-- ⚠️ ملف قديم لا تشغّله: تجاوزه schema.sql (آمن للتكرار ويصلح أي حالة سابقة).
-- تشغيله بعد التحديثات الأخيرة قد يعيد دوالاً قديمة تشير إلى أعمدة محذوفة.

-- =====================================================
-- تحديث: توزيع المتقدم على أكثر من عضو + إزالة المسؤول
-- شغّله مرة واحدة في Supabase > SQL Editor (قابل لإعادة التشغيل).
-- يحوّل عمود assigned_to القديم إلى قائمة assignees ويحذف القديم، فلا تعد تشغيل ملفات
-- التحديث السابقة بعده (schema.sql نفسه محدَّث).
-- =====================================================

-- 1) عمود المسؤولين المتعددين + نقل التوزيع الحالي إليه
alter table applications add column if not exists assignees uuid[] not null default '{}';
do $$ begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'applications' and column_name = 'assigned_to') then
    update applications set assignees = array[assigned_to]
    where assigned_to is not null and assignees = '{}';
  end if;
end $$;
create index if not exists applications_assignees_gin on applications using gin (assignees);

-- 2) السياسات: يرى ويعدّل كل من هو ضمن مسؤولي الطلب
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

-- 3) حماية الأعمدة: عضو HR يعدّل التقييم والقرار والتحويل والدعوة فقط
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

-- 4) تحويل متقدم (لجنة/محافظة) مع تسليمه لعضو آخر
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

-- 7) حذف العمود القديم بعد استبدال كل ما يعتمد عليه
alter table applications drop column if exists assigned_to;

select count(*) filter (where cardinality(assignees) > 0) as distributed, count(*) as total from applications;
