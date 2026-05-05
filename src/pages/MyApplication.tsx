import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Plus, Lock, Send, ArrowLeft, ArrowRight, CheckCircle2, Users, Eye, AlertTriangle } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { MemberCard, emptyMember, type Member } from "@/components/MemberCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatBirthDate } from "@/lib/formatDate";
import { toast } from "sonner";
import { ID_RE, isFullName } from "@/lib/validators";
import { useAppSettings } from "@/hooks/useAppSettings";
import { RegistrationClosedNotice } from "@/pages/RegistrationClosed";
import { useConfirm } from "@/components/ConfirmDialog";
import { AidPreview } from "@/pages/MyAid";
import { friendlyError } from "@/lib/friendlyError";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { enqueueOp, cacheGet, cacheSet, logHistory, listOps, onOutboxChange } from "@/lib/offlineOutbox";
import { drainOutbox, onSyncState } from "@/lib/syncEngine";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Fields locked on the head-of-family card — tied to the user's auth account.
const HEAD_LOCKED_FIELDS = ["full_name", "national_id", "birth_date", "gender", "relationship", "relationship_other"];

const MyApplication = () => {
  const { t, i18n } = useTranslation();
  const { user, isAdmin, loading } = useAuth();
  const { settings, loading: settingsLoading } = useAppSettings();
  const navigate = useNavigate();
  const isRtl = i18n.language === "ar";
  const Arrow = isRtl ? ArrowLeft : ArrowRight;
  const ArrowBack = isRtl ? ArrowRight : ArrowLeft;
  const confirmAsk = useConfirm();

  const [step, setStep] = useState(1);
  const [appId, setAppId] = useState<string | null>(null);
  const [appStatus, setAppStatus] = useState<string | null>(null);
  const [rejection, setRejection] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [memberErrors, setMemberErrors] = useState<Record<number, Record<string, string>>>({});
  const [editMode, setEditMode] = useState(false);
  const [snapshot, setSnapshot] = useState<string>("");
  const [familySizeInput, setFamilySizeInput] = useState<string>("");
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [collapsedMembers, setCollapsedMembers] = useState<Record<number, boolean>>({});
  const [lastDraftSavedAt, setLastDraftSavedAt] = useState<string>("");
  const [pendingDraft, setPendingDraft] = useState<{ residence: any; members: Member[]; savedAt: string } | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  // Signature of the last successfully saved draft (server or local). Used
  // to decide whether the form has unsaved changes (`draftDirty`).
  const [lastSavedSig, setLastSavedSig] = useState<string>("");
  // Server-side timestamp of the application row at load time. Used to
  // detect concurrent edits (someone else modified the row while we were
  // working offline).
  const [serverUpdatedAt, setServerUpdatedAt] = useState<string | null>(null);
  const [conflictData, setConflictData] = useState<{ residence: any; members: Member[]; updatedAt: string } | null>(null);
  const [hasPendingSubmit, setHasPendingSubmit] = useState(false);
  const [pendingSubmitProgress, setPendingSubmitProgress] = useState<number>(0);
  const [pendingSubmitSyncing, setPendingSubmitSyncing] = useState(false);

  const [residence, setResidence] = useState({
    original_residence: "",
    original_landmark: "",
    current_landmark: "",
    family_size: 1,
    has_martyr: false,
    martyr_name: "",
    martyr_relationship: "",
  });

  const [members, setMembers] = useState<Member[]>([]);

  // Head of family — editable in the same UI as members. Persisted as a
  // `family_members` row with `is_head=true`, AND mirrored back to the
  // `profiles` table to keep the user account in sync.
  const [head, setHead] = useState<Member>({
    full_name: "",
    national_id: "",
    birth_date: "",
    gender: "male",
    relationship: "other",
    relationship_other: "رب الأسرة",
    is_war_injured: false,
    injury_report_url: null,
    chronic_diseases: "",
    is_pregnant: false,
    is_breastfeeding: false,
    pregnancy_report_url: null,
    health_notes: "",
    is_head: true,
  });
  const [headErrors, setHeadErrors] = useState<Record<string, string>>({});

  const currentSig = () => JSON.stringify({ residence, members });
  const isDirty = editMode && !!appId && snapshot && snapshot !== currentSig();

  const guardDiscard = async (): Promise<boolean> => {
    if (!isDirty) return true;
    return await confirmAsk({
      title: t("confirm.discard_changes_title"),
      description: t("confirm.discard_changes"),
      confirmText: t("confirm.discard_confirm"),
      variant: "warning",
    });
  };

  // Unsaved-changes detection: dirty if either an existing-app edit has
  // diverged from its snapshot, OR the in-progress draft (no app yet) has
  // diverged from the last persisted draft signature.
  const draftDirty =
    !appId && !pageLoading && !!user && !pendingDraft && !!lastSavedSig && currentSig() !== lastSavedSig;
  const anyUnsaved = isDirty || draftDirty;

  // Combined guard: warn on tab close + intercept SPA navigation.
  useUnsavedChangesGuard(anyUnsaved, confirmAsk as any);


  const validateMemberField = (m: Member, key: string): string => {
    switch (key) {
      case "full_name":
        if (!m.full_name?.trim()) return t("field_errors.name_required");
        if (!isFullName(m.full_name)) return t("field_errors.name_format");
        return "";
      case "national_id":
        if (m.national_id && !ID_RE.test(m.national_id)) return t("field_errors.id_format");
        return "";
      case "birth_date":
        if (!m.birth_date) return t("field_errors.birth_required");
        if (new Date(m.birth_date) > new Date()) return t("field_errors.birth_future");
        return "";
      case "relationship_other":
        if (m.relationship === "other" && !m.relationship_other?.trim()) return t("field_errors.rel_other_required");
        return "";
      case "injury_report_url":
        // Optional — never block save (user may upload later)
        return "";
      case "pregnancy_report_url":
        // Optional — never block save (user may upload later)
        return "";
    }
    return "";
  };

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
    else if (!loading && user && isAdmin) navigate("/admin", { replace: true });
  }, [user, isAdmin, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const cacheKey = `app:${user.id}`;
      const offline = typeof navigator !== "undefined" && !navigator.onLine;

      // Hydrate immediately from cache so the form is usable even before
      // (or without) a network round-trip.
      const cached = await cacheGet<any>(cacheKey);
      if (cached?.app) {
        setAppId(cached.app.id);
        setAppStatus(cached.app.status);
        setRejection(cached.app.rejection_reason);
        setResidence({
          original_residence: cached.app.original_residence,
          original_landmark: cached.app.original_landmark,
          current_landmark: cached.app.current_landmark,
          family_size: cached.app.family_size,
          has_martyr: cached.app.has_martyr,
          martyr_name: cached.app.martyr_name || "",
          martyr_relationship: cached.app.martyr_relationship || "",
        });
        setFamilySizeInput(String(cached.app.family_size));
        if (Array.isArray(cached.members)) setMembers(cached.members);
        setServerUpdatedAt(cached.app.updated_at || null);
        setLastSavedSig(JSON.stringify({
          residence: {
            original_residence: cached.app.original_residence,
            original_landmark: cached.app.original_landmark,
            current_landmark: cached.app.current_landmark,
            family_size: cached.app.family_size,
            has_martyr: cached.app.has_martyr,
            martyr_name: cached.app.martyr_name || "",
            martyr_relationship: cached.app.martyr_relationship || "",
          },
          members: cached.members || [],
        }));
      }

      if (offline) {
        // Cache is now the source of truth until we're back online.
        if (!cached) {
          // No app and no cache → offer the in-progress local draft.
          let localDraft: any = null;
          try {
            const raw = localStorage.getItem(`baraka2:draft:${user.id}`);
            if (raw) localDraft = JSON.parse(raw);
          } catch {}
          if (localDraft && (localDraft.residence?.original_residence || localDraft.members?.length)) {
            setPendingDraft({
              residence: localDraft.residence,
              members: Array.isArray(localDraft.members) ? localDraft.members : [],
              savedAt: localDraft.savedAt ? new Date(localDraft.savedAt).toLocaleString("ar") : "",
            });
          } else {
            setLastSavedSig(JSON.stringify({ residence, members: [] }));
          }
        }
        setPageLoading(false);
        return;
      }

      // Load head-of-family profile data so it can be edited inline.
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, national_id, birth_date, gender, is_war_injured, injury_report_url, chronic_diseases, health_notes")
        .eq("id", user.id)
        .maybeSingle();
      if (profile) {
        setHead((h) => ({
          ...h,
          full_name: profile.full_name || "",
          national_id: profile.national_id || "",
          birth_date: profile.birth_date || "",
          gender: (profile.gender as any) || "male",
          is_war_injured: !!profile.is_war_injured,
          injury_report_url: profile.injury_report_url || null,
          chronic_diseases: profile.chronic_diseases || "",
          health_notes: profile.health_notes || "",
        }));
      }

      const { data: app } = await supabase.from("applications").select("*").eq("user_id", user.id).maybeSingle();
      if (app) {
        setAppId(app.id);
        setAppStatus(app.status);
        setRejection(app.rejection_reason);
        setResidence({
          original_residence: app.original_residence,
          original_landmark: app.original_landmark,
          current_landmark: app.current_landmark,
          family_size: app.family_size,
          has_martyr: app.has_martyr,
          martyr_name: app.martyr_name || "",
          martyr_relationship: app.martyr_relationship || "",
          });
          setFamilySizeInput(String(app.family_size));
        setServerUpdatedAt(app.updated_at || null);
        const { data: fm } = await supabase.from("family_members").select("*").eq("application_id", app.id);
        const allRows = (fm || []).map((m) => ({ ...m, chronic_diseases: m.chronic_diseases || "", health_notes: m.health_notes || "", relationship_other: m.relationship_other || "" } as any));
        const headRow = allRows.find((m: any) => m.is_head);
        const memberRows = allRows.filter((m: any) => !m.is_head);
        if (memberRows.length) setMembers(memberRows);
        if (headRow) {
          setHead({ ...headRow, is_head: true });
        }
        // Persist to cache for next offline launch.
        await cacheSet(cacheKey, { app, members: memberRows });
      } else {
        // Clear stale cache if the app was deleted server-side.
        await cacheSet(cacheKey, null);
      }
      // No saved application yet — check for an in-progress draft and offer
      // to resume it (do not auto-overwrite the empty form). Server draft
      // takes precedence over the local copy (most reliable across devices).
      if (!app) {
        let serverDraft: any = null;
        try {
          const { data } = await (supabase as any)
            .from("application_drafts")
            .select("payload, updated_at")
            .eq("user_id", user.id)
            .maybeSingle();
          if (data?.payload) serverDraft = { ...data.payload, savedAt: data.updated_at };
        } catch {}

        let localDraft: any = null;
        try {
          const raw = localStorage.getItem(`baraka2:draft:${user.id}`);
          if (raw) localDraft = JSON.parse(raw);
        } catch {}

        const d = serverDraft || localDraft;
        const hasContent =
          d &&
          ((d.residence?.original_residence || d.residence?.original_landmark || d.residence?.current_landmark) ||
            (Array.isArray(d.members) && d.members.length > 0));
        if (hasContent) {
          setPendingDraft({
            residence: d.residence,
            members: Array.isArray(d.members) ? d.members : [],
            savedAt: d.savedAt ? new Date(d.savedAt).toLocaleString("ar") : "",
          });
        } else {
          // Mark current empty state as the baseline so we don't flag it
          // as dirty before the user starts editing.
          setLastSavedSig(JSON.stringify({ residence, members: [] }));
        }
      } else {
        setLastSavedSig(JSON.stringify({ residence: {
          original_residence: app.original_residence,
          original_landmark: app.original_landmark,
          current_landmark: app.current_landmark,
          family_size: app.family_size,
          has_martyr: app.has_martyr,
          martyr_name: app.martyr_name || "",
          martyr_relationship: app.martyr_relationship || "",
        }, members }));
      }
      setPageLoading(false);
    })();
  }, [user]);

  // Track whether a high-level submit op is queued, and surface its
  // live progress so the user sees a retry banner + progress bar.
  useEffect(() => {
    let opId: number | null = null;
    const refresh = async () => {
      const all = await listOps();
      const pending = all.find((o) => o.kind === "app.submit" || o.kind === "app.update");
      setHasPendingSubmit(!!pending);
      opId = pending?.id ?? null;
    };
    refresh();
    const off1 = onOutboxChange(refresh);
    const off2 = onSyncState((s) => {
      setPendingSubmitSyncing(s.syncing && s.currentOpId === opId && opId !== null);
      setPendingSubmitProgress(s.currentOpId === opId && opId !== null ? s.currentOpProgress : 0);
    });
    return () => { off1(); off2(); };
  }, []);

  // Auto-save draft (local + server) while the user is filling members or
  // residence (only before submission). Debounced 1.2 s to avoid spamming
  // the network on every keystroke.
  useEffect(() => {
    if (!user || pageLoading) return;
    if (appId && !editMode) return; // already submitted view
    if (pendingDraft) return; // waiting for user to resume/discard
    const handle = setTimeout(async () => {
      const payload = { residence, members, savedAt: Date.now() };
      const sig = JSON.stringify({ residence, members });
      // Local copy is best-effort and immediate.
      try {
        localStorage.setItem(`baraka2:draft:${user.id}`, JSON.stringify(payload));
      } catch {}
      // Server copy — when offline we queue an upsert and let the sync
      // engine flush it once the network returns.
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        try {
          await enqueueOp({
            kind: "supabase.upsert",
            table: "application_drafts",
            payload: { user_id: user.id, payload: { residence, members } },
            label: "حفظ مسودة الطلب",
          });
          setLastSavedSig(sig);
          setLastDraftSavedAt(new Date().toLocaleTimeString("ar") + " (سيُرفع لاحقاً)");
        } catch {}
        return;
      }
      try {
        await (supabase as any)
          .from("application_drafts")
          .upsert({ user_id: user.id, payload: { residence, members } });
        setLastSavedSig(sig);
        setLastDraftSavedAt(new Date().toLocaleTimeString("ar"));
      } catch {
        // Network died mid-request → queue it.
        try {
          await enqueueOp({
            kind: "supabase.upsert",
            table: "application_drafts",
            payload: { user_id: user.id, payload: { residence, members } },
            label: "حفظ مسودة الطلب",
          });
          setLastSavedSig(sig);
          setLastDraftSavedAt(new Date().toLocaleTimeString("ar") + " (سيُرفع لاحقاً)");
        } catch {}
      }
    }, 1200);
    return () => clearTimeout(handle);
  }, [residence, members, user, pageLoading, appId, editMode, pendingDraft]);

  // Trim members if user reduces family size below current members count.
  // Do NOT auto-add members — user adds them manually with the "Add member" button.
  useEffect(() => {
    const expected = Math.max(0, residence.family_size - 1);
    setMembers((prev) => (prev.length > expected ? prev.slice(0, expected) : prev));
  }, [residence.family_size]);

  const validateMembers = async () => {
    const seen = new Set<string>();
    const allErrors: Record<number, Record<string, string>> = {};
    let firstErrorIdx = -1;
    const fields = ["full_name","national_id","birth_date","relationship_other","injury_report_url","pregnancy_report_url"];

    // Validate head of family first
    const headErrs: Record<string, string> = {};
    for (const f of ["full_name","national_id","birth_date","injury_report_url"]) {
      const msg = validateMemberField(head, f);
      if (msg) headErrs[f] = msg;
    }
    if (head.national_id) seen.add(head.national_id);
    setHeadErrors(headErrs);
    if (Object.keys(headErrs).length) {
      toast.error(`رب الأسرة: ${t("toast.fix_errors")}`);
      return false;
    }

    for (let i = 0; i < members.length; i++) {
      const m = members[i];
      const errs: Record<string, string> = {};
      for (const f of fields) {
        const msg = validateMemberField(m, f);
        if (msg) errs[f] = msg;
      }
      if (m.national_id && !errs.national_id) {
        if (seen.has(m.national_id)) errs.national_id = t("toast.id_exists_with_data", { id: m.national_id });
        else seen.add(m.national_id);
      }
      if (Object.keys(errs).length) {
        allErrors[i] = errs;
        if (firstErrorIdx < 0) firstErrorIdx = i;
      }
    }
    setMemberErrors(allErrors);
    if (firstErrorIdx >= 0) {
      toast.error(`${t("family.person")} #${firstErrorIdx + 1}: ${t("toast.fix_errors")}`);
      return false;
    }
    if (residence.has_martyr && (!residence.martyr_name.trim() || !residence.martyr_relationship.trim())) {
      toast.error(t("form.required"));
      return false;
    }
    // Check duplicates against the rest of the camp
    for (let i = 0; i < members.length; i++) {
      const m = members[i];
      if (!m.national_id) continue;
      const { data } = await supabase.rpc("national_id_used_by_others", {
        _nid: m.national_id, _exclude_user: user!.id, _exclude_member: m.id ?? null,
      });
      if (data === true) {
        setMemberErrors((p) => ({ ...p, [i]: { ...(p[i] || {}), national_id: t("field_errors.id_duplicate") } }));
        toast.error(t("toast.id_exists_with_data", { id: m.national_id }));
        return false;
      }
    }
    return true;
  };

  // Open the review summary dialog after running validations.
  const openReview = async () => {
    if (!user) return;
    if (!appId && !settings.registration_open) {
      toast.error(t("toast.registration_closed_now"));
      return;
    }
    if (!(await validateMembers())) return;
    setSummaryOpen(true);
  };

  const submit = async () => {
    if (!user) return;
    setSummaryOpen(false);
    if (!(await confirmAsk({
      title: appId ? t("confirm.save_changes_title") : t("confirm.submit_app_title"),
      description: appId ? t("confirm.save_changes") : t("confirm.submit_app"),
      confirmText: appId ? t("form.save") : t("form.submit"),
      variant: "default",
    }))) return;

    // Offline path → queue a high-level app.submit / app.update op so the
    // sync engine completes the submission as soon as we're back online.
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      const buildRow = (m: Member, isHead: boolean) => ({
        full_name: m.full_name,
        national_id: m.national_id || null,
        birth_date: m.birth_date,
        gender: m.gender,
        relationship: m.relationship,
        relationship_other: m.relationship_other || null,
        is_war_injured: m.is_war_injured,
        injury_report_url: m.injury_report_url || null,
        chronic_diseases: m.chronic_diseases || null,
        is_pregnant: m.is_pregnant,
        is_breastfeeding: m.is_breastfeeding,
        pregnancy_report_url: m.is_pregnant ? (m.pregnancy_report_url || null) : null,
        health_notes: m.health_notes || null,
        is_head: isHead,
      });
      const memberRows = [buildRow(head, true), ...members.map((m) => buildRow(m, false))];
      const appPayload = {
        user_id: user.id,
        original_residence: residence.original_residence,
        original_landmark: residence.original_landmark,
        current_camp: "Baraka 2",
        current_landmark: residence.current_landmark,
        family_size: residence.family_size,
        has_martyr: residence.has_martyr,
        martyr_name: residence.has_martyr ? residence.martyr_name : null,
        martyr_relationship: residence.has_martyr ? residence.martyr_relationship : null,
        status: "pending" as const,
        rejection_reason: null,
      };
      try {
        if (appId) {
          await enqueueOp({
            kind: "app.update",
            payload: { applicationId: appId, application: appPayload, members: memberRows, userId: user.id },
            label: "تحديث الطلب",
          });
        } else {
          await enqueueOp({
            kind: "app.submit",
            payload: { application: appPayload, members: memberRows },
            label: "إرسال الطلب",
          });
        }
        toast.success("تم وضع الطلب في قائمة الانتظار", {
          description: "سيتم الإرسال تلقائياً فور عودة الإنترنت — أو اضغط إعادة المحاولة من سجل المزامنة.",
        });
        setHasPendingSubmit(true);
      } catch (e: any) {
        toast.error(friendlyError(e, "submit"));
      }
      return;
    }

    setBusy(true);
    try {
      let currentAppId = appId;
      // Conflict detection — if this is an UPDATE and the server's
      // updated_at advanced past the snapshot we loaded, somebody (likely
      // the admin or another device) edited our application in the
      // meantime. Surface a dialog so the user chooses to overwrite or
      // reload.
      if (currentAppId && serverUpdatedAt) {
        const { data: latest } = await supabase
          .from("applications")
          .select("updated_at, original_residence, original_landmark, current_landmark, family_size, has_martyr, martyr_name, martyr_relationship")
          .eq("id", currentAppId)
          .maybeSingle();
        if (latest && latest.updated_at && latest.updated_at !== serverUpdatedAt) {
          const { data: latestFm } = await supabase
            .from("family_members").select("*").eq("application_id", currentAppId);
          setConflictData({
            residence: {
              original_residence: latest.original_residence,
              original_landmark: latest.original_landmark,
              current_landmark: latest.current_landmark,
              family_size: latest.family_size,
              has_martyr: latest.has_martyr,
              martyr_name: latest.martyr_name || "",
              martyr_relationship: latest.martyr_relationship || "",
            },
            members: (latestFm || []).map((m) => ({ ...m, chronic_diseases: m.chronic_diseases || "", health_notes: m.health_notes || "", relationship_other: m.relationship_other || "" } as any)),
            updatedAt: new Date(latest.updated_at).toLocaleString("ar"),
          });
          setBusy(false);
          return;
        }
      }
      const appPayload = {
        user_id: user.id,
        original_residence: residence.original_residence,
        original_landmark: residence.original_landmark,
        current_camp: "Baraka 2",
        current_landmark: residence.current_landmark,
        family_size: residence.family_size,
        has_martyr: residence.has_martyr,
        martyr_name: residence.has_martyr ? residence.martyr_name : null,
        martyr_relationship: residence.has_martyr ? residence.martyr_relationship : null,
        status: "pending" as const,
        rejection_reason: null,
      };
      if (currentAppId) {
        const { error } = await supabase.from("applications").update(appPayload).eq("id", currentAppId);
        if (error) throw error;
        await supabase.from("family_members").delete().eq("application_id", currentAppId);
      } else {
        const { data, error } = await supabase.from("applications").insert(appPayload).select("id").single();
        if (error) throw error;
        currentAppId = data.id;
        setAppId(data.id);
      }
      // Build the rows to insert: head of family first, then the rest.
      const toRow = (m: Member, isHead: boolean) => ({
        application_id: currentAppId!,
        full_name: m.full_name,
        national_id: m.national_id || null,
        birth_date: m.birth_date,
        gender: m.gender,
        relationship: m.relationship,
        relationship_other: m.relationship_other || null,
        is_war_injured: m.is_war_injured,
        injury_report_url: m.injury_report_url || null,
        chronic_diseases: m.chronic_diseases || null,
        is_pregnant: m.is_pregnant,
        is_breastfeeding: m.is_breastfeeding,
        pregnancy_report_url: m.is_pregnant ? (m.pregnancy_report_url || null) : null,
        health_notes: m.health_notes || null,
        is_head: isHead,
      });
      const allRows = [toRow(head, true), ...members.map((m) => toRow(m, false))];
      const { error: fmErr } = await supabase.from("family_members").insert(allRows);
      if (fmErr) throw fmErr;
      // Persist head-of-family edits to the profiles table.
      try {
        const { error: pErr } = await supabase.from("profiles").update({
          full_name: head.full_name,
          national_id: head.national_id,
          birth_date: head.birth_date,
          gender: head.gender,
          is_war_injured: head.is_war_injured,
          injury_report_url: head.injury_report_url || null,
          chronic_diseases: head.chronic_diseases || null,
          health_notes: head.health_notes || null,
        }).eq("id", user.id);
        if (pErr) throw pErr;
      } catch (e) {
        console.error("[profile update]", e);
        toast.error("تعذّر حفظ بيانات رب الأسرة");
      }
      const wasUpdate = !!appId;
      setAppStatus("pending");
      setRejection(null);
      setEditMode(false);
      setSnapshot("");
      setStep(1);
      // Notify the family that data was updated/submitted
      await supabase.from("notifications").insert({
        user_id: user.id,
        title: wasUpdate ? t("notify.app_updated_title") : t("notify.app_submitted_title"),
        body: wasUpdate ? t("notify.app_updated_body") : t("notify.app_submitted_body"),
        link: "/my-application",
        kind: "info",
      });
      toast.success(wasUpdate ? t("toast.updated") : t("toast.submitted"));
      try { localStorage.removeItem(`baraka2:draft:${user.id}`); } catch {}
      try { await (supabase as any).from("application_drafts").delete().eq("user_id", user.id); } catch {}
      setLastDraftSavedAt("");
      setLastSavedSig(JSON.stringify({ residence, members }));
      // Refresh cache + server timestamp so future conflict checks compare
      // against the new state.
      try {
        const { data: refreshed } = await supabase
          .from("applications").select("*").eq("id", currentAppId!).maybeSingle();
        if (refreshed) {
          setServerUpdatedAt(refreshed.updated_at || null);
          await cacheSet(`app:${user.id}`, { app: refreshed, members });
        }
      } catch {}
      await logHistory({
        status: "success",
        label: wasUpdate ? "تحديث الطلب" : "إرسال الطلب",
        detail: `تم بنجاح في ${new Date().toLocaleString("ar")}`,
      });
    } catch (e: any) {
      const msg = (e?.message || "").toLowerCase();
      if (msg.includes("family_members_national_id_unique") || msg.includes("duplicate") || msg.includes("unique")) {
        toast.error(t("toast.id_exists"));
      } else {
        toast.error(friendlyError(e, "submit"));
      }
      await logHistory({ status: "error", label: "إرسال/تحديث الطلب", detail: e?.message || String(e) });
    }
    setBusy(false);
  };

  if (pageLoading) return <Layout><div className="container py-20 text-center text-muted-foreground">...</div></Layout>;

  return (
    <Layout>
      <section className="container py-8 max-w-4xl">
        {!appId && !settings.registration_open && !settingsLoading && (
          <RegistrationClosedNotice reason={settings.closed_reason} />
        )}
        {(appId || settings.registration_open || settingsLoading) && (
        <>
        <h1 className="text-2xl md:text-3xl text-primary mb-2">{t("my_app.title")}</h1>

        {/* Resume draft banner — shown when an in-progress draft exists. */}
        {pendingDraft && !appId && (
          <Card className="p-4 mb-4 border-accent/40 bg-gradient-to-br from-accent-soft/40 via-background to-background animate-fade-in">
            <div className="flex items-start gap-3 flex-wrap">
              <div className="rounded-full bg-accent/15 p-2 shrink-0">
                <CheckCircle2 className="h-5 w-5 text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-primary">{t("form.resume_draft_title")}</div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t("form.resume_draft_desc", { time: pendingDraft.savedAt || "—" })}
                </p>
                <div className="flex gap-2 mt-3 flex-wrap">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      const d = pendingDraft!;
                      if (d.residence) {
                        setResidence(d.residence);
                        setFamilySizeInput(String(d.residence.family_size || 1));
                      }
                      setMembers(d.members);
                      setPendingDraft(null);
                      // Mark restored data as the saved baseline so the
                      // unsaved-changes guard doesn't immediately fire.
                      setLastSavedSig(JSON.stringify({ residence: d.residence, members: d.members }));
                      toast.success(t("form.draft_restored"));
                    }}
                    className="brand-gradient text-primary-foreground gap-1.5"
                  >
                    <CheckCircle2 className="h-4 w-4" /> {t("form.resume_draft_btn")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try { if (user) localStorage.removeItem(`baraka2:draft:${user.id}`); } catch {}
                      try { if (user) await (supabase as any).from("application_drafts").delete().eq("user_id", user.id); } catch {}
                      setPendingDraft(null);
                      setLastDraftSavedAt("");
                      setLastSavedSig(JSON.stringify({ residence, members: [] }));
                      toast.info(t("form.draft_discarded"));
                    }}
                  >
                    {t("form.discard_draft_btn")}
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        )}

        {appId && !settings.registration_open && !settingsLoading && (
          <Card className="p-4 mb-4 border-warning/40 bg-warning/10">
            <div className="font-bold text-warning-foreground">{t("my_app.update_only_title")}</div>
            <p className="text-sm text-warning-foreground/90">{t("my_app.update_only_subtitle")}</p>
            {settings.closed_reason && (
              <p className="text-xs mt-1"><strong>{t("closed.reason_label")}:</strong> {settings.closed_reason}</p>
            )}
          </Card>
        )}

        {appStatus && (
          <Card className="p-4 mb-6 shadow-card flex items-center gap-3 flex-wrap">
            <span className="text-sm font-semibold">{t("admin.applications")}:</span>
            <span className={`px-3 py-1 rounded-full text-sm font-bold ${
              appStatus === "approved" ? "bg-success/15 text-success" :
              appStatus === "rejected" ? "bg-destructive/15 text-destructive" :
              "bg-warning/20 text-warning-foreground"
            }`}>{t(`status.${appStatus}`)}</span>
            {rejection && (
              <div className="w-full text-sm text-destructive mt-2"><strong>{t("my_app.rejection_reason")}:</strong> {rejection}</div>
            )}
          </Card>
        )}

        {/* Retry banner — appears whenever a submit/update op is queued. */}
        {hasPendingSubmit && (
          <Card className="p-4 mb-6 border-warning/40 bg-gradient-to-br from-warning/15 via-background to-background animate-fade-in">
            <div className="flex items-start gap-3 flex-wrap">
              <div className="rounded-full bg-warning/20 p-2 shrink-0">
                <Send className="h-5 w-5 text-warning-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-primary">طلبك بانتظار الإرسال</div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {pendingSubmitSyncing
                    ? `جاري الإرسال... ${pendingSubmitProgress}%`
                    : typeof navigator !== "undefined" && !navigator.onLine
                    ? "ستتم المحاولة تلقائياً فور عودة الإنترنت."
                    : "اضغط إعادة المحاولة للإرسال الآن."}
                </p>
                {pendingSubmitSyncing && (
                  <div className="mt-2 h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-accent to-success transition-all"
                      style={{ width: `${pendingSubmitProgress}%` }}
                    />
                  </div>
                )}
                <div className="flex gap-2 mt-3 flex-wrap">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => drainOutbox()}
                    disabled={pendingSubmitSyncing || (typeof navigator !== "undefined" && !navigator.onLine)}
                    className="brand-gradient text-primary-foreground gap-1.5"
                  >
                    <Send className="h-4 w-4" />
                    {pendingSubmitSyncing ? "جاري الإرسال..." : "إعادة المحاولة الآن"}
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        )}


        {appId && !editMode ? (
          <ErrorBoundary label="ApplicationSummary">
            <ApplicationSummary
              residence={residence}
              head={head}
              members={members}
              onEditResidence={() => { setSnapshot(currentSig()); setEditMode(true); setStep(1); }}
              onEditMembers={() => { setSnapshot(currentSig()); setEditMode(true); setStep(2); }}
            />
          </ErrorBoundary>
        ) : (
        <ErrorBoundary label="EditForm"><>
        {/* Stepper — labeled, with progress bar and manual save. */}
        {(() => {
          const expectedMembers = Math.max(0, residence.family_size - 1);
          const residenceFilled =
            !!residence.original_residence && !!residence.original_landmark && !!residence.current_landmark;
          const residencePct = residenceFilled ? 50 : 0;
          const memberPct = expectedMembers === 0 ? 50 : Math.min(50, Math.round((members.length / expectedMembers) * 50));
          const totalPct = residencePct + memberPct;
          const saveDraftNow = async () => {
            if (!user) return;
            setSavingDraft(true);
            const sig = JSON.stringify({ residence, members });
            // Always write the local copy first so the user is protected
            // even if the network request below fails.
            try {
              const payload = { residence, members, savedAt: Date.now() };
              localStorage.setItem(`baraka2:draft:${user.id}`, JSON.stringify(payload));
            } catch {}
            const offline = typeof navigator !== "undefined" && !navigator.onLine;
            if (offline) {
              try {
                await enqueueOp({
                  kind: "supabase.upsert",
                  table: "application_drafts",
                  payload: { user_id: user.id, payload: { residence, members } },
                  label: "حفظ مسودة الطلب",
                });
                setLastSavedSig(sig);
                setLastDraftSavedAt(new Date().toLocaleTimeString("ar") + " (سيُرفع عند عودة الإنترنت)");
                toast.success("تم الحفظ محلياً — سيتم رفعه عند عودة الإنترنت");
              } catch (e: any) {
                toast.error(friendlyError(e, "save_draft"));
              } finally {
                setTimeout(() => setSavingDraft(false), 300);
              }
              return;
            }
            try {
              const { error } = await (supabase as any)
                .from("application_drafts")
                .upsert({ user_id: user.id, payload: { residence, members } });
              if (error) throw error;
              setLastSavedSig(sig);
              setLastDraftSavedAt(new Date().toLocaleTimeString("ar"));
              toast.success(t("form.draft_saved_now"));
              drainOutbox();
            } catch (e: any) {
              toast.error(friendlyError(e, "save_draft"), {
                description: "تم حفظ نسخة محلية على هذا الجهاز.",
              });
            } finally {
              setTimeout(() => setSavingDraft(false), 300);
            }
          };
          return (
            <Card className="p-4 mb-6 shadow-card">
              {/* Progress header */}
              <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                <div className="text-sm font-bold text-primary">
                  {t("form.progress_label")} <span className="text-accent">{totalPct}%</span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={saveDraftNow}
                  disabled={savingDraft}
                  className="gap-1.5 h-8 border-accent/40 text-accent hover:bg-accent-soft"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {savingDraft ? "..." : t("form.save_draft")}
                </Button>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden mb-4">
                <div
                  className="h-full bg-gradient-to-r from-accent to-success transition-all"
                  style={{ width: `${totalPct}%` }}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { n: 1, label: t("form.step2"), hint: "السكن وعدد الأسرة", filled: residenceFilled },
                  { n: 2, label: t("form.step3"), hint: `${members.length} / ${expectedMembers} فرد`, filled: expectedMembers > 0 && members.length === expectedMembers },
                ].map(({ n, label, hint, filled }) => {
                  const active = step === n;
                  const done = filled && !active;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setStep(n)}
                      className={`text-start rounded-xl border-2 p-3 transition-all ${
                        active
                          ? "border-accent bg-accent-soft/60 shadow-md"
                          : done
                          ? "border-success/40 bg-success/5"
                          : "border-border bg-muted/30"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-extrabold ${
                            active
                              ? "bg-accent text-accent-foreground"
                              : done
                              ? "bg-success text-white"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {done ? <CheckCircle2 className="h-4 w-4" /> : n}
                        </span>
                        <div className="font-bold text-primary text-sm">
                          {t("form.step")} {n}: {label}
                        </div>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-1 ms-9">{hint}</div>
                    </button>
                  );
                })}
              </div>
              {lastDraftSavedAt && (
                <div className="mt-3 text-[11px] text-success inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" /> {t("form.draft_saved_at", { time: lastDraftSavedAt })}
                </div>
              )}
            </Card>
          );
        })()}

        {step === 1 && (
          <Card className="p-5 md:p-6 shadow-elegant space-y-4">
            <h2 className="text-xl font-bold text-primary">{t("form.step2")}</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>{t("residence.original_residence")}</Label>
                <Input value={residence.original_residence}
                  onChange={(e) => setResidence({ ...residence, original_residence: e.target.value })} />
              </div>
              <div>
                <Label>{t("residence.original_landmark")}</Label>
                <Input value={residence.original_landmark}
                  onChange={(e) => setResidence({ ...residence, original_landmark: e.target.value })} />
              </div>
              <div>
                <Label>{t("residence.current_camp")}</Label>
                <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-input bg-muted/50 text-sm font-semibold text-primary">
                  <Lock className="h-3.5 w-3.5 text-accent" /> {t("app.name")} (Baraka 2)
                </div>
              </div>
              <div>
                <Label>{t("residence.current_landmark")}</Label>
                <Input value={residence.current_landmark}
                  onChange={(e) => setResidence({ ...residence, current_landmark: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <Label>{t("residence.family_size")} <span className="text-muted-foreground text-xs">(شامل رب الأسرة)</span></Label>
                <Select
                  value={familySizeInput}
                  onValueChange={(v) => {
                    setFamilySizeInput(v);
                    const n = parseInt(v, 10);
                    setResidence((r) => ({ ...r, family_size: n }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر عدد الأفراد" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {Array.from({ length: 15 }, (_, i) => i + 1).map((n) => (
                      <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {familySizeInput && (
                  <p className="text-xs text-muted-foreground mt-1">
                    رب الأسرة محسوب — سيتم طلب بيانات {Math.max(0, residence.family_size - 1)} فرد إضافي
                  </p>
                )}
              </div>
            </div>
            <div className="pt-2 border-t border-border">
              <Label>{t("family.martyr_title")}</Label>
              <RadioGroup className="flex gap-4 mt-1" value={residence.has_martyr ? "yes" : "no"}
                onValueChange={(v) => setResidence({ ...residence, has_martyr: v === "yes" })}>
                <label className="flex items-center gap-2"><RadioGroupItem value="yes" />{t("health.yes")}</label>
                <label className="flex items-center gap-2"><RadioGroupItem value="no" />{t("health.no")}</label>
              </RadioGroup>
              {residence.has_martyr && (
                <div className="grid gap-3 md:grid-cols-2 mt-3">
                  <div>
                    <Label>{t("family.martyr_name")}</Label>
                    <Input value={residence.martyr_name}
                      onChange={(e) => setResidence({ ...residence, martyr_name: e.target.value })} />
                  </div>
                  <div>
                    <Label>{t("family.martyr_relationship")}</Label>
                    <Input value={residence.martyr_relationship}
                      onChange={(e) => setResidence({ ...residence, martyr_relationship: e.target.value })} />
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end pt-2">
              <Button onClick={() => {
                if (!residence.original_residence || !residence.original_landmark || !residence.current_landmark) {
                  toast.error(t("form.required")); return;
                }
                setStep(2);
              }} className="brand-gradient text-primary-foreground gap-2">
                {t("form.next")} <Arrow className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        )}

        {step === 2 && (() => {
          const totalMembers = Math.max(0, residence.family_size - 1);
          const filledMembers = members.length;
          return (
          <div className="space-y-4">
            <Card className="p-5 shadow-elegant">
              <div className="flex items-center gap-3 flex-wrap justify-between">
                <div>
                  <h2 className="text-xl font-bold text-primary mb-1 flex items-center gap-2">
                    <Users className="h-5 w-5 text-accent" /> {t("form.step3")}
                  </h2>
                  <p className="text-sm text-muted-foreground">{t("family.title")}</p>
                </div>
                {familySizeInput && (
                  <div className="text-end">
                    <div className="text-xs text-muted-foreground">{t("residence.family_size")}</div>
                    <div className="text-lg font-bold text-primary">
                      {filledMembers} / {totalMembers}
                      {filledMembers === totalMembers && totalMembers > 0 && (
                        <CheckCircle2 className="inline h-5 w-5 text-success ms-1" />
                      )}
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Head of family — editable inline; saved to `profiles` on submit */}
            <div className="relative">
              <div className="absolute -top-2 start-4 z-10 px-2 py-0.5 rounded-full bg-accent text-accent-foreground text-[11px] font-bold shadow">
                رب الأسرة
              </div>
              <MemberCard
                index={0}
                total={1}
                member={head}
                userId={user!.id}
                errors={headErrors}
                lockedFields={HEAD_LOCKED_FIELDS}
                onFieldBlur={(field) => {
                  const msg = validateMemberField(head, field);
                  setHeadErrors((p) => ({ ...p, [field]: msg }));
                }}
                onChange={(nm) => {
                  setHead(nm);
                  if (Object.keys(headErrors).length) {
                    const next: Record<string, string> = {};
                    Object.keys(headErrors).forEach((k) => { next[k] = validateMemberField(nm, k); });
                    setHeadErrors(next);
                  }
                }}
              />
            </div>

            {members.map((m, i) => {
              const errs = memberErrors[i] || {};
              const hasErrors = Object.values(errs).some(Boolean);
              const isCollapsed = !!collapsedMembers[i] && !hasErrors;
              return (
                <div key={i} className="relative">
                  {isCollapsed ? (
                    <Card className="p-4 shadow-card border-success/30 bg-success/5 animate-fade-in">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-3">
                          <div className="rounded-full bg-success/15 p-2">
                            <CheckCircle2 className="h-5 w-5 text-success" />
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">
                              {t("family.person")} {i + 1} / {totalMembers}
                            </div>
                            <div className="font-bold text-primary">
                              {m.full_name || <span className="text-muted-foreground italic">—</span>}
                            </div>
                          </div>
                        </div>
                        <Button type="button" size="sm" variant="outline"
                          onClick={() => setCollapsedMembers((p) => ({ ...p, [i]: false }))}
                          className="gap-2">
                          {t("form.edit_member")}
                        </Button>
                      </div>
                    </Card>
                  ) : (
                    <MemberCard
                      index={i}
                      total={totalMembers}
                      member={m}
                      userId={user!.id}
                      errors={errs}
                      onFieldBlur={(field) => {
                        const msg = validateMemberField(m, field);
                        setMemberErrors((p) => ({ ...p, [i]: { ...(p[i] || {}), [field]: msg } }));
                      }}
                      onChange={(nm) => {
                        setMembers((prev) => prev.map((p, idx) => (idx === i ? nm : p)));
                        if (memberErrors[i]) {
                          const next: Record<string, string> = {};
                          Object.keys(memberErrors[i]).forEach((k) => {
                            next[k] = validateMemberField(nm, k);
                          });
                          setMemberErrors((p) => ({ ...p, [i]: next }));
                        }
                      }}
                      onRemove={appStatus === "approved" ? undefined : () => {
                        setMembers((prev) => prev.filter((_, idx) => idx !== i));
                        setMemberErrors((p) => { const c = { ...p }; delete c[i]; return c; });
                        setCollapsedMembers((p) => { const c = { ...p }; delete c[i]; return c; });
                        // Sync family_size down so it matches the actual member count + head
                        setResidence((r) => {
                          const nextSize = Math.max(1, r.family_size - 1);
                          setFamilySizeInput(String(nextSize));
                          return { ...r, family_size: nextSize };
                        });
                      }}
                      onSave={() => {
                        // Validate this member only
                        const fields = ["full_name","national_id","birth_date","relationship_other","injury_report_url","pregnancy_report_url"];
                        const errsLocal: Record<string, string> = {};
                        for (const f of fields) {
                          const msg = validateMemberField(m, f);
                          if (msg) errsLocal[f] = msg;
                        }
                        if (Object.keys(errsLocal).length) {
                          setMemberErrors((p) => ({ ...p, [i]: errsLocal }));
                          toast.error(t("toast.fix_errors"));
                          return;
                        }
                        setMemberErrors((p) => ({ ...p, [i]: {} }));
                        setCollapsedMembers((p) => ({ ...p, [i]: true }));
                        toast.success(t("form.member_saved"));
                      }}
                    />
                  )}
                </div>
              );
            })}

            {appStatus !== "approved" && (
              <div className="space-y-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    // Auto-grow family_size to fit the new member (head + members)
                    const newCount = members.length + 1;
                    const newFamilySize = newCount + 1; // +1 for head
                    if (!familySizeInput || newFamilySize > residence.family_size) {
                      setResidence((r) => ({ ...r, family_size: newFamilySize }));
                      setFamilySizeInput(String(newFamilySize));
                    }
                    setMembers([...members, emptyMember()]);
                  }}
                  className="w-full gap-2 border-dashed border-accent text-accent hover:bg-accent-soft"
                >
                  <Plus className="h-4 w-4" /> {t("family.add")}
                  <span className="text-xs text-muted-foreground">
                    ({filledMembers + 1} / {Math.max(filledMembers + 1, totalMembers)})
                  </span>
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  سيتم تحديث عدد أفراد الأسرة تلقائياً حسب عدد الأفراد المُضافين
                </p>
              </div>
            )}
            {appStatus === "approved" && (
              <Card className="p-3 text-sm text-center text-success bg-success/5 border-success/30">
                {t("my_app.approved_locked_add")}
              </Card>
            )}

            <div className="flex justify-between gap-3 pt-2">
              <Button variant="outline" onClick={async () => {
                if (appId) {
                  if (!(await guardDiscard())) return;
                  if (snapshot) {
                    try { const s = JSON.parse(snapshot); setResidence(s.residence); setMembers(s.members); } catch {}
                  }
                  setEditMode(false);
                  setSnapshot("");
                } else {
                  setStep(1);
                }
              }} className="gap-2">
                <ArrowBack className="h-4 w-4" /> {appId ? t("form.cancel") : t("form.prev")}
              </Button>
              <Button onClick={openReview} disabled={busy} className="gold-gradient text-accent-foreground shadow-gold gap-2">
                <Eye className="h-4 w-4" /> {t("form.review_summary")}
              </Button>
            </div>
          </div>
          );
        })()}
        </></ErrorBoundary>
        )}
        </>
        )}

        {appId && <AidPreview applicationId={appId} />}
      </section>

      {/* ============== Review Summary Dialog ============== */}
      <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl text-primary flex items-center gap-2">
              <Eye className="h-6 w-6 text-accent" /> {t("form.summary_title")}
            </DialogTitle>
            <DialogDescription>{t("form.summary_intro")}</DialogDescription>
          </DialogHeader>

          {typeof navigator !== "undefined" && !navigator.onLine && (
            <Card className="p-3 border-warning/40 bg-warning/10 text-sm text-warning-foreground flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <strong>أنت خارج الاتصال حالياً.</strong> عند تأكيد الإرسال سيتم وضع الطلب في طابور الانتظار،
                وسيُرسل تلقائياً فور عودة الإنترنت.
              </div>
            </Card>
          )}

          <div className="space-y-4 py-2">
            <Card className="p-4 bg-muted/30 border-accent/20">
              <h3 className="font-bold text-primary mb-3 flex items-center gap-2">
                <Lock className="h-4 w-4 text-accent" /> {t("form.step2")}
              </h3>
              <div className="grid gap-3 md:grid-cols-2 text-sm">
                <div><span className="text-muted-foreground">{t("residence.original_residence")}:</span> <strong>{residence.original_residence || "—"}</strong></div>
                <div><span className="text-muted-foreground">{t("residence.original_landmark")}:</span> <strong>{residence.original_landmark || "—"}</strong></div>
                <div><span className="text-muted-foreground">{t("residence.current_camp")}:</span> <strong>{t("app.name")} (Baraka 2)</strong></div>
                <div><span className="text-muted-foreground">{t("residence.current_landmark")}:</span> <strong>{residence.current_landmark || "—"}</strong></div>
                <div><span className="text-muted-foreground">{t("residence.family_size")}:</span> <strong>{residence.family_size}</strong></div>
                {residence.has_martyr && (
                  <>
                    <div><span className="text-muted-foreground">{t("family.martyr_name")}:</span> <strong>{residence.martyr_name}</strong></div>
                    <div><span className="text-muted-foreground">{t("family.martyr_relationship")}:</span> <strong>{residence.martyr_relationship}</strong></div>
                  </>
                )}
              </div>
            </Card>

            <Card className="p-4 bg-muted/30 border-accent/20">
              <h3 className="font-bold text-primary mb-3 flex items-center gap-2">
                <Users className="h-4 w-4 text-accent" />
                {t("form.step3")} ({members.length} / {Math.max(0, residence.family_size - 1)})
              </h3>
              <div className="space-y-2">
                {/* Head of family at the top — always shown */}
                <div className="p-3 rounded-md bg-accent-soft/40 border border-accent/40 text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="rounded-full bg-accent text-accent-foreground px-2 py-0.5 text-[10px] font-bold">رب الأسرة</span>
                    <strong className="text-primary">{head.full_name || "—"}</strong>
                  </div>
                  <div className="grid gap-1 md:grid-cols-3 text-xs text-muted-foreground ms-2">
                    {head.national_id && <div>{t("form.national_id")}: <strong className="text-foreground">{head.national_id}</strong></div>}
                    <div>{t("form.birth_date")}: <strong className="text-foreground">{formatBirthDate(head.birth_date)}</strong></div>
                    <div>{t("form.gender")}: <strong className="text-foreground">{t(`form.${head.gender}`)}</strong></div>
                  </div>
                </div>
                {members.length === 0 ? (
                  <p className="text-sm text-muted-foreground">لا يوجد أفراد إضافيون</p>
                ) : (
                  members.map((m, i) => (
                    <div key={i} className="p-3 rounded-md bg-background border border-border text-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="rounded-full bg-accent/15 text-accent w-6 h-6 inline-flex items-center justify-center text-xs font-bold">{i + 1}</span>
                        <strong className="text-primary">{m.full_name || "—"}</strong>
                      </div>
                      <div className="grid gap-1 md:grid-cols-3 text-xs text-muted-foreground ms-8">
                        {m.national_id && <div>{t("form.national_id")}: <strong className="text-foreground">{m.national_id}</strong></div>}
                        <div>{t("form.birth_date")}: <strong className="text-foreground">{formatBirthDate(m.birth_date)}</strong></div>
                        <div>{t("form.gender")}: <strong className="text-foreground">{t(`form.${m.gender}`)}</strong></div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSummaryOpen(false)}>
              <ArrowBack className="h-4 w-4 me-1" /> {t("form.back_to_edit")}
            </Button>
            <Button onClick={submit} disabled={busy} className="gold-gradient text-accent-foreground shadow-gold gap-2">
              <Send className="h-4 w-4" /> {busy ? "..." : t("form.confirm_send")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============== Conflict resolution Dialog ============== */}
      <Dialog open={!!conflictData} onOpenChange={(v) => !v && setConflictData(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl text-warning-foreground flex items-center gap-2">
              ⚠️ تعارض في التعديلات
            </DialogTitle>
            <DialogDescription>
              تم تعديل بياناتك من جهاز آخر أو من قِبل الإدارة بتاريخ <strong>{conflictData?.updatedAt}</strong>،
              بعد تحميلك للصفحة. اختر كيف تريد المتابعة:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Card className="p-3 border-accent/30 bg-accent-soft/20">
              <div className="font-bold text-primary mb-1">الاحتفاظ بتعديلاتك (الكتابة فوق)</div>
              <p className="text-xs text-muted-foreground">
                سيتم استبدال البيانات على الخادم بنسختك الحالية. التعديلات الأخرى ستضيع.
              </p>
            </Card>
            <Card className="p-3 border-success/30 bg-success/5">
              <div className="font-bold text-primary mb-1">إعادة تحميل النسخة الأحدث</div>
              <p className="text-xs text-muted-foreground">
                سيتم تجاهل تعديلاتك الحالية وعرض النسخة المحدّثة من الخادم.
              </p>
            </Card>
          </div>
          <DialogFooter className="gap-2 flex-wrap">
            <Button
              variant="outline"
              onClick={() => {
                if (conflictData) {
                  setResidence(conflictData.residence);
                  setFamilySizeInput(String(conflictData.residence.family_size || 1));
                  setMembers(conflictData.members);
                  setServerUpdatedAt(new Date().toISOString());
                  setLastSavedSig(JSON.stringify({ residence: conflictData.residence, members: conflictData.members }));
                  setEditMode(false);
                  toast.info("تم تحميل النسخة الأحدث");
                }
                setConflictData(null);
              }}
            >
              تحميل النسخة الأحدث
            </Button>
            <Button
              className="brand-gradient text-primary-foreground"
              onClick={async () => {
                // User chose to overwrite — bump our snapshot to the
                // latest so the next submit() bypasses the check.
                if (conflictData) {
                  // Read the latest updated_at from server quickly.
                  try {
                    const { data } = await supabase
                      .from("applications").select("updated_at").eq("id", appId!).maybeSingle();
                    if (data?.updated_at) setServerUpdatedAt(data.updated_at);
                  } catch {}
                }
                setConflictData(null);
                // Re-trigger submit
                setTimeout(() => submit(), 100);
              }}
            >
              الاحتفاظ بتعديلاتي
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

// ----------------- Application Summary (read-only view) -----------------
const ApplicationSummary = ({
  residence,
  head,
  members,
  onEditResidence,
  onEditMembers,
}: {
  residence: any;
  head: Member;
  members: Member[];
  onEditResidence: () => void;
  onEditMembers: () => void;
}) => {
  const { t } = useTranslation();
  const Field = ({ label, value }: { label: string; value: any }) => (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium text-foreground">{value || "—"}</div>
    </div>
  );
  const relLabel = (r: string) => {
    const key = `family.rel_${r}`;
    const v = t(key);
    return v === key ? r : v;
  };
  return (
    <div className="space-y-4 animate-fade-in">
      {/* Submitted hero banner */}
      <Card className="p-5 md:p-6 shadow-elegant border-success/30 bg-gradient-to-br from-success/10 via-background to-accent-soft/30">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="rounded-full bg-success/15 p-3 shrink-0">
            <CheckCircle2 className="h-7 w-7 text-success" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl md:text-2xl font-extrabold text-primary mb-1">
              تم استلام طلبك بنجاح
            </h2>
            <p className="text-sm text-muted-foreground">
              فيما يلي ملخص كامل لبيانات الأسرة كما تم تسجيلها. يمكنك تعديل أي قسم في أي وقت.
            </p>
            <div className="mt-3 flex flex-wrap gap-3 text-xs">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/15 text-accent font-bold">
                <Users className="h-3.5 w-3.5" /> {residence.family_size} فرد في الأسرة
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-success/15 text-success font-bold">
                <CheckCircle2 className="h-3.5 w-3.5" /> {members.length} فرد مسجّل
              </span>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-5 shadow-elegant">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <h2 className="text-xl font-bold text-primary">{t("form.step2")}</h2>
          <Button onClick={onEditResidence} className="gold-gradient text-accent-foreground shadow-gold gap-2">
            {t("my_app.edit")}
          </Button>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t("residence.original_residence")} value={residence.original_residence} />
          <Field label={t("residence.original_landmark")} value={residence.original_landmark} />
          <Field label={t("residence.current_camp")} value={`${t("app.name")} (Baraka 2)`} />
          <Field label={t("residence.current_landmark")} value={residence.current_landmark} />
          <Field label={t("residence.family_size")} value={residence.family_size} />
          {residence.has_martyr && (
            <>
              <Field label={t("family.martyr_name")} value={residence.martyr_name} />
              <Field label={t("family.martyr_relationship")} value={residence.martyr_relationship} />
            </>
          )}
        </div>
      </Card>

      <Card className="p-5 shadow-elegant">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <h2 className="text-xl font-bold text-primary">{t("admin.members")} ({members.length})</h2>
          <Button onClick={onEditMembers} className="gold-gradient text-accent-foreground shadow-gold gap-2">
            {t("my_app.edit")}
          </Button>
        </div>
        <div className="space-y-3">
          {/* Head of family — always rendered first, with a distinct badge. */}
          <Card className="p-4 bg-accent-soft/40 border-accent/40">
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <div className="font-bold text-primary flex items-center gap-2">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent text-accent-foreground font-bold">رب الأسرة</span>
                {head.full_name || "—"}
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {head.is_war_injured && <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/15 text-destructive font-bold">{t("health.injured")}</span>}
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3 text-sm">
              <Field label={t("form.national_id")} value={head.national_id} />
              <Field label={t("form.birth_date")} value={formatBirthDate(head.birth_date)} />
              <Field label={t("form.gender")} value={t(`form.${head.gender}`)} />
              {head.chronic_diseases && <Field label={t("health.chronic")} value={head.chronic_diseases} />}
              {head.health_notes && <Field label={t("health.notes")} value={head.health_notes} />}
            </div>
          </Card>
          {members.map((m, i) => (
            <Card key={i} className="p-4 bg-muted/30 border-accent/20">
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <div className="font-bold text-primary">#{i + 1} — {m.full_name}</div>
                <div className="flex gap-1.5 flex-wrap">
                  {m.is_war_injured && <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/15 text-destructive font-bold">{t("health.injured")}</span>}
                  {m.is_pregnant && <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/20 text-accent-foreground font-bold">{t("health_extra.pregnant")}</span>}
                  {m.is_breastfeeding && <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/20 text-accent-foreground font-bold">{t("health_extra.breastfeeding")}</span>}
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-3 text-sm">
                <Field label={t("form.national_id")} value={m.national_id} />
                <Field label={t("form.birth_date")} value={formatBirthDate(m.birth_date)} />
                <Field label={t("form.gender")} value={t(`form.${m.gender}`)} />
                <Field label={t("family.relationship")} value={m.relationship === "other" ? m.relationship_other : relLabel(m.relationship)} />
                {m.chronic_diseases && <Field label={t("health.chronic")} value={m.chronic_diseases} />}
                {m.health_notes && <Field label={t("health.notes")} value={m.health_notes} />}
              </div>
              {(m.injury_report_url || m.pregnancy_report_url) && (
                <div className="flex gap-2 mt-3 flex-wrap">
                  {m.injury_report_url && (
                    <a href={m.injury_report_url} target="_blank" rel="noreferrer"
                      className="text-xs px-3 py-1 rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20">
                      {t("health.report")} (إصابة)
                    </a>
                  )}
                  {m.pregnancy_report_url && (
                    <a href={m.pregnancy_report_url} target="_blank" rel="noreferrer"
                      className="text-xs px-3 py-1 rounded-md bg-accent/10 text-accent-foreground hover:bg-accent/20">
                      {t("health_extra.pregnancy_report")}
                    </a>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
        <div className="flex justify-end mt-4">
          <Button onClick={onEditMembers} variant="outline" className="gap-2">
            {t("my_app.edit")}
          </Button>
        </div>
      </Card>
    </div>
  );
};


export default MyApplication;
