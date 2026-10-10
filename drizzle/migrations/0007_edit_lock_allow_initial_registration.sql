
-- السماح بالتعبئة الأولى: إذا لم يكن للطلب أي أفراد بعد (تسجيل أول مرة)
-- يُسمح للأسرة بالإدخال؛ القفل يسري فقط بعد اكتمال التسجيل الأول.
create or replace function public.enforce_edit_lock() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  _uid uuid;
  _app uuid;
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
    select a.id into _app from public.applications a where a.user_id = _uid;
  elsif TG_TABLE_NAME = 'applications' then
    _uid := (_row->>'user_id')::uuid;
    _app := (_row->>'id')::uuid;
  else
    _app := (_row->>'application_id')::uuid;
    select a.user_id into _uid from public.applications a where a.id = _app;
  end if;

  -- القفل على تعديل الأسرة لبياناتها فقط
  if _uid is distinct from auth.uid() then
    return coalesce(NEW, OLD);
  end if;

  -- لا يوجد طلب بعد، أو الطلب بلا أفراد = تسجيل أول مرة، مسموح
  if _app is null
     or not exists (select 1 from public.family_members where application_id = _app) then
    return coalesce(NEW, OLD);
  end if;

  if not public.edit_grant_active(_uid) then
    raise exception 'التعديل مقفل — اطلب من المسؤول الإداري فتح التعديل';
  end if;
  return coalesce(NEW, OLD);
end;
$$;
