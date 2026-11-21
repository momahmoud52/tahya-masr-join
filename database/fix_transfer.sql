-- =====================================================
-- إصلاح سريع: "column assigned_to does not exist" عند التحويل
-- شغّله في SQL Editor (آمن للتكرار). هو يستبدل دالتي التحويل والتوزيع بالنسخة الصحيحة
-- ويحدّث ذاكرة Supabase، ثم يفحص أن لا شيء يشير للعمود القديم.
-- =====================================================

alter table applications add column if not exists assignees uuid[] not null default '{}';

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
