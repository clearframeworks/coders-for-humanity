begin;
create table public.community_posts (
 id uuid primary key default gen_random_uuid(),
 author_id uuid not null references public.profiles(id),
 project_id uuid references public.projects(id),
 parent_id uuid references public.community_posts(id),
 kind text not null check(kind in ('discussion','question','update')),
 title text not null default '' check(length(title)<=160),
 body text not null check(length(trim(body)) between 1 and 12000),
 hidden boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(parent_id is not null or length(trim(title))>=4)
);
create index community_posts_feed on public.community_posts(created_at desc) where parent_id is null and not hidden;
create index community_posts_author on public.community_posts(author_id);
create index community_posts_project on public.community_posts(project_id,created_at desc);
create index community_posts_parent on public.community_posts(parent_id,created_at);
create table public.saved_posts(user_id uuid not null references public.profiles on delete cascade,post_id uuid not null references public.community_posts on delete cascade,created_at timestamptz not null default now(),primary key(user_id,post_id));
create index saved_posts_post on public.saved_posts(post_id);
alter table public.community_posts enable row level security;
alter table public.saved_posts enable row level security;
revoke all on public.community_posts,public.saved_posts from anon,authenticated;
grant select on public.community_posts to anon,authenticated;
grant select on public.saved_posts to authenticated;
revoke insert,update,delete on public.community_posts,public.saved_posts from anon,authenticated;
-- This narrowly scoped helper answers only whether a root thread is public.
-- It avoids a recursive RLS self-join and never exposes thread contents.
create function private.public_thread_visible(thread_input uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.community_posts c where c.id=thread_input and c.parent_id is null and not c.hidden and (c.project_id is null or exists(select 1 from public.projects p where p.id=c.project_id and p.published)))
$$;
revoke all on function private.public_thread_visible(uuid) from public;
grant usage on schema private to anon;
grant execute on function private.public_thread_visible(uuid) to anon,authenticated;
create policy published_posts on public.community_posts for select to anon,authenticated using(not hidden and (parent_id is null or private.public_thread_visible(parent_id)) and (project_id is null or exists(select 1 from public.projects p where p.id=project_id and p.published)));
create policy own_saved_posts on public.saved_posts for select to authenticated using(user_id=(select auth.uid()));

create function private.publish_post(title_input text,body_input text,kind_input text,project_input uuid default null,parent_input uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare new_id uuid; parent public.community_posts; begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and is_public) then raise exception 'Create a public contributor profile before posting'; end if;
 perform private.consume_limit('community_post',20);
 if length(trim(body_input)) not between 1 and 12000 or body_input is null or kind_input not in ('discussion','question','update') or kind_input is null then raise exception 'Invalid post'; end if;
 if parent_input is not null then
 select * into parent from public.community_posts where id=parent_input and not hidden and parent_id is null;
 if not found then raise exception 'Thread unavailable'; end if;
 project_input=parent.project_id;
 else
 if title_input is null or length(trim(title_input)) not between 4 and 160 then raise exception 'A title of 4–160 characters is required'; end if;
 end if;
 if project_input is not null and not exists(select 1 from public.projects where id=project_input and published and not is_demo) then raise exception 'Project unavailable'; end if;
 insert into public.community_posts(author_id,project_id,parent_id,kind,title,body) values(auth.uid(),project_input,parent_input,kind_input,coalesce(trim(title_input),''),trim(body_input)) returning id into new_id;
 if parent_input is not null and parent.author_id<>auth.uid() then insert into public.notifications(user_id,message) values(parent.author_id,'New reply in discussion '||parent.id::text); end if;
 insert into private.audit_log(actor_id,event,record_id) values(auth.uid(),'community.posted',new_id::text);
 return new_id;
end $$;
create function public.publish_post(title_input text,body_input text,kind_input text,project_input uuid default null,parent_input uuid default null) returns uuid language sql security invoker set search_path='' as $$select private.publish_post(title_input,body_input,kind_input,project_input,parent_input)$$;
revoke all on function private.publish_post(text,text,text,uuid,uuid),public.publish_post(text,text,text,uuid,uuid) from public,anon;
grant execute on function private.publish_post(text,text,text,uuid,uuid),public.publish_post(text,text,text,uuid,uuid) to authenticated;

create function private.save_post(post_input uuid,saved_input boolean) returns void language plpgsql security definer set search_path='' as $$begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid()) then raise exception 'Sign in and create a profile'; end if;
 perform private.consume_limit('save_post',120);
 if saved_input is null then raise exception 'Invalid save state'; end if;
 if saved_input and not exists(select 1 from public.community_posts c where c.id=post_input and not c.hidden and (c.parent_id is null or private.public_thread_visible(c.parent_id)) and (c.project_id is null or exists(select 1 from public.projects p where p.id=c.project_id and p.published))) then raise exception 'Post unavailable'; end if;
 if saved_input then insert into public.saved_posts(user_id,post_id) values(auth.uid(),post_input) on conflict do nothing; else delete from public.saved_posts where user_id=auth.uid() and post_id=post_input; end if;
end $$;
create function public.save_post(post_input uuid,saved_input boolean) returns void language sql security invoker set search_path='' as $$select private.save_post(post_input,saved_input)$$;
revoke all on function private.save_post(uuid,boolean),public.save_post(uuid,boolean) from public,anon;
grant execute on function private.save_post(uuid,boolean),public.save_post(uuid,boolean) to authenticated;

create function private.join_project(project_input uuid) returns void language plpgsql security definer set search_path='' as $$begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and is_public) then raise exception 'Create a public contributor profile first'; end if;
 perform private.consume_limit('join_project',30);
 if not exists(select 1 from public.projects where id=project_input and published and not is_demo and status<>'ARCHIVED') then raise exception 'Project unavailable'; end if;
 insert into public.project_members(project_id,user_id,role) values(project_input,auth.uid(),'Contributor') on conflict(project_id,user_id) do nothing;
 if found then insert into private.audit_log(actor_id,event,record_id) values(auth.uid(),'project.joined',project_input::text); end if;
end $$;
create function public.join_project(project_input uuid) returns void language sql security invoker set search_path='' as $$select private.join_project(project_input)$$;
revoke all on function private.join_project(uuid),public.join_project(uuid) from public,anon;
grant execute on function private.join_project(uuid),public.join_project(uuid) to authenticated;

alter table public.tasks add column submission_version integer not null default 0 check(submission_version>=0), add column submission_evidence text;
alter table public.reviews add column submission_version integer not null default 0;
create function private.update_work(task_input uuid,status_input text,evidence_input text default null,version_input integer default null) returns void language plpgsql security definer set search_path='' as $$
declare task public.tasks; maintainer boolean; assignee boolean; begin
 if auth.uid() is null then raise exception 'Sign in to update work'; end if;
 perform private.consume_limit('work_update',60);
 select t.* into task from public.tasks t join public.projects p on p.id=t.project_id where t.id=task_input and not t.is_demo and p.published and not p.is_demo and p.status<>'ARCHIVED' for update of t;
 if not found then raise exception 'Task unavailable'; end if;
 maintainer=exists(select 1 from public.project_maintainers where project_id=task.project_id and user_id=auth.uid());
 assignee=exists(select 1 from public.task_assignments where task_id=task_input and user_id=auth.uid());
 if not maintainer and not assignee then raise exception 'You cannot update this task'; end if;
 if status_input is null or status_input not in ('IN PROGRESS','REVIEW','BLOCKED','COMPLETE') then raise exception 'Invalid status'; end if;
 if status_input='COMPLETE' then
   if version_input is distinct from task.submission_version then raise exception 'Submission changed; reload before accepting'; end if;
   if task.status<>'REVIEW' or not maintainer or assignee then raise exception 'An independent maintainer must accept reviewed work'; end if;
   if not exists(select 1 from public.reviews where task_id=task_input and reviewer_id=auth.uid() and outcome='APPROVED' and submission_version=task.submission_version) then raise exception 'Approve the current submission before completion'; end if;
 else
   if not assignee or not ((task.status='CLAIMED' and status_input in ('IN PROGRESS','BLOCKED')) or (task.status='IN PROGRESS' and status_input in ('REVIEW','BLOCKED')) or (task.status='BLOCKED' and status_input='IN PROGRESS')) then raise exception 'This transition requires the assignee and an eligible task state'; end if;
 end if;
 if status_input='REVIEW' then
   if evidence_input is null or length(evidence_input)>2000 or evidence_input !~ '^https://[^[:space:]]+$' then raise exception 'An HTTPS evidence link is required for review'; end if;
   update public.tasks set status=status_input,submission_version=submission_version+1,submission_evidence=evidence_input where id=task_input;
 else
   update public.tasks set status=status_input where id=task_input;
 end if;
 insert into private.audit_log(actor_id,event,record_id) values(auth.uid(),'task.status.'||status_input,task_input::text);
end $$;
create function public.update_work(task_input uuid,status_input text,evidence_input text default null,version_input integer default null) returns void language sql security invoker set search_path='' as $$select private.update_work(task_input,status_input,evidence_input,version_input)$$;
revoke all on function private.update_work(uuid,text,text,integer),public.update_work(uuid,text,text,integer) from public,anon;
grant execute on function private.update_work(uuid,text,text,integer),public.update_work(uuid,text,text,integer) to authenticated;

create function private.review_work(task_input uuid,outcome_input text,body_input text,version_input integer) returns void language plpgsql security definer set search_path='' as $$
declare task public.tasks; begin
 if auth.uid() is null then raise exception 'Sign in to review work'; end if;
 select t.* into task from public.tasks t join public.projects p on p.id=t.project_id where t.id=task_input and not t.is_demo and p.published and not p.is_demo and p.status<>'ARCHIVED' for update of t;
 if not found or task.status<>'REVIEW' then raise exception 'Task is not awaiting review'; end if;
 if version_input is distinct from task.submission_version then raise exception 'Submission changed; reload before reviewing'; end if;
 if not exists(select 1 from public.project_maintainers where project_id=task.project_id and user_id=auth.uid()) or exists(select 1 from public.task_assignments where task_id=task_input and user_id=auth.uid()) then raise exception 'Independent maintainer review required'; end if;
 if outcome_input is null or outcome_input not in ('APPROVED','CHANGES REQUESTED') or body_input is null or length(trim(body_input)) not between 20 and 5000 then raise exception 'Provide a review outcome and 20–5000 characters of evidence'; end if;
 perform private.consume_limit('review',30);
 insert into public.reviews(reviewer_id,task_id,body,outcome,submission_version) values(auth.uid(),task_input,trim(body_input),outcome_input,task.submission_version);
 if outcome_input='CHANGES REQUESTED' then update public.tasks set status='IN PROGRESS' where id=task_input; end if;
 insert into private.audit_log(actor_id,event,record_id) values(auth.uid(),'task.review.'||outcome_input,task_input::text);
end $$;
create function public.review_work(task_input uuid,outcome_input text,body_input text,version_input integer) returns void language sql security invoker set search_path='' as $$select private.review_work(task_input,outcome_input,body_input,version_input)$$;
revoke all on function private.review_work(uuid,text,text,integer),public.review_work(uuid,text,text,integer) from public,anon;
grant execute on function private.review_work(uuid,text,text,integer),public.review_work(uuid,text,text,integer) to authenticated;

create function private.read_notifications() returns void language plpgsql security definer set search_path='' as $$begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 update public.notifications set read_at=now() where user_id=auth.uid() and read_at is null;
end $$;
create function public.read_notifications() returns void language sql security invoker set search_path='' as $$select private.read_notifications()$$;
revoke all on function private.read_notifications(),public.read_notifications() from public,anon;
grant execute on function private.read_notifications(),public.read_notifications() to authenticated;

-- The platform itself is real work, backed by its dedicated repository.
insert into public.projects(id,slug,name,program_id,summary,problem,objective,status,license,architecture,evidence,published)
values('cf000000-0000-4000-8000-000000000001','community-platform','Community platform','civic-infrastructure','The community and shared workspace behind Coders for Humanity.','Contributors need one place to find people, discuss problems, and coordinate work across open-source projects.','Build and operate the CFH community, project workspaces, and shared GitHub integration.','BUILDING','MIT','Next.js and TypeScript application, PostgreSQL community data, and a dedicated public GitHub repository.','The platform is in active development in the clearframeworks/coders-for-humanity repository.',true);
insert into public.project_repositories(project_id,name,url) values('cf000000-0000-4000-8000-000000000001','coders-for-humanity','https://github.com/clearframeworks/coders-for-humanity');
commit;
