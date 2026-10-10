
-- هل يوجد سماح تعديل فعّال للمستخدم؟
create or replace function public.edit_grant_active(_user_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.edit_grants
    where user_id = _user_id and revoked = false and expires_at > now()
  );
$$;

-- قفل تعديل بيانات الأسرة من جهة الأسرة نفسها ما لم يوجد سماح فعّال.
-- الإدارة (أي دور إداري) وخدمات النظام (service role) غير مقيّدة.
create or replace function public.enforce_edit_lock() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  _uid uuid;
  _row jsonb;
begin
  if auth.uid() is null then
    return coalesce(NEW, OLD);
  end if;
  if public.is_admin_tier(auth.uid()) then
    return coalesce(NEW, OLD);
  end if;

  _row := coalesce(to_jsonb(NEW), to_jsonb(OLD));
  if TG_TABLE_NAME = 'profiles' then
    _uid := (_row->>'id')::uuid;
    -- لا نمنع التسجيل الأول: القفل يسري فقط بعد وجود طلب مقدّم
    if not exists (select 1 from public.applications where user_id = _uid) then
      return coalesce(NEW, OLD);
    end if;
  elsif TG_TABLE_NAME = 'applications' then
    _uid := (_row->>'user_id')::uuid;
  else
    select a.user_id into _uid from public.applications a
      where a.id = (_row->>'application_id')::uuid;
  end if;

  -- القفل على تعديل الأسرة لبياناتها فقط
  if _uid is distinct from auth.uid() then
    return coalesce(NEW, OLD);
  end if;

  if not public.edit_grant_active(_uid) then
    raise exception 'التعديل مقفل — اطلب من المسؤول الإداري فتح التعديل';
  end if;
  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists trg_lock_profiles on public.profiles;
create trigger trg_lock_profiles before update on public.profiles
  for each row execute function public.enforce_edit_lock();

drop trigger if exists trg_lock_applications on public.applications;
create trigger trg_lock_applications before update on public.applications
  for each row execute function public.enforce_edit_lock();

drop trigger if exists trg_lock_members on public.family_members;
create trigger trg_lock_members before insert or update or delete on public.family_members
  for each row execute function public.enforce_edit_lock();
