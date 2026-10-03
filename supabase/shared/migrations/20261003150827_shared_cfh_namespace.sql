-- CFH only. Apply this bundle, not the dedicated-project migrations, to retehost-cfw.
begin;
create schema cfh;
revoke all on schema cfh from public;
grant usage on schema cfh to anon, authenticated;

create schema if not exists cfh_private;
revoke all on schema cfh_private from public;
grant usage on schema cfh_private to authenticated;

create table cfh.licenses (id text primary key, name text not null, artifact_type text not null, url text not null check(url ~ '^https://'));
insert into cfh.licenses values ('MIT','MIT License','software','https://opensource.org/license/mit');
create table cfh.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 username text unique not null check(username ~ '^[a-z0-9][a-z0-9-]{2,39}$'),
 name text not null check(length(name) between 1 and 100), bio text not null default '' check(length(bio)<=2000),
 location text not null default '' check(length(location)<=100), availability text not null default '' check(length(availability)<=100),
 github_url text check(github_url is null or github_url ~ '^https://github.com/[A-Za-z0-9-]+/?$'),
 website_url text check(website_url is null or website_url ~ '^https://'),
 is_public boolean not null default false, is_demo boolean not null default false,
 created_at timestamptz not null default now()
);
create table cfh.skills(id text primary key,name text unique not null,kind text not null check(kind in ('discipline','technology','interest')));
create table cfh.user_skills(user_id uuid references cfh.profiles on delete cascade,skill_id text references cfh.skills on delete cascade,primary key(user_id,skill_id));
create table cfh.programs(id text primary key,slug text unique not null,name text unique not null,description text not null,icon text not null default 'Globe2');
create table cfh.problems(id uuid primary key default gen_random_uuid(),slug text unique not null,title text not null,program_id text references cfh.programs,description text not null,evidence text not null,affected text not null,geography text not null,interventions text not null,questions text not null,is_demo boolean not null default false,published boolean not null default false);
create table cfh.projects(id uuid primary key default gen_random_uuid(),slug text unique not null,name text not null,program_id text not null references cfh.programs,problem_id uuid references cfh.problems,summary text not null,problem text not null,objective text not null,status text not null default 'PROPOSAL' check(status in ('PROPOSAL','RESEARCH','DESIGN','BUILDING','VERIFICATION','PILOT','MEASUREMENT','DEPLOYED','MAINTENANCE','ARCHIVED')),license text not null references cfh.licenses default 'MIT',architecture text not null default '',evidence text not null default '',is_demo boolean not null default false,published boolean not null default false,created_at timestamptz not null default now());
create table cfh.project_members(id uuid primary key default gen_random_uuid(),project_id uuid not null references cfh.projects on delete cascade,user_id uuid not null references cfh.profiles on delete cascade,role text not null default 'Contributor',unique(project_id,user_id));
create table cfh.project_maintainers(id uuid primary key default gen_random_uuid(),project_id uuid not null references cfh.projects on delete cascade,user_id uuid not null references cfh.profiles on delete cascade,role text not null default 'Project Maintainer',unique(project_id,user_id));
create table cfh.project_repositories(id uuid primary key default gen_random_uuid(),project_id uuid not null references cfh.projects on delete cascade,name text not null,url text not null check(url ~ '^https://github.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/?$'),github_repository_id bigint unique,last_synced_at timestamptz);
create table cfh.project_milestones(id uuid primary key default gen_random_uuid(),project_id uuid not null references cfh.projects on delete cascade,title text not null,status text not null default 'PLANNED',due_at date);
create table cfh.project_deployments(id uuid primary key default gen_random_uuid(),project_id uuid not null references cfh.projects on delete cascade,name text not null,url text not null check(url ~ '^https://'),status text not null,verified_at timestamptz);
create table cfh.project_metrics(id uuid primary key default gen_random_uuid(),project_id uuid not null references cfh.projects on delete cascade,name text not null,unit text not null,methodology text not null);
create table cfh.impact_records(id uuid primary key default gen_random_uuid(),metric_id uuid not null references cfh.project_metrics on delete cascade,value numeric not null,source_url text not null check(source_url ~ '^https://'),measured_at date not null,limitations text not null,verified boolean not null default false);
create table cfh.tasks(id uuid primary key default gen_random_uuid(),project_id uuid not null references cfh.projects on delete cascade,title text not null,discipline text not null,level text not null check(level in ('First Contribution','Beginner','Intermediate','Advanced','Specialist')),effort text not null check(effort in ('< 1 hour','1–3 hours','3–8 hours','Multi-day','Ongoing')),technology text not null,objective text not null,context text not null,acceptance text not null,dependencies text not null default 'No dependencies',reviewer text not null default 'Reviewer not yet appointed',assignee text not null default 'Unassigned',issue_url text check(issue_url is null or issue_url ~ '^https://github.com/'),status text not null default 'OPEN' check(status in ('OPEN','CLAIMED','IN PROGRESS','REVIEW','BLOCKED','COMPLETE')),is_demo boolean not null default false,created_at timestamptz not null default now());
create table cfh.task_skills(task_id uuid references cfh.tasks on delete cascade,skill_id text references cfh.skills on delete cascade,primary key(task_id,skill_id));
create table cfh.task_assignments(task_id uuid primary key references cfh.tasks on delete cascade,user_id uuid not null references cfh.profiles on delete cascade,claimed_at timestamptz not null default now());
create table cfh.task_dependencies(task_id uuid references cfh.tasks on delete cascade,depends_on uuid references cfh.tasks,primary key(task_id,depends_on),check(task_id<>depends_on));
create table cfh.proposals(id uuid primary key default gen_random_uuid(),user_id uuid not null references cfh.profiles on delete cascade,title text not null check(length(title) between 8 and 180),problem text not null,evidence text not null,existing_solutions text not null,people_affected text not null,intervention text not null,technology_rationale text not null,risks text not null,expertise text not null,deployment text not null,measurement text not null,status text not null default 'SUBMITTED' check(status in ('DRAFT','SUBMITTED','RESEARCH REVIEW','NEEDS INFORMATION','ACCEPTED','DECLINED','MERGED WITH EXISTING PROJECT')),merged_project_id uuid references cfh.projects,created_at timestamptz not null default now());
create unique index proposals_user_title on cfh.proposals(user_id,lower(title));
create table cfh.proposal_sources(id uuid primary key default gen_random_uuid(),proposal_id uuid not null references cfh.proposals on delete cascade,url text not null check(url ~ '^https://'),title text not null);
create table cfh.research_sources(id uuid primary key default gen_random_uuid(),project_id uuid references cfh.projects on delete cascade,problem_id uuid references cfh.problems on delete cascade,title text not null,url text not null check(url ~ '^https://'),retrieved_at date,check(num_nonnulls(project_id,problem_id)=1));
create table cfh.decisions(id uuid primary key default gen_random_uuid(),project_id uuid references cfh.projects,title text not null,status text not null default 'PROPOSED',context text not null,decision text not null,consequences text not null,decided_at date,is_demo boolean not null default false,published boolean not null default false);
create table cfh.comments(id uuid primary key default gen_random_uuid(),user_id uuid not null references cfh.profiles,project_id uuid not null references cfh.projects,body text not null check(length(body) between 1 and 5000),published boolean not null default false,created_at timestamptz not null default now());
create table cfh.reviews(id uuid primary key default gen_random_uuid(),reviewer_id uuid not null references cfh.profiles,task_id uuid not null references cfh.tasks,body text not null,outcome text not null check(outcome in ('CHANGES REQUESTED','APPROVED')),created_at timestamptz not null default now());
create table cfh.organizations(id uuid primary key default gen_random_uuid(),name text not null,website_url text check(website_url is null or website_url ~ '^https://'));
create table cfh.partners(id uuid primary key default gen_random_uuid(),organization_id uuid not null references cfh.organizations,description text not null,published boolean not null default false);
create table cfh.sponsors(id uuid primary key default gen_random_uuid(),organization_id uuid not null references cfh.organizations,description text not null,published boolean not null default false);
create table cfh.funding_records(id uuid primary key default gen_random_uuid(),project_id uuid references cfh.projects,sponsor_id uuid references cfh.sponsors,source_name text not null,amount numeric(14,2) not null check(amount>=0),currency text not null check(currency ~ '^[A-Z]{3}$'),received_at date not null,source_url text not null check(source_url ~ '^https://'),published boolean not null default false);
create table cfh.expense_records(id uuid primary key default gen_random_uuid(),project_id uuid references cfh.projects,description text not null,amount numeric(14,2) not null check(amount>=0),currency text not null check(currency ~ '^[A-Z]{3}$'),incurred_at date not null,source_url text not null check(source_url ~ '^https://'),published boolean not null default false);
create table cfh.notifications(id uuid primary key default gen_random_uuid(),user_id uuid not null references cfh.profiles on delete cascade,message text not null,read_at timestamptz,created_at timestamptz not null default now());
create table cfh_private.institutional_roles(user_id uuid not null references cfh.profiles on delete cascade,role text not null check(role in ('Board','Institutional Maintainer','Program Steward','Reviewer','Domain Advisor')),primary key(user_id,role));
create table cfh_private.audit_log(id bigint generated always as identity primary key,actor_id uuid,event text not null,record_id text,created_at timestamptz not null default now());
create table cfh_private.rate_limits(user_id uuid not null references auth.users on delete cascade,action text not null,window_start timestamptz not null,count integer not null,primary key(user_id,action,window_start));

-- Index every foreign key used by joins or policies.
do $$ declare r record; begin
 for r in select tc.table_schema,tc.table_name,kcu.column_name from information_schema.table_constraints tc join information_schema.key_column_usage kcu using(constraint_catalog,constraint_schema,constraint_name) where tc.constraint_type='FOREIGN KEY' and tc.table_schema in ('cfh','cfh_private') loop
 execute format('create index if not exists %I on %I.%I (%I)',r.table_name||'_'||r.column_name||'_idx',r.table_schema,r.table_name,r.column_name);
 end loop;
end $$;
create index tasks_open_filter on cfh.tasks(discipline,level,effort) where status='OPEN';
create index projects_program_status on cfh.projects(program_id,status);
create index projects_search on cfh.projects using gin(to_tsvector('english',name||' '||summary));
create index tasks_search on cfh.tasks using gin(to_tsvector('english',title||' '||objective));

-- Tables are denied by default. Public reads expose only published, public records.
do $$ declare t text; begin
 for t in select tablename from pg_tables where schemaname='cfh' loop
 execute format('alter table cfh.%I enable row level security',t);
 execute format('revoke all on cfh.%I from anon, authenticated',t);
 execute format('grant select on cfh.%I to anon, authenticated',t);
 end loop;
 for t in select tablename from pg_tables where schemaname='cfh_private' loop execute format('alter table cfh_private.%I enable row level security',t); end loop;
end $$;
create policy public_programs on cfh.programs for select using(true);
create policy public_licenses on cfh.licenses for select using(true);
create policy public_skills on cfh.skills for select using(true);
create policy public_profiles on cfh.profiles for select using(is_public or id=(select auth.uid()));
create policy public_user_skills on cfh.user_skills for select using(exists(select 1 from cfh.profiles p where p.id=user_id));
create policy public_problems on cfh.problems for select using(published);
create policy public_projects on cfh.projects for select using(published);
create policy public_decisions on cfh.decisions for select using(published);
do $$ declare t text; begin
 foreach t in array array['tasks','project_members','project_maintainers','project_repositories','project_milestones','project_deployments','project_metrics'] loop
 execute format('create policy public_project_record on cfh.%I for select using (exists(select 1 from cfh.projects p where p.id=project_id and p.published))',t);
 end loop;
 foreach t in array array['task_skills','task_dependencies','task_assignments','reviews'] loop
 execute format('create policy public_task_record on cfh.%I for select using (exists(select 1 from cfh.tasks t where t.id=task_id))',t);
 end loop;
 foreach t in array array['partners','sponsors','funding_records','expense_records'] loop
 execute format('create policy public_published on cfh.%I for select using(published)',t);
 end loop;
end $$;
create policy public_orgs on cfh.organizations for select using(exists(select 1 from cfh.partners where organization_id=organizations.id and published) or exists(select 1 from cfh.sponsors where organization_id=organizations.id and published));
create policy public_sources on cfh.research_sources for select using(exists(select 1 from cfh.projects where id=project_id) or exists(select 1 from cfh.problems where id=problem_id));
create policy public_impact on cfh.impact_records for select using(verified and exists(select 1 from cfh.project_metrics where id=metric_id));
create policy own_proposals on cfh.proposals for select to authenticated using(user_id=(select auth.uid()));
create policy own_proposal_sources on cfh.proposal_sources for select to authenticated using(exists(select 1 from cfh.proposals where id=proposal_id and user_id=(select auth.uid())));
create policy public_comments on cfh.comments for select using((published and exists(select 1 from cfh.projects where id=project_id)) or user_id=(select auth.uid()));
create policy own_notifications on cfh.notifications for select to authenticated using(user_id=(select auth.uid()));
grant insert(id,username,name,bio,location,availability,github_url,website_url,is_public), update(username,name,bio,location,availability,github_url,website_url,is_public) on cfh.profiles to authenticated;
create policy profile_insert on cfh.profiles for insert to authenticated with check(id=(select auth.uid()) and not is_demo);
create policy profile_update on cfh.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));

-- Privileged functions live in a non-exposed schema with explicit authorization.
create function cfh_private.consume_limit(action_name text,max_requests integer) returns void language plpgsql security definer set search_path='' as $$
declare current_count integer; begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 insert into cfh_private.rate_limits(user_id,action,window_start,count) values(auth.uid(),action_name,date_trunc('hour',now()),1)
 on conflict(user_id,action,window_start) do update set count=cfh_private.rate_limits.count+1 returning count into current_count;
 if current_count>max_requests then raise exception 'Rate limit reached. Please try again later.'; end if;
end $$;
revoke all on function cfh_private.consume_limit(text,integer) from public,anon,authenticated;
create function cfh_private.claim_task(task_id_input uuid) returns void language plpgsql security definer set search_path='' as $$
declare current_task cfh.tasks; begin
 if auth.uid() is null or not exists(select 1 from cfh.profiles where id=auth.uid()) then raise exception 'A signed-in contributor profile is required'; end if;
 perform cfh_private.consume_limit('claim',15);
 select t.* into current_task from cfh.tasks t join cfh.projects p on p.id=t.project_id where t.id=task_id_input and p.published and not p.is_demo and not t.is_demo for update of t;
 if not found or current_task.status<>'OPEN' then raise exception 'This task is not available'; end if;
 if exists(select 1 from cfh.task_dependencies d join cfh.tasks t on t.id=d.depends_on where d.task_id=task_id_input and t.status<>'COMPLETE') then raise exception 'Dependencies are not complete'; end if;
 insert into cfh.task_assignments(task_id,user_id) values(task_id_input,auth.uid());
 update cfh.tasks set status='CLAIMED',assignee='Assigned contributor' where id=task_id_input;
 insert into cfh_private.audit_log(actor_id,event,record_id) values(auth.uid(),'task.claimed',task_id_input::text);
end $$;
create function cfh.claim_task(task_id_input uuid) returns void language sql security invoker set search_path='' as $$select cfh_private.claim_task(task_id_input)$$;
revoke all on function cfh_private.claim_task(uuid),cfh.claim_task(uuid) from public,anon;
grant execute on function cfh_private.claim_task(uuid),cfh.claim_task(uuid) to authenticated;

create function cfh_private.submit_proposal(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare new_id uuid; field text; source text; begin
 if auth.uid() is null or not exists(select 1 from cfh.profiles where id=auth.uid()) then raise exception 'Create your contributor profile first'; end if;
 perform cfh_private.consume_limit('proposal',5);
 if length(trim(payload->>'title')) not between 8 and 180 or payload->>'title' is null then raise exception 'Invalid title'; end if;
 foreach field in array array['problem','evidence','existing_solutions','people_affected','intervention','technology_rationale','risks','expertise','deployment','measurement'] loop
 if payload->>field is null or length(trim(payload->>field)) not between 40 and 10000 then raise exception 'Complete every proposal section (40–10,000 characters)'; end if;
 end loop;
 if jsonb_typeof(payload->'sources') is distinct from 'array' then raise exception 'Sources are required'; end if;
 if jsonb_array_length(payload->'sources') not between 1 and 20 then raise exception 'Provide 1–20 sources'; end if;
 if exists(select 1 from cfh.projects where lower(name)=lower(trim(payload->>'title'))) then raise exception 'A project with this name already exists. Contribute to the existing work.'; end if;
 insert into cfh.proposals(user_id,title,problem,evidence,existing_solutions,people_affected,intervention,technology_rationale,risks,expertise,deployment,measurement) values(auth.uid(),trim(payload->>'title'),payload->>'problem',payload->>'evidence',payload->>'existing_solutions',payload->>'people_affected',payload->>'intervention',payload->>'technology_rationale',payload->>'risks',payload->>'expertise',payload->>'deployment',payload->>'measurement') returning id into new_id;
 for source in select jsonb_array_elements_text(payload->'sources') loop
 if source !~ '^https://' or length(source)>2000 then raise exception 'Sources must use HTTPS'; end if;
 insert into cfh.proposal_sources(proposal_id,url,title) values(new_id,source,source);
 end loop;
 insert into cfh_private.audit_log(actor_id,event,record_id) values(auth.uid(),'proposal.submitted',new_id::text);
 return new_id;
end $$;
create function cfh.submit_proposal(payload jsonb) returns uuid language sql security invoker set search_path='' as $$select cfh_private.submit_proposal(payload)$$;
revoke all on function cfh_private.submit_proposal(jsonb),cfh.submit_proposal(jsonb) from public,anon;
grant execute on function cfh_private.submit_proposal(jsonb),cfh.submit_proposal(jsonb) to authenticated;

-- Read-only taxonomy; no fake projects, people, finance, or outcomes in production.
insert into cfh.programs(id,slug,name,description,icon) values
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


create table cfh.community_posts (
 id uuid primary key default gen_random_uuid(),
 author_id uuid not null references cfh.profiles(id),
 project_id uuid references cfh.projects(id),
 parent_id uuid references cfh.community_posts(id),
 kind text not null check(kind in ('discussion','question','update')),
 title text not null default '' check(length(title)<=160),
 body text not null check(length(trim(body)) between 1 and 12000),
 hidden boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(parent_id is not null or length(trim(title))>=4)
);
create index community_posts_feed on cfh.community_posts(created_at desc) where parent_id is null and not hidden;
create index community_posts_author on cfh.community_posts(author_id);
create index community_posts_project on cfh.community_posts(project_id,created_at desc);
create index community_posts_parent on cfh.community_posts(parent_id,created_at);
create table cfh.saved_posts(user_id uuid not null references cfh.profiles on delete cascade,post_id uuid not null references cfh.community_posts on delete cascade,created_at timestamptz not null default now(),primary key(user_id,post_id));
create index saved_posts_post on cfh.saved_posts(post_id);
alter table cfh.community_posts enable row level security;
alter table cfh.saved_posts enable row level security;
revoke all on cfh.community_posts,cfh.saved_posts from anon,authenticated;
grant select on cfh.community_posts to anon,authenticated;
grant select on cfh.saved_posts to authenticated;
revoke insert,update,delete on cfh.community_posts,cfh.saved_posts from anon,authenticated;
-- This narrowly scoped helper answers only whether a root thread is cfh.
-- It avoids a recursive RLS self-join and never exposes thread contents.
create function cfh_private.public_thread_visible(thread_input uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from cfh.community_posts c where c.id=thread_input and c.parent_id is null and not c.hidden and (c.project_id is null or exists(select 1 from cfh.projects p where p.id=c.project_id and p.published)))
$$;
revoke all on function cfh_private.public_thread_visible(uuid) from public;
grant usage on schema cfh_private to anon;
grant execute on function cfh_private.public_thread_visible(uuid) to anon,authenticated;
create policy published_posts on cfh.community_posts for select to anon,authenticated using(not hidden and (parent_id is null or cfh_private.public_thread_visible(parent_id)) and (project_id is null or exists(select 1 from cfh.projects p where p.id=project_id and p.published)));
create policy own_saved_posts on cfh.saved_posts for select to authenticated using(user_id=(select auth.uid()));

create function cfh_private.publish_post(title_input text,body_input text,kind_input text,project_input uuid default null,parent_input uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare new_id uuid; parent cfh.community_posts; begin
 if auth.uid() is null or not exists(select 1 from cfh.profiles where id=auth.uid() and is_public) then raise exception 'Create a public contributor profile before posting'; end if;
 perform cfh_private.consume_limit('community_post',20);
 if length(trim(body_input)) not between 1 and 12000 or body_input is null or kind_input not in ('discussion','question','update') or kind_input is null then raise exception 'Invalid post'; end if;
 if parent_input is not null then
 select * into parent from cfh.community_posts where id=parent_input and not hidden and parent_id is null;
 if not found then raise exception 'Thread unavailable'; end if;
 project_input=parent.project_id;
 else
 if title_input is null or length(trim(title_input)) not between 4 and 160 then raise exception 'A title of 4–160 characters is required'; end if;
 end if;
 if project_input is not null and not exists(select 1 from cfh.projects where id=project_input and published and not is_demo) then raise exception 'Project unavailable'; end if;
 insert into cfh.community_posts(author_id,project_id,parent_id,kind,title,body) values(auth.uid(),project_input,parent_input,kind_input,coalesce(trim(title_input),''),trim(body_input)) returning id into new_id;
 if parent_input is not null and parent.author_id<>auth.uid() then insert into cfh.notifications(user_id,message) values(parent.author_id,'New reply in discussion '||parent.id::text); end if;
 insert into cfh_private.audit_log(actor_id,event,record_id) values(auth.uid(),'community.posted',new_id::text);
 return new_id;
end $$;
create function cfh.publish_post(title_input text,body_input text,kind_input text,project_input uuid default null,parent_input uuid default null) returns uuid language sql security invoker set search_path='' as $$select cfh_private.publish_post(title_input,body_input,kind_input,project_input,parent_input)$$;
revoke all on function cfh_private.publish_post(text,text,text,uuid,uuid),cfh.publish_post(text,text,text,uuid,uuid) from public,anon;
grant execute on function cfh_private.publish_post(text,text,text,uuid,uuid),cfh.publish_post(text,text,text,uuid,uuid) to authenticated;

create function cfh_private.save_post(post_input uuid,saved_input boolean) returns void language plpgsql security definer set search_path='' as $$begin
 if auth.uid() is null or not exists(select 1 from cfh.profiles where id=auth.uid()) then raise exception 'Sign in and create a profile'; end if;
 perform cfh_private.consume_limit('save_post',120);
 if saved_input is null then raise exception 'Invalid save state'; end if;
 if saved_input and not exists(select 1 from cfh.community_posts c where c.id=post_input and not c.hidden and (c.parent_id is null or cfh_private.public_thread_visible(c.parent_id)) and (c.project_id is null or exists(select 1 from cfh.projects p where p.id=c.project_id and p.published))) then raise exception 'Post unavailable'; end if;
 if saved_input then insert into cfh.saved_posts(user_id,post_id) values(auth.uid(),post_input) on conflict do nothing; else delete from cfh.saved_posts where user_id=auth.uid() and post_id=post_input; end if;
end $$;
create function cfh.save_post(post_input uuid,saved_input boolean) returns void language sql security invoker set search_path='' as $$select cfh_private.save_post(post_input,saved_input)$$;
revoke all on function cfh_private.save_post(uuid,boolean),cfh.save_post(uuid,boolean) from public,anon;
grant execute on function cfh_private.save_post(uuid,boolean),cfh.save_post(uuid,boolean) to authenticated;

create function cfh_private.join_project(project_input uuid) returns void language plpgsql security definer set search_path='' as $$begin
 if auth.uid() is null or not exists(select 1 from cfh.profiles where id=auth.uid() and is_public) then raise exception 'Create a public contributor profile first'; end if;
 perform cfh_private.consume_limit('join_project',30);
 if not exists(select 1 from cfh.projects where id=project_input and published and not is_demo and status<>'ARCHIVED') then raise exception 'Project unavailable'; end if;
 insert into cfh.project_members(project_id,user_id,role) values(project_input,auth.uid(),'Contributor') on conflict(project_id,user_id) do nothing;
 if found then insert into cfh_private.audit_log(actor_id,event,record_id) values(auth.uid(),'project.joined',project_input::text); end if;
end $$;
create function cfh.join_project(project_input uuid) returns void language sql security invoker set search_path='' as $$select cfh_private.join_project(project_input)$$;
revoke all on function cfh_private.join_project(uuid),cfh.join_project(uuid) from public,anon;
grant execute on function cfh_private.join_project(uuid),cfh.join_project(uuid) to authenticated;

alter table cfh.tasks add column submission_version integer not null default 0 check(submission_version>=0), add column submission_evidence text;
alter table cfh.reviews add column submission_version integer not null default 0;
create function cfh_private.update_work(task_input uuid,status_input text,evidence_input text default null,version_input integer default null) returns void language plpgsql security definer set search_path='' as $$
declare task cfh.tasks; maintainer boolean; assignee boolean; begin
 if auth.uid() is null then raise exception 'Sign in to update work'; end if;
 perform cfh_private.consume_limit('work_update',60);
 select t.* into task from cfh.tasks t join cfh.projects p on p.id=t.project_id where t.id=task_input and not t.is_demo and p.published and not p.is_demo and p.status<>'ARCHIVED' for update of t;
 if not found then raise exception 'Task unavailable'; end if;
 maintainer=exists(select 1 from cfh.project_maintainers where project_id=task.project_id and user_id=auth.uid());
 assignee=exists(select 1 from cfh.task_assignments where task_id=task_input and user_id=auth.uid());
 if not maintainer and not assignee then raise exception 'You cannot update this task'; end if;
 if status_input is null or status_input not in ('IN PROGRESS','REVIEW','BLOCKED','COMPLETE') then raise exception 'Invalid status'; end if;
 if status_input='COMPLETE' then
   if version_input is distinct from task.submission_version then raise exception 'Submission changed; reload before accepting'; end if;
   if task.status<>'REVIEW' or not maintainer or assignee then raise exception 'An independent maintainer must accept reviewed work'; end if;
   if not exists(select 1 from cfh.reviews where task_id=task_input and reviewer_id=auth.uid() and outcome='APPROVED' and submission_version=task.submission_version) then raise exception 'Approve the current submission before completion'; end if;
 else
   if not assignee or not ((task.status='CLAIMED' and status_input in ('IN PROGRESS','BLOCKED')) or (task.status='IN PROGRESS' and status_input in ('REVIEW','BLOCKED')) or (task.status='BLOCKED' and status_input='IN PROGRESS')) then raise exception 'This transition requires the assignee and an eligible task state'; end if;
 end if;
 if status_input='REVIEW' then
   if evidence_input is null or length(evidence_input)>2000 or evidence_input !~ '^https://[^[:space:]]+$' then raise exception 'An HTTPS evidence link is required for review'; end if;
   update cfh.tasks set status=status_input,submission_version=submission_version+1,submission_evidence=evidence_input where id=task_input;
 else
   update cfh.tasks set status=status_input where id=task_input;
 end if;
 insert into cfh_private.audit_log(actor_id,event,record_id) values(auth.uid(),'task.status.'||status_input,task_input::text);
end $$;
create function cfh.update_work(task_input uuid,status_input text,evidence_input text default null,version_input integer default null) returns void language sql security invoker set search_path='' as $$select cfh_private.update_work(task_input,status_input,evidence_input,version_input)$$;
revoke all on function cfh_private.update_work(uuid,text,text,integer),cfh.update_work(uuid,text,text,integer) from public,anon;
grant execute on function cfh_private.update_work(uuid,text,text,integer),cfh.update_work(uuid,text,text,integer) to authenticated;

create function cfh_private.review_work(task_input uuid,outcome_input text,body_input text,version_input integer) returns void language plpgsql security definer set search_path='' as $$
declare task cfh.tasks; begin
 if auth.uid() is null then raise exception 'Sign in to review work'; end if;
 select t.* into task from cfh.tasks t join cfh.projects p on p.id=t.project_id where t.id=task_input and not t.is_demo and p.published and not p.is_demo and p.status<>'ARCHIVED' for update of t;
 if not found or task.status<>'REVIEW' then raise exception 'Task is not awaiting review'; end if;
 if version_input is distinct from task.submission_version then raise exception 'Submission changed; reload before reviewing'; end if;
 if not exists(select 1 from cfh.project_maintainers where project_id=task.project_id and user_id=auth.uid()) or exists(select 1 from cfh.task_assignments where task_id=task_input and user_id=auth.uid()) then raise exception 'Independent maintainer review required'; end if;
 if outcome_input is null or outcome_input not in ('APPROVED','CHANGES REQUESTED') or body_input is null or length(trim(body_input)) not between 20 and 5000 then raise exception 'Provide a review outcome and 20–5000 characters of evidence'; end if;
 perform cfh_private.consume_limit('review',30);
 insert into cfh.reviews(reviewer_id,task_id,body,outcome,submission_version) values(auth.uid(),task_input,trim(body_input),outcome_input,task.submission_version);
 if outcome_input='CHANGES REQUESTED' then update cfh.tasks set status='IN PROGRESS' where id=task_input; end if;
 insert into cfh_private.audit_log(actor_id,event,record_id) values(auth.uid(),'task.review.'||outcome_input,task_input::text);
end $$;
create function cfh.review_work(task_input uuid,outcome_input text,body_input text,version_input integer) returns void language sql security invoker set search_path='' as $$select cfh_private.review_work(task_input,outcome_input,body_input,version_input)$$;
revoke all on function cfh_private.review_work(uuid,text,text,integer),cfh.review_work(uuid,text,text,integer) from public,anon;
grant execute on function cfh_private.review_work(uuid,text,text,integer),cfh.review_work(uuid,text,text,integer) to authenticated;

create function cfh_private.read_notifications() returns void language plpgsql security definer set search_path='' as $$begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 update cfh.notifications set read_at=now() where user_id=auth.uid() and read_at is null;
end $$;
create function cfh.read_notifications() returns void language sql security invoker set search_path='' as $$select cfh_private.read_notifications()$$;
revoke all on function cfh_private.read_notifications(),cfh.read_notifications() from public,anon;
grant execute on function cfh_private.read_notifications(),cfh.read_notifications() to authenticated;

-- The platform itself is real work, backed by its dedicated repository.
insert into cfh.projects(id,slug,name,program_id,summary,problem,objective,status,license,architecture,evidence,published)
values('cf000000-0000-4000-8000-000000000001','community-platform','Community platform','civic-infrastructure','The community and shared workspace behind Coders for Humanity.','Contributors need one place to find people, discuss problems, and coordinate work across open-source projects.','Build and operate the CFH community, project workspaces, and shared GitHub integration.','BUILDING','MIT','Next.js and TypeScript application, PostgreSQL community data, and a dedicated public GitHub repository.','The platform is in active development in the clearframeworks/coders-for-humanity repository.',true);
insert into cfh.project_repositories(project_id,name,url) values('cf000000-0000-4000-8000-000000000001','coders-for-humanity','https://github.com/clearframeworks/coders-for-humanity');
-- Real founding work requested by the owner. No fabricated people or outcomes.
-- Stable IDs match lib/harness.ts; never overwrite task progress during provisioning.
insert into cfh.tasks (id,project_id,title,discipline,level,effort,technology,objective,context,acceptance,dependencies,reviewer,assignee,issue_url,status,is_demo) values
('cf100000-0000-4000-8000-000000000001','cf000000-0000-4000-8000-000000000001','Establish the independent harness team','Security','Specialist','Ongoing','Security review · GitHub','Give the community an accountable review team before widening release access.','The platform is being handed to human maintainers. Contributor, reviewer and release authority must remain separate. No security team has been appointed yet.','Publish consenting maintainer and security reviewer contacts; document conflicts of interest and coverage; configure protected main with required checks and fresh independent reviews; prove a failing pull request cannot merge; record provider evidence.','Owner appoints trusted reviewers and approves repository settings.','Repository owner; independent security reviewer to be appointed','Unassigned',null,'OPEN',false),
('cf100000-0000-4000-8000-000000000002','cf000000-0000-4000-8000-000000000001','Verify accounts and data isolation with real users','Backend','Advanced','Multi-day','Supabase · PostgreSQL · Next.js','Enable shared community work only after isolation is verified on the hosted system.','Migrations and protected actions are implemented locally. Production account infrastructure needs an explicitly approved dedicated database and provider configuration.','Configure approved database and authentication; test anonymous, two-member and maintainer sessions; demonstrate blocked cross-user edits and role escalation; test revoked sessions, callback origins and rate limits; attach sanitized test evidence.','Dedicated Supabase project approval; harness reviewer assigned.','Backend maintainer and independent security reviewer','Unassigned',null,'OPEN',false),
('cf100000-0000-4000-8000-000000000003','cf000000-0000-4000-8000-000000000001','Test the complete contribution journey for accessibility','Accessibility','Intermediate','3–8 hours','Keyboard · Screen reader · WCAG','Make joining, finding work, discussing and submitting usable without a mouse.','Automated checks cannot establish usability. Test the actual shared workflow in both color themes and on mobile.','Complete the journey using keyboard and a screen reader; record focus order, announcements and errors; verify light/dark contrast and 200% zoom; file reproducible issues and retest fixes.','Stable preview; authenticated journey available for full coverage.','Accessibility reviewer independent of the fixes','Unassigned',null,'OPEN',false),
('cf100000-0000-4000-8000-000000000004','cf000000-0000-4000-8000-000000000001','Write the first human maintainer handoff','Documentation','First Contribution','1–3 hours','Markdown · GitHub','Let a new maintainer understand and continue the work without this chat.','Use the repository, harness charter and current deployment evidence. Separate implemented code from configured services and future work.','A new contributor can identify the current goal, open blockers, local setup, tests, review rules and release owner; every operational claim links to evidence; no credentials or invented people appear.','Access to the current public source and release record.','Project maintainer','Unassigned',null,'OPEN',false),
('cf100000-0000-4000-8000-000000000005','cf000000-0000-4000-8000-000000000001','Design a respectful first contribution experience','UX/UI','Intermediate','3–8 hours','Interaction design · User research','Help people choose useful work by skill, time and interest without turning contribution into a popularity contest.','Human contributors need autonomy, clear expectations, help and a way to hand off work when their availability changes.','Test the flow with at least three consenting contributors; publish anonymized findings; show claim, ask-for-help and handoff states; include non-code roles and low-bandwidth/mobile use.','Recruit consenting testers; no public personal research data.','Design maintainer and accessibility reviewer','Unassigned',null,'OPEN',false),
('cf100000-0000-4000-8000-000000000006','cf000000-0000-4000-8000-000000000001','Exercise the review boundary against hostile contributions','Testing','Advanced','3–8 hours','Threat modeling · Integration tests','Demonstrate that untrusted contributions cannot gain authority or ship themselves.','Use a staging environment with synthetic data. Test malicious links, abusive content, task races, self-approval and dependency changes without running untrusted code with production secrets.','Publish a threat model and reproducible safe tests; prove self-approval and unauthorized completion are rejected; demonstrate stale evidence blocks acceptance; verify that application task completion cannot trigger a production deploy.','Hosted staging auth; independent review and release controls configured.','Harness security reviewer','Unassigned',null,'OPEN',false),
('cf100000-0000-4000-8000-000000000007','cf000000-0000-4000-8000-000000000001','Rehearse a release and rollback with a human steward','DevOps','Advanced','3–8 hours','Vercel · GitHub Actions','Make every release attributable, reviewable and recoverable.','A successful build is evidence, not authorization. Keep public contributor CI separate from hosting credentials and production approval.','Record source SHA, preview URL, check results and independent approvals; prove unauthorized deployment denied; rehearse rollback in staging; verify the released URL and record an owner-approved production procedure.','Harness team appointed; hosting release permissions reviewed.','Repository owner and security reviewer','Unassigned',null,'OPEN',false)
on conflict (id) do nothing;
commit;
