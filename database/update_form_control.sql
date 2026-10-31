-- =====================================================
-- تحديث: غلق/فتح الاستمارة + حذف صور الطلبات (للمشروع الحالي)
-- شغّله مرة واحدة في Supabase > SQL Editor (قابل لإعادة التشغيل)
-- =====================================================

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

-- التسجيل ورفع الصور لا يعملان إلا والاستمارة مفتوحة (الأدمن مستثنى للاستيراد)
drop policy if exists "public can apply" on applications;
create policy "public can apply" on applications
  for insert to anon, authenticated
  with check (decision is null and assigned_to is null and scores is null
              and (form_is_open() or is_admin()));

drop policy if exists "upload photos" on storage.objects;
create policy "upload photos" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'photos' and (form_is_open() or is_admin()));

-- الأدمن يحذف صور الطلبات المحذوفة
drop policy if exists "admin delete photos" on storage.objects;
create policy "admin delete photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and is_admin());

select form_is_open() as form_open;
