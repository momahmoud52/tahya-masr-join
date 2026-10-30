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
  assigned_to     uuid references staff(id) on delete set null,
  scores          jsonb,
  hr_notes        text,
  decision        text check (decision in ('accepted','rejected')),
  decision_reason text,
  evaluated_by    uuid references staff(id) on delete set null,
  evaluated_at    timestamptz
);

-- مبادرة رائدات مصر للإناث فقط (لا تُطبَّق على الصفوف القديمة)
alter table applications drop constraint if exists female_only_initiative;
alter table applications add constraint female_only_initiative
  check (committee <> 'المبادرة الوطنية رائدات مصر' or gender = 'أنثى') not valid;

-- 2) دالة التحقق من الأدمن
create or replace function is_admin() returns boolean
language sql security definer set search_path = public as
$$ select exists(select 1 from staff where id = auth.uid() and role = 'admin') $$;

-- 3) تفعيل الحماية على مستوى الصفوف
alter table staff enable row level security;
alter table applications enable row level security;

-- 4) سياسات جدول الطلبات
drop policy if exists "public can apply" on applications;
create policy "public can apply" on applications
  for insert to anon, authenticated
  with check (decision is null and assigned_to is null and scores is null);

drop policy if exists "read own or admin" on applications;
create policy "read own or admin" on applications
  for select to authenticated
  using (is_admin() or assigned_to = auth.uid());

drop policy if exists "update own or admin" on applications;
create policy "update own or admin" on applications
  for update to authenticated
  using (is_admin() or assigned_to = auth.uid())
  with check (is_admin() or assigned_to = auth.uid());

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
  with check (bucket_id = 'photos');

-- 8) حماية بيانات المتقدم: عضو HR يعدّل حقول التقييم والقرار فقط
create or replace function protect_application_columns() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  ev text[] := array['scores','hr_notes','decision','decision_reason','evaluated_by','evaluated_at'];
begin
  if auth.uid() is not null and not is_admin()
     and (to_jsonb(new) - ev) is distinct from (to_jsonb(old) - ev) then
    raise exception 'عضو HR يستطيع تعديل التقييم والقرار فقط';
  end if;
  return new;
end $$;

drop trigger if exists trg_protect_application on applications;
create trigger trg_protect_application
  before update on applications
  for each row execute function protect_application_columns();

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
