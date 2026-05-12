
-- 1) Internal comments on applications
CREATE TABLE public.application_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL,
  author_id uuid NOT NULL,
  author_name text,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_app_comments_app ON public.application_comments(application_id);
ALTER TABLE public.application_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tier reads comments" ON public.application_comments
  FOR SELECT USING (public.is_admin_tier(auth.uid()));
CREATE POLICY "reviewer inserts comments" ON public.application_comments
  FOR INSERT WITH CHECK (public.can_review(auth.uid()) AND auth.uid() = author_id);
CREATE POLICY "author updates comments" ON public.application_comments
  FOR UPDATE USING (auth.uid() = author_id);
CREATE POLICY "super deletes comments" ON public.application_comments
  FOR DELETE USING (public.is_super_admin(auth.uid()));

-- 2) Saved filters per admin
CREATE TABLE public.saved_filters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  scope text NOT NULL DEFAULT 'applications',
  name text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_saved_filters_user ON public.saved_filters(user_id);
ALTER TABLE public.saved_filters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user manages own filters select" ON public.saved_filters
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user manages own filters insert" ON public.saved_filters
  FOR INSERT WITH CHECK (auth.uid() = user_id AND public.is_admin_tier(auth.uid()));
CREATE POLICY "user manages own filters update" ON public.saved_filters
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "user manages own filters delete" ON public.saved_filters
  FOR DELETE USING (auth.uid() = user_id);

-- 3) Duplicate detection function
CREATE OR REPLACE FUNCTION public.find_duplicate_persons()
RETURNS TABLE(
  match_kind text,
  match_value text,
  occurrences integer,
  person_names text[],
  application_ids uuid[]
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin_tier(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH all_persons AS (
    SELECT p.national_id, p.full_name, p.birth_date, a.id AS application_id
    FROM public.profiles p
    LEFT JOIN public.applications a ON a.user_id = p.id
    WHERE p.national_id IS NOT NULL AND length(p.national_id) >= 5
    UNION ALL
    SELECT fm.national_id, fm.full_name, fm.birth_date, fm.application_id
    FROM public.family_members fm
    WHERE fm.national_id IS NOT NULL AND length(fm.national_id) >= 5
  ),
  by_nid AS (
    SELECT 'national_id'::text AS match_kind,
           national_id AS match_value,
           count(*)::int AS occurrences,
           array_agg(DISTINCT full_name) AS person_names,
           array_agg(DISTINCT application_id) FILTER (WHERE application_id IS NOT NULL) AS application_ids
    FROM all_persons
    GROUP BY national_id
    HAVING count(*) > 1
  ),
  by_name_dob AS (
    SELECT 'name_birth'::text AS match_kind,
           (full_name || ' • ' || birth_date::text) AS match_value,
           count(*)::int AS occurrences,
           array_agg(DISTINCT full_name) AS person_names,
           array_agg(DISTINCT application_id) FILTER (WHERE application_id IS NOT NULL) AS application_ids
    FROM all_persons
    WHERE birth_date IS NOT NULL
    GROUP BY full_name, birth_date
    HAVING count(*) > 1
  )
  SELECT * FROM by_nid
  UNION ALL
  SELECT * FROM by_name_dob
  ORDER BY occurrences DESC;
END $$;

-- 4) Advanced stats single-call
CREATE OR REPLACE FUNCTION public.admin_advanced_stats()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
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
    'aid_count_30d', (SELECT count(*)::int FROM public.aid_distributions WHERE delivered_at > current_date - 30),
    'pending_count', (SELECT count(*)::int FROM public.applications WHERE status = 'pending')
  ) INTO result;

  RETURN result;
END $$;

-- 5) Bulk status update for applications (reviewer+)
CREATE OR REPLACE FUNCTION public.bulk_update_application_status(_ids uuid[], _status text, _reason text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE n integer;
BEGIN
  IF NOT public.can_review(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF _status NOT IN ('pending','approved','rejected') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;
  UPDATE public.applications
     SET status = _status::application_status,
         rejection_reason = CASE WHEN _status = 'rejected' THEN _reason ELSE NULL END,
         reviewed_at = now(),
         reviewed_by = auth.uid()
   WHERE id = ANY(_ids);
  GET DIAGNOSTICS n = ROW_COUNT;

  PERFORM public.log_admin_action('bulk_status_update', 'applications',
    array_length(_ids,1)::text, _status,
    jsonb_build_object('ids', _ids, 'status', _status, 'reason', _reason));
  RETURN n;
END $$;
