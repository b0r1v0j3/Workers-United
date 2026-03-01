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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          admin_id: string
          created_at: string | null
          field: string
          id: string
          new_value: string | null
          old_value: string | null
          record_id: string
          table_name: string
        }
        Insert: {
          action?: string
          admin_id: string
          created_at?: string | null
          field: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          record_id: string
          table_name: string
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string | null
          field?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          record_id?: string
          table_name?: string
        }
        Relationships: []
      }
      brain_reports: {
        Row: {
          created_at: string | null
          findings_count: number | null
          id: string
          model: string
          report: Json
        }
        Insert: {
          created_at?: string | null
          findings_count?: number | null
          id?: string
          model?: string
          report: Json
        }
        Update: {
          created_at?: string | null
          findings_count?: number | null
          id?: string
          model?: string
          report?: Json
        }
        Relationships: []
      }
      candidate_documents: {
        Row: {
          created_at: string | null
          document_type: string
          extracted_data: Json | null
          id: string
          ocr_json: Json | null
          reject_reason: string | null
          status: string | null
          storage_path: string | null
          updated_at: string | null
          user_id: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string | null
          document_type: string
          extracted_data?: Json | null
          id?: string
          ocr_json?: Json | null
          reject_reason?: string | null
          status?: string | null
          storage_path?: string | null
          updated_at?: string | null
          user_id: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string | null
          document_type?: string
          extracted_data?: Json | null
          id?: string
          ocr_json?: Json | null
          reject_reason?: string | null
          status?: string | null
          storage_path?: string | null
          updated_at?: string | null
          user_id?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      candidates: {
        Row: {
          address: string | null
          admin_approved: boolean | null
          admin_approved_at: string | null
          admin_approved_by: string | null
          application_data: Json | null
          birth_city: string | null
          birth_country: string | null
          citizenship: string | null
          country: string | null
          current_country: string | null
          cv_url: string | null
          date_of_birth: string | null
          desired_countries: Json | null
          desired_industries: string[] | null
          diploma_url: string | null
          education_level: string | null
          entry_fee_paid: boolean | null
          experience_years: number | null
          family_data: Json | null
          father_name: string | null
          gender: string | null
          id: string
          job_search_activated_at: string | null
          job_search_active: boolean | null
          languages: string[] | null
          lives_abroad: string | null
          maiden_name: string | null
          marital_status: string | null
          mother_name: string | null
          nationality: string | null
          onboarding_completed: boolean | null
          original_citizenship: string | null
          passport_expiry_date: string | null
          passport_issue_date: string | null
          passport_issued_by: string | null
          passport_number: string | null
          passport_url: string | null
          phone: string | null
          photo_url: string | null
          preferred_country: string | null
          preferred_job: string | null
          previous_visas: string | null
          profile_id: string | null
          profile_validation_status: string | null
          queue_joined_at: string | null
          queue_position: number | null
          refund_deadline: string | null
          refund_eligible: boolean | null
          rejection_count: number | null
          signature_agreed_at: string | null
          signature_url: string | null
          status: string | null
          updated_at: string | null
          validation_issues: Json | null
        }
        Insert: {
          address?: string | null
          admin_approved?: boolean | null
          admin_approved_at?: string | null
          admin_approved_by?: string | null
          application_data?: Json | null
          birth_city?: string | null
          birth_country?: string | null
          citizenship?: string | null
          country?: string | null
          current_country?: string | null
          cv_url?: string | null
          date_of_birth?: string | null
          desired_countries?: Json | null
          desired_industries?: string[] | null
          diploma_url?: string | null
          education_level?: string | null
          entry_fee_paid?: boolean | null
          experience_years?: number | null
          family_data?: Json | null
          father_name?: string | null
          gender?: string | null
          id?: string
          job_search_activated_at?: string | null
          job_search_active?: boolean | null
          languages?: string[] | null
          lives_abroad?: string | null
          maiden_name?: string | null
          marital_status?: string | null
          mother_name?: string | null
          nationality?: string | null
          onboarding_completed?: boolean | null
          original_citizenship?: string | null
          passport_expiry_date?: string | null
          passport_issue_date?: string | null
          passport_issued_by?: string | null
          passport_number?: string | null
          passport_url?: string | null
          phone?: string | null
          photo_url?: string | null
          preferred_country?: string | null
          preferred_job?: string | null
          previous_visas?: string | null
          profile_id?: string | null
          profile_validation_status?: string | null
          queue_joined_at?: string | null
          queue_position?: number | null
          refund_deadline?: string | null
          refund_eligible?: boolean | null
          rejection_count?: number | null
          signature_agreed_at?: string | null
          signature_url?: string | null
          status?: string | null
          updated_at?: string | null
          validation_issues?: Json | null
        }
        Update: {
          address?: string | null
          admin_approved?: boolean | null
          admin_approved_at?: string | null
          admin_approved_by?: string | null
          application_data?: Json | null
          birth_city?: string | null
          birth_country?: string | null
          citizenship?: string | null
          country?: string | null
          current_country?: string | null
          cv_url?: string | null
          date_of_birth?: string | null
          desired_countries?: Json | null
          desired_industries?: string[] | null
          diploma_url?: string | null
          education_level?: string | null
          entry_fee_paid?: boolean | null
          experience_years?: number | null
          family_data?: Json | null
          father_name?: string | null
          gender?: string | null
          id?: string
          job_search_activated_at?: string | null
          job_search_active?: boolean | null
          languages?: string[] | null
          lives_abroad?: string | null
          maiden_name?: string | null
          marital_status?: string | null
          mother_name?: string | null
          nationality?: string | null
          onboarding_completed?: boolean | null
          original_citizenship?: string | null
          passport_expiry_date?: string | null
          passport_issue_date?: string | null
          passport_issued_by?: string | null
          passport_number?: string | null
          passport_url?: string | null
          phone?: string | null
          photo_url?: string | null
          preferred_country?: string | null
          preferred_job?: string | null
          previous_visas?: string | null
          profile_id?: string | null
          profile_validation_status?: string | null
          queue_joined_at?: string | null
          queue_position?: number | null
          refund_deadline?: string | null
          refund_eligible?: boolean | null
          rejection_count?: number | null
          signature_agreed_at?: string | null
          signature_url?: string | null
          status?: string | null
          updated_at?: string | null
          validation_issues?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "candidates_admin_approved_by_fkey"
            columns: ["admin_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidates_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_data: {
        Row: {
          candidate_gender: string | null
          candidate_passport_issue_date: string | null
          candidate_passport_issuer: string | null
          candidate_place_of_birth: string | null
          contact_email: string | null
          contact_phone: string | null
          employer_apr_number: string | null
          employer_city: string | null
          employer_director: string | null
          employer_founding_date: string | null
          employer_mb: string | null
          end_date: string | null
          generated_at: string | null
          generated_documents: Json | null
          id: string
          job_description_en: string | null
          job_description_sr: string | null
          match_id: string | null
          signing_city: string | null
          signing_date: string | null
        }
        Insert: {
          candidate_gender?: string | null
          candidate_passport_issue_date?: string | null
          candidate_passport_issuer?: string | null
          candidate_place_of_birth?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          employer_apr_number?: string | null
          employer_city?: string | null
          employer_director?: string | null
          employer_founding_date?: string | null
          employer_mb?: string | null
          end_date?: string | null
          generated_at?: string | null
          generated_documents?: Json | null
          id?: string
          job_description_en?: string | null
          job_description_sr?: string | null
          match_id?: string | null
          signing_city?: string | null
          signing_date?: string | null
        }
        Update: {
          candidate_gender?: string | null
          candidate_passport_issue_date?: string | null
          candidate_passport_issuer?: string | null
          candidate_place_of_birth?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          employer_apr_number?: string | null
          employer_city?: string | null
          employer_director?: string | null
          employer_founding_date?: string | null
          employer_mb?: string | null
          end_date?: string | null
          generated_at?: string | null
          generated_documents?: Json | null
          id?: string
          job_description_en?: string | null
          job_description_sr?: string | null
          match_id?: string | null
          signing_city?: string | null
          signing_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_data_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          candidate_id: string | null
          document_type: string
          expires_at: string | null
          file_url: string
          id: string
          verification_status: string | null
        }
        Insert: {
          candidate_id?: string | null
          document_type: string
          expires_at?: string | null
          file_url: string
          id?: string
          verification_status?: string | null
        }
        Update: {
          candidate_id?: string | null
          document_type?: string
          expires_at?: string | null
          file_url?: string
          id?: string
          verification_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_queue: {
        Row: {
          created_at: string | null
          email_type: string
          error_message: string | null
          id: string
          read_at: string | null
          recipient_email: string
          recipient_name: string | null
          scheduled_for: string
          sent_at: string | null
          status: string
          subject: string
          template_data: Json | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email_type: string
          error_message?: string | null
          id?: string
          read_at?: string | null
          recipient_email: string
          recipient_name?: string | null
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          subject: string
          template_data?: Json | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email_type?: string
          error_message?: string | null
          id?: string
          read_at?: string | null
          recipient_email?: string
          recipient_name?: string | null
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          subject?: string
          template_data?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      employers: {
        Row: {
          admin_approved: boolean | null
          admin_approved_at: string | null
          admin_approved_by: string | null
          business_registry_number: string | null
          city: string | null
          company_address: string | null
          company_name: string | null
          company_registration_number: string | null
          company_size: string | null
          contact_email: string | null
          contact_phone: string | null
          country: string | null
          created_at: string | null
          description: string | null
          founded_year: string | null
          founding_date: string | null
          id: string
          industry: string | null
          mb: string | null
          postal_code: string | null
          profile_id: string | null
          status: string | null
          tax_id: string | null
          updated_at: string | null
          website: string | null
          work_city: string | null
        }
        Insert: {
          admin_approved?: boolean | null
          admin_approved_at?: string | null
          admin_approved_by?: string | null
          business_registry_number?: string | null
          city?: string | null
          company_address?: string | null
          company_name?: string | null
          company_registration_number?: string | null
          company_size?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          founded_year?: string | null
          founding_date?: string | null
          id?: string
          industry?: string | null
          mb?: string | null
          postal_code?: string | null
          profile_id?: string | null
          status?: string | null
          tax_id?: string | null
          updated_at?: string | null
          website?: string | null
          work_city?: string | null
        }
        Update: {
          admin_approved?: boolean | null
          admin_approved_at?: string | null
          admin_approved_by?: string | null
          business_registry_number?: string | null
          city?: string | null
          company_address?: string | null
          company_name?: string | null
          company_registration_number?: string | null
          company_size?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          founded_year?: string | null
          founding_date?: string | null
          id?: string
          industry?: string | null
          mb?: string | null
          postal_code?: string | null
          profile_id?: string | null
          status?: string | null
          tax_id?: string | null
          updated_at?: string | null
          website?: string | null
          work_city?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employers_admin_approved_by_fkey"
            columns: ["admin_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_requests: {
        Row: {
          accommodation_address: string | null
          auto_match_triggered: boolean | null
          contract_duration_months: number | null
          created_at: string | null
          description: string | null
          description_en: string | null
          destination_country: string | null
          employer_id: string | null
          experience_required_years: number | null
          id: string
          industry: string | null
          positions_count: number | null
          positions_filled: number | null
          salary_currency: string | null
          salary_max: number | null
          salary_min: number | null
          salary_rsd: number | null
          status: string | null
          title: string
          updated_at: string | null
          work_city: string | null
          work_schedule: string | null
        }
        Insert: {
          accommodation_address?: string | null
          auto_match_triggered?: boolean | null
          contract_duration_months?: number | null
          created_at?: string | null
          description?: string | null
          description_en?: string | null
          destination_country?: string | null
          employer_id?: string | null
          experience_required_years?: number | null
          id?: string
          industry?: string | null
          positions_count?: number | null
          positions_filled?: number | null
          salary_currency?: string | null
          salary_max?: number | null
          salary_min?: number | null
          salary_rsd?: number | null
          status?: string | null
          title: string
          updated_at?: string | null
          work_city?: string | null
          work_schedule?: string | null
        }
        Update: {
          accommodation_address?: string | null
          auto_match_triggered?: boolean | null
          contract_duration_months?: number | null
          created_at?: string | null
          description?: string | null
          description_en?: string | null
          destination_country?: string | null
          employer_id?: string | null
          experience_required_years?: number | null
          id?: string
          industry?: string | null
          positions_count?: number | null
          positions_filled?: number | null
          salary_currency?: string | null
          salary_max?: number | null
          salary_min?: number | null
          salary_rsd?: number | null
          status?: string | null
          title?: string
          updated_at?: string | null
          work_city?: string | null
          work_schedule?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_requests_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          candidate_id: string | null
          employer_id: string | null
          id: string
          status: string | null
        }
        Insert: {
          candidate_id?: string | null
          employer_id?: string | null
          id?: string
          status?: string | null
        }
        Update: {
          candidate_id?: string | null
          employer_id?: string | null
          id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          candidate_id: string | null
          expires_at: string | null
          id: string
          job_request_id: string | null
          status: string | null
        }
        Insert: {
          candidate_id?: string | null
          expires_at?: string | null
          id?: string
          job_request_id?: string | null
          status?: string | null
        }
        Update: {
          candidate_id?: string | null
          expires_at?: string | null
          id?: string
          job_request_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "offers_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_job_request_id_fkey"
            columns: ["job_request_id"]
            isOneToOne: false
            referencedRelation: "job_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number | null
          amount_cents: number
          deadline_at: string | null
          id: string
          metadata: Json | null
          paid_at: string | null
          payment_type: string
          profile_id: string | null
          refund_notes: string | null
          refund_status: string | null
          status: string | null
          stripe_checkout_session_id: string | null
          user_id: string | null
        }
        Insert: {
          amount?: number | null
          amount_cents: number
          deadline_at?: string | null
          id?: string
          metadata?: Json | null
          paid_at?: string | null
          payment_type: string
          profile_id?: string | null
          refund_notes?: string | null
          refund_status?: string | null
          status?: string | null
          stripe_checkout_session_id?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number | null
          amount_cents?: number
          deadline_at?: string | null
          id?: string
          metadata?: Json | null
          paid_at?: string | null
          payment_type?: string
          profile_id?: string | null
          refund_notes?: string | null
          refund_status?: string | null
          status?: string | null
          stripe_checkout_session_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          first_name: string | null
          full_name: string | null
          id: string
          last_name: string | null
          user_type: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          first_name?: string | null
          full_name?: string | null
          id: string
          last_name?: string | null
          user_type?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          first_name?: string | null
          full_name?: string | null
          id?: string
          last_name?: string | null
          user_type?: string | null
        }
        Relationships: []
      }
      signatures: {
        Row: {
          agreed_at: string | null
          agreed_text: string | null
          created_at: string | null
          document_type: string
          id: string
          ip_address: string | null
          signature_data: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          agreed_at?: string | null
          agreed_text?: string | null
          created_at?: string | null
          document_type: string
          id?: string
          ip_address?: string | null
          signature_data: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          agreed_at?: string | null
          agreed_text?: string | null
          created_at?: string | null
          document_type?: string
          id?: string
          ip_address?: string | null
          signature_data?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          content: string | null
          created_at: string | null
          direction: string
          error_message: string | null
          id: string
          message_type: string | null
          phone_number: string
          status: string | null
          template_name: string | null
          user_id: string | null
          wamid: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          direction: string
          error_message?: string | null
          id?: string
          message_type?: string | null
          phone_number: string
          status?: string | null
          template_name?: string | null
          user_id?: string | null
          wamid?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          direction?: string
          error_message?: string | null
          id?: string
          message_type?: string | null
          phone_number?: string
          status?: string | null
          template_name?: string | null
          user_id?: string | null
          wamid?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_at_risk_candidates: {
        Args: never
        Returns: {
          days_until_refund: number
          days_waiting: number
          full_name: string
          id: string
          profession: string
          waitlist_payment_date: string
        }[]
      }
      get_user_type: { Args: never; Returns: string }
      handle_offer_rejection: {
        Args: { p_offer_id: string }
        Returns: undefined
      }
      increment_positions_filled: {
        Args: { job_request_id: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      is_employer: { Args: never; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
