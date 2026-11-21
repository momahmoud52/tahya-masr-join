-- =====================================================
-- اتحاد طلاب تحيا مصر: قاعدة بيانات الانضمام (قابلة لإعادة التشغيل)
-- شغّله كاملاً في Supabase > SQL Editor
-- =====================================================

-- 1) الجداول
create table if not exists staff (
  id   uuid primary key references auth.users on delete cascade,
  name text not null,
  role text not null default 'hr' check (role in ('admin','hr'))
);

create table if not exists applications (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz default now(),
  name_ar         text not null,
  national_id     text not null unique check (national_id ~ '^[0-9]{14}$'),
  address         text,
  gender          text,
  education       text,
  email           text,
  phone           text,
  whatsapp        text,
  residence_gov   text,
  target_gov      text,
  university      text,
  faculty         text,
  school          text,
  birth_date      date,
  age             int,
  committee       text,
  photo_url       text,
  assignees       uuid[] not null default '{}',
  scores          jsonb,
  hr_notes        text,
  decision        text check (decision in ('accepted','rejected')),
  decision_reason text,
  evaluated_by    uuid references staff(id) on delete set null,
  evaluated_at    timestamptz,
  transfer_log    jsonb not null default '[]'::jsonb,
  invited_at      timestamptz,
  invited_by      text
);

-- مبادرة رائدات مصر للإناث فقط (لا تُطبَّق على الصفوف القديمة)
alter table applications drop constraint if exists female_only_initiative;
alter table applications add constraint female_only_initiative
  check (committee <> 'المبادرة الوطنية رائدات مصر' or gender = 'أنثى') not valid;

-- ترقية قواعد البيانات الأقدم: كل سطر هنا آمن للتكرار، وبه يصلح هذا الملف أي حالة سابقة
alter table applications add column if not exists transfer_log jsonb not null default '[]'::jsonb;
alter table applications add column if not exists invited_at timestamptz;
alter table applications add column if not exists invited_by text;
alter table applications add column if not exists assignees uuid[] not null default '{}';
do $$ begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'applications' and column_name = 'assigned_to') then
    update applications set assignees = array[assigned_to]
    where assigned_to is not null and assignees = '{}';
  end if;
end $$;

create index if not exists applications_assignees_gin on applications using gin (assignees);

-- 2) دالة التحقق من الأدمن
create or replace function is_admin() returns boolean
language sql security definer set search_path = public as
$$ select exists(select 1 from staff where id = auth.uid() and role = 'admin') $$;

-- 3) تفعيل الحماية على مستوى الصفوف
alter table staff enable row level security;
alter table applications enable row level security;

-- 3.5) التحكم بفتح وغلق الاستمارة
create table if not exists settings (
  key   text primary key,
  value jsonb not null
);
insert into settings (key, value) values ('form_open', 'true') on conflict (key) do nothing;

alter table settings enable row level security;
drop policy if exists "admin manage settings" on settings;
create policy "admin manage settings" on settings
  for all to authenticated using (is_admin()) with check (is_admin());

create or replace function form_is_open() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce((select value = 'true'::jsonb from settings where key = 'form_open'), true) $$;
grant execute on function form_is_open() to anon, authenticated;

-- 4) سياسات جدول الطلبات
drop policy if exists "public can apply" on applications;
create policy "public can apply" on applications
  for insert to anon, authenticated
  with check (decision is null and assignees = '{}'::uuid[] and scores is null
              and (form_is_open() or is_admin()));

drop policy if exists "read own or admin" on applications;
create policy "read own or admin" on applications
  for select to authenticated
  using (is_admin() or assignees @> array[auth.uid()]);

drop policy if exists "update own or admin" on applications;
create policy "update own or admin" on applications
  for update to authenticated
  using (is_admin() or assignees @> array[auth.uid()])
  with check (is_admin() or assignees @> array[auth.uid()]);

drop policy if exists "admin delete" on applications;
create policy "admin delete" on applications
  for delete to authenticated
  using (is_admin());

-- 5) سياسات جدول الفريق
drop policy if exists "staff read" on staff;
create policy "staff read" on staff
  for select to authenticated using (true);

drop policy if exists "admin manage staff" on staff;
create policy "admin manage staff" on staff
  for all to authenticated
  using (is_admin()) with check (is_admin());

-- 6) الاستعلام عن النتيجة بالرقم القومي (يرجع سجلاً واحداً فقط)
create or replace function check_result(nid text)
returns table(name_ar text, committee text, decision text, decision_reason text)
language sql security definer set search_path = public as
$$ select name_ar, committee, decision, decision_reason
   from applications where national_id = nid $$;
grant execute on function check_result(text) to anon, authenticated;

-- 7) تخزين الصور الشخصية
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 153600, array['image/jpeg'])
on conflict (id) do update
  set file_size_limit = 153600, allowed_mime_types = array['image/jpeg'];

drop policy if exists "upload photos" on storage.objects;
create policy "upload photos" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'photos' and (form_is_open() or is_admin()));

drop policy if exists "admin delete photos" on storage.objects;
create policy "admin delete photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and is_admin());

-- 8) حماية بيانات المتقدم: عضو HR يعدّل التقييم والقرار واللجنة فقط
create or replace function protect_application_columns() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  ev text[] := array['scores','hr_notes','decision','decision_reason','evaluated_by','evaluated_at',
                     'committee','target_gov','transfer_log','assignees','invited_at','invited_by'];
begin
  if auth.uid() is not null and not is_admin()
     and (to_jsonb(new) - ev) is distinct from (to_jsonb(old) - ev) then
    raise exception 'عضو HR يستطيع تعديل التقييم والقرار واللجنة والمحافظة والمسؤول والدعوة فقط';
  end if;
  return new;
end $$;

drop trigger if exists trg_protect_application on applications;
create trigger trg_protect_application
  before update on applications
  for each row execute function protect_application_columns();

-- 8.5) التحديث اللحظي بين أعضاء الفريق وتحويل الطلبات
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

-- تحويل متقدم إلى لجنة/محافظة أخرى مع تحديد HR المسؤول (للأدمن، ولعضو HR على طلباته فقط)
-- نحذف كل نسخ هاتين الدالتين (حتى لو اختلفت وسائطها) قبل إعادة إنشائهما نظيفتين
do $$ declare r record; begin
  for r in select p.oid::regprocedure as sig
           from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('transfer_application', 'assign_applications') loop
    execute 'drop function ' || r.sig;
  end loop;
end $$;

create or replace function transfer_application(
  p_id uuid, p_committee text default null, p_gov text default null,
  p_assignee uuid default null, p_log jsonb default null
) returns boolean
language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  select (is_admin() or assignees @> array[auth.uid()]) into ok from applications where id = p_id;
  if not coalesce(ok, false) then return false; end if;
  update applications set
    committee  = coalesce(p_committee, committee),
    target_gov = coalesce(p_gov, target_gov),
    assignees  = case
      when p_assignee is null then assignees
      when is_admin() then array[p_assignee]
      else (select array_agg(distinct x) from unnest(array_remove(assignees, auth.uid()) || p_assignee) x)
    end,
    transfer_log = coalesce(p_log, transfer_log)
  where id = p_id;
  return true;
end $$;
revoke all on function transfer_application(uuid, text, text, uuid, jsonb) from public, anon;
grant execute on function transfer_application(uuid, text, text, uuid, jsonb) to authenticated;

-- 5) التوزيع الجماعي للأدمن: إضافة / استبدال / إزالة أعضاء / إزالة كل المسؤولين
create or replace function assign_applications(p_ids uuid[], p_mode text, p_staff uuid[] default '{}')
returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not is_admin() then raise exception 'التوزيع للأدمن فقط'; end if;
  if p_mode not in ('add', 'replace', 'remove', 'clear') then raise exception 'إجراء غير معروف'; end if;
  if exists (select 1 from unnest(p_staff) s where not exists (select 1 from staff where id = s)) then
    raise exception 'أحد الأعضاء غير موجود';
  end if;
  update applications set assignees = case p_mode
    when 'add'     then (select coalesce(array_agg(distinct x), '{}') from unnest(assignees || p_staff) x)
    when 'replace' then (select coalesce(array_agg(distinct x), '{}') from unnest(p_staff) x)
    when 'remove'  then array(select x from unnest(assignees) x where x <> all(p_staff))
    else '{}'::uuid[]
  end
  where id = any(p_ids);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function assign_applications(uuid[], text, uuid[]) from public, anon;
grant execute on function assign_applications(uuid[], text, uuid[]) to authenticated;

-- 6) عند حذف عضو من الفريق تُزال مسؤولياته تلقائياً
create or replace function clean_staff_assignments() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update applications set assignees = array_remove(assignees, old.id) where assignees @> array[old.id];
  return old;
end $$;
drop trigger if exists trg_clean_staff on staff;
create trigger trg_clean_staff after delete on staff
  for each row execute function clean_staff_assignments();


-- حذف العمود القديم بعد إعادة إنشاء كل السياسات والدوال التي كانت تعتمد عليه
alter table applications drop column if exists assigned_to;

-- 9) إضافة الفريق دفعة واحدة
-- أنشئ حسابات الأعضاء أولاً من Authentication > Users (مع Auto Confirm User)،
-- ثم عدّل القائمة (البريد، الاسم، الدور) ونفّذ. أي بريد بلا حساب يُتجاهل.
insert into staff (id, name, role)
select u.id, v.name, v.role
from (values
  ('m.o18122023@gmail.com', 'Mohamed', 'admin')
  -- ,('hr1@gmail.com',     'اسم عضو HR', 'hr')
  -- ,('hr2@gmail.com',     'اسم عضو HR', 'hr')
  -- ,('admin2@gmail.com',  'أدمن آخر',   'admin')
) as v(email, name, role)
join auth.users u on u.email = v.email
on conflict (id) do update set name = excluded.name, role = excluded.role;

-- 10) تحقق: يجب أن يظهر كل أعضاء الفريق
select s.name, s.role, u.email
from staff s join auth.users u on u.id = s.id
order by s.role, s.name;

-- تحديث ذاكرة واجهة Supabase (PostgREST) بالدوال الجديدة
notify pgrst, 'reload schema';

-- فحص نهائي: يجب أن تكون النتيجة صفر صفوف، أي لا دالة ولا سياسة تشير إلى العمود القديم
select 'function' as kind, p.proname::text as name
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosrc ilike '%assigned_to%'
union all
select 'policy', policyname::text from pg_policies
where schemaname in ('public', 'storage')
  and (coalesce(qual, '') ilike '%assigned_to%' or coalesce(with_check, '') ilike '%assigned_to%');