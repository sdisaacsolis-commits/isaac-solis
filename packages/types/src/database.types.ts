export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string;
          actor_user_id: string | null;
          clinic_id: string | null;
          created_at: string;
          entity_id: string | null;
          entity_type: string;
          id: number;
          ip_address: unknown;
          metadata: Json | null;
          new_data: Json | null;
          old_data: Json | null;
          organization_id: string | null;
          user_agent: string | null;
        };
        Insert: {
          action: string;
          actor_user_id?: string | null;
          clinic_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type: string;
          id?: never;
          ip_address?: unknown;
          metadata?: Json | null;
          new_data?: Json | null;
          old_data?: Json | null;
          organization_id?: string | null;
          user_agent?: string | null;
        };
        Update: {
          action?: string;
          actor_user_id?: string | null;
          clinic_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string;
          id?: never;
          ip_address?: unknown;
          metadata?: Json | null;
          new_data?: Json | null;
          old_data?: Json | null;
          organization_id?: string | null;
          user_agent?: string | null;
        };
        Relationships: [];
      };
      clinic_invitations: {
        Row: {
          accepted_at: string | null;
          accepted_by: string | null;
          clinic_id: string;
          created_at: string;
          email: string;
          expires_at: string;
          id: string;
          invited_by: string | null;
          role: Database["public"]["Enums"]["clinic_role"];
          status: Database["public"]["Enums"]["invitation_status"];
          token_hash: string;
          updated_at: string;
        };
        Insert: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          clinic_id: string;
          created_at?: string;
          email: string;
          expires_at: string;
          id?: string;
          invited_by?: string | null;
          role: Database["public"]["Enums"]["clinic_role"];
          status?: Database["public"]["Enums"]["invitation_status"];
          token_hash: string;
          updated_at?: string;
        };
        Update: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          clinic_id?: string;
          created_at?: string;
          email?: string;
          expires_at?: string;
          id?: string;
          invited_by?: string | null;
          role?: Database["public"]["Enums"]["clinic_role"];
          status?: Database["public"]["Enums"]["invitation_status"];
          token_hash?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "clinic_invitations_accepted_by_fkey";
            columns: ["accepted_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "clinic_invitations_clinic_id_fkey";
            columns: ["clinic_id"];
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "clinic_invitations_invited_by_fkey";
            columns: ["invited_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      clinic_members: {
        Row: {
          clinic_id: string;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          id: string;
          job_title: string | null;
          joined_at: string | null;
          professional_license: string | null;
          role: Database["public"]["Enums"]["clinic_role"];
          status: Database["public"]["Enums"]["membership_status"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          clinic_id: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          job_title?: string | null;
          joined_at?: string | null;
          professional_license?: string | null;
          role: Database["public"]["Enums"]["clinic_role"];
          status?: Database["public"]["Enums"]["membership_status"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          clinic_id?: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          job_title?: string | null;
          joined_at?: string | null;
          professional_license?: string | null;
          role?: Database["public"]["Enums"]["clinic_role"];
          status?: Database["public"]["Enums"]["membership_status"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "clinic_members_clinic_id_fkey";
            columns: ["clinic_id"];
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "clinic_members_created_by_fkey";
            columns: ["created_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "clinic_members_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      clinics: {
        Row: {
          accepts_online_booking: boolean;
          address_line_1: string | null;
          address_line_2: string | null;
          city: string | null;
          country_code: string;
          created_at: string;
          created_by: string | null;
          currency: string;
          deleted_at: string | null;
          description: string | null;
          email: string | null;
          id: string;
          is_public: boolean;
          name: string;
          neighborhood: string | null;
          organization_id: string;
          phone: string | null;
          postal_code: string | null;
          slug: string | null;
          state: string | null;
          status: Database["public"]["Enums"]["clinic_status"];
          timezone: string;
          updated_at: string;
        };
        Insert: {
          accepts_online_booking?: boolean;
          address_line_1?: string | null;
          address_line_2?: string | null;
          city?: string | null;
          country_code?: string;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          deleted_at?: string | null;
          description?: string | null;
          email?: string | null;
          id?: string;
          is_public?: boolean;
          name: string;
          neighborhood?: string | null;
          organization_id: string;
          phone?: string | null;
          postal_code?: string | null;
          slug?: string | null;
          state?: string | null;
          status?: Database["public"]["Enums"]["clinic_status"];
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          accepts_online_booking?: boolean;
          address_line_1?: string | null;
          address_line_2?: string | null;
          city?: string | null;
          country_code?: string;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          deleted_at?: string | null;
          description?: string | null;
          email?: string | null;
          id?: string;
          is_public?: boolean;
          name?: string;
          neighborhood?: string | null;
          organization_id?: string;
          phone?: string | null;
          postal_code?: string | null;
          slug?: string | null;
          state?: string | null;
          status?: Database["public"]["Enums"]["clinic_status"];
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "clinics_created_by_fkey";
            columns: ["created_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "clinics_organization_id_fkey";
            columns: ["organization_id"];
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      organization_members: {
        Row: {
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          id: string;
          joined_at: string | null;
          organization_id: string;
          role: Database["public"]["Enums"]["organization_role"];
          status: Database["public"]["Enums"]["membership_status"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          joined_at?: string | null;
          organization_id: string;
          role?: Database["public"]["Enums"]["organization_role"];
          status?: Database["public"]["Enums"]["membership_status"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          joined_at?: string | null;
          organization_id?: string;
          role?: Database["public"]["Enums"]["organization_role"];
          status?: Database["public"]["Enums"]["membership_status"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organization_members_created_by_fkey";
            columns: ["created_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organization_members_organization_id_fkey";
            columns: ["organization_id"];
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organization_members_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      organizations: {
        Row: {
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          id: string;
          included_active_veterinarians: number;
          legal_name: string | null;
          name: string;
          plan_code: string;
          slug: string | null;
          status: Database["public"]["Enums"]["organization_status"];
          tax_id: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          included_active_veterinarians?: number;
          legal_name?: string | null;
          name: string;
          plan_code?: string;
          slug?: string | null;
          status?: Database["public"]["Enums"]["organization_status"];
          tax_id?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          included_active_veterinarians?: number;
          legal_name?: string | null;
          name?: string;
          plan_code?: string;
          slug?: string | null;
          status?: Database["public"]["Enums"]["organization_status"];
          tax_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organizations_created_by_fkey";
            columns: ["created_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          deleted_at: string | null;
          display_name: string | null;
          first_name: string | null;
          id: string;
          is_superadmin: boolean;
          last_name: string | null;
          phone: string | null;
          preferred_locale: string;
          timezone: string;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          display_name?: string | null;
          first_name?: string | null;
          id: string;
          is_superadmin?: boolean;
          last_name?: string | null;
          phone?: string | null;
          preferred_locale?: string;
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          display_name?: string | null;
          first_name?: string | null;
          id?: string;
          is_superadmin?: boolean;
          last_name?: string | null;
          phone?: string | null;
          preferred_locale?: string;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      reserved_slugs: {
        Row: {
          created_at: string;
          reason: string | null;
          slug: string;
        };
        Insert: {
          created_at?: string;
          reason?: string | null;
          slug: string;
        };
        Update: {
          created_at?: string;
          reason?: string | null;
          slug?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_clinic_invitation: { Args: { p_token: string }; Returns: string };
      clinic_belongs_to_organization: {
        Args: { p_clinic_id: string; p_organization_id: string };
        Returns: boolean;
      };
      create_organization_with_owner: {
        Args: {
          p_legal_name?: string;
          p_name: string;
          p_slug?: string;
          p_tax_id?: string;
        };
        Returns: string;
      };
      current_user_is_superadmin: { Args: never; Returns: boolean };
      invite_clinic_member: {
        Args: {
          p_clinic_id: string;
          p_email: string;
          p_role: Database["public"]["Enums"]["clinic_role"];
        };
        Returns: string;
      };
      is_clinic_admin: { Args: { p_clinic_id: string }; Returns: boolean };
      is_clinic_member: { Args: { p_clinic_id: string }; Returns: boolean };
      is_organization_admin: {
        Args: { p_organization_id: string };
        Returns: boolean;
      };
      is_organization_member: {
        Args: { p_organization_id: string };
        Returns: boolean;
      };
      is_organization_owner: {
        Args: { p_organization_id: string };
        Returns: boolean;
      };
      organization_of_clinic: { Args: { p_clinic_id: string }; Returns: string };
    };
    Enums: {
      clinic_role: "clinic_admin" | "veterinarian" | "receptionist" | "assistant";
      clinic_status: "trial" | "active" | "past_due" | "suspended" | "cancelled" | "archived";
      invitation_status: "pending" | "accepted" | "expired" | "revoked";
      membership_status: "invited" | "active" | "suspended" | "removed";
      organization_role: "owner" | "admin" | "billing" | "member";
      organization_status: "active" | "suspended" | "archived";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      clinic_role: ["clinic_admin", "veterinarian", "receptionist", "assistant"],
      clinic_status: ["trial", "active", "past_due", "suspended", "cancelled", "archived"],
      invitation_status: ["pending", "accepted", "expired", "revoked"],
      membership_status: ["invited", "active", "suspended", "removed"],
      organization_role: ["owner", "admin", "billing", "member"],
      organization_status: ["active", "suspended", "archived"],
    },
  },
} as const;
