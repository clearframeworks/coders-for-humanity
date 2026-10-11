-- Incremental migration AFTER 20261003150827_shared_cfh_namespace.sql.
-- Installs no extensions, credentials, schedules or delivery activation.
begin;
-- PostgreSQL validates function SET options at creation. On hosted postgres,
-- an unloaded custom GUC is an untrusted placeholder rather than PGC_USERSET.
-- Load http's C library in THIS session before CREATE FUNCTION registers its
-- timeout override. Listing options performs no HTTP request or secret lookup.
do $$begin
 if to_regprocedure('extensions.http_list_curlopt()') is null
  or to_regprocedure('extensions.http(extensions.http_request)') is null then
  raise exception 'Install the http extension in schema extensions before this migration';
 end if;
 perform count(*) from extensions.http_list_curlopt();
end$$;
create table cfh_private.native_mail_settings (
 singleton boolean primary key default true check(singleton),
 enabled boolean not null default false,
 sender_email text check(sender_email is null or (length(sender_email)<=254 and sender_email ~ '^[^[:space:]@<>]+@[^[:space:]@<>]+\.[^[:space:]@<>]+$')),
 last_run_at timestamptz,
 last_status text
);
insert into cfh_private.native_mail_settings(singleton) values(true);
alter table cfh_private.native_mail_settings enable row level security;
alter table cfh_private.native_mail_settings force row level security;
revoke all on cfh_private.native_mail_settings from public,anon,authenticated,cfh_notification_worker;

create function cfh_private.native_mail_ready() returns boolean
language plpgsql security definer set search_path='' as $$
declare checked_role text;
begin
 if to_regprocedure('extensions.http(extensions.http_request)') is null
  or to_regclass('vault.decrypted_secrets') is null then return false; end if;
 foreach checked_role in array array['anon','authenticated','cfh_notification_worker'] loop
  if has_table_privilege(checked_role,'vault.decrypted_secrets','SELECT') then return false; end if;
 end loop;
 return exists(select 1 from cfh_private.founder_notification_settings where singleton)
  and exists(select 1 from vault.decrypted_secrets where name='cfh_resend_sending_key' and length(decrypted_secret)>=10);
end $$;
revoke all on function cfh_private.native_mail_ready() from public,anon,authenticated,cfh_notification_worker;

-- The durable lease is committed by the procedure BEFORE this synchronous call.
-- No bearer credential is persisted in a shared HTTP request table.
create function cfh_private.send_native_founder_mail(item_input uuid,lease_input uuid) returns text
language plpgsql security definer set search_path='' set http.timeout_msec='10000' as $$
declare
 item cfh_private.founder_notification_outbox;
 reply record;
 sender_key text;
 provider_id text;
 result_status text;
 transport_error text;
 saved_options jsonb;
 option_row record;
begin
 if not exists(select 1 from cfh_private.native_mail_settings where singleton and enabled)
  or not cfh_private.native_mail_ready() then return 'not_ready'; end if;
 select * into item from cfh_private.founder_notification_outbox
  where id=item_input and status='inflight' and lease_id=lease_input for update;
 if not found then return 'superseded'; end if;
 if item.first_attempt_at<now()-interval '20 hours' then
  perform cfh_private.finish_founder_email(item.id,lease_input,null,'retry_window_expired',false);
  return 'needs_review';
 end if;
 -- http 1.6 uses session curl options. Save and restore instead of leaving
 -- changed settings behind in an operator connection. Do not pass the key until
 -- every TLS/timeout option succeeded. http 1.6 can follow provider redirects
 -- (up to five), with no exposed FOLLOWLOCATION override. Only the initial URL
 -- is pinned; Resend-controlled redirects remain part of the provider boundary.
 -- Function-local http.timeout_msec also bounds the deprecated GUC override.
 select coalesce(jsonb_object_agg(curlopt,value) filter(where value is not null),'{}'::jsonb)
  into saved_options from extensions.http_list_curlopt();
 begin
  -- Separate statements preserve option order rather than relying on boolean
  -- expression evaluation order around session-mutating extension calls.
  if not extensions.http_reset_curlopt() then raise exception 'HTTP reset unavailable'; end if;
  if not extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS','10000') then raise exception 'HTTP timeout unavailable'; end if;
  if not extensions.http_set_curlopt('CURLOPT_CONNECTTIMEOUT','3') then raise exception 'HTTP connection timeout unavailable'; end if;
  if not extensions.http_set_curlopt('CURLOPT_SSL_VERIFYPEER','1') then raise exception 'HTTP TLS verification unavailable'; end if;
  if not extensions.http_set_curlopt('CURLOPT_SSL_VERIFYHOST','2') then raise exception 'HTTP hostname verification unavailable'; end if;
  select decrypted_secret into sender_key from vault.decrypted_secrets where name='cfh_resend_sending_key';
  select * into reply from extensions.http((
   'POST','https://api.resend.com/emails',array[
    ('Authorization','Bearer '||sender_key)::extensions.http_header,
    ('Idempotency-Key','cfh-profile-'||item.id::text)::extensions.http_header
   ],'application/json',
   jsonb_build_object('from',item.sender_email,'to',jsonb_build_array(item.recipient_email),'subject',item.subject,'text',item.message)::text
  )::extensions.http_request);
 exception when query_canceled then transport_error:='transport_canceled';
 when others then transport_error:='transport_failed_'||sqlstate;
 end;
 perform extensions.http_reset_curlopt();
 for option_row in select key,value from jsonb_each_text(saved_options) loop
  perform extensions.http_set_curlopt(option_row.key,option_row.value);
 end loop;
 if transport_error is not null then
  perform cfh_private.finish_founder_email(item.id,lease_input,null,transport_error,true);
 else
  provider_id:=null;
  if reply.status between 200 and 299 then
   begin
    if jsonb_typeof(reply.content::jsonb->'id')='string' then provider_id:=nullif(reply.content::jsonb->>'id',''); end if;
   exception when others then provider_id:=null;
   end;
  end if;
  if provider_id is not null then
   perform cfh_private.finish_founder_email(item.id,lease_input,provider_id,null,false);
   return 'accepted';
  end if;
  perform cfh_private.finish_founder_email(item.id,lease_input,null,
   case when reply.status is null then 'provider_missing_response'
    when reply.status between 200 and 299 then 'provider_missing_receipt'
    else 'provider_http_'||reply.status::text end,
   reply.status is null or reply.status>=500 or reply.status in (408,409,429) or reply.status between 200 and 299);
 end if;
 select case when status='pending' then 'retry' else 'needs_review' end into result_status
  from cfh_private.founder_notification_outbox where id=item.id;
 return result_status;
end $$;
revoke all on function cfh_private.send_native_founder_mail(uuid,uuid) from public,anon,authenticated,cfh_notification_worker;

-- Top-level CALL only. SECURITY INVOKER and no SET clause allow COMMIT.
-- Cron runs as the trusted operator. Commit the claim before HTTP so crash
-- recovery preserves first_attempt_at, frozen payload, lease and retry limits.
create procedure cfh_private.dispatch_founder_mail()
language plpgsql security invoker as $$
declare settings cfh_private.native_mail_settings; item jsonb; result_status text;
begin
 select * into settings from cfh_private.native_mail_settings where singleton;
 update cfh_private.native_mail_settings set last_run_at=now(),last_status='checking' where singleton;
 if to_regclass('cron.job_run_details') is not null then
  delete from cron.job_run_details where runid in (
   select d.runid from cron.job_run_details d join cron.job j on j.jobid=d.jobid
   where j.jobname='cfh_founder_mail_dispatch' and j.command='call cfh_private.dispatch_founder_mail();'
    and d.end_time<now()-interval '7 days' order by d.end_time limit 1000);
 end if;
 if not coalesce(settings.enabled,false) then
  update cfh_private.native_mail_settings set last_status='paused' where singleton;
  return;
 end if;
 if settings.sender_email is null or not cfh_private.native_mail_ready() then
  update cfh_private.native_mail_settings set last_status='not_ready' where singleton;
  return;
 end if;
 item:=cfh_private.claim_founder_email(settings.sender_email);
 if item is null then
  update cfh_private.native_mail_settings set last_status='idle' where singleton;
  return;
 end if;
 update cfh_private.native_mail_settings set last_status='leased' where singleton;
 commit;
 result_status:=cfh_private.send_native_founder_mail((item->>'id')::uuid,(item->>'lease_id')::uuid);
 update cfh_private.native_mail_settings set last_status=result_status where singleton;
 commit;
end $$;
revoke all on procedure cfh_private.dispatch_founder_mail() from public,anon,authenticated,cfh_notification_worker;

create function cfh_private.enable_native_founder_mail(sender_input text) returns bigint
language plpgsql security definer set search_path='' as $$
declare job_id bigint;
begin
 if sender_input is null or length(sender_input)>254 or sender_input !~ '^[^[:space:]@<>]+@[^[:space:]@<>]+\.[^[:space:]@<>]+$' then raise exception 'Verified sender email required'; end if;
 if to_regprocedure('cron.schedule(text,text,text)') is null or not cfh_private.native_mail_ready() then
  raise exception 'Configure http, pg_cron, private Vault sending key and verified founder before activation';
 end if;
 if exists(select 1 from cron.job where jobname='cfh_founder_mail_dispatch'
  and command<>'call cfh_private.dispatch_founder_mail();') then raise exception 'Existing Cron job name is owned by another command'; end if;
 update cfh_private.native_mail_settings set enabled=true,sender_email=sender_input,last_status='enabled' where singleton;
 revoke execute on function cfh.claim_founder_email(text),cfh.finish_founder_email(uuid,uuid,text,text,boolean) from cfh_notification_worker;
 revoke execute on function cfh_private.claim_founder_email(text),cfh_private.finish_founder_email(uuid,uuid,text,text,boolean) from cfh_notification_worker;
 select cron.schedule('cfh_founder_mail_dispatch','* * * * *','call cfh_private.dispatch_founder_mail();') into job_id;
 return job_id;
end $$;
revoke all on function cfh_private.enable_native_founder_mail(text) from public,anon,authenticated,cfh_notification_worker;

create function cfh_private.pause_native_founder_mail() returns void
language plpgsql security definer set search_path='' as $$
declare job_id bigint;
begin
 update cfh_private.native_mail_settings set enabled=false,last_status='paused' where singleton;
 if to_regclass('cron.job') is not null then
  for job_id in select jobid from cron.job where jobname='cfh_founder_mail_dispatch'
   and command='call cfh_private.dispatch_founder_mail();'
  loop perform cron.alter_job(job_id,active:=false); end loop;
 end if;
end $$;
revoke all on function cfh_private.pause_native_founder_mail() from public,anon,authenticated,cfh_notification_worker;
commit;
