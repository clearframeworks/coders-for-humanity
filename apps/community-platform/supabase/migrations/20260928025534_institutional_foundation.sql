-- Apply to a new, dedicated Supabase project. Never to another application's database.
begin;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.licenses (id text primary key, name text not null, artifact_type text not null, url text not null check(url ~ '^https://'));
insert into public.licenses values ('MIT','MIT License','software','https://opensource.org/license/mit');
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 username text unique not null check(username ~ '^[a-z0-9][a-z0-9-]{2,39}$'),
 name text not null check(length(name) between 1 and 100), bio text not null default '' check(length(bio)<=2000),
 location text not null default '' check(length(location)<=100), availability text not null default '' check(length(availability)<=100),
 github_url text check(github_url is null or github_url ~ '^https://github.com/[A-Za-z0-9-]+/?$'),
 website_url text check(website_url is null or website_url ~ '^https://'),
 is_public boolean not null default false, is_demo boolean not null default false,
 created_at timestamptz not null default now()
);
create table public.skills(id text primary key,name text unique not null,kind text not null check(kind in ('discipline','technology','interest')));
create table public.user_skills(user_id uuid references public.profiles on delete cascade,skill_id text references public.skills on delete cascade,primary key(user_id,skill_id));
create table public.programs(id text primary key,slug text unique not null,name text unique not null,description text not null,icon text not null default 'Globe2');
create table public.problems(id uuid primary key default gen_random_uuid(),slug text unique not null,title text not null,program_id text references public.programs,description text not null,evidence text not null,affected text not null,geography text not null,interventions text not null,questions text not null,is_demo boolean not null default false,published boolean not null default false);
create table public.projects(id uuid primary key default gen_random_uuid(),slug text unique not null,name text not null,program_id text not null references public.programs,problem_id uuid references public.problems,summary text not null,problem text not null,objective text not null,status text not null default 'PROPOSAL' check(status in ('PROPOSAL','RESEARCH','DESIGN','BUILDING','VERIFICATION','PILOT','MEASUREMENT','DEPLOYED','MAINTENANCE','ARCHIVED')),license text not null references public.licenses default 'MIT',architecture text not null default '',evidence text not null default '',is_demo boolean not null default false,published boolean not null default false,created_at timestamptz not null default now());
create table public.project_members(id uuid primary key default gen_random_uuid(),project_id uuid not null references public.projects on delete cascade,user_id uuid not null references public.profiles on delete cascade,role text not null default 'Contributor',unique(project_id,user_id));
create table public.project_maintainers(id uuid primary key default gen_random_uuid(),project_id uuid not null references public.projects on delete cascade,user_id uuid not null references public.profiles on delete cascade,role text not null default 'Project Maintainer',unique(project_id,user_id));
create table public.project_repositories(id uuid primary key default gen_random_uuid(),project_id uuid not null references public.projects on delete cascade,name text not null,url text not null check(url ~ '^https://github.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/?$'),github_repository_id bigint unique,last_synced_at timestamptz);
create table public.project_milestones(id uuid primary key default gen_random_uuid(),project_id uuid not null references public.projects on delete cascade,title text not null,status text not null default 'PLANNED',due_at date);
create table public.project_deployments(id uuid primary key default gen_random_uuid(),project_id uuid not null references public.projects on delete cascade,name text not null,url text not null check(url ~ '^https://'),status text not null,verified_at timestamptz);
create table public.project_metrics(id uuid primary key default gen_random_uuid(),project_id uuid not null references public.projects on delete cascade,name text not null,unit text not null,methodology text not null);
create table public.impact_records(id uuid primary key default gen_random_uuid(),metric_id uuid not null references public.project_metrics on delete cascade,value numeric not null,source_url text not null check(source_url ~ '^https://'),measured_at date not null,limitations text not null,verified boolean not null default false);
create table public.tasks(id uuid primary key default gen_random_uuid(),project_id uuid not null references public.projects on delete cascade,title text not null,discipline text not null,level text not null check(level in ('First Contribution','Beginner','Intermediate','Advanced','Specialist')),effort text not null check(effort in ('< 1 hour','1–3 hours','3–8 hours','Multi-day','Ongoing')),technology text not null,objective text not null,context text not null,acceptance text not null,dependencies text not null default 'No dependencies',reviewer text not null default 'Reviewer not yet appointed',assignee text not null default 'Unassigned',issue_url text check(issue_url is null or issue_url ~ '^https://github.com/'),status text not null default 'OPEN' check(status in ('OPEN','CLAIMED','IN PROGRESS','REVIEW','BLOCKED','COMPLETE')),is_demo boolean not null default false,created_at timestamptz not null default now());
create table public.task_skills(task_id uuid references public.tasks on delete cascade,skill_id text references public.skills on delete cascade,primary key(task_id,skill_id));
create table public.task_assignments(task_id uuid primary key references public.tasks on delete cascade,user_id uuid not null references public.profiles on delete cascade,claimed_at timestamptz not null default now());
create table public.task_dependencies(task_id uuid references public.tasks on delete cascade,depends_on uuid references public.tasks,primary key(task_id,depends_on),check(task_id<>depends_on));
create table public.proposals(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles on delete cascade,title text not null check(length(title) between 8 and 180),problem text not null,evidence text not null,existing_solutions text not null,people_affected text not null,intervention text not null,technology_rationale text not null,risks text not null,expertise text not null,deployment text not null,measurement text not null,status text not null default 'SUBMITTED' check(status in ('DRAFT','SUBMITTED','RESEARCH REVIEW','NEEDS INFORMATION','ACCEPTED','DECLINED','MERGED WITH EXISTING PROJECT')),merged_project_id uuid references public.projects,created_at timestamptz not null default now());
create unique index proposals_user_title on public.proposals(user_id,lower(title));
create table public.proposal_sources(id uuid primary key default gen_random_uuid(),proposal_id uuid not null references public.proposals on delete cascade,url text not null check(url ~ '^https://'),title text not null);
create table public.research_sources(id uuid primary key default gen_random_uuid(),project_id uuid references public.projects on delete cascade,problem_id uuid references public.problems on delete cascade,title text not null,url text not null check(url ~ '^https://'),retrieved_at date,check(num_nonnulls(project_id,problem_id)=1));
create table public.decisions(id uuid primary key default gen_random_uuid(),project_id uuid references public.projects,title text not null,status text not null default 'PROPOSED',context text not null,decision text not null,consequences text not null,decided_at date,is_demo boolean not null default false,published boolean not null default false);
create table public.comments(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles,project_id uuid not null references public.projects,body text not null check(length(body) between 1 and 5000),published boolean not null default false,created_at timestamptz not null default now());
create table public.reviews(id uuid primary key default gen_random_uuid(),reviewer_id uuid not null references public.profiles,task_id uuid not null references public.tasks,body text not null,outcome text not null check(outcome in ('CHANGES REQUESTED','APPROVED')),created_at timestamptz not null default now());
create table public.organizations(id uuid primary key default gen_random_uuid(),name text not null,website_url text check(website_url is null or website_url ~ '^https://'));
create table public.partners(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations,description text not null,published boolean not null default false);
create table public.sponsors(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations,description text not null,published boolean not null default false);
create table public.funding_records(id uuid primary key default gen_random_uuid(),project_id uuid references public.projects,sponsor_id uuid references public.sponsors,source_name text not null,amount numeric(14,2) not null check(amount>=0),currency text not null check(currency ~ '^[A-Z]{3}$'),received_at date not null,source_url text not null check(source_url ~ '^https://'),published boolean not null default false);
create table public.expense_records(id uuid primary key default gen_random_uuid(),project_id uuid references public.projects,description text not null,amount numeric(14,2) not null check(amount>=0),currency text not null check(currency ~ '^[A-Z]{3}$'),incurred_at date not null,source_url text not null check(source_url ~ '^https://'),published boolean not null default false);
create table public.notifications(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles on delete cascade,message text not null,read_at timestamptz,created_at timestamptz not null default now());
create table private.institutional_roles(user_id uuid not null references public.profiles on delete cascade,role text not null check(role in ('Board','Institutional Maintainer','Program Steward','Reviewer','Domain Advisor')),primary key(user_id,role));
create table private.audit_log(id bigint generated always as identity primary key,actor_id uuid,event text not null,record_id text,created_at timestamptz not null default now());
create table private.rate_limits(user_id uuid not null references auth.users on delete cascade,action text not null,window_start timestamptz not null,count integer not null,primary key(user_id,action,window_start));

-- Index every foreign key used by joins or policies.
do $$ declare r record; begin
 for r in select tc.table_schema,tc.table_name,kcu.column_name from information_schema.table_constraints tc join information_schema.key_column_usage kcu using(constraint_catalog,constraint_schema,constraint_name) where tc.constraint_type='FOREIGN KEY' and tc.table_schema in ('public','private') loop
 execute format('create index if not exists %I on %I.%I (%I)',r.table_name||'_'||r.column_name||'_idx',r.table_schema,r.table_name,r.column_name);
 end loop;
end $$;
create index tasks_open_filter on public.tasks(discipline,level,effort) where status='OPEN';
create index projects_program_status on public.projects(program_id,status);
create index projects_search on public.projects using gin(to_tsvector('english',name||' '||summary));
create index tasks_search on public.tasks using gin(to_tsvector('english',title||' '||objective));

-- Tables are denied by default. Public reads expose only published, public records.
do $$ declare t text; begin
 for t in select tablename from pg_tables where schemaname='public' loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant select on public.%I to anon, authenticated',t);
 end loop;
 for t in select tablename from pg_tables where schemaname='private' loop execute format('alter table private.%I enable row level security',t); end loop;
end $$;
create policy public_programs on public.programs for select using(true);
create policy public_licenses on public.licenses for select using(true);
create policy public_skills on public.skills for select using(true);
create policy public_profiles on public.profiles for select using(is_public or id=(select auth.uid()));
create policy public_user_skills on public.user_skills for select using(exists(select 1 from public.profiles p where p.id=user_id));
create policy public_problems on public.problems for select using(published);
create policy public_projects on public.projects for select using(published);
create policy public_decisions on public.decisions for select using(published);
do $$ declare t text; begin
 foreach t in array array['tasks','project_members','project_maintainers','project_repositories','project_milestones','project_deployments','project_metrics'] loop
 execute format('create policy public_project_record on public.%I for select using (exists(select 1 from public.projects p where p.id=project_id and p.published))',t);
 end loop;
 foreach t in array array['task_skills','task_dependencies','task_assignments','reviews'] loop
 execute format('create policy public_task_record on public.%I for select using (exists(select 1 from public.tasks t where t.id=task_id))',t);
 end loop;
 foreach t in array array['partners','sponsors','funding_records','expense_records'] loop
 execute format('create policy public_published on public.%I for select using(published)',t);
 end loop;
end $$;
create policy public_orgs on public.organizations for select using(exists(select 1 from public.partners where organization_id=organizations.id and published) or exists(select 1 from public.sponsors where organization_id=organizations.id and published));
create policy public_sources on public.research_sources for select using(exists(select 1 from public.projects where id=project_id) or exists(select 1 from public.problems where id=problem_id));
create policy public_impact on public.impact_records for select using(verified and exists(select 1 from public.project_metrics where id=metric_id));
create policy own_proposals on public.proposals for select to authenticated using(user_id=(select auth.uid()));
create policy own_proposal_sources on public.proposal_sources for select to authenticated using(exists(select 1 from public.proposals where id=proposal_id and user_id=(select auth.uid())));
create policy public_comments on public.comments for select using((published and exists(select 1 from public.projects where id=project_id)) or user_id=(select auth.uid()));
create policy own_notifications on public.notifications for select to authenticated using(user_id=(select auth.uid()));
grant insert(id,username,name,bio,location,availability,github_url,website_url,is_public), update(username,name,bio,location,availability,github_url,website_url,is_public) on public.profiles to authenticated;
create policy profile_insert on public.profiles for insert to authenticated with check(id=(select auth.uid()) and not is_demo);
create policy profile_update on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));

-- Privileged functions live in a non-exposed schema with explicit authorization.
create function private.consume_limit(action_name text,max_requests integer) returns void language plpgsql security definer set search_path='' as $$
declare current_count integer; begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 insert into private.rate_limits(user_id,action,window_start,count) values(auth.uid(),action_name,date_trunc('hour',now()),1)
 on conflict(user_id,action,window_start) do update set count=private.rate_limits.count+1 returning count into current_count;
 if current_count>max_requests then raise exception 'Rate limit reached. Please try again later.'; end if;
end $$;
revoke all on function private.consume_limit(text,integer) from public,anon,authenticated;
create function private.claim_task(task_id_input uuid) returns void language plpgsql security definer set search_path='' as $$
declare current_task public.tasks; begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid()) then raise exception 'A signed-in contributor profile is required'; end if;
 perform private.consume_limit('claim',15);
 select t.* into current_task from public.tasks t join public.projects p on p.id=t.project_id where t.id=task_id_input and p.published and not p.is_demo and not t.is_demo for update of t;
 if not found or current_task.status<>'OPEN' then raise exception 'This task is not available'; end if;
 if exists(select 1 from public.task_dependencies d join public.tasks t on t.id=d.depends_on where d.task_id=task_id_input and t.status<>'COMPLETE') then raise exception 'Dependencies are not complete'; end if;
 insert into public.task_assignments(task_id,user_id) values(task_id_input,auth.uid());
 update public.tasks set status='CLAIMED',assignee='Assigned contributor' where id=task_id_input;
 insert into private.audit_log(actor_id,event,record_id) values(auth.uid(),'task.claimed',task_id_input::text);
end $$;
create function public.claim_task(task_id_input uuid) returns void language sql security invoker set search_path='' as $$select private.claim_task(task_id_input)$$;
revoke all on function private.claim_task(uuid),public.claim_task(uuid) from public,anon;
grant execute on function private.claim_task(uuid),public.claim_task(uuid) to authenticated;

create function private.submit_proposal(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare new_id uuid; field text; source text; begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid()) then raise exception 'Create your contributor profile first'; end if;
 perform private.consume_limit('proposal',5);
 if length(trim(payload->>'title')) not between 8 and 180 or payload->>'title' is null then raise exception 'Invalid title'; end if;
 foreach field in array array['problem','evidence','existing_solutions','people_affected','intervention','technology_rationale','risks','expertise','deployment','measurement'] loop
 if payload->>field is null or length(trim(payload->>field)) not between 40 and 10000 then raise exception 'Complete every proposal section (40–10,000 characters)'; end if;
 end loop;
 if jsonb_typeof(payload->'sources') is distinct from 'array' then raise exception 'Sources are required'; end if;
 if jsonb_array_length(payload->'sources') not between 1 and 20 then raise exception 'Provide 1–20 sources'; end if;
 if exists(select 1 from public.projects where lower(name)=lower(trim(payload->>'title'))) then raise exception 'A project with this name already exists. Contribute to the existing work.'; end if;
 insert into public.proposals(user_id,title,problem,evidence,existing_solutions,people_affected,intervention,technology_rationale,risks,expertise,deployment,measurement) values(auth.uid(),trim(payload->>'title'),payload->>'problem',payload->>'evidence',payload->>'existing_solutions',payload->>'people_affected',payload->>'intervention',payload->>'technology_rationale',payload->>'risks',payload->>'expertise',payload->>'deployment',payload->>'measurement') returning id into new_id;
 for source in select jsonb_array_elements_text(payload->'sources') loop
 if source !~ '^https://' or length(source)>2000 then raise exception 'Sources must use HTTPS'; end if;
 insert into public.proposal_sources(proposal_id,url,title) values(new_id,source,source);
 end loop;
 insert into private.audit_log(actor_id,event,record_id) values(auth.uid(),'proposal.submitted',new_id::text);
 return new_id;
end $$;
create function public.submit_proposal(payload jsonb) returns uuid language sql security invoker set search_path='' as $$select private.submit_proposal(payload)$$;
revoke all on function private.submit_proposal(jsonb),public.submit_proposal(jsonb) from public,anon;
grant execute on function private.submit_proposal(jsonb),public.submit_proposal(jsonb) to authenticated;

-- Read-only taxonomy; no fake projects, people, finance, or outcomes in production.
insert into public.programs(id,slug,name,description,icon) values
('food','food','Food','More resilient, equitable food systems.','Sprout'),
('housing','housing','Housing','Tools for stable shelter and dignified housing.','House'),
('accessibility','accessibility','Accessibility','Participation without unnecessary barriers.','Accessibility'),
('disaster-response','disaster-response','Disaster Response','Shared infrastructure when every hour matters.','Radio'),
('education','education','Education','Open pathways to learning and knowledge.','BookOpen'),
('environment','environment','Environment','Technology in service of a living planet.','Leaf'),
('health','health','Health','Public tools for healthier communities.','HeartPulse'),
('civic-infrastructure','civic-infrastructure','Civic Infrastructure','Accountable, accessible public systems.','Landmark'),
('humanitarian-logistics','humanitarian-logistics','Humanitarian Logistics','Get essential resources where they are needed.','Route'),
('open-science','open-science','Open Science','Research that everyone can build upon.','FlaskConical');
commit;
