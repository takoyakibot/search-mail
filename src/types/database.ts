export type Database = {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string;
          name: string;
          domain: string | null;
          plan: string;
          email_limit: number;
          created_at: string;
          stripe_customer_id: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          domain?: string | null;
          plan?: string;
          email_limit?: number;
          created_at?: string;
          stripe_customer_id?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          domain?: string | null;
          plan?: string;
          email_limit?: number;
          created_at?: string;
          stripe_customer_id?: string | null;
        };
      };
      profiles: {
        Row: {
          id: string;
          tenant_id: string | null;
          name: string | null;
          role: string;
          created_at: string;
        };
        Insert: {
          id: string;
          tenant_id?: string | null;
          name?: string | null;
          role?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string | null;
          name?: string | null;
          role?: string;
          created_at?: string;
        };
      };
      mails: {
        Row: {
          id: string;
          tenant_id: string;
          message_id: string | null;
          subject: string | null;
          sender: string | null;
          sender_name: string | null;
          received_at: string | null;
          body_text: string | null;
          body_summary: string | null;
          category: string | null;
          priority: string | null;
          related_people: string[] | null;
          action_required: boolean;
          status: string;
          tags: string[] | null;
          ai_raw_response: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          message_id?: string | null;
          subject?: string | null;
          sender?: string | null;
          sender_name?: string | null;
          received_at?: string | null;
          body_text?: string | null;
          body_summary?: string | null;
          category?: string | null;
          priority?: string | null;
          related_people?: string[] | null;
          action_required?: boolean;
          status?: string;
          tags?: string[] | null;
          ai_raw_response?: Record<string, unknown> | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          message_id?: string | null;
          subject?: string | null;
          sender?: string | null;
          sender_name?: string | null;
          received_at?: string | null;
          body_text?: string | null;
          body_summary?: string | null;
          category?: string | null;
          priority?: string | null;
          related_people?: string[] | null;
          action_required?: boolean;
          status?: string;
          tags?: string[] | null;
          ai_raw_response?: Record<string, unknown> | null;
          created_at?: string;
        };
      };
      attachments: {
        Row: {
          id: string;
          mail_id: string | null;
          tenant_id: string | null;
          file_name: string | null;
          file_type: string | null;
          storage_path: string | null;
          extracted_text: string | null;
          structured_data: Record<string, unknown> | null;
          person_name: string | null;
          skills: string[] | null;
          available_from: string | null;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          mail_id?: string | null;
          tenant_id?: string | null;
          file_name?: string | null;
          file_type?: string | null;
          storage_path?: string | null;
          extracted_text?: string | null;
          structured_data?: Record<string, unknown> | null;
          person_name?: string | null;
          skills?: string[] | null;
          available_from?: string | null;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          mail_id?: string | null;
          tenant_id?: string | null;
          file_name?: string | null;
          file_type?: string | null;
          storage_path?: string | null;
          extracted_text?: string | null;
          structured_data?: Record<string, unknown> | null;
          person_name?: string | null;
          skills?: string[] | null;
          available_from?: string | null;
          status?: string;
          created_at?: string;
        };
      };
    };
  };
};
