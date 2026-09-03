export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          actor_id: string
          actor_name: string | null
          created_at: string
          details: Json | null
          id: string
          target_id: string | null
          target_label: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_id: string
          actor_name?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string | null
          target_label?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          actor_name?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string | null
          target_label?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      admin_login_attempts: {
        Row: {
          attempted_at: string
          id: string
          ip: string | null
          national_id: string | null
          reason: string | null
          success: boolean
          user_id: string | null
        }
        Insert: {
          attempted_at?: string
          id?: string
          ip?: string | null
          national_id?: string | null
          reason?: string | null
          success?: boolean
          user_id?: string | null
        }
        Update: {
          attempted_at?: string
          id?: string
          ip?: string | null
          national_id?: string | null
          reason?: string | null
          success?: boolean
          user_id?: string | null
        }
        Relationships: []
      }
      admin_otp_codes: {
        Row: {
          code_hash: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          purpose: string
          user_id: string
        }
        Insert: {
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          purpose?: string
          user_id: string
        }
        Update: {
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          purpose?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_secrets: {
        Row: {
          admin_pin: string
          id: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          admin_pin?: string
          id?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          admin_pin?: string
          id?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      admin_sessions: {
        Row: {
          device_label: string | null
          ended_at: string | null
          id: string
          ip: string | null
          last_seen_at: string
          revoked: boolean
          started_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          device_label?: string | null
          ended_at?: string | null
          id?: string
          ip?: string | null
          last_seen_at?: string
          revoked?: boolean
          started_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          device_label?: string | null
          ended_at?: string | null
          id?: string
          ip?: string | null
          last_seen_at?: string
          revoked?: boolean
          started_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          active: boolean
          body: string
          created_at: string
          created_by: string | null
          event_at: string | null
          id: string
          kind: string
          media_type: string | null
          media_url: string | null
          organizer: string | null
          show_in_strip: boolean
          show_popup: boolean
          target_age_max: number | null
          target_age_min: number | null
          target_camp: string | null
          target_gender: string | null
          target_special: string | null
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          body: string
          created_at?: string
          created_by?: string | null
          event_at?: string | null
          id?: string
          kind?: string
          media_type?: string | null
          media_url?: string | null
          organizer?: string | null
          show_in_strip?: boolean
          show_popup?: boolean
          target_age_max?: number | null
          target_age_min?: number | null
          target_camp?: string | null
          target_gender?: string | null
          target_special?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          body?: string
          created_at?: string
          created_by?: string | null
          event_at?: string | null
          id?: string
          kind?: string
          media_type?: string | null
          media_url?: string | null
          organizer?: string | null
          show_in_strip?: boolean
          show_popup?: boolean
          target_age_max?: number | null
          target_age_min?: number | null
          target_camp?: string | null
          target_gender?: string | null
          target_special?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          camp_lock_enabled: boolean
          closed_reason: string | null
          id: number
          registration_open: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          camp_lock_enabled?: boolean
          closed_reason?: string | null
          id?: number
          registration_open?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          camp_lock_enabled?: boolean
          closed_reason?: string | null
          id?: number
          registration_open?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      application_comments: {
        Row: {
          application_id: string
          author_id: string
          author_name: string | null
          body: string
          created_at: string
          id: string
        }
        Insert: {
          application_id: string
          author_id: string
          author_name?: string | null
          body: string
          created_at?: string
          id?: string
        }
        Update: {
          application_id?: string
          author_id?: string
          author_name?: string | null
          body?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      application_drafts: {
        Row: {
          payload: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          payload: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          payload?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      applications: {
        Row: {
          created_at: string
          current_camp: string
          current_landmark: string
          family_no: number | null
          family_size: number
          has_martyr: boolean
          id: string
          is_female_breadwinner: boolean
          martyr_death_certificate_url: string | null
          martyr_name: string | null
          martyr_relationship: string | null
          original_landmark: string
          original_residence: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["application_status"]
          submitted_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_camp?: string
          current_landmark: string
          family_no?: number | null
          family_size: number
          has_martyr?: boolean
          id?: string
          is_female_breadwinner?: boolean
          martyr_death_certificate_url?: string | null
          martyr_name?: string | null
          martyr_relationship?: string | null
          original_landmark: string
          original_residence: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          submitted_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_camp?: string
          current_landmark?: string
          family_no?: number | null
          family_size?: number
          has_martyr?: boolean
          id?: string
          is_female_breadwinner?: boolean
          martyr_death_certificate_url?: string | null
          martyr_name?: string | null
          martyr_relationship?: string | null
          original_landmark?: string
          original_residence?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          submitted_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      camp_roster: {
        Row: {
          added_by: string | null
          camp: string | null
          created_at: string
          head_name: string | null
          id: string
          national_id: string
          note: string | null
          status: string
          updated_at: string
        }
        Insert: {
          added_by?: string | null
          camp?: string | null
          created_at?: string
          head_name?: string | null
          id?: string
          national_id: string
          note?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          added_by?: string | null
          camp?: string | null
          created_at?: string
          head_name?: string | null
          id?: string
          national_id?: string
          note?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      data_update_requests: {
        Row: {
          application_id: string | null
          created_at: string
          fields: string[]
          id: string
          message: string | null
          requested_by: string | null
          status: string
          target_national_id: string | null
          target_user_id: string | null
          updated_at: string
        }
        Insert: {
          application_id?: string | null
          created_at?: string
          fields?: string[]
          id?: string
          message?: string | null
          requested_by?: string | null
          status?: string
          target_national_id?: string | null
          target_user_id?: string | null
          updated_at?: string
        }
        Update: {
          application_id?: string | null
          created_at?: string
          fields?: string[]
          id?: string
          message?: string | null
          requested_by?: string | null
          status?: string
          target_national_id?: string | null
          target_user_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      family_members: {
        Row: {
          application_id: string
          birth_date: string
          chronic_disease_report_url: string | null
          chronic_diseases: string | null
          created_at: string
          full_name: string
          gender: Database["public"]["Enums"]["gender"]
          health_notes: string | null
          id: string
          injury_report_url: string | null
          is_breastfeeding: boolean
          is_head: boolean
          is_pregnant: boolean
          is_special_needs: boolean
          is_war_injured: boolean
          national_id: string | null
          pregnancy_report_url: string | null
          relationship: Database["public"]["Enums"]["relationship"]
          relationship_other: string | null
          special_needs_report_url: string | null
        }
        Insert: {
          application_id: string
          birth_date: string
          chronic_disease_report_url?: string | null
          chronic_diseases?: string | null
          created_at?: string
          full_name: string
          gender: Database["public"]["Enums"]["gender"]
          health_notes?: string | null
          id?: string
          injury_report_url?: string | null
          is_breastfeeding?: boolean
          is_head?: boolean
          is_pregnant?: boolean
          is_special_needs?: boolean
          is_war_injured?: boolean
          national_id?: string | null
          pregnancy_report_url?: string | null
          relationship: Database["public"]["Enums"]["relationship"]
          relationship_other?: string | null
          special_needs_report_url?: string | null
        }
        Update: {
          application_id?: string
          birth_date?: string
          chronic_disease_report_url?: string | null
          chronic_diseases?: string | null
          created_at?: string
          full_name?: string
          gender?: Database["public"]["Enums"]["gender"]
          health_notes?: string | null
          id?: string
          injury_report_url?: string | null
          is_breastfeeding?: boolean
          is_head?: boolean
          is_pregnant?: boolean
          is_special_needs?: boolean
          is_war_injured?: boolean
          national_id?: string | null
          pregnancy_report_url?: string | null
          relationship?: Database["public"]["Enums"]["relationship"]
          relationship_other?: string | null
          special_needs_report_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "family_members_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          link: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      pending_edits: {
        Row: {
          application_id: string
          changes: Json
          created_at: string
          id: string
          reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_notes: string | null
          status: string
          target_id: string | null
          target_kind: string
          user_id: string
        }
        Insert: {
          application_id: string
          changes: Json
          created_at?: string
          id?: string
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          status?: string
          target_id?: string | null
          target_kind: string
          user_id: string
        }
        Update: {
          application_id?: string
          changes?: Json
          created_at?: string
          id?: string
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          status?: string
          target_id?: string | null
          target_kind?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          alt_phone: string | null
          birth_date: string
          chronic_disease_report_url: string | null
          chronic_diseases: string | null
          created_at: string
          email: string | null
          full_name: string
          gender: Database["public"]["Enums"]["gender"]
          health_notes: string | null
          id: string
          injury_report_url: string | null
          is_special_needs: boolean
          is_war_injured: boolean
          marital_status: Database["public"]["Enums"]["marital_status"]
          marital_status_other: string | null
          national_id: string
          phone: string
          special_needs_report_url: string | null
          two_fa_enabled: boolean
          updated_at: string
        }
        Insert: {
          alt_phone?: string | null
          birth_date: string
          chronic_disease_report_url?: string | null
          chronic_diseases?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          gender: Database["public"]["Enums"]["gender"]
          health_notes?: string | null
          id: string
          injury_report_url?: string | null
          is_special_needs?: boolean
          is_war_injured?: boolean
          marital_status: Database["public"]["Enums"]["marital_status"]
          marital_status_other?: string | null
          national_id: string
          phone: string
          special_needs_report_url?: string | null
          two_fa_enabled?: boolean
          updated_at?: string
        }
        Update: {
          alt_phone?: string | null
          birth_date?: string
          chronic_disease_report_url?: string | null
          chronic_diseases?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          gender?: Database["public"]["Enums"]["gender"]
          health_notes?: string | null
          id?: string
          injury_report_url?: string | null
          is_special_needs?: boolean
          is_war_injured?: boolean
          marital_status?: Database["public"]["Enums"]["marital_status"]
          marital_status_other?: string | null
          national_id?: string
          phone?: string
          special_needs_report_url?: string | null
          two_fa_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      saved_filters: {
        Row: {
          created_at: string
          id: string
          name: string
          payload: Json
          scope: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          payload?: Json
          scope?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          payload?: Json
          scope?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_advanced_stats: { Args: never; Returns: Json }
      admin_duplicate_occurrences: {
        Args: { _nid: string }
        Returns: {
          application_id: string
          current_camp: string
          full_name: string
          head_name: string
          kind: string
          member_id: string
          person_id: string
          relationship: string
          status: string
        }[]
      }
      admin_promote_to_review: { Args: { _user_id: string }; Returns: boolean }
      admin_remove_family_member: {
        Args: { _member_id: string }
        Returns: boolean
      }
      admin_set_family_no: {
        Args: { _app_id: string; _family_no: number }
        Returns: boolean
      }
      admin_update_head: {
        Args: {
          _alt_phone?: string
          _birth_date?: string
          _chronic_diseases?: string
          _full_name?: string
          _gender?: Database["public"]["Enums"]["gender"]
          _marital_status?: Database["public"]["Enums"]["marital_status"]
          _national_id?: string
          _phone?: string
          _user_id: string
        }
        Returns: boolean
      }
      apply_pending_edit: {
        Args: { _edit_id: string; _notes?: string }
        Returns: boolean
      }
      bulk_update_application_status: {
        Args: { _ids: string[]; _reason?: string; _status: string }
        Returns: number
      }
      camp_id_allowed: { Args: { _nid: string }; Returns: boolean }
      camp_id_removed: { Args: { _nid: string }; Returns: boolean }
      can_review: { Args: { _user_id: string }; Returns: boolean }
      find_duplicate_persons: {
        Args: never
        Returns: {
          application_ids: string[]
          match_kind: string
          match_value: string
          occurrences: number
          person_names: string[]
        }[]
      }
      find_user_id_by_nid: { Args: { _nid: string }; Returns: string }
      get_phone_hint: { Args: { _nid: string }; Returns: string }
      get_random_security_question: {
        Args: { _exclude_id?: string; _nid: string }
        Returns: {
          kind: string
          label: string
          question_id: string
        }[]
      }
      get_security_questions: {
        Args: { _nid: string }
        Returns: {
          kind: string
          label: string
          question_id: string
        }[]
      }
      grant_admin_by_nid: { Args: { _nid: string }; Returns: boolean }
      grant_role_by_nid: {
        Args: { _nid: string; _role: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      head_account_exists: { Args: { _nid: string }; Returns: boolean }
      is_admin_locked: { Args: { _nid: string }; Returns: boolean }
      is_admin_tier: { Args: { _user_id: string }; Returns: boolean }
      is_only_super_admin: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      list_admins: {
        Args: never
        Returns: {
          created_at: string
          full_name: string
          national_id: string
          phone: string
          role: string
          two_fa_enabled: boolean
          user_id: string
        }[]
      }
      list_incomplete_accounts: {
        Args: never
        Returns: {
          application_id: string
          created_at: string
          family_size: number
          full_name: string
          member_count: number
          missing: string[]
          national_id: string
          phone: string
          reason: string
          status: string
          user_id: string
        }[]
      }
      log_admin_action: {
        Args: {
          _action: string
          _details?: Json
          _target_id?: string
          _target_label?: string
          _target_type?: string
        }
        Returns: undefined
      }
      national_id_exists: {
        Args: { _exclude_user?: string; _nid: string }
        Returns: boolean
      }
      national_id_used_by_others: {
        Args: { _exclude_member?: string; _exclude_user?: string; _nid: string }
        Returns: boolean
      }
      reject_pending_edit: {
        Args: { _edit_id: string; _notes?: string }
        Returns: boolean
      }
      revoke_admin: { Args: { _uid: string }; Returns: boolean }
      verify_security_answers: {
        Args: {
          _k1: string
          _k2: string
          _nid: string
          _q1: string
          _q2: string
          _v1: string
          _v2: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "user"
        | "super_admin"
        | "reviewer"
        | "aid_distributor"
        | "viewer"
      application_status: "pending" | "approved" | "rejected"
      gender: "male" | "female"
      marital_status: "married" | "single" | "widowed" | "divorced" | "other"
      relationship:
        | "wife"
        | "husband"
        | "son"
        | "daughter"
        | "father"
        | "mother"
        | "brother"
        | "sister"
        | "other"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "user",
        "super_admin",
        "reviewer",
        "aid_distributor",
        "viewer",
      ],
      application_status: ["pending", "approved", "rejected"],
      gender: ["male", "female"],
      marital_status: ["married", "single", "widowed", "divorced", "other"],
      relationship: [
        "wife",
        "husband",
        "son",
        "daughter",
        "father",
        "mother",
        "brother",
        "sister",
        "other",
      ],
    },
  },
} as const
