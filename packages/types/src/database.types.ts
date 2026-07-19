export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          clinic_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: number
          ip_address: unknown
          metadata: Json | null
          new_data: Json | null
          old_data: Json | null
          organization_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          clinic_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: never
          ip_address?: unknown
          metadata?: Json | null
          new_data?: Json | null
          old_data?: Json | null
          organization_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          clinic_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: never
          ip_address?: unknown
          metadata?: Json | null
          new_data?: Json | null
          old_data?: Json | null
          organization_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      clinic_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          clinic_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["clinic_role"]
          status: Database["public"]["Enums"]["invitation_status"]
          token_hash: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          clinic_id: string
          created_at?: string
          email: string
          expires_at: string
          id?: string
          invited_by?: string | null
          role: Database["public"]["Enums"]["clinic_role"]
          status?: Database["public"]["Enums"]["invitation_status"]
          token_hash: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          clinic_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["clinic_role"]
          status?: Database["public"]["Enums"]["invitation_status"]
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_invitations_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "colleague_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_invitations_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_invitations_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "colleague_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_members: {
        Row: {
          clinic_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          job_title: string | null
          joined_at: string | null
          professional_license: string | null
          role: Database["public"]["Enums"]["clinic_role"]
          status: Database["public"]["Enums"]["membership_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          job_title?: string | null
          joined_at?: string | null
          professional_license?: string | null
          role: Database["public"]["Enums"]["clinic_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          job_title?: string | null
          joined_at?: string | null
          professional_license?: string | null
          role?: Database["public"]["Enums"]["clinic_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_members_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_members_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "colleague_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_members_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "colleague_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_pet_relationships: {
        Row: {
          administrative_notes: string | null
          clinic_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          first_visit_at: string | null
          id: string
          internal_patient_number: string | null
          last_visit_at: string | null
          organization_id: string
          pet_id: string
          referred_by_clinic_id: string | null
          source: Database["public"]["Enums"]["clinic_pet_source"]
          status: Database["public"]["Enums"]["clinic_pet_status"]
          updated_at: string
        }
        Insert: {
          administrative_notes?: string | null
          clinic_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          first_visit_at?: string | null
          id?: string
          internal_patient_number?: string | null
          last_visit_at?: string | null
          organization_id: string
          pet_id: string
          referred_by_clinic_id?: string | null
          source?: Database["public"]["Enums"]["clinic_pet_source"]
          status?: Database["public"]["Enums"]["clinic_pet_status"]
          updated_at?: string
        }
        Update: {
          administrative_notes?: string | null
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          first_visit_at?: string | null
          id?: string
          internal_patient_number?: string | null
          last_visit_at?: string | null
          organization_id?: string
          pet_id?: string
          referred_by_clinic_id?: string | null
          source?: Database["public"]["Enums"]["clinic_pet_source"]
          status?: Database["public"]["Enums"]["clinic_pet_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_pet_relationships_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_pet_relationships_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "colleague_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_pet_relationships_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_pet_relationships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_pet_relationships_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_pet_relationships_referred_by_clinic_id_fkey"
            columns: ["referred_by_clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinics: {
        Row: {
          accepts_online_booking: boolean
          address_line_1: string | null
          address_line_2: string | null
          city: string | null
          country_code: string
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          description: string | null
          email: string | null
          id: string
          is_public: boolean
          name: string
          neighborhood: string | null
          organization_id: string
          phone: string | null
          postal_code: string | null
          slug: string | null
          state: string | null
          status: Database["public"]["Enums"]["clinic_status"]
          timezone: string
          updated_at: string
        }
        Insert: {
          accepts_online_booking?: boolean
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          country_code?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          description?: string | null
          email?: string | null
          id?: string
          is_public?: boolean
          name: string
          neighborhood?: string | null
          organization_id: string
          phone?: string | null
          postal_code?: string | null
          slug?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["clinic_status"]
          timezone?: string
          updated_at?: string
        }
        Update: {
          accepts_online_booking?: boolean
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          country_code?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          description?: string | null
          email?: string | null
          id?: string
          is_public?: boolean
          name?: string
          neighborhood?: string | null
          organization_id?: string
          phone?: string | null
          postal_code?: string | null
          slug?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["clinic_status"]
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinics_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "colleague_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinics_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          joined_at: string | null
          organization_id: string
          role: Database["public"]["Enums"]["organization_role"]
          status: Database["public"]["Enums"]["membership_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          joined_at?: string | null
          organization_id: string
          role?: Database["public"]["Enums"]["organization_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          joined_at?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["organization_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "colleague_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "colleague_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          included_active_veterinarians: number
          legal_name: string | null
          name: string
          plan_code: string
          slug: string | null
          status: Database["public"]["Enums"]["organization_status"]
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          included_active_veterinarians?: number
          legal_name?: string | null
          name: string
          plan_code?: string
          slug?: string | null
          status?: Database["public"]["Enums"]["organization_status"]
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          included_active_veterinarians?: number
          legal_name?: string | null
          name?: string
          plan_code?: string
          slug?: string | null
          status?: Database["public"]["Enums"]["organization_status"]
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "colleague_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_clinic_relationships: {
        Row: {
          administrative_notes: string | null
          clinic_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          internal_customer_number: string | null
          organization_id: string
          owner_id: string
          status: Database["public"]["Enums"]["clinic_pet_status"]
          updated_at: string
        }
        Insert: {
          administrative_notes?: string | null
          clinic_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          internal_customer_number?: string | null
          organization_id: string
          owner_id: string
          status?: Database["public"]["Enums"]["clinic_pet_status"]
          updated_at?: string
        }
        Update: {
          administrative_notes?: string | null
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          internal_customer_number?: string | null
          organization_id?: string
          owner_id?: string
          status?: Database["public"]["Enums"]["clinic_pet_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_clinic_relationships_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_clinic_relationships_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "colleague_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_clinic_relationships_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_clinic_relationships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_clinic_relationships_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "pet_owners"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_consents: {
        Row: {
          clinic_id: string | null
          created_at: string
          document_version: string
          granted_at: string
          id: string
          medium: Database["public"]["Enums"]["consent_medium"]
          metadata: Json | null
          organization_id: string | null
          owner_id: string
          recorded_by: string | null
          revoked_at: string | null
          revoked_by: string | null
          type: Database["public"]["Enums"]["consent_type"]
          updated_at: string
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string
          document_version: string
          granted_at?: string
          id?: string
          medium?: Database["public"]["Enums"]["consent_medium"]
          metadata?: Json | null
          organization_id?: string | null
          owner_id: string
          recorded_by?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          type: Database["public"]["Enums"]["consent_type"]
          updated_at?: string
        }
        Update: {
          clinic_id?: string | null
          created_at?: string
          document_version?: string
          granted_at?: string
          id?: string
          medium?: Database["public"]["Enums"]["consent_medium"]
          metadata?: Json | null
          organization_id?: string | null
          owner_id?: string
          recorded_by?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          type?: Database["public"]["Enums"]["consent_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_consents_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_consents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_consents_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "pet_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_consents_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "colleague_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_consents_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_consents_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "colleague_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_consents_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pet_alerts: {
        Row: {
          active: boolean
          clinic_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          organization_id: string
          pet_id: string
          resolved_at: string | null
          resolved_by: string | null
          severity: Database["public"]["Enums"]["pet_alert_severity"]
          title: string
          type: Database["public"]["Enums"]["pet_alert_type"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          clinic_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          organization_id: string
          pet_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["pet_alert_severity"]
          title: string
          type: Database["public"]["Enums"]["pet_alert_type"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          organization_id?: string
          pet_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["pet_alert_severity"]
          title?: string
          type?: Database["public"]["Enums"]["pet_alert_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pet_alerts_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_alerts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "colleague_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_alerts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_alerts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_alerts_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_alerts_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "colleague_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_alerts_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pet_owner_relationships: {
        Row: {
          can_access_portal: boolean
          can_make_medical_decisions: boolean
          can_receive_notifications: boolean
          created_at: string
          created_by: string | null
          deleted_at: string | null
          ended_at: string | null
          id: string
          is_primary: boolean
          owner_id: string
          pet_id: string
          relationship_type: Database["public"]["Enums"]["owner_pet_relationship_type"]
          started_at: string
          status: Database["public"]["Enums"]["owner_pet_relationship_status"]
          updated_at: string
        }
        Insert: {
          can_access_portal?: boolean
          can_make_medical_decisions?: boolean
          can_receive_notifications?: boolean
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          ended_at?: string | null
          id?: string
          is_primary?: boolean
          owner_id: string
          pet_id: string
          relationship_type?: Database["public"]["Enums"]["owner_pet_relationship_type"]
          started_at?: string
          status?: Database["public"]["Enums"]["owner_pet_relationship_status"]
          updated_at?: string
        }
        Update: {
          can_access_portal?: boolean
          can_make_medical_decisions?: boolean
          can_receive_notifications?: boolean
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          ended_at?: string | null
          id?: string
          is_primary?: boolean
          owner_id?: string
          pet_id?: string
          relationship_type?: Database["public"]["Enums"]["owner_pet_relationship_type"]
          started_at?: string
          status?: Database["public"]["Enums"]["owner_pet_relationship_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pet_owner_relationships_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "colleague_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_owner_relationships_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_owner_relationships_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "pet_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_owner_relationships_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      pet_owners: {
        Row: {
          address_line_1: string | null
          address_line_2: string | null
          city: string | null
          country_code: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          display_name: string | null
          email: string | null
          first_name: string
          id: string
          last_name: string
          neighborhood: string | null
          phone: string | null
          postal_code: string | null
          preferred_contact_method: Database["public"]["Enums"]["contact_method"]
          secondary_phone: string | null
          state: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          country_code?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          display_name?: string | null
          email?: string | null
          first_name: string
          id?: string
          last_name: string
          neighborhood?: string | null
          phone?: string | null
          postal_code?: string | null
          preferred_contact_method?: Database["public"]["Enums"]["contact_method"]
          secondary_phone?: string | null
          state?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          country_code?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          display_name?: string | null
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string
          neighborhood?: string | null
          phone?: string | null
          postal_code?: string | null
          preferred_contact_method?: Database["public"]["Enums"]["contact_method"]
          secondary_phone?: string | null
          state?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pet_owners_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "colleague_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_owners_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_owners_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "colleague_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_owners_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pets: {
        Row: {
          approximate_birth_date: boolean
          birth_date: string | null
          breed: string | null
          color: string | null
          created_at: string
          created_by: string | null
          deceased_at: string | null
          deleted_at: string | null
          id: string
          identifying_marks: string | null
          microchip_number: string | null
          name: string
          photo_path: string | null
          sex: Database["public"]["Enums"]["pet_sex"]
          species: Database["public"]["Enums"]["pet_species"]
          sterilized: boolean | null
          updated_at: string
        }
        Insert: {
          approximate_birth_date?: boolean
          birth_date?: string | null
          breed?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          deceased_at?: string | null
          deleted_at?: string | null
          id?: string
          identifying_marks?: string | null
          microchip_number?: string | null
          name: string
          photo_path?: string | null
          sex?: Database["public"]["Enums"]["pet_sex"]
          species: Database["public"]["Enums"]["pet_species"]
          sterilized?: boolean | null
          updated_at?: string
        }
        Update: {
          approximate_birth_date?: boolean
          birth_date?: string | null
          breed?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          deceased_at?: string | null
          deleted_at?: string | null
          id?: string
          identifying_marks?: string | null
          microchip_number?: string | null
          name?: string
          photo_path?: string | null
          sex?: Database["public"]["Enums"]["pet_sex"]
          species?: Database["public"]["Enums"]["pet_species"]
          sterilized?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "colleague_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          deleted_at: string | null
          display_name: string | null
          first_name: string | null
          id: string
          is_superadmin: boolean
          last_name: string | null
          phone: string | null
          preferred_locale: string
          timezone: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string | null
          first_name?: string | null
          id: string
          is_superadmin?: boolean
          last_name?: string | null
          phone?: string | null
          preferred_locale?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string | null
          first_name?: string | null
          id?: string
          is_superadmin?: boolean
          last_name?: string | null
          phone?: string | null
          preferred_locale?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      reserved_slugs: {
        Row: {
          created_at: string
          reason: string | null
          slug: string
        }
        Insert: {
          created_at?: string
          reason?: string | null
          slug: string
        }
        Update: {
          created_at?: string
          reason?: string | null
          slug?: string
        }
        Relationships: []
      }
    }
    Views: {
      colleague_profiles: {
        Row: {
          avatar_url: string | null
          display_name: string | null
          first_name: string | null
          id: string | null
          last_name: string | null
        }
        Insert: {
          avatar_url?: string | null
          display_name?: string | null
          first_name?: string | null
          id?: string | null
          last_name?: string | null
        }
        Update: {
          avatar_url?: string | null
          display_name?: string | null
          first_name?: string | null
          id?: string | null
          last_name?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_clinic_invitation: { Args: { p_token: string }; Returns: string }
      add_pet_owner: {
        Args: {
          p_owner_id: string
          p_pet_id: string
          p_relationship_type?: Database["public"]["Enums"]["owner_pet_relationship_type"]
        }
        Returns: string
      }
      can_access_owner: { Args: { p_owner_id: string }; Returns: boolean }
      can_access_pet: { Args: { p_pet_id: string }; Returns: boolean }
      can_manage_owner: { Args: { p_owner_id: string }; Returns: boolean }
      can_manage_pet: { Args: { p_pet_id: string }; Returns: boolean }
      clinic_belongs_to_organization: {
        Args: { p_clinic_id: string; p_organization_id: string }
        Returns: boolean
      }
      create_clinic_with_admin: {
        Args: {
          p_address_line_1?: string
          p_address_line_2?: string
          p_city?: string
          p_description?: string
          p_email?: string
          p_name: string
          p_neighborhood?: string
          p_organization_id: string
          p_phone?: string
          p_postal_code?: string
          p_slug?: string
          p_state?: string
          p_timezone?: string
        }
        Returns: string
      }
      create_organization_with_owner: {
        Args: {
          p_legal_name?: string
          p_name: string
          p_slug?: string
          p_tax_id?: string
        }
        Returns: string
      }
      current_user_is_superadmin: { Args: never; Returns: boolean }
      has_active_clinic_pet_relationship: {
        Args: { p_clinic_id: string; p_pet_id: string }
        Returns: boolean
      }
      has_active_owner_pet_relationship: {
        Args: { p_owner_id: string; p_pet_id: string }
        Returns: boolean
      }
      invite_clinic_member: {
        Args: {
          p_clinic_id: string
          p_email: string
          p_role: Database["public"]["Enums"]["clinic_role"]
        }
        Returns: string
      }
      is_clinic_admin: { Args: { p_clinic_id: string }; Returns: boolean }
      is_clinic_member: { Args: { p_clinic_id: string }; Returns: boolean }
      is_clinic_operational_staff: {
        Args: { p_clinic_id: string }
        Returns: boolean
      }
      is_organization_admin: {
        Args: { p_organization_id: string }
        Returns: boolean
      }
      is_organization_member: {
        Args: { p_organization_id: string }
        Returns: boolean
      }
      is_organization_owner: {
        Args: { p_organization_id: string }
        Returns: boolean
      }
      link_pet_to_clinic: {
        Args: {
          p_clinic_id: string
          p_internal_patient_number?: string
          p_pet_id: string
          p_source?: Database["public"]["Enums"]["clinic_pet_source"]
        }
        Returns: string
      }
      organization_of_clinic: { Args: { p_clinic_id: string }; Returns: string }
      pet_belongs_to_accessible_clinic: {
        Args: { p_pet_id: string }
        Returns: boolean
      }
      pet_id_from_storage_path: { Args: { p_name: string }; Returns: string }
      register_owner_with_clinic: {
        Args: {
          p_address_line_1?: string
          p_address_line_2?: string
          p_administrative_notes?: string
          p_city?: string
          p_clinic_id: string
          p_email?: string
          p_first_name: string
          p_internal_customer_number?: string
          p_last_name: string
          p_neighborhood?: string
          p_phone?: string
          p_postal_code?: string
          p_preferred_contact_method?: Database["public"]["Enums"]["contact_method"]
          p_secondary_phone?: string
          p_state?: string
        }
        Returns: string
      }
      register_pet_with_relationships: {
        Args: {
          p_approximate_birth_date?: boolean
          p_birth_date?: string
          p_breed?: string
          p_clinic_id: string
          p_color?: string
          p_identifying_marks?: string
          p_internal_patient_number?: string
          p_microchip_number?: string
          p_name: string
          p_owner_id: string
          p_relationship_type?: Database["public"]["Enums"]["owner_pet_relationship_type"]
          p_sex?: Database["public"]["Enums"]["pet_sex"]
          p_source?: Database["public"]["Enums"]["clinic_pet_source"]
          p_species: Database["public"]["Enums"]["pet_species"]
          p_sterilized?: boolean
        }
        Returns: string
      }
      resend_clinic_invitation: {
        Args: { p_invitation_id: string }
        Returns: string
      }
      set_primary_pet_owner: {
        Args: { p_owner_id: string; p_pet_id: string }
        Returns: undefined
      }
      shares_active_organization_with: {
        Args: { p_profile_id: string }
        Returns: boolean
      }
    }
    Enums: {
      clinic_pet_source:
        | "manual"
        | "owner_registration"
        | "invitation"
        | "referral"
        | "import"
      clinic_pet_status:
        | "active"
        | "inactive"
        | "transferred"
        | "blocked"
        | "archived"
      clinic_role:
        | "clinic_admin"
        | "veterinarian"
        | "receptionist"
        | "assistant"
      clinic_status:
        | "trial"
        | "active"
        | "past_due"
        | "suspended"
        | "cancelled"
        | "archived"
      consent_medium: "in_person" | "web" | "email" | "phone"
      consent_type:
        | "privacy_notice"
        | "data_processing"
        | "communications"
        | "clinic_access"
        | "share_records"
        | "portal_terms"
      contact_method: "phone" | "email" | "whatsapp" | "sms"
      invitation_status: "pending" | "accepted" | "expired" | "revoked"
      membership_status: "invited" | "active" | "suspended" | "removed"
      organization_role: "owner" | "admin" | "billing" | "member"
      organization_status: "active" | "suspended" | "archived"
      owner_pet_relationship_status:
        | "active"
        | "inactive"
        | "disputed"
        | "revoked"
      owner_pet_relationship_type:
        | "owner"
        | "guardian"
        | "family_member"
        | "temporary_caregiver"
        | "other"
      pet_alert_severity: "info" | "caution" | "critical"
      pet_alert_type:
        | "aggressive_behavior"
        | "escape_risk"
        | "handling_precaution"
        | "communication_preference"
        | "billing_note"
        | "other"
      pet_sex: "male" | "female" | "unknown"
      pet_species: "dog" | "cat" | "other"
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
      clinic_pet_source: [
        "manual",
        "owner_registration",
        "invitation",
        "referral",
        "import",
      ],
      clinic_pet_status: [
        "active",
        "inactive",
        "transferred",
        "blocked",
        "archived",
      ],
      clinic_role: [
        "clinic_admin",
        "veterinarian",
        "receptionist",
        "assistant",
      ],
      clinic_status: [
        "trial",
        "active",
        "past_due",
        "suspended",
        "cancelled",
        "archived",
      ],
      consent_medium: ["in_person", "web", "email", "phone"],
      consent_type: [
        "privacy_notice",
        "data_processing",
        "communications",
        "clinic_access",
        "share_records",
        "portal_terms",
      ],
      contact_method: ["phone", "email", "whatsapp", "sms"],
      invitation_status: ["pending", "accepted", "expired", "revoked"],
      membership_status: ["invited", "active", "suspended", "removed"],
      organization_role: ["owner", "admin", "billing", "member"],
      organization_status: ["active", "suspended", "archived"],
      owner_pet_relationship_status: [
        "active",
        "inactive",
        "disputed",
        "revoked",
      ],
      owner_pet_relationship_type: [
        "owner",
        "guardian",
        "family_member",
        "temporary_caregiver",
        "other",
      ],
      pet_alert_severity: ["info", "caution", "critical"],
      pet_alert_type: [
        "aggressive_behavior",
        "escape_risk",
        "handling_precaution",
        "communication_preference",
        "billing_note",
        "other",
      ],
      pet_sex: ["male", "female", "unknown"],
      pet_species: ["dog", "cat", "other"],
    },
  },
} as const

