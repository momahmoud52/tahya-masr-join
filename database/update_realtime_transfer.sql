-- =====================================================
-- تحديث: التحديث اللحظي بين أعضاء الفريق + تحويل مع تحديد HR المسؤول
-- شغّله مرة واحدة في Supabase > SQL Editor (قابل لإعادة التشغيل)
-- يتطلب أن تكون update_transfer.sql و update_gov_transfer.sql قد شُغّلتا قبله
-- =====================================================

-- سجل أحداث لحظي: كل تغيير على الطلبات يُسجَّل هنا فيصل فوراً لكل أعضاء الفريق
create table if not exists app_events (
  id             bigint generated always as identity primary key,
  application_id uuid not null,
  kind           text not null,
  at             timestamptz not null default now()
);
alter table app_events enable row level security;
drop policy if exists "staff read events" on app_events;
create policy "staff read events" on app_events
  for select to authenticated using (true);

create or replace function log_application_event() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into app_events (application_id, kind) values (coalesce(new.id, old.id), tg_op);
  if random() < 0.02 then
    delete from app_events where at < now() - interval '1 hour';  -- تنظيف تلقائي للأحداث القديمة
  end if;
  return null;
end $$;

drop trigger if exists trg_app_events on applications;
create trigger trg_app_events
  after insert or update or delete on applications
  for each row execute function log_application_event();

do $$ begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'app_events') then
    alter publication supabase_realtime add table public.app_events;
  end if;
end $$;

-- عضو HR يستطيع الآن تغيير المسؤول عند التحويل
create or replace function protect_application_columns() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  ev text[] := array['scores','hr_notes','decision','decision_reason','evaluated_by','evaluated_at',
                     'committee','target_gov','transfer_log','assigned_to'];
begin
  if auth.uid() is not null and not is_admin()
     and (to_jsonb(new) - ev) is distinct from (to_jsonb(old) - ev) then
    raise exception 'عضو HR يستطيع تعديل التقييم والقرار واللجنة والمحافظة والمسؤول فقط';
  end if;
  return new;
end $$;

-- تحويل متقدم إلى لجنة/محافظة أخرى مع تحديد HR المسؤول (للأدمن، ولعضو HR على طلباته فقط)
create or replace function transfer_application(
  p_id uuid, p_committee text default null, p_gov text default null,
  p_assignee uuid default null, p_log jsonb default null
) returns boolean
language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  select (is_admin() or assigned_to = auth.uid()) into ok from applications where id = p_id;
  if not coalesce(ok, false) then return false; end if;
  update applications set
    committee    = coalesce(p_committee, committee),
    target_gov   = coalesce(p_gov, target_gov),
    assigned_to  = coalesce(p_assignee, assigned_to),
    transfer_log = coalesce(p_log, transfer_log)
  where id = p_id;
  return true;
end $$;
revoke all on function transfer_application(uuid, text, text, uuid, jsonb) from public, anon;
grant execute on function transfer_application(uuid, text, text, uuid, jsonb) to authenticated;
