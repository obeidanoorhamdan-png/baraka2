-- ============ 1) Aid Campaigns ============
CREATE TABLE IF NOT EXISTS public.aid_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  aid_type text,
  contents text,
  scheduled_date date NOT NULL DEFAULT CURRENT_DATE,
  target_camp text,
  quota integer NOT NULL DEFAULT 0,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.aid_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tier reads campaigns" ON public.aid_campaigns
  FOR SELECT USING (public.is_admin_tier(auth.uid()));
CREATE POLICY "super manages campaigns ins" ON public.aid_campaigns
  FOR INSERT WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "super manages campaigns upd" ON public.aid_campaigns
  FOR UPDATE USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "super manages campaigns del" ON public.aid_campaigns
  FOR DELETE USING (public.is_super_admin(auth.uid()));

CREATE TRIGGER trg_aid_campaigns_updated_at BEFORE UPDATE ON public.aid_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ 2) Campaign Recipients (الاستلام) ============
CREATE TABLE IF NOT EXISTS public.aid_campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.aid_campaigns(id) ON DELETE CASCADE,
  application_id uuid NOT NULL,
  delivered boolean NOT NULL DEFAULT false,
  delivered_at timestamptz,
  delivered_by uuid,
  delivered_by_name text,
  received_by_name text,
  received_by_relation text,
  received_by_national_id text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, application_id)
);
ALTER TABLE public.aid_campaign_recipients ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_acr_campaign ON public.aid_campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_acr_application ON public.aid_campaign_recipients(application_id);

CREATE POLICY "tier reads recipients" ON public.aid_campaign_recipients
  FOR SELECT USING (
    public.is_admin_tier(auth.uid())
    OR EXISTS (SELECT 1 FROM public.applications a WHERE a.id = application_id AND a.user_id = auth.uid())
  );
CREATE POLICY "distributor inserts recipients" ON public.aid_campaign_recipients
  FOR INSERT WITH CHECK (public.can_distribute_aid(auth.uid()));
CREATE POLICY "distributor updates recipients" ON public.aid_campaign_recipients
  FOR UPDATE USING (public.can_distribute_aid(auth.uid()))
  WITH CHECK (public.can_distribute_aid(auth.uid()));
CREATE POLICY "super deletes recipients" ON public.aid_campaign_recipients
  FOR DELETE USING (public.is_super_admin(auth.uid()));

CREATE TRIGGER trg_acr_updated_at BEFORE UPDATE ON public.aid_campaign_recipients
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Enable realtime for live "who received" view across devices
ALTER TABLE public.aid_campaign_recipients REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.aid_campaign_recipients;

-- ============ 3) Pending Edits (طلبات تعديل الأسرة المقبولة) ============
CREATE TABLE IF NOT EXISTS public.pending_edits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL,
  user_id uuid NOT NULL,
  target_kind text NOT NULL,           -- 'application' | 'profile' | 'family_member'
  target_id uuid,                       -- id of family_member if applicable
  changes jsonb NOT NULL,               -- { field: { old, new } }
  reason text,
  status text NOT NULL DEFAULT 'pending', -- pending|approved|rejected
  reviewed_by uuid,
  reviewer_notes text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pending_edits ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_pe_status ON public.pending_edits(status);
CREATE INDEX IF NOT EXISTS idx_pe_app ON public.pending_edits(application_id);

CREATE POLICY "owner reads own edits" ON public.pending_edits
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin_tier(auth.uid()));
CREATE POLICY "owner inserts own edits" ON public.pending_edits
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reviewer updates edits" ON public.pending_edits
  FOR UPDATE USING (public.can_review(auth.uid()))
  WITH CHECK (public.can_review(auth.uid()));
CREATE POLICY "super deletes edits" ON public.pending_edits
  FOR DELETE USING (public.is_super_admin(auth.uid()));

-- ============ 4) Supplement requests (طلبات تكميلية من المندوب) ============
CREATE TABLE IF NOT EXISTS public.aid_supplement_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.aid_campaigns(id) ON DELETE SET NULL,
  application_id uuid,
  requested_by uuid NOT NULL,
  applicant_name text,
  applicant_national_id text,
  reason text,
  status text NOT NULL DEFAULT 'pending', -- pending|approved|rejected
  reviewed_by uuid,
  reviewer_notes text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.aid_supplement_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tier reads supplement" ON public.aid_supplement_requests
  FOR SELECT USING (public.is_admin_tier(auth.uid()));
CREATE POLICY "distributor inserts supplement" ON public.aid_supplement_requests
  FOR INSERT WITH CHECK (public.can_distribute_aid(auth.uid()) AND auth.uid() = requested_by);
CREATE POLICY "reviewer updates supplement" ON public.aid_supplement_requests
  FOR UPDATE USING (public.can_review(auth.uid()))
  WITH CHECK (public.can_review(auth.uid()));
CREATE POLICY "super deletes supplement" ON public.aid_supplement_requests
  FOR DELETE USING (public.is_super_admin(auth.uid()));

-- ============ 5) Helper: search approved families by national_id (for distributor) ============
CREATE OR REPLACE FUNCTION public.distributor_lookup_family(_nid text)
RETURNS TABLE (
  application_id uuid,
  head_name text,
  head_national_id text,
  current_camp text,
  family_size integer,
  status text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.can_distribute_aid(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT a.id, p.full_name, p.national_id, a.current_camp, a.family_size, a.status::text
  FROM public.applications a
  JOIN public.profiles p ON p.id = a.user_id
  WHERE a.status = 'approved'
    AND (
      p.national_id = _nid
      OR EXISTS (SELECT 1 FROM public.family_members fm
                  WHERE fm.application_id = a.id AND fm.national_id = _nid)
    )
  LIMIT 5;
END $$;

-- ============ 6) Apply approved edit ============
CREATE OR REPLACE FUNCTION public.apply_pending_edit(_edit_id uuid, _notes text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  e public.pending_edits%ROWTYPE;
  k text; v jsonb;
  sql_set text := '';
BEGIN
  IF NOT public.can_review(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO e FROM public.pending_edits WHERE id = _edit_id AND status = 'pending' FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  -- Build dynamic UPDATE from changes jsonb { field: { old, new } }
  FOR k, v IN SELECT * FROM jsonb_each(e.changes) LOOP
    sql_set := sql_set || format('%I = %L, ', k, v->>'new');
  END LOOP;
  sql_set := rtrim(sql_set, ', ');

  IF sql_set <> '' THEN
    IF e.target_kind = 'application' THEN
      EXECUTE format('UPDATE public.applications SET %s WHERE id = $1', sql_set) USING e.application_id;
    ELSIF e.target_kind = 'profile' THEN
      EXECUTE format('UPDATE public.profiles SET %s WHERE id = $1', sql_set) USING e.user_id;
    ELSIF e.target_kind = 'family_member' THEN
      EXECUTE format('UPDATE public.family_members SET %s WHERE id = $1', sql_set) USING e.target_id;
    END IF;
  END IF;

  UPDATE public.pending_edits
     SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), reviewer_notes = _notes
   WHERE id = _edit_id;

  PERFORM public.log_admin_action('approve_edit', e.target_kind, e.target_id::text, NULL, e.changes);
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.reject_pending_edit(_edit_id uuid, _notes text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.can_review(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  UPDATE public.pending_edits
     SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), reviewer_notes = _notes
   WHERE id = _edit_id AND status = 'pending';
  RETURN FOUND;
END $$;