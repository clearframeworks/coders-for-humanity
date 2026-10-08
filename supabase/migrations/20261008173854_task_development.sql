begin;

alter table public.tasks add column reviewer_id uuid references public.profiles;
create index tasks_reviewer on public.tasks(reviewer_id);

-- Handoffs remain visible with their task, even after its assignment changes.
create table public.task_handoffs (
 id uuid primary key default gen_random_uuid(),
 task_id uuid not null references public.tasks on delete cascade,
 author_id uuid not null references public.profiles,
 body text not null check(length(trim(body)) between 20 and 5000),
 created_at timestamptz not null default now()
);
create index task_handoffs_task on public.task_handoffs(task_id,created_at);
create index task_handoffs_author on public.task_handoffs(author_id);
alter table public.task_handoffs enable row level security;
revoke all on public.task_handoffs from public,anon,authenticated;
grant select on public.task_handoffs to anon,authenticated;
create policy visible_task_handoffs on public.task_handoffs for select to anon,authenticated
 using(exists(select 1 from public.tasks t where t.id=task_id));

create function private.create_task_brief(payload jsonb) returns uuid
 language plpgsql security definer set search_path='' as $$
declare project_input uuid; reviewer_input uuid; new_id uuid; dependency_input uuid;
 field text; reviewer_name text; dependencies_text text;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 project_input=(payload->>'project_id')::uuid;
 reviewer_input=(payload->>'reviewer_id')::uuid;
 -- Lock the project while checking publication and authority.
 perform 1 from public.projects where id=project_input and published and not is_demo and status<>'ARCHIVED' for update;
 if not found or not exists(select 1 from public.project_maintainers where project_id=project_input and user_id=auth.uid()) then
   raise exception 'Project maintainer required';
 end if;
 select p.name into reviewer_name from public.project_maintainers m join public.profiles p on p.id=m.user_id
 where m.project_id=project_input and m.user_id=reviewer_input and p.is_public;
 if not found then raise exception 'Choose a public project maintainer as reviewer'; end if;
 if payload->>'title' is null or length(trim(payload->>'title')) not between 8 and 180 then raise exception 'Invalid title'; end if;
 if payload->>'technology' is null or length(trim(payload->>'technology')) not between 1 and 200 then raise exception 'Invalid technology'; end if;
 foreach field in array array['objective','context','acceptance'] loop
   if payload->>field is null or length(trim(payload->>field)) not between 20 and (case when field='objective' then 5000 else 10000 end) then raise exception 'Complete the work brief'; end if;
 end loop;
 if payload->>'discipline' is null or payload->>'discipline' not in ('Frontend','Backend','Full Stack','DevOps','Security','Data','AI/ML','UX/UI','Accessibility','Documentation','Testing','Research','Translation','Legal/Policy','Domain Expertise','Project Management','Field Testing') then raise exception 'Invalid discipline'; end if;
 if jsonb_typeof(payload->'dependency_ids') is distinct from 'array' then raise exception 'Invalid dependencies'; end if;
 if jsonb_array_length(payload->'dependency_ids')>20 then raise exception 'Too many dependencies'; end if;
 for dependency_input in select value::uuid from jsonb_array_elements_text(payload->'dependency_ids') loop
   perform 1 from public.tasks where id=dependency_input and project_id=project_input and not is_demo for share;
   if not found then raise exception 'Dependencies must belong to this project'; end if;
 end loop;
 perform private.consume_limit('task_create',20);
 select string_agg(t.title,'; ' order by t.title) into dependencies_text from public.tasks t
 where t.id in (select value::uuid from jsonb_array_elements_text(payload->'dependency_ids'));
 insert into public.tasks(project_id,title,discipline,level,effort,technology,objective,context,acceptance,dependencies,reviewer,reviewer_id)
 values(project_input,trim(payload->>'title'),payload->>'discipline',payload->>'level',payload->>'effort',trim(payload->>'technology'),trim(payload->>'objective'),trim(payload->>'context'),trim(payload->>'acceptance'),coalesce(dependencies_text,'No dependencies'),reviewer_name,reviewer_input)
 returning id into new_id;
 insert into public.task_dependencies(task_id,depends_on)
 select distinct new_id,value::uuid from jsonb_array_elements_text(payload->'dependency_ids');
 insert into private.audit_log(actor_id,event,record_id) values(auth.uid(),'task.created',new_id::text);
 return new_id;
end $$;
create function public.create_task_brief(payload jsonb) returns uuid language sql security invoker set search_path='' as $$select private.create_task_brief(payload)$$;
revoke all on function private.create_task_brief(jsonb),public.create_task_brief(jsonb) from public,anon;
grant execute on function private.create_task_brief(jsonb),public.create_task_brief(jsonb) to authenticated;

create function private.release_task_claim(task_input uuid,handoff_input text) returns void
 language plpgsql security definer set search_path='' as $$
declare current_task public.tasks;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 select * into current_task from public.tasks where id=task_input for update;
 if not found or current_task.is_demo or current_task.status not in ('CLAIMED','IN PROGRESS','BLOCKED') then raise exception 'Task cannot be released in this state'; end if;
 if not exists(select 1 from public.task_assignments where task_id=task_input and user_id=auth.uid()) then raise exception 'Only the assigned contributor can release this claim'; end if;
 if handoff_input is null or length(trim(handoff_input)) not between 20 and 5000 then raise exception 'Leave a useful handoff'; end if;
 perform private.consume_limit('task_release',30);
 insert into public.task_handoffs(task_id,author_id,body) values(task_input,auth.uid(),trim(handoff_input));
 delete from public.task_assignments where task_id=task_input and user_id=auth.uid();
 update public.tasks set status='OPEN',assignee='Unassigned',submission_evidence=null,submission_version=submission_version+1 where id=task_input;
 insert into private.audit_log(actor_id,event,record_id) values(auth.uid(),'task.claim_released',task_input::text);
end $$;
create function public.release_task_claim(task_input uuid,handoff_input text) returns void language sql security invoker set search_path='' as $$select private.release_task_claim(task_input,handoff_input)$$;
revoke all on function private.release_task_claim(uuid,text),public.release_task_claim(uuid,text) from public,anon;
grant execute on function private.release_task_claim(uuid,text),public.release_task_claim(uuid,text) to authenticated;

-- Existing profiles can claim work; profile privacy does not grant extra authority.
-- Archive status must be checked when claiming as well as when submitting work.
create or replace function private.claim_task(task_id_input uuid) returns void language plpgsql security definer set search_path='' as $$
declare current_task public.tasks; begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid()) then raise exception 'A signed-in contributor profile is required'; end if;
 perform private.consume_limit('claim',15);
 select t.* into current_task from public.tasks t join public.projects p on p.id=t.project_id where t.id=task_id_input and p.published and p.status<>'ARCHIVED' and not p.is_demo and not t.is_demo for update of t;
 if not found or current_task.status<>'OPEN' then raise exception 'This task is not available'; end if;
 if exists(select 1 from public.task_dependencies d join public.tasks t on t.id=d.depends_on where d.task_id=task_id_input and t.status<>'COMPLETE') then raise exception 'Dependencies are not complete'; end if;
 insert into public.task_assignments(task_id,user_id) values(task_id_input,auth.uid());
 update public.tasks set status='CLAIMED',assignee='Assigned contributor' where id=task_id_input;
 insert into private.audit_log(actor_id,event,record_id) values(auth.uid(),'task.claimed',task_id_input::text);
end $$;
commit;
