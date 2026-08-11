DROP TABLE IF EXISTS public.aid_campaign_recipients CASCADE;
DROP TABLE IF EXISTS public.aid_campaigns CASCADE;
DROP TABLE IF EXISTS public.aid_supplement_requests CASCADE;
DROP TABLE IF EXISTS public.aid_distributions CASCADE;

DROP FUNCTION IF EXISTS public.can_distribute_aid(uuid);
DROP FUNCTION IF EXISTS public.distributor_lookup_family(text);

DELETE FROM public.user_roles WHERE role = 'aid_distributor';

CREATE OR REPLACE FUNCTION public.is_admin_tier(_user_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id
      AND role IN ('admin','super_admin','reviewer','viewer')
  )
$function$;

CREATE OR REPLACE FUNCTION public.grant_role_by_nid(_nid text, _role text)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE uid uuid;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden: super admin required' USING ERRCODE = '42501';
  END IF;
  IF _role NOT IN ('admin','super_admin','reviewer','viewer') THEN
    RAISE EXCEPTION 'invalid role';
  END IF;
  SELECT id INTO uid FROM public.profiles WHERE national_id = _nid;
  IF uid IS NULL THEN RETURN false; END IF;
  DELETE FROM public.user_roles
   WHERE user_id = uid AND role IN ('admin','super_admin','reviewer','aid_distributor','viewer');
  INSERT INTO public.user_roles (user_id, role) VALUES (uid, _role::app_role) ON CONFLICT DO NOTHING;
  RETURN true;
END $function$;

CREATE OR REPLACE FUNCTION public.list_admins()
 RETURNS TABLE(user_id uuid, full_name text, national_id text, phone text, role text, two_fa_enabled boolean, created_at timestamp with time zone)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_admin_tier(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT DISTINCT ON (p.id) p.id, p.full_name, p.national_id, p.phone,
    (SELECT ur.role::text FROM public.user_roles ur
       WHERE ur.user_id = p.id
         AND ur.role IN ('super_admin','admin','reviewer','viewer')
       ORDER BY CASE ur.role
         WHEN 'super_admin' THEN 1 WHEN 'admin' THEN 2
         WHEN 'reviewer' THEN 3 ELSE 5
       END LIMIT 1) AS role,
    p.two_fa_enabled, p.created_at
  FROM public.profiles p
  WHERE EXISTS (SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = p.id
      AND ur.role IN ('admin','super_admin','reviewer','viewer'))
  ORDER BY p.id, p.created_at;
END $function$;

CREATE OR REPLACE FUNCTION public.admin_advanced_stats()
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE result jsonb;
BEGIN
  IF NOT public.is_admin_tier(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'by_camp', (SELECT jsonb_object_agg(current_camp, c) FROM (
      SELECT current_camp, count(*)::int AS c FROM public.applications GROUP BY current_camp
    ) t),
    'by_origin', (SELECT jsonb_object_agg(original_residence, c) FROM (
      SELECT original_residence, count(*)::int AS c FROM public.applications GROUP BY original_residence ORDER BY c DESC LIMIT 20
    ) t),
    'female_breadwinner', (SELECT count(*)::int FROM public.applications WHERE is_female_breadwinner),
    'with_martyr', (SELECT count(*)::int FROM public.applications WHERE has_martyr),
    'special_needs_total', (
      (SELECT count(*)::int FROM public.profiles WHERE is_special_needs)
      + (SELECT count(*)::int FROM public.family_members WHERE is_special_needs)
    ),
    'chronic_total', (
      (SELECT count(*)::int FROM public.profiles WHERE chronic_diseases IS NOT NULL AND chronic_diseases <> '')
      + (SELECT count(*)::int FROM public.family_members WHERE chronic_diseases IS NOT NULL AND chronic_diseases <> '')
    ),
    'pregnant', (SELECT count(*)::int FROM public.family_members WHERE is_pregnant),
    'breastfeeding', (SELECT count(*)::int FROM public.family_members WHERE is_breastfeeding),
    'pending_count', (SELECT count(*)::int FROM public.applications WHERE status = 'pending')
  ) INTO result;

  RETURN result;
END $function$;