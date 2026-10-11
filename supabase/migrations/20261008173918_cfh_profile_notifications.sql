begin;
-- CFH membership starts at profile creation, including people with existing
-- shared Auth identities. No shared auth.users or central mail tables change.
create table private.founder_notification_settings (
 singleton boolean primary key default true check(singleton),
 user_id uuid not null references public.profiles(id),
 email text not null check(length(email)<=254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
 created_at timestamptz not null default now()
);
create table private.profile_events (
 id uuid primary key default gen_random_uuid(),
 profile_id uuid unique not null references public.profiles(id) on delete cascade,
 event_type text not null default 'profile.created' check(event_type='profile.created'),
 created_at timestamptz not null default now()
);
create table private.founder_notification_outbox (
 id uuid primary key default gen_random_uuid(),
 event_id uuid unique not null references private.profile_events(id) on delete cascade,
 recipient_id uuid not null references public.profiles(id),
 recipient_email text not null,
 sender_email text,
 notification_id uuid not null references public.notifications(id) on delete cascade,
 subject text not null,
 message text not null,
 status text not null default 'requires_sender' check(status in ('requires_sender','pending','inflight','sent','needs_review')),
 attempts integer not null default 0 check(attempts>=0),
 first_attempt_at timestamptz,
 leased_at timestamptz,
 lease_id uuid,
 next_attempt_at timestamptz not null default now(),
 provider_id text,
 last_error text,
 sent_at timestamptz,
 created_at timestamptz not null default now(),
 check(status<>'sent' or (provider_id is not null and sent_at is not null))
);
create index founder_notification_due on private.founder_notification_outbox(next_attempt_at) where status='pending';
alter table private.founder_notification_settings enable row level security;
alter table private.profile_events enable row level security;
alter table private.founder_notification_outbox enable row level security;
revoke all on private.founder_notification_settings,private.profile_events,private.founder_notification_outbox from public,anon,authenticated;

-- Runs only from database-owned triggers, never from the public API. The
-- privileged operator chooses the founder UUID; user-editable metadata is ignored.
create function private.route_profile_event(event_input uuid) returns void
language plpgsql security definer set search_path='' as $$
declare owner_record private.founder_notification_settings; event_record private.profile_events;
 profile_record public.profiles; notice_id uuid; notice_text text;
begin
 select * into owner_record from private.founder_notification_settings where singleton;
 if not found then return; end if;
 select * into event_record from private.profile_events where id=event_input for update;
 if not found or exists(select 1 from private.founder_notification_outbox where event_id=event_input) then return; end if;
 select * into profile_record from public.profiles where id=event_record.profile_id;
 if not found then return; end if;
 notice_text := case when profile_record.is_public then 'A contributor created a CFH profile: '||profile_record.name||' (@'||profile_record.username||'). Public profile: https://cfh.retehost.com/people/'||profile_record.username
     else 'A contributor created a private CFH profile.' end;
 insert into public.notifications(user_id,message) values(owner_record.user_id,notice_text) returning id into notice_id;
 insert into private.founder_notification_outbox(event_id,recipient_id,recipient_email,notification_id,subject,message)
 values(event_record.id,owner_record.user_id,owner_record.email,notice_id,'[New CFH contributor] Profile created',notice_text);
end $$;
revoke all on function private.route_profile_event(uuid) from public,anon,authenticated;

create function private.capture_profile_created() returns trigger
language plpgsql security definer set search_path='' as $$
declare event_id uuid;
begin
 if new.is_demo then return new; end if;
 insert into private.profile_events(profile_id) values(new.id) on conflict(profile_id) do nothing returning id into event_id;
 if event_id is not null then perform private.route_profile_event(event_id); end if;
 return new;
end $$;
revoke all on function private.capture_profile_created() from public,anon,authenticated;
create trigger cfh_profile_created after insert on public.profiles for each row execute function private.capture_profile_created();

-- Capture events before operator setup without losing them. Adding the founder
-- config routes the backlog once. Existing events are not resent when config changes.
create function private.route_pending_profile_events() returns trigger
language plpgsql security definer set search_path='' as $$
declare event_record record;
begin
 for event_record in select e.id from private.profile_events e
   where not exists(select 1 from private.founder_notification_outbox o where o.event_id=e.id)
   order by e.created_at,e.id loop
  perform private.route_profile_event(event_record.id);
 end loop;
 return new;
end $$;
revoke all on function private.route_pending_profile_events() from public,anon,authenticated;
create trigger cfh_founder_configured after insert or update on private.founder_notification_settings
for each row execute function private.route_pending_profile_events();

-- Only the narrowly scoped worker role may lease and complete mail. Nothing here
-- activates a scheduler or changes shared Auth/SMTP configuration.
create role cfh_notification_worker nologin noinherit;
grant cfh_notification_worker to authenticator;
create function private.claim_founder_email(sender_input text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare item private.founder_notification_outbox;
begin
 if sender_input is null or length(sender_input)>254 or sender_input !~ '^[^[:space:]@<>]+@[^[:space:]@<>]+\.[^[:space:]@<>]+$' then raise exception 'Verified sender email required'; end if;
 update private.founder_notification_outbox set status='needs_review',last_error='retry_window_expired'
 where status in ('pending','inflight') and (attempts>=12 or first_attempt_at<now()-interval '20 hours')
   and (leased_at is null or leased_at<now()-interval '2 minutes');
 select * into item from private.founder_notification_outbox
 where (status in ('requires_sender','pending') and next_attempt_at<=now())
    or (status='inflight' and leased_at<now()-interval '2 minutes')
 order by created_at,id limit 1 for update skip locked;
 if not found then return null; end if;
 update private.founder_notification_outbox set status='inflight',attempts=attempts+1,
   first_attempt_at=coalesce(first_attempt_at,now()),leased_at=now(),lease_id=gen_random_uuid(),sender_email=coalesce(sender_email,sender_input)
 where id=item.id returning * into item;
 return jsonb_build_object('id',item.id,'lease_id',item.lease_id,'recipient_email',item.recipient_email,'sender_email',item.sender_email,
   'subject',item.subject,'message',item.message);
end $$;
create function private.finish_founder_email(item_input uuid,lease_input uuid,provider_input text,error_input text,retry_input boolean) returns void
language plpgsql security definer set search_path='' as $$
declare item private.founder_notification_outbox;
begin
 select * into item from private.founder_notification_outbox where id=item_input and lease_id=lease_input and status='inflight' for update;
 if not found then raise exception 'Mail lease expired or already completed'; end if;
 if coalesce(length(provider_input),0)>0 then
  update private.founder_notification_outbox set status='sent',provider_id=left(provider_input,200),sent_at=now(),last_error=null where id=item.id;
 else
  update private.founder_notification_outbox set status=case when retry_input and attempts<12 and first_attempt_at>now()-interval '20 hours' then 'pending' else 'needs_review' end,
   next_attempt_at=now()+make_interval(secs=>least(3600,60*(2^least(attempts,6))::integer)),
   last_error=left(coalesce(error_input,'provider_failed'),100)
   where id=item.id;
 end if;
end $$;
create function public.claim_founder_email(sender_input text) returns jsonb language sql security invoker set search_path='' as $$select private.claim_founder_email(sender_input)$$;
create function public.finish_founder_email(item_input uuid,lease_input uuid,provider_input text,error_input text,retry_input boolean) returns void
language sql security invoker set search_path='' as $$select private.finish_founder_email(item_input,lease_input,provider_input,error_input,retry_input)$$;
revoke all on function private.claim_founder_email(text),public.claim_founder_email(text),
 private.finish_founder_email(uuid,uuid,text,text,boolean),public.finish_founder_email(uuid,uuid,text,text,boolean) from public,anon,authenticated;
grant usage on schema private to cfh_notification_worker;
grant usage on schema public to cfh_notification_worker;
grant execute on function private.claim_founder_email(text),public.claim_founder_email(text),
 private.finish_founder_email(uuid,uuid,text,text,boolean),public.finish_founder_email(uuid,uuid,text,text,boolean) to cfh_notification_worker;
commit;
