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
      appointment_folio_counters: {
        Row: {
          clinic_id: string
          counter: number
          year: number
        }
        Insert: {
          clinic_id: string
          counter?: number
          year: number
        }
        Update: {
          clinic_id?: string
          counter?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "appointment_folio_counters_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_notifications: {
        Row: {
          appointment_id: string
          attempts: number
          channel: Database["public"]["Enums"]["notification_channel"]
          clinic_id: string
          created_at: string
          id: string
          idempotency_key: string
          last_error: string | null
          organization_id: string
          payload: Json
          recipient_email: string | null
          recipient_name: string | null
          scheduled_for: string
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_status"]
          type: Database["public"]["Enums"]["appointment_notification_type"]
          updated_at: string
        }
        Insert: {
          appointment_id: string
          attempts?: number
          channel?: Database["public"]["Enums"]["notification_channel"]
          clinic_id: string
          created_at?: string
          id?: string
          idempotency_key: string
          last_error?: string | null
          organization_id: string
          payload?: Json
          recipient_email?: string | null
          recipient_name?: string | null
          scheduled_for?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          type: Database["public"]["Enums"]["appointment_notification_type"]
          updated_at?: string
        }
        Update: {
          appointment_id?: string
          attempts?: number
          channel?: Database["public"]["Enums"]["notification_channel"]
          clinic_id?: string
          created_at?: string
          id?: string
          idempotency_key?: string
          last_error?: string | null
          organization_id?: string
          payload?: Json
          recipient_email?: string | null
          recipient_name?: string | null
          scheduled_for?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          type?: Database["public"]["Enums"]["appointment_notification_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_notifications_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_notifications_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_services: {
        Row: {
          appointment_id: string
          category: Database["public"]["Enums"]["service_category"]
          clinic_service_id: string
          created_at: string
          currency: string
          duration_minutes: number
          id: string
          price_cents: number
          quantity: number
          service_name: string
          updated_at: string
        }
        Insert: {
          appointment_id: string
          category: Database["public"]["Enums"]["service_category"]
          clinic_service_id: string
          created_at?: string
          currency?: string
          duration_minutes: number
          id?: string
          price_cents: number
          quantity?: number
          service_name: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string
          category?: Database["public"]["Enums"]["service_category"]
          clinic_service_id?: string
          created_at?: string
          currency?: string
          duration_minutes?: number
          id?: string
          price_cents?: number
          quantity?: number
          service_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_services_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_services_clinic_service_id_fkey"
            columns: ["clinic_service_id"]
            isOneToOne: false
            referencedRelation: "clinic_services"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_status_history: {
        Row: {
          appointment_id: string
          changed_by: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["appointment_status"] | null
          id: string
          reason: string | null
          to_status: Database["public"]["Enums"]["appointment_status"]
        }
        Insert: {
          appointment_id: string
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["appointment_status"] | null
          id?: string
          reason?: string | null
          to_status: Database["public"]["Enums"]["appointment_status"]
        }
        Update: {
          appointment_id?: string
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["appointment_status"] | null
          id?: string
          reason?: string | null
          to_status?: Database["public"]["Enums"]["appointment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "appointment_status_history_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "colleague_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          checked_in_at: string | null
          clinic_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          emergency: boolean
          emergency_reason: string | null
          folio: string
          id: string
          no_show_at: string | null
          occupies_from: string
          occupies_until: string
          organization_id: string
          owner_id: string
          pet_id: string
          reason: string | null
          scheduled_end: string
          scheduled_start: string
          source: Database["public"]["Enums"]["appointment_source"]
          staff_notes: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
          veterinarian_clinic_member_id: string
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          checked_in_at?: string | null
          clinic_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          emergency?: boolean
          emergency_reason?: string | null
          folio: string
          id?: string
          no_show_at?: string | null
          occupies_from: string
          occupies_until: string
          organization_id: string
          owner_id: string
          pet_id: string
          reason?: string | null
          scheduled_end: string
          scheduled_start: string
          source?: Database["public"]["Enums"]["appointment_source"]
          staff_notes?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
          veterinarian_clinic_member_id: string
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          checked_in_at?: string | null
          clinic_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          emergency?: boolean
          emergency_reason?: string | null
          folio?: string
          id?: string
          no_show_at?: string | null
          occupies_from?: string
          occupies_until?: string
          organization_id?: string
          owner_id?: string
          pet_id?: string
          reason?: string | null
          scheduled_end?: string
          scheduled_start?: string
          source?: Database["public"]["Enums"]["appointment_source"]
          staff_notes?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
          veterinarian_clinic_member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "colleague_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "colleague_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "pet_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_veterinarian_clinic_member_id_fkey"
            columns: ["veterinarian_clinic_member_id"]
            isOneToOne: false
            referencedRelation: "clinic_members"
            referencedColumns: ["id"]
          },
        ]
      }
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
      clinic_service_veterinarians: {
        Row: {
          clinic_member_id: string
          clinic_service_id: string
          created_at: string
          created_by: string | null
          id: string
          updated_at: string
        }
        Insert: {
          clinic_member_id: string
          clinic_service_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          updated_at?: string
        }
        Update: {
          clinic_member_id?: string
          clinic_service_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_service_veterinarians_clinic_member_id_fkey"
            columns: ["clinic_member_id"]
            isOneToOne: false
            referencedRelation: "clinic_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_service_veterinarians_clinic_service_id_fkey"
            columns: ["clinic_service_id"]
            isOneToOne: false
            referencedRelation: "clinic_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_service_veterinarians_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "colleague_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_service_veterinarians_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_services: {
        Row: {
          active: boolean
          buffer_after_minutes: number
          buffer_before_minutes: number
          category: Database["public"]["Enums"]["service_category"]
          clinic_id: string
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          duration_minutes: number
          id: string
          name: string
          organization_id: string
          price_cents: number
          requires_veterinarian: boolean
          updated_at: string
        }
        Insert: {
          active?: boolean
          buffer_after_minutes?: number
          buffer_before_minutes?: number
          category: Database["public"]["Enums"]["service_category"]
          clinic_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          duration_minutes: number
          id?: string
          name: string
          organization_id: string
          price_cents?: number
          requires_veterinarian?: boolean
          updated_at?: string
        }
        Update: {
          active?: boolean
          buffer_after_minutes?: number
          buffer_before_minutes?: number
          category?: Database["public"]["Enums"]["service_category"]
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          name?: string
          organization_id?: string
          price_cents?: number
          requires_veterinarian?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_services_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_services_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "colleague_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_services_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_services_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_encounters: {
        Row: {
          appointment_id: string | null
          chief_complaint: string | null
          clinic_id: string
          clinic_pet_relationship_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          encounter_type: Database["public"]["Enums"]["encounter_type"]
          examination_skipped_reason: string | null
          finalized_at: string | null
          finalized_by: string | null
          folio: string
          id: string
          internal_notes: string | null
          organization_id: string
          pet_id: string
          responsible_veterinarian_clinic_member_id: string
          started_at: string
          status: Database["public"]["Enums"]["encounter_status"]
          updated_at: string
          vitals_skipped_reason: string | null
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          appointment_id?: string | null
          chief_complaint?: string | null
          clinic_id: string
          clinic_pet_relationship_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          encounter_type?: Database["public"]["Enums"]["encounter_type"]
          examination_skipped_reason?: string | null
          finalized_at?: string | null
          finalized_by?: string | null
          folio: string
          id?: string
          internal_notes?: string | null
          organization_id: string
          pet_id: string
          responsible_veterinarian_clinic_member_id: string
          started_at?: string
          status?: Database["public"]["Enums"]["encounter_status"]
          updated_at?: string
          vitals_skipped_reason?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          appointment_id?: string | null
          chief_complaint?: string | null
          clinic_id?: string
          clinic_pet_relationship_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          encounter_type?: Database["public"]["Enums"]["encounter_type"]
          examination_skipped_reason?: string | null
          finalized_at?: string | null
          finalized_by?: string | null
          folio?: string
          id?: string
          internal_notes?: string | null
          organization_id?: string
          pet_id?: string
          responsible_veterinarian_clinic_member_id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["encounter_status"]
          updated_at?: string
          vitals_skipped_reason?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clinical_encounters_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_encounters_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_encounters_clinic_pet_relationship_id_fkey"
            columns: ["clinic_pet_relationship_id"]
            isOneToOne: false
            referencedRelation: "clinic_pet_relationships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_encounters_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "colleague_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_encounters_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_encounters_finalized_by_fkey"
            columns: ["finalized_by"]
            isOneToOne: false
            referencedRelation: "colleague_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_encounters_finalized_by_fkey"
            columns: ["finalized_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_encounters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_encounters_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_encounters_responsible_veterinarian_clinic_member_fkey"
            columns: ["responsible_veterinarian_clinic_member_id"]
            isOneToOne: false
            referencedRelation: "clinic_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_encounters_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "colleague_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_encounters_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_files: {
        Row: {
          clinic_id: string
          created_at: string
          deleted_at: string | null
          description: string | null
          encounter_id: string
          id: string
          kind: Database["public"]["Enums"]["clinical_file_kind"]
          mime_type: string
          organization_id: string
          original_filename: string
          pet_id: string
          size_bytes: number
          storage_path: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          encounter_id: string
          id?: string
          kind?: Database["public"]["Enums"]["clinical_file_kind"]
          mime_type: string
          organization_id: string
          original_filename: string
          pet_id: string
          size_bytes: number
          storage_path: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          encounter_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["clinical_file_kind"]
          mime_type?: string
          organization_id?: string
          original_filename?: string
          pet_id?: string
          size_bytes?: number
          storage_path?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clinical_files_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_files_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "clinical_encounters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_files_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_files_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "colleague_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_folio_counters: {
        Row: {
          clinic_id: string
          counter: number
          year: number
        }
        Insert: {
          clinic_id: string
          counter?: number
          year: number
        }
        Update: {
          clinic_id?: string
          counter?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "clinical_folio_counters_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_notes: {
        Row: {
          assessment: string | null
          author_clinic_member_id: string | null
          created_at: string
          encounter_id: string
          history_summary: string | null
          id: string
          objective: string | null
          plan: string | null
          subjective: string | null
          updated_at: string
          version: number
        }
        Insert: {
          assessment?: string | null
          author_clinic_member_id?: string | null
          created_at?: string
          encounter_id: string
          history_summary?: string | null
          id?: string
          objective?: string | null
          plan?: string | null
          subjective?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          assessment?: string | null
          author_clinic_member_id?: string | null
          created_at?: string
          encounter_id?: string
          history_summary?: string | null
          id?: string
          objective?: string | null
          plan?: string | null
          subjective?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "clinical_notes_author_clinic_member_id_fkey"
            columns: ["author_clinic_member_id"]
            isOneToOne: false
            referencedRelation: "clinic_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_notes_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: true
            referencedRelation: "clinical_encounters"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_vitals: {
        Row: {
          blood_pressure_diastolic: number | null
          blood_pressure_systolic: number | null
          body_condition_score: number | null
          capillary_refill_seconds: number | null
          created_at: string
          encounter_id: string
          heart_rate_bpm: number | null
          hydration_status: string | null
          id: string
          mucous_membranes: string | null
          notes: string | null
          pain_score: number | null
          recorded_at: string
          recorded_by: string | null
          respiratory_rate_bpm: number | null
          temperature_c: number | null
          updated_at: string
          weight_kg: number | null
        }
        Insert: {
          blood_pressure_diastolic?: number | null
          blood_pressure_systolic?: number | null
          body_condition_score?: number | null
          capillary_refill_seconds?: number | null
          created_at?: string
          encounter_id: string
          heart_rate_bpm?: number | null
          hydration_status?: string | null
          id?: string
          mucous_membranes?: string | null
          notes?: string | null
          pain_score?: number | null
          recorded_at?: string
          recorded_by?: string | null
          respiratory_rate_bpm?: number | null
          temperature_c?: number | null
          updated_at?: string
          weight_kg?: number | null
        }
        Update: {
          blood_pressure_diastolic?: number | null
          blood_pressure_systolic?: number | null
          body_condition_score?: number | null
          capillary_refill_seconds?: number | null
          created_at?: string
          encounter_id?: string
          heart_rate_bpm?: number | null
          hydration_status?: string | null
          id?: string
          mucous_membranes?: string | null
          notes?: string | null
          pain_score?: number | null
          recorded_at?: string
          recorded_by?: string | null
          respiratory_rate_bpm?: number | null
          temperature_c?: number | null
          updated_at?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "clinical_vitals_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "clinical_encounters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_vitals_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "clinic_members"
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
      device_tokens: {
        Row: {
          created_at: string
          id: string
          last_seen_at: string
          platform: Database["public"]["Enums"]["device_platform"]
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_seen_at?: string
          platform: Database["public"]["Enums"]["device_platform"]
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_seen_at?: string
          platform?: Database["public"]["Enums"]["device_platform"]
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      diagnoses: {
        Row: {
          certainty: Database["public"]["Enums"]["diagnosis_certainty"]
          code: string | null
          code_system: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          diagnosed_by: string | null
          encounter_id: string
          id: string
          is_primary: boolean
          name: string
          updated_at: string
        }
        Insert: {
          certainty?: Database["public"]["Enums"]["diagnosis_certainty"]
          code?: string | null
          code_system?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          diagnosed_by?: string | null
          encounter_id: string
          id?: string
          is_primary?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          certainty?: Database["public"]["Enums"]["diagnosis_certainty"]
          code?: string | null
          code_system?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          diagnosed_by?: string | null
          encounter_id?: string
          id?: string
          is_primary?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "diagnoses_diagnosed_by_fkey"
            columns: ["diagnosed_by"]
            isOneToOne: false
            referencedRelation: "clinic_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnoses_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "clinical_encounters"
            referencedColumns: ["id"]
          },
        ]
      }
      encounter_addenda: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          encounter_id: string
          id: string
          reason: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          encounter_id: string
          id?: string
          reason: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          encounter_id?: string
          id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "encounter_addenda_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "colleague_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encounter_addenda_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encounter_addenda_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "clinical_encounters"
            referencedColumns: ["id"]
          },
        ]
      }
      encounter_examinations: {
        Row: {
          additional_findings: Json | null
          attitude: string | null
          body_condition: string | null
          cardiovascular: string | null
          created_at: string
          digestive: string | null
          ears: string | null
          encounter_id: string
          examined_by: string | null
          eyes: string | null
          general_condition: string | null
          id: string
          lymph_nodes: string | null
          musculoskeletal: string | null
          neurological: string | null
          observations: string | null
          oral_cavity: string | null
          respiratory: string | null
          skin_and_coat: string | null
          updated_at: string
          urinary: string | null
          version: number
        }
        Insert: {
          additional_findings?: Json | null
          attitude?: string | null
          body_condition?: string | null
          cardiovascular?: string | null
          created_at?: string
          digestive?: string | null
          ears?: string | null
          encounter_id: string
          examined_by?: string | null
          eyes?: string | null
          general_condition?: string | null
          id?: string
          lymph_nodes?: string | null
          musculoskeletal?: string | null
          neurological?: string | null
          observations?: string | null
          oral_cavity?: string | null
          respiratory?: string | null
          skin_and_coat?: string | null
          updated_at?: string
          urinary?: string | null
          version?: number
        }
        Update: {
          additional_findings?: Json | null
          attitude?: string | null
          body_condition?: string | null
          cardiovascular?: string | null
          created_at?: string
          digestive?: string | null
          ears?: string | null
          encounter_id?: string
          examined_by?: string | null
          eyes?: string | null
          general_condition?: string | null
          id?: string
          lymph_nodes?: string | null
          musculoskeletal?: string | null
          neurological?: string | null
          observations?: string | null
          oral_cavity?: string | null
          respiratory?: string | null
          skin_and_coat?: string | null
          updated_at?: string
          urinary?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "encounter_examinations_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: true
            referencedRelation: "clinical_encounters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encounter_examinations_examined_by_fkey"
            columns: ["examined_by"]
            isOneToOne: false
            referencedRelation: "clinic_members"
            referencedColumns: ["id"]
          },
        ]
      }
      encounter_follow_ups: {
        Row: {
          appointment_id: string | null
          created_at: string
          encounter_id: string
          id: string
          reason: string
          recommended_within_days: number | null
          service_id: string | null
          status: Database["public"]["Enums"]["follow_up_status"]
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string
          encounter_id: string
          id?: string
          reason: string
          recommended_within_days?: number | null
          service_id?: string | null
          status?: Database["public"]["Enums"]["follow_up_status"]
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          created_at?: string
          encounter_id?: string
          id?: string
          reason?: string
          recommended_within_days?: number | null
          service_id?: string | null
          status?: Database["public"]["Enums"]["follow_up_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "encounter_follow_ups_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encounter_follow_ups_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "clinical_encounters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encounter_follow_ups_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "clinic_services"
            referencedColumns: ["id"]
          },
        ]
      }
      encounter_status_history: {
        Row: {
          changed_by: string | null
          clinic_id: string
          created_at: string
          encounter_id: string
          from_status: Database["public"]["Enums"]["encounter_status"] | null
          id: string
          metadata: Json | null
          organization_id: string
          reason: string | null
          to_status: Database["public"]["Enums"]["encounter_status"]
        }
        Insert: {
          changed_by?: string | null
          clinic_id: string
          created_at?: string
          encounter_id: string
          from_status?: Database["public"]["Enums"]["encounter_status"] | null
          id?: string
          metadata?: Json | null
          organization_id: string
          reason?: string | null
          to_status: Database["public"]["Enums"]["encounter_status"]
        }
        Update: {
          changed_by?: string | null
          clinic_id?: string
          created_at?: string
          encounter_id?: string
          from_status?: Database["public"]["Enums"]["encounter_status"] | null
          id?: string
          metadata?: Json | null
          organization_id?: string
          reason?: string | null
          to_status?: Database["public"]["Enums"]["encounter_status"]
        }
        Relationships: [
          {
            foreignKeyName: "encounter_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "colleague_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encounter_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encounter_status_history_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encounter_status_history_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "clinical_encounters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encounter_status_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      encounter_treatments: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          dosage_text: string | null
          duration_text: string | null
          encounter_id: string
          frequency_text: string | null
          id: string
          instructions: string | null
          name: string
          performed_during_encounter: boolean
          route_text: string | null
          treatment_type: Database["public"]["Enums"]["treatment_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          dosage_text?: string | null
          duration_text?: string | null
          encounter_id: string
          frequency_text?: string | null
          id?: string
          instructions?: string | null
          name: string
          performed_during_encounter?: boolean
          route_text?: string | null
          treatment_type?: Database["public"]["Enums"]["treatment_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          dosage_text?: string | null
          duration_text?: string | null
          encounter_id?: string
          frequency_text?: string | null
          id?: string
          instructions?: string | null
          name?: string
          performed_during_encounter?: boolean
          route_text?: string | null
          treatment_type?: Database["public"]["Enums"]["treatment_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "encounter_treatments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "colleague_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encounter_treatments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encounter_treatments_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "clinical_encounters"
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
      portal_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          clinic_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          organization_id: string
          owner_id: string
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
          organization_id: string
          owner_id: string
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
          organization_id?: string
          owner_id?: string
          status?: Database["public"]["Enums"]["invitation_status"]
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_invitations_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "colleague_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_invitations_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_invitations_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "colleague_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_invitations_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "pet_owners"
            referencedColumns: ["id"]
          },
        ]
      }
      prescription_documents: {
        Row: {
          content: Json
          created_at: string
          generated_at: string
          generated_by: string | null
          id: string
          mime_type: string | null
          prescription_id: string
          sha256: string
          size_bytes: number | null
          storage_path: string | null
          template_version: number
        }
        Insert: {
          content: Json
          created_at?: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          mime_type?: string | null
          prescription_id: string
          sha256: string
          size_bytes?: number | null
          storage_path?: string | null
          template_version?: number
        }
        Update: {
          content?: Json
          created_at?: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          mime_type?: string | null
          prescription_id?: string
          sha256?: string
          size_bytes?: number | null
          storage_path?: string | null
          template_version?: number
        }
        Relationships: [
          {
            foreignKeyName: "prescription_documents_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "colleague_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescription_documents_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescription_documents_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: true
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      prescription_folio_counters: {
        Row: {
          clinic_id: string
          counter: number
          year: number
        }
        Insert: {
          clinic_id: string
          counter?: number
          year: number
        }
        Update: {
          clinic_id?: string
          counter?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "prescription_folio_counters_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      prescription_items: {
        Row: {
          active_ingredient: string | null
          as_needed: boolean
          concentration: string | null
          created_at: string
          dosage_text: string
          duration_text: string
          end_date: string | null
          frequency_text: string
          id: string
          instructions: string | null
          medication_name: string
          notes: string | null
          position: number
          prescription_id: string
          presentation: string | null
          quantity_text: string | null
          route_text: string
          start_date: string | null
          updated_at: string
        }
        Insert: {
          active_ingredient?: string | null
          as_needed?: boolean
          concentration?: string | null
          created_at?: string
          dosage_text: string
          duration_text: string
          end_date?: string | null
          frequency_text: string
          id?: string
          instructions?: string | null
          medication_name: string
          notes?: string | null
          position: number
          prescription_id: string
          presentation?: string | null
          quantity_text?: string | null
          route_text: string
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          active_ingredient?: string | null
          as_needed?: boolean
          concentration?: string | null
          created_at?: string
          dosage_text?: string
          duration_text?: string
          end_date?: string | null
          frequency_text?: string
          id?: string
          instructions?: string | null
          medication_name?: string
          notes?: string | null
          position?: number
          prescription_id?: string
          presentation?: string | null
          quantity_text?: string | null
          route_text?: string
          start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescription_items_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      prescription_status_history: {
        Row: {
          changed_by: string | null
          clinic_id: string
          created_at: string
          from_status: Database["public"]["Enums"]["prescription_status"] | null
          id: string
          metadata: Json | null
          organization_id: string
          prescription_id: string
          reason: string | null
          to_status: Database["public"]["Enums"]["prescription_status"]
        }
        Insert: {
          changed_by?: string | null
          clinic_id: string
          created_at?: string
          from_status?:
            | Database["public"]["Enums"]["prescription_status"]
            | null
          id?: string
          metadata?: Json | null
          organization_id: string
          prescription_id: string
          reason?: string | null
          to_status: Database["public"]["Enums"]["prescription_status"]
        }
        Update: {
          changed_by?: string | null
          clinic_id?: string
          created_at?: string
          from_status?:
            | Database["public"]["Enums"]["prescription_status"]
            | null
          id?: string
          metadata?: Json | null
          organization_id?: string
          prescription_id?: string
          reason?: string | null
          to_status?: Database["public"]["Enums"]["prescription_status"]
        }
        Relationships: [
          {
            foreignKeyName: "prescription_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "colleague_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescription_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescription_status_history_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescription_status_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescription_status_history_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      prescriptions: {
        Row: {
          clinic_id: string
          clinic_pet_relationship_id: string
          clinic_snapshot: Json | null
          clinical_indication: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          encounter_id: string
          folio: string | null
          general_instructions: string | null
          id: string
          issued_at: string | null
          issued_by: string | null
          organization_id: string
          owner_snapshot: Json | null
          pet_id: string
          pet_snapshot: Json | null
          prescriber_clinic_member_id: string
          prescriber_snapshot: Json | null
          responsible_owner_id: string
          status: Database["public"]["Enums"]["prescription_status"]
          superseded_by_prescription_id: string | null
          supersedes_prescription_id: string | null
          updated_at: string
          valid_until: string | null
          version: number
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          clinic_id: string
          clinic_pet_relationship_id: string
          clinic_snapshot?: Json | null
          clinical_indication?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          encounter_id: string
          folio?: string | null
          general_instructions?: string | null
          id?: string
          issued_at?: string | null
          issued_by?: string | null
          organization_id: string
          owner_snapshot?: Json | null
          pet_id: string
          pet_snapshot?: Json | null
          prescriber_clinic_member_id: string
          prescriber_snapshot?: Json | null
          responsible_owner_id: string
          status?: Database["public"]["Enums"]["prescription_status"]
          superseded_by_prescription_id?: string | null
          supersedes_prescription_id?: string | null
          updated_at?: string
          valid_until?: string | null
          version?: number
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          clinic_id?: string
          clinic_pet_relationship_id?: string
          clinic_snapshot?: Json | null
          clinical_indication?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          encounter_id?: string
          folio?: string | null
          general_instructions?: string | null
          id?: string
          issued_at?: string | null
          issued_by?: string | null
          organization_id?: string
          owner_snapshot?: Json | null
          pet_id?: string
          pet_snapshot?: Json | null
          prescriber_clinic_member_id?: string
          prescriber_snapshot?: Json | null
          responsible_owner_id?: string
          status?: Database["public"]["Enums"]["prescription_status"]
          superseded_by_prescription_id?: string | null
          supersedes_prescription_id?: string | null
          updated_at?: string
          valid_until?: string | null
          version?: number
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prescriptions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_clinic_pet_relationship_id_fkey"
            columns: ["clinic_pet_relationship_id"]
            isOneToOne: false
            referencedRelation: "clinic_pet_relationships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "colleague_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "clinical_encounters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "colleague_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_prescriber_clinic_member_id_fkey"
            columns: ["prescriber_clinic_member_id"]
            isOneToOne: false
            referencedRelation: "clinic_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_responsible_owner_id_fkey"
            columns: ["responsible_owner_id"]
            isOneToOne: false
            referencedRelation: "pet_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_superseded_by_prescription_id_fkey"
            columns: ["superseded_by_prescription_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_supersedes_prescription_id_fkey"
            columns: ["supersedes_prescription_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "colleague_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_voided_by_fkey"
            columns: ["voided_by"]
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
      public_booking_requests: {
        Row: {
          appointment_id: string
          clinic_id: string
          created_at: string
          guest_email: string
          id: string
          organization_id: string
          owner_id: string
          pet_id: string
          request_id: string | null
        }
        Insert: {
          appointment_id: string
          clinic_id: string
          created_at?: string
          guest_email: string
          id?: string
          organization_id: string
          owner_id: string
          pet_id: string
          request_id?: string | null
        }
        Update: {
          appointment_id?: string
          clinic_id?: string
          created_at?: string
          guest_email?: string
          id?: string
          organization_id?: string
          owner_id?: string
          pet_id?: string
          request_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "public_booking_requests_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_booking_requests_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_booking_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_booking_requests_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "pet_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_booking_requests_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
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
      review_moderation_events: {
        Row: {
          action: string
          actor_user_id: string | null
          clinic_id: string
          created_at: string
          id: string
          organization_id: string
          reason: string | null
          review_id: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          clinic_id: string
          created_at?: string
          id?: string
          organization_id: string
          reason?: string | null
          review_id: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          clinic_id?: string
          created_at?: string
          id?: string
          organization_id?: string
          reason?: string | null
          review_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_moderation_events_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "colleague_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_moderation_events_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_moderation_events_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_moderation_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_moderation_events_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          appointment_id: string
          author_user_id: string
          body: string
          clinic_id: string
          clinic_reply: string | null
          clinic_reply_at: string | null
          clinic_reply_by: string | null
          created_at: string
          deleted_at: string | null
          hidden_at: string | null
          hidden_by: string | null
          hidden_reason: string | null
          id: string
          organization_id: string
          owner_id: string
          pet_id: string
          rating: number
          report_reason: string | null
          reported_at: string | null
          reported_by: string | null
          status: Database["public"]["Enums"]["review_status"]
          title: string | null
          updated_at: string
          veterinarian_clinic_member_id: string
        }
        Insert: {
          appointment_id: string
          author_user_id: string
          body: string
          clinic_id: string
          clinic_reply?: string | null
          clinic_reply_at?: string | null
          clinic_reply_by?: string | null
          created_at?: string
          deleted_at?: string | null
          hidden_at?: string | null
          hidden_by?: string | null
          hidden_reason?: string | null
          id?: string
          organization_id: string
          owner_id: string
          pet_id: string
          rating: number
          report_reason?: string | null
          reported_at?: string | null
          reported_by?: string | null
          status?: Database["public"]["Enums"]["review_status"]
          title?: string | null
          updated_at?: string
          veterinarian_clinic_member_id: string
        }
        Update: {
          appointment_id?: string
          author_user_id?: string
          body?: string
          clinic_id?: string
          clinic_reply?: string | null
          clinic_reply_at?: string | null
          clinic_reply_by?: string | null
          created_at?: string
          deleted_at?: string | null
          hidden_at?: string | null
          hidden_by?: string | null
          hidden_reason?: string | null
          id?: string
          organization_id?: string
          owner_id?: string
          pet_id?: string
          rating?: number
          report_reason?: string | null
          reported_at?: string | null
          reported_by?: string | null
          status?: Database["public"]["Enums"]["review_status"]
          title?: string | null
          updated_at?: string
          veterinarian_clinic_member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_author_user_id_fkey"
            columns: ["author_user_id"]
            isOneToOne: false
            referencedRelation: "colleague_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_author_user_id_fkey"
            columns: ["author_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_clinic_reply_by_fkey"
            columns: ["clinic_reply_by"]
            isOneToOne: false
            referencedRelation: "colleague_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_clinic_reply_by_fkey"
            columns: ["clinic_reply_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_hidden_by_fkey"
            columns: ["hidden_by"]
            isOneToOne: false
            referencedRelation: "colleague_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_hidden_by_fkey"
            columns: ["hidden_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "pet_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "colleague_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_veterinarian_clinic_member_id_fkey"
            columns: ["veterinarian_clinic_member_id"]
            isOneToOne: false
            referencedRelation: "clinic_members"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_exceptions: {
        Row: {
          clinic_id: string
          clinic_member_id: string | null
          created_at: string
          created_by: string | null
          ends_at: string
          id: string
          organization_id: string
          reason: string | null
          starts_at: string
          type: Database["public"]["Enums"]["schedule_exception_type"]
          updated_at: string
        }
        Insert: {
          clinic_id: string
          clinic_member_id?: string | null
          created_at?: string
          created_by?: string | null
          ends_at: string
          id?: string
          organization_id: string
          reason?: string | null
          starts_at: string
          type: Database["public"]["Enums"]["schedule_exception_type"]
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          clinic_member_id?: string | null
          created_at?: string
          created_by?: string | null
          ends_at?: string
          id?: string
          organization_id?: string
          reason?: string | null
          starts_at?: string
          type?: Database["public"]["Enums"]["schedule_exception_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_exceptions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_exceptions_clinic_member_id_fkey"
            columns: ["clinic_member_id"]
            isOneToOne: false
            referencedRelation: "clinic_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_exceptions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "colleague_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_exceptions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_exceptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      vaccination_documents: {
        Row: {
          content: Json
          created_at: string
          generated_at: string
          generated_by: string | null
          id: string
          mime_type: string | null
          sha256: string
          size_bytes: number | null
          storage_path: string | null
          template_version: number
          vaccination_record_id: string
        }
        Insert: {
          content: Json
          created_at?: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          mime_type?: string | null
          sha256: string
          size_bytes?: number | null
          storage_path?: string | null
          template_version?: number
          vaccination_record_id: string
        }
        Update: {
          content?: Json
          created_at?: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          mime_type?: string | null
          sha256?: string
          size_bytes?: number | null
          storage_path?: string | null
          template_version?: number
          vaccination_record_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vaccination_documents_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "colleague_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vaccination_documents_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vaccination_documents_vaccination_record_id_fkey"
            columns: ["vaccination_record_id"]
            isOneToOne: true
            referencedRelation: "vaccination_records"
            referencedColumns: ["id"]
          },
        ]
      }
      vaccination_notifications: {
        Row: {
          attempts: number
          channel: Database["public"]["Enums"]["notification_channel"]
          clinic_id: string
          created_at: string
          id: string
          idempotency_key: string
          last_error: string | null
          organization_id: string
          payload: Json
          recipient_email: string | null
          recipient_name: string | null
          scheduled_for: string
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_status"]
          type: Database["public"]["Enums"]["vaccination_notification_type"]
          updated_at: string
          vaccination_record_id: string
        }
        Insert: {
          attempts?: number
          channel?: Database["public"]["Enums"]["notification_channel"]
          clinic_id: string
          created_at?: string
          id?: string
          idempotency_key: string
          last_error?: string | null
          organization_id: string
          payload?: Json
          recipient_email?: string | null
          recipient_name?: string | null
          scheduled_for?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          type: Database["public"]["Enums"]["vaccination_notification_type"]
          updated_at?: string
          vaccination_record_id: string
        }
        Update: {
          attempts?: number
          channel?: Database["public"]["Enums"]["notification_channel"]
          clinic_id?: string
          created_at?: string
          id?: string
          idempotency_key?: string
          last_error?: string | null
          organization_id?: string
          payload?: Json
          recipient_email?: string | null
          recipient_name?: string | null
          scheduled_for?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          type?: Database["public"]["Enums"]["vaccination_notification_type"]
          updated_at?: string
          vaccination_record_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vaccination_notifications_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vaccination_notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vaccination_notifications_vaccination_record_id_fkey"
            columns: ["vaccination_record_id"]
            isOneToOne: false
            referencedRelation: "vaccination_records"
            referencedColumns: ["id"]
          },
        ]
      }
      vaccination_records: {
        Row: {
          administered_at: string
          administered_by_clinic_member_id: string | null
          application_site: string | null
          client_request_id: string | null
          clinic_id: string
          clinic_pet_relationship_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          diseases_snapshot: string[]
          dose_text: string | null
          encounter_id: string | null
          expiration_date: string | null
          historical_document_path: string | null
          historical_document_reference: string | null
          historical_provider_name: string | null
          id: string
          lot_missing_reason: string | null
          lot_number: string | null
          manufacturer_snapshot: string | null
          next_due_at: string | null
          notes: string | null
          organization_id: string
          pet_id: string
          route_text: string | null
          source: Database["public"]["Enums"]["vaccination_source"]
          status: Database["public"]["Enums"]["vaccination_record_status"]
          updated_at: string
          vaccine_catalog_id: string | null
          vaccine_name_snapshot: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          administered_at: string
          administered_by_clinic_member_id?: string | null
          application_site?: string | null
          client_request_id?: string | null
          clinic_id: string
          clinic_pet_relationship_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          diseases_snapshot?: string[]
          dose_text?: string | null
          encounter_id?: string | null
          expiration_date?: string | null
          historical_document_path?: string | null
          historical_document_reference?: string | null
          historical_provider_name?: string | null
          id?: string
          lot_missing_reason?: string | null
          lot_number?: string | null
          manufacturer_snapshot?: string | null
          next_due_at?: string | null
          notes?: string | null
          organization_id: string
          pet_id: string
          route_text?: string | null
          source: Database["public"]["Enums"]["vaccination_source"]
          status?: Database["public"]["Enums"]["vaccination_record_status"]
          updated_at?: string
          vaccine_catalog_id?: string | null
          vaccine_name_snapshot: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          administered_at?: string
          administered_by_clinic_member_id?: string | null
          application_site?: string | null
          client_request_id?: string | null
          clinic_id?: string
          clinic_pet_relationship_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          diseases_snapshot?: string[]
          dose_text?: string | null
          encounter_id?: string | null
          expiration_date?: string | null
          historical_document_path?: string | null
          historical_document_reference?: string | null
          historical_provider_name?: string | null
          id?: string
          lot_missing_reason?: string | null
          lot_number?: string | null
          manufacturer_snapshot?: string | null
          next_due_at?: string | null
          notes?: string | null
          organization_id?: string
          pet_id?: string
          route_text?: string | null
          source?: Database["public"]["Enums"]["vaccination_source"]
          status?: Database["public"]["Enums"]["vaccination_record_status"]
          updated_at?: string
          vaccine_catalog_id?: string | null
          vaccine_name_snapshot?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vaccination_records_administered_by_clinic_member_id_fkey"
            columns: ["administered_by_clinic_member_id"]
            isOneToOne: false
            referencedRelation: "clinic_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vaccination_records_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vaccination_records_clinic_pet_relationship_id_fkey"
            columns: ["clinic_pet_relationship_id"]
            isOneToOne: false
            referencedRelation: "clinic_pet_relationships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vaccination_records_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "colleague_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vaccination_records_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vaccination_records_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "clinical_encounters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vaccination_records_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vaccination_records_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vaccination_records_vaccine_catalog_id_fkey"
            columns: ["vaccine_catalog_id"]
            isOneToOne: false
            referencedRelation: "vaccines_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vaccination_records_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "colleague_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vaccination_records_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vaccination_status_history: {
        Row: {
          changed_by: string | null
          clinic_id: string
          created_at: string
          from_status:
            | Database["public"]["Enums"]["vaccination_record_status"]
            | null
          id: string
          metadata: Json | null
          organization_id: string
          reason: string | null
          to_status: Database["public"]["Enums"]["vaccination_record_status"]
          vaccination_record_id: string
        }
        Insert: {
          changed_by?: string | null
          clinic_id: string
          created_at?: string
          from_status?:
            | Database["public"]["Enums"]["vaccination_record_status"]
            | null
          id?: string
          metadata?: Json | null
          organization_id: string
          reason?: string | null
          to_status: Database["public"]["Enums"]["vaccination_record_status"]
          vaccination_record_id: string
        }
        Update: {
          changed_by?: string | null
          clinic_id?: string
          created_at?: string
          from_status?:
            | Database["public"]["Enums"]["vaccination_record_status"]
            | null
          id?: string
          metadata?: Json | null
          organization_id?: string
          reason?: string | null
          to_status?: Database["public"]["Enums"]["vaccination_record_status"]
          vaccination_record_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vaccination_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "colleague_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vaccination_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vaccination_status_history_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vaccination_status_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vaccination_status_history_vaccination_record_id_fkey"
            columns: ["vaccination_record_id"]
            isOneToOne: false
            referencedRelation: "vaccination_records"
            referencedColumns: ["id"]
          },
        ]
      }
      vaccines_catalog: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          default_booster_interval_days: number | null
          deleted_at: string | null
          diseases_covered: string[]
          id: string
          manufacturer: string | null
          name: string
          organization_id: string
          presentation: string | null
          target_species: Database["public"]["Enums"]["pet_species"][]
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          default_booster_interval_days?: number | null
          deleted_at?: string | null
          diseases_covered?: string[]
          id?: string
          manufacturer?: string | null
          name: string
          organization_id: string
          presentation?: string | null
          target_species?: Database["public"]["Enums"]["pet_species"][]
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          default_booster_interval_days?: number | null
          deleted_at?: string | null
          diseases_covered?: string[]
          id?: string
          manufacturer?: string | null
          name?: string
          organization_id?: string
          presentation?: string | null
          target_species?: Database["public"]["Enums"]["pet_species"][]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vaccines_catalog_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "colleague_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vaccines_catalog_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vaccines_catalog_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      veterinarian_public_profiles: {
        Row: {
          bio: string | null
          created_at: string
          deleted_at: string | null
          headline: string | null
          id: string
          is_public: boolean
          slug: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bio?: string | null
          created_at?: string
          deleted_at?: string | null
          headline?: string | null
          id?: string
          is_public?: boolean
          slug: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bio?: string | null
          created_at?: string
          deleted_at?: string | null
          headline?: string | null
          id?: string
          is_public?: boolean
          slug?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "veterinarian_public_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "colleague_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "veterinarian_public_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      veterinarian_schedules: {
        Row: {
          active: boolean
          clinic_id: string
          clinic_member_id: string
          created_at: string
          created_by: string | null
          effective_from: string
          effective_until: string | null
          end_time: string
          id: string
          organization_id: string
          start_time: string
          updated_at: string
          weekday: number
        }
        Insert: {
          active?: boolean
          clinic_id: string
          clinic_member_id: string
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_until?: string | null
          end_time: string
          id?: string
          organization_id: string
          start_time: string
          updated_at?: string
          weekday: number
        }
        Update: {
          active?: boolean
          clinic_id?: string
          clinic_member_id?: string
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_until?: string | null
          end_time?: string
          id?: string
          organization_id?: string
          start_time?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "veterinarian_schedules_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "veterinarian_schedules_clinic_member_id_fkey"
            columns: ["clinic_member_id"]
            isOneToOne: false
            referencedRelation: "clinic_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "veterinarian_schedules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "colleague_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "veterinarian_schedules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "veterinarian_schedules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
      accept_portal_invitation: { Args: { p_token: string }; Returns: string }
      add_pet_owner: {
        Args: {
          p_owner_id: string
          p_pet_id: string
          p_relationship_type?: Database["public"]["Enums"]["owner_pet_relationship_type"]
        }
        Returns: string
      }
      appointment_clinic_accessible: {
        Args: { p_appointment_id: string }
        Returns: boolean
      }
      appointment_transition_allowed: {
        Args: {
          p_from: Database["public"]["Enums"]["appointment_status"]
          p_to: Database["public"]["Enums"]["appointment_status"]
        }
        Returns: boolean
      }
      book_appointment: {
        Args: {
          p_clinic_id: string
          p_emergency?: boolean
          p_emergency_reason?: string
          p_notes?: string
          p_owner_id: string
          p_pet_id: string
          p_reason?: string
          p_service_ids: string[]
          p_source?: Database["public"]["Enums"]["appointment_source"]
          p_start: string
          p_veterinarian_clinic_member_id: string
        }
        Returns: string
      }
      can_access_owner: { Args: { p_owner_id: string }; Returns: boolean }
      can_access_pet: { Args: { p_pet_id: string }; Returns: boolean }
      can_edit_clinical_encounter: {
        Args: { p_encounter_id: string }
        Returns: boolean
      }
      can_edit_prescription: {
        Args: { p_prescription_id: string }
        Returns: boolean
      }
      can_finalize_clinical_encounter: {
        Args: { p_encounter_id: string }
        Returns: boolean
      }
      can_manage_owner: { Args: { p_owner_id: string }; Returns: boolean }
      can_manage_pet: { Args: { p_pet_id: string }; Returns: boolean }
      can_manage_vaccine_catalog: {
        Args: { p_organization_id: string }
        Returns: boolean
      }
      can_record_vitals: { Args: { p_encounter_id: string }; Returns: boolean }
      can_view_clinical_content: {
        Args: { p_encounter_id: string }
        Returns: boolean
      }
      can_view_clinical_encounter: {
        Args: { p_encounter_id: string }
        Returns: boolean
      }
      can_view_prescription: {
        Args: { p_prescription_id: string }
        Returns: boolean
      }
      can_view_vaccination_record: {
        Args: { p_record_id: string }
        Returns: boolean
      }
      cancel_appointment: {
        Args: { p_appointment_id: string; p_reason: string }
        Returns: Database["public"]["Enums"]["appointment_status"]
      }
      cancel_my_appointment: {
        Args: { p_appointment_id: string; p_reason?: string }
        Returns: Database["public"]["Enums"]["appointment_status"]
      }
      cancel_pending_appointment_notifications: {
        Args: { p_appointment_id: string }
        Returns: undefined
      }
      cancel_pending_vaccination_notifications: {
        Args: { p_record_id: string }
        Returns: undefined
      }
      claim_due_appointment_notifications: {
        Args: { p_clinic_id: string; p_limit?: number }
        Returns: {
          appointment_id: string
          attempts: number
          channel: Database["public"]["Enums"]["notification_channel"]
          clinic_id: string
          created_at: string
          id: string
          idempotency_key: string
          last_error: string | null
          organization_id: string
          payload: Json
          recipient_email: string | null
          recipient_name: string | null
          scheduled_for: string
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_status"]
          type: Database["public"]["Enums"]["appointment_notification_type"]
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "appointment_notifications"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_due_appointment_notifications_batch: {
        Args: { p_limit?: number }
        Returns: {
          appointment_id: string
          attempts: number
          channel: Database["public"]["Enums"]["notification_channel"]
          clinic_id: string
          created_at: string
          id: string
          idempotency_key: string
          last_error: string | null
          organization_id: string
          payload: Json
          recipient_email: string | null
          recipient_name: string | null
          scheduled_for: string
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_status"]
          type: Database["public"]["Enums"]["appointment_notification_type"]
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "appointment_notifications"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_due_vaccination_notifications: {
        Args: { p_clinic_id: string; p_limit?: number }
        Returns: {
          attempts: number
          channel: Database["public"]["Enums"]["notification_channel"]
          clinic_id: string
          created_at: string
          id: string
          idempotency_key: string
          last_error: string | null
          organization_id: string
          payload: Json
          recipient_email: string | null
          recipient_name: string | null
          scheduled_for: string
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_status"]
          type: Database["public"]["Enums"]["vaccination_notification_type"]
          updated_at: string
          vaccination_record_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "vaccination_notifications"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_due_vaccination_notifications_batch: {
        Args: { p_limit?: number }
        Returns: {
          attempts: number
          channel: Database["public"]["Enums"]["notification_channel"]
          clinic_id: string
          created_at: string
          id: string
          idempotency_key: string
          last_error: string | null
          organization_id: string
          payload: Json
          recipient_email: string | null
          recipient_name: string | null
          scheduled_for: string
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_status"]
          type: Database["public"]["Enums"]["vaccination_notification_type"]
          updated_at: string
          vaccination_record_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "vaccination_notifications"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      clinic_appointment_metrics: {
        Args: { p_clinic_id: string; p_from: string; p_to: string }
        Returns: Json
      }
      clinic_belongs_to_organization: {
        Args: { p_clinic_id: string; p_organization_id: string }
        Returns: boolean
      }
      clinic_is_publicly_visible: {
        Args: { p_clinic_id: string }
        Returns: boolean
      }
      clinic_rating: { Args: { p_clinic_id: string }; Returns: Json }
      clinical_encounter_from_storage_path: {
        Args: { p_name: string }
        Returns: string
      }
      configure_veterinarian_schedule: {
        Args: { p_clinic_id: string; p_clinic_member_id: string; p_slots: Json }
        Returns: number
      }
      create_clinic_service: {
        Args: {
          p_buffer_after_minutes?: number
          p_buffer_before_minutes?: number
          p_category: Database["public"]["Enums"]["service_category"]
          p_clinic_id: string
          p_description?: string
          p_duration_minutes: number
          p_name: string
          p_price_cents: number
          p_requires_veterinarian?: boolean
          p_veterinarian_member_ids?: string[]
        }
        Returns: string
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
      create_portal_invitation: {
        Args: { p_clinic_id: string; p_owner_id: string }
        Returns: string
      }
      create_prescription_draft: {
        Args: { p_encounter_id: string }
        Returns: string
      }
      create_walk_in_encounter: {
        Args: {
          p_chief_complaint?: string
          p_clinic_id: string
          p_emergency_reason?: string
          p_encounter_type?: Database["public"]["Enums"]["encounter_type"]
          p_owner_id: string
          p_pet_id: string
          p_service_ids: string[]
          p_veterinarian_clinic_member_id: string
        }
        Returns: string
      }
      current_user_is_superadmin: { Args: never; Returns: boolean }
      discard_prescription_draft: {
        Args: { p_prescription_id: string }
        Returns: undefined
      }
      encounter_clinic: { Args: { p_encounter_id: string }; Returns: string }
      encounter_transition_allowed: {
        Args: {
          p_from: Database["public"]["Enums"]["encounter_status"]
          p_to: Database["public"]["Enums"]["encounter_status"]
        }
        Returns: boolean
      }
      enqueue_appointment_notifications: {
        Args: {
          p_appointment_id: string
          p_kind: Database["public"]["Enums"]["appointment_notification_type"]
        }
        Returns: undefined
      }
      enqueue_vaccination_reminder: {
        Args: { p_record_id: string }
        Returns: undefined
      }
      finalize_clinical_encounter: {
        Args: { p_encounter_id: string }
        Returns: Database["public"]["Enums"]["encounter_status"]
      }
      get_available_slots: {
        Args: {
          p_clinic_id: string
          p_clinic_service_id: string
          p_from_date: string
          p_to_date: string
          p_veterinarian_clinic_member_id: string
        }
        Returns: {
          slot_end: string
          slot_start: string
        }[]
      }
      get_clinic_reviews: {
        Args: { p_clinic_slug: string; p_limit?: number; p_offset?: number }
        Returns: Json
      }
      get_my_appointments: { Args: never; Returns: Json }
      get_my_pet_history: { Args: { p_pet_id: string }; Returns: Json }
      get_my_pets: { Args: never; Returns: Json }
      get_my_reviewable_appointments: { Args: never; Returns: Json }
      get_public_available_slots: {
        Args: {
          p_clinic_slug: string
          p_from: string
          p_service_id: string
          p_to: string
          p_veterinarian_clinic_member_id: string
        }
        Returns: Json
      }
      get_public_clinic: { Args: { p_slug: string }; Returns: Json }
      get_public_veterinarian: { Args: { p_slug: string }; Returns: Json }
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
      is_encounter_veterinarian: {
        Args: { p_encounter_id: string }
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
      issue_prescription: {
        Args: { p_prescription_id: string }
        Returns: string
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
      list_public_cities: { Args: never; Returns: Json }
      log_clinical_record_access: {
        Args: { p_access_type: string; p_encounter_id: string }
        Returns: undefined
      }
      log_prescription_access: {
        Args: { p_access_type: string; p_prescription_id: string }
        Returns: undefined
      }
      log_vaccination_access: {
        Args: { p_access_type: string; p_record_id: string }
        Returns: undefined
      }
      mark_appointment_notification: {
        Args: { p_error?: string; p_notification_id: string; p_ok: boolean }
        Returns: undefined
      }
      mark_appointment_notification_by_service: {
        Args: { p_error?: string; p_notification_id: string; p_ok: boolean }
        Returns: undefined
      }
      mark_vaccination_notification: {
        Args: { p_error?: string; p_notification_id: string; p_ok: boolean }
        Returns: undefined
      }
      mark_vaccination_notification_by_service: {
        Args: { p_error?: string; p_notification_id: string; p_ok: boolean }
        Returns: undefined
      }
      next_appointment_folio: {
        Args: { p_clinic_id: string; p_year: number }
        Returns: string
      }
      next_clinical_folio: {
        Args: { p_clinic_id: string; p_year: number }
        Returns: string
      }
      next_prescription_folio: {
        Args: { p_clinic_id: string; p_year: number }
        Returns: string
      }
      organization_of_clinic: { Args: { p_clinic_id: string }; Returns: string }
      pet_belongs_to_accessible_clinic: {
        Args: { p_pet_id: string }
        Returns: boolean
      }
      pet_id_from_storage_path: { Args: { p_name: string }; Returns: string }
      platform_clinics: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          appointment_count: number
          clinic_id: string
          clinic_name: string
          clinic_status: Database["public"]["Enums"]["clinic_status"]
          created_at: string
          is_public: boolean
          organization_id: string
          organization_name: string
          organization_status: Database["public"]["Enums"]["organization_status"]
        }[]
      }
      platform_overview: { Args: never; Returns: Json }
      platform_recent_activity: {
        Args: { p_limit?: number }
        Returns: {
          action: string
          actor_user_id: string
          created_at: string
          entity_id: string
          entity_type: string
          id: number
          organization_id: string
        }[]
      }
      prescription_clinic: {
        Args: { p_prescription_id: string }
        Returns: string
      }
      prescription_transition_allowed: {
        Args: {
          p_from: Database["public"]["Enums"]["prescription_status"]
          p_to: Database["public"]["Enums"]["prescription_status"]
        }
        Returns: boolean
      }
      record_historical_vaccination: {
        Args: {
          p_administered_on: string
          p_clinic_id: string
          p_diseases?: string[]
          p_document_path?: string
          p_document_reference?: string
          p_expiration_date?: string
          p_lot_number?: string
          p_manufacturer?: string
          p_next_due_at?: string
          p_notes?: string
          p_pet_id: string
          p_provider_name?: string
          p_request_id?: string
          p_source: Database["public"]["Enums"]["vaccination_source"]
          p_vaccine_name: string
        }
        Returns: string
      }
      record_vaccination: {
        Args: {
          p_application_site?: string
          p_clinic_id: string
          p_diseases?: string[]
          p_dose_text?: string
          p_encounter_id?: string
          p_expiration_date?: string
          p_lot_missing_reason?: string
          p_lot_number?: string
          p_manufacturer?: string
          p_next_due_at?: string
          p_notes?: string
          p_pet_id: string
          p_request_id?: string
          p_route_text?: string
          p_vaccine_catalog_id?: string
          p_vaccine_name?: string
        }
        Returns: string
      }
      register_device_token: {
        Args: {
          p_platform: Database["public"]["Enums"]["device_platform"]
          p_token: string
        }
        Returns: {
          created_at: string
          id: string
          last_seen_at: string
          platform: Database["public"]["Enums"]["device_platform"]
          token: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "device_tokens"
          isOneToOne: true
          isSetofReturn: false
        }
      }
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
      reply_to_review: {
        Args: { p_reply: string; p_review_id: string }
        Returns: undefined
      }
      report_review: {
        Args: { p_reason: string; p_review_id: string }
        Returns: undefined
      }
      request_public_appointment: {
        Args: {
          p_clinic_slug: string
          p_email: string
          p_first_name: string
          p_last_name: string
          p_pet_name: string
          p_pet_species: Database["public"]["Enums"]["pet_species"]
          p_phone: string
          p_reason?: string
          p_request_id?: string
          p_service_id: string
          p_start: string
          p_veterinarian_clinic_member_id: string
        }
        Returns: Json
      }
      reschedule_appointment: {
        Args: {
          p_appointment_id: string
          p_new_start: string
          p_new_veterinarian_clinic_member_id?: string
          p_reason?: string
        }
        Returns: string
      }
      resend_clinic_invitation: {
        Args: { p_invitation_id: string }
        Returns: string
      }
      search_public_clinics: {
        Args: {
          p_category?: Database["public"]["Enums"]["service_category"]
          p_city?: string
          p_limit?: number
          p_offset?: number
          p_q?: string
        }
        Returns: Json
      }
      set_primary_pet_owner: {
        Args: { p_owner_id: string; p_pet_id: string }
        Returns: undefined
      }
      set_review_visibility: {
        Args: { p_hidden: boolean; p_reason: string; p_review_id: string }
        Returns: Database["public"]["Enums"]["review_status"]
      }
      shares_active_organization_with: {
        Args: { p_profile_id: string }
        Returns: boolean
      }
      start_encounter_from_appointment: {
        Args: { p_appointment_id: string }
        Returns: string
      }
      submit_review: {
        Args: {
          p_appointment_id: string
          p_body: string
          p_rating: number
          p_title?: string
        }
        Returns: string
      }
      supersede_prescription: {
        Args: { p_prescription_id: string; p_reason: string }
        Returns: string
      }
      transition_appointment_status: {
        Args: {
          p_appointment_id: string
          p_new_status: Database["public"]["Enums"]["appointment_status"]
          p_reason?: string
        }
        Returns: Database["public"]["Enums"]["appointment_status"]
      }
      unregister_device_token: { Args: { p_token: string }; Returns: undefined }
      update_my_review: {
        Args: {
          p_body: string
          p_rating: number
          p_review_id: string
          p_title?: string
        }
        Returns: undefined
      }
      vaccination_pet_from_storage_path: {
        Args: { p_name: string }
        Returns: string
      }
      vaccination_record_clinic: {
        Args: { p_record_id: string }
        Returns: string
      }
      void_clinical_encounter: {
        Args: { p_encounter_id: string; p_reason: string }
        Returns: Database["public"]["Enums"]["encounter_status"]
      }
      void_prescription: {
        Args: { p_prescription_id: string; p_reason: string }
        Returns: Database["public"]["Enums"]["prescription_status"]
      }
      void_vaccination_record: {
        Args: { p_reason: string; p_record_id: string }
        Returns: Database["public"]["Enums"]["vaccination_record_status"]
      }
    }
    Enums: {
      appointment_notification_type:
        | "confirmation"
        | "reminder_24h"
        | "reminder_2h"
        | "cancellation"
        | "reschedule"
      appointment_source:
        | "staff"
        | "phone"
        | "walk_in"
        | "owner_portal"
        | "mobile_app"
        | "whatsapp"
        | "migration"
      appointment_status:
        | "requested"
        | "pending_confirmation"
        | "confirmed"
        | "checked_in"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "no_show"
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
      clinical_file_kind:
        | "laboratory_result"
        | "image"
        | "external_prescription"
        | "referral"
        | "consent"
        | "other"
      consent_medium: "in_person" | "web" | "email" | "phone"
      consent_type:
        | "privacy_notice"
        | "data_processing"
        | "communications"
        | "clinic_access"
        | "share_records"
        | "portal_terms"
      contact_method: "phone" | "email" | "whatsapp" | "sms"
      device_platform: "ios" | "android" | "web"
      diagnosis_certainty:
        | "differential"
        | "presumptive"
        | "confirmed"
        | "ruled_out"
      encounter_status: "in_progress" | "finalized" | "voided"
      encounter_type:
        | "scheduled"
        | "walk_in"
        | "emergency"
        | "follow_up"
        | "other"
      follow_up_status: "pending" | "scheduled" | "completed" | "cancelled"
      invitation_status: "pending" | "accepted" | "expired" | "revoked"
      membership_status: "invited" | "active" | "suspended" | "removed"
      notification_channel: "email" | "whatsapp" | "push" | "sms"
      notification_status:
        | "pending"
        | "processing"
        | "sent"
        | "failed"
        | "cancelled"
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
      prescription_status: "draft" | "issued" | "superseded" | "voided"
      review_status: "published" | "hidden"
      schedule_exception_type:
        | "vacation"
        | "sick_leave"
        | "personal"
        | "training"
        | "holiday"
        | "clinic_closure"
        | "special_hours"
        | "other"
      service_category:
        | "consultation"
        | "vaccination"
        | "surgery"
        | "grooming"
        | "laboratory"
        | "imaging"
        | "dental"
        | "emergency"
        | "other"
      treatment_type:
        | "medication_recommendation"
        | "procedure"
        | "diet"
        | "home_care"
        | "restriction"
        | "referral"
        | "follow_up"
        | "other"
      vaccination_notification_type: "next_dose_due"
      vaccination_record_status: "recorded" | "voided"
      vaccination_source:
        | "administered_in_clinic"
        | "historical_owner_document"
        | "external_clinic"
        | "campaign"
        | "import"
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
      appointment_notification_type: [
        "confirmation",
        "reminder_24h",
        "reminder_2h",
        "cancellation",
        "reschedule",
      ],
      appointment_source: [
        "staff",
        "phone",
        "walk_in",
        "owner_portal",
        "mobile_app",
        "whatsapp",
        "migration",
      ],
      appointment_status: [
        "requested",
        "pending_confirmation",
        "confirmed",
        "checked_in",
        "in_progress",
        "completed",
        "cancelled",
        "no_show",
      ],
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
      clinical_file_kind: [
        "laboratory_result",
        "image",
        "external_prescription",
        "referral",
        "consent",
        "other",
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
      device_platform: ["ios", "android", "web"],
      diagnosis_certainty: [
        "differential",
        "presumptive",
        "confirmed",
        "ruled_out",
      ],
      encounter_status: ["in_progress", "finalized", "voided"],
      encounter_type: [
        "scheduled",
        "walk_in",
        "emergency",
        "follow_up",
        "other",
      ],
      follow_up_status: ["pending", "scheduled", "completed", "cancelled"],
      invitation_status: ["pending", "accepted", "expired", "revoked"],
      membership_status: ["invited", "active", "suspended", "removed"],
      notification_channel: ["email", "whatsapp", "push", "sms"],
      notification_status: [
        "pending",
        "processing",
        "sent",
        "failed",
        "cancelled",
      ],
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
      prescription_status: ["draft", "issued", "superseded", "voided"],
      review_status: ["published", "hidden"],
      schedule_exception_type: [
        "vacation",
        "sick_leave",
        "personal",
        "training",
        "holiday",
        "clinic_closure",
        "special_hours",
        "other",
      ],
      service_category: [
        "consultation",
        "vaccination",
        "surgery",
        "grooming",
        "laboratory",
        "imaging",
        "dental",
        "emergency",
        "other",
      ],
      treatment_type: [
        "medication_recommendation",
        "procedure",
        "diet",
        "home_care",
        "restriction",
        "referral",
        "follow_up",
        "other",
      ],
      vaccination_notification_type: ["next_dose_due"],
      vaccination_record_status: ["recorded", "voided"],
      vaccination_source: [
        "administered_in_clinic",
        "historical_owner_document",
        "external_clinic",
        "campaign",
        "import",
      ],
    },
  },
} as const

