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
      aid_distributions: {
        Row: {
          application_id: string
          contents: string | null
          created_at: string
          created_by: string | null
          delivered_at: string
          id: string
          notes: string | null
          title: string
          updated_at: string
        }
        Insert: {
          application_id: string
          contents?: string | null
          created_at?: string
          created_by?: string | null
          delivered_at?: string
          id?: string
          notes?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          application_id?: string
          contents?: string | null
          created_at?: string
          created_by?: string | null
          delivered_at?: string
          id?: string
          notes?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aid_distributions_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          admin_pin: string
          closed_reason: string | null
          id: number
          registration_open: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          admin_pin?: string
          closed_reason?: string | null
          id?: number
          registration_open?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          admin_pin?: string
          closed_reason?: string | null
          id?: number
          registration_open?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      applications: {
        Row: {
          created_at: string
          current_camp: string
          current_landmark: string
          family_size: number
          has_martyr: boolean
          id: string
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
          family_size: number
          has_martyr?: boolean
          id?: string
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
          family_size?: number
          has_martyr?: boolean
          id?: string
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
      family_members: {
        Row: {
          application_id: string
          birth_date: string
          chronic_diseases: string | null
          created_at: string
          full_name: string
          gender: Database["public"]["Enums"]["gender"]
          health_notes: string | null
          id: string
          injury_report_url: string | null
          is_breastfeeding: boolean
          is_pregnant: boolean
          is_war_injured: boolean
          national_id: string | null
          pregnancy_report_url: string | null
          relationship: Database["public"]["Enums"]["relationship"]
          relationship_other: string | null
        }
        Insert: {
          application_id: string
          birth_date: string
          chronic_diseases?: string | null
          created_at?: string
          full_name: string
          gender: Database["public"]["Enums"]["gender"]
          health_notes?: string | null
          id?: string
          injury_report_url?: string | null
          is_breastfeeding?: boolean
          is_pregnant?: boolean
          is_war_injured?: boolean
          national_id?: string | null
          pregnancy_report_url?: string | null
          relationship: Database["public"]["Enums"]["relationship"]
          relationship_other?: string | null
        }
        Update: {
          application_id?: string
          birth_date?: string
          chronic_diseases?: string | null
          created_at?: string
          full_name?: string
          gender?: Database["public"]["Enums"]["gender"]
          health_notes?: string | null
          id?: string
          injury_report_url?: string | null
          is_breastfeeding?: boolean
          is_pregnant?: boolean
          is_war_injured?: boolean
          national_id?: string | null
          pregnancy_report_url?: string | null
          relationship?: Database["public"]["Enums"]["relationship"]
          relationship_other?: string | null
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
      profiles: {
        Row: {
          alt_phone: string | null
          birth_date: string
          chronic_diseases: string | null
          created_at: string
          email: string | null
          full_name: string
          gender: Database["public"]["Enums"]["gender"]
          health_notes: string | null
          id: string
          injury_report_url: string | null
          is_war_injured: boolean
          marital_status: Database["public"]["Enums"]["marital_status"]
          marital_status_other: string | null
          national_id: string
          phone: string
          updated_at: string
        }
        Insert: {
          alt_phone?: string | null
          birth_date: string
          chronic_diseases?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          gender: Database["public"]["Enums"]["gender"]
          health_notes?: string | null
          id: string
          injury_report_url?: string | null
          is_war_injured?: boolean
          marital_status: Database["public"]["Enums"]["marital_status"]
          marital_status_other?: string | null
          national_id: string
          phone: string
          updated_at?: string
        }
        Update: {
          alt_phone?: string | null
          birth_date?: string
          chronic_diseases?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          gender?: Database["public"]["Enums"]["gender"]
          health_notes?: string | null
          id?: string
          injury_report_url?: string | null
          is_war_injured?: boolean
          marital_status?: Database["public"]["Enums"]["marital_status"]
          marital_status_other?: string | null
          national_id?: string
          phone?: string
          updated_at?: string
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
      find_user_id_by_nid: { Args: { _nid: string }; Returns: string }
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      national_id_exists: {
        Args: { _exclude_user?: string; _nid: string }
        Returns: boolean
      }
      national_id_used_by_others: {
        Args: { _exclude_member?: string; _exclude_user?: string; _nid: string }
        Returns: boolean
      }
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
      app_role: "admin" | "user"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["admin", "user"],
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
