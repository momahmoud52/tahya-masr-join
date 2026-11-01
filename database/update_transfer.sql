-- =====================================================
-- تحديث: تحويل المتقدم إلى لجنة أخرى (للأدمن وHR)
-- شغّله مرة واحدة في Supabase > SQL Editor (قابل لإعادة التشغيل)
-- =====================================================

-- سجل التحويلات: من أي لجنة، إلى أي لجنة، بواسطة من، ومتى
alter table applications
  add column if not exists transfer_log jsonb not null default '[]'::jsonb;

-- عضو HR يعدّل التقييم والقرار والتحويل بين اللجان فقط
create or replace function protect_application_columns() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  ev text[] := array['scores','hr_notes','decision','decision_reason','evaluated_by','evaluated_at',
                     'committee','target_gov','transfer_log'];
begin
  if auth.uid() is not null and not is_admin()
     and (to_jsonb(new) - ev) is distinct from (to_jsonb(old) - ev) then
    raise exception 'عضو HR يستطيع تعديل التقييم والقرار واللجنة والمحافظة فقط';
  end if;
  return new;
end $$;
