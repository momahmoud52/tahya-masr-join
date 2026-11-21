-- ⚠️ ملف قديم لا تشغّله: تجاوزه schema.sql (آمن للتكرار ويصلح أي حالة سابقة).
-- تشغيله بعد التحديثات الأخيرة قد يعيد دوالاً قديمة تشير إلى أعمدة محذوفة.

-- =====================================================
-- تحديث: تسجيل أن دعوة المقابلة فُتحت لكل متقدم (يظهر للفريق كله)
-- شغّله مرة واحدة في Supabase > SQL Editor (قابل لإعادة التشغيل)
-- =====================================================

alter table applications
  add column if not exists invited_at timestamptz,
  add column if not exists invited_by text;

-- عضو HR يستطيع تسجيل الدعوة على طلباته
create or replace function protect_application_columns() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  ev text[] := array['scores','hr_notes','decision','decision_reason','evaluated_by','evaluated_at',
                     'committee','target_gov','transfer_log','assigned_to','invited_at','invited_by'];
begin
  if auth.uid() is not null and not is_admin()
     and (to_jsonb(new) - ev) is distinct from (to_jsonb(old) - ev) then
    raise exception 'عضو HR يستطيع تعديل التقييم والقرار واللجنة والمحافظة والمسؤول والدعوة فقط';
  end if;
  return new;
end $$;
