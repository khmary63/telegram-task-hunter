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
      chat_suggestions: {
        Row: {
          first_seen_at: string
          id: string
          last_seen_at: string
          mentions_count: number
          source_chat: string | null
          status: string
          username: string
        }
        Insert: {
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          mentions_count?: number
          source_chat?: string | null
          status?: string
          username: string
        }
        Update: {
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          mentions_count?: number
          source_chat?: string | null
          status?: string
          username?: string
        }
        Relationships: []
      }
      chats: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          joined_at: string | null
          niche_id: string | null
          tg_chat_id: number | null
          title: string | null
          username: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          joined_at?: string | null
          niche_id?: string | null
          tg_chat_id?: number | null
          title?: string | null
          username: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          joined_at?: string | null
          niche_id?: string | null
          tg_chat_id?: number | null
          title?: string | null
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "chats_niche_id_fkey"
            columns: ["niche_id"]
            isOneToOne: false
            referencedRelation: "niches"
            referencedColumns: ["id"]
          },
        ]
      }
      keywords: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          niche_id: string | null
          phrase: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          niche_id?: string | null
          phrase: string
          type?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          niche_id?: string | null
          phrase?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "keywords_niche_id_fkey"
            columns: ["niche_id"]
            isOneToOne: false
            referencedRelation: "niches"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          author_display_name: string | null
          author_user_id: number | null
          author_username: string | null
          chat_id: string | null
          chat_title: string | null
          chat_username: string | null
          found_at: string
          id: string
          is_read: boolean
          is_starred: boolean
          matched_keyword_id: string | null
          matched_niche_id: string | null
          matched_phrase: string | null
          message_link: string | null
          message_text: string
          notes: string | null
          posted_at: string
          tg_chat_id: number
          tg_message_id: number
        }
        Insert: {
          author_display_name?: string | null
          author_user_id?: number | null
          author_username?: string | null
          chat_id?: string | null
          chat_title?: string | null
          chat_username?: string | null
          found_at?: string
          id?: string
          is_read?: boolean
          is_starred?: boolean
          matched_keyword_id?: string | null
          matched_niche_id?: string | null
          matched_phrase?: string | null
          message_link?: string | null
          message_text: string
          notes?: string | null
          posted_at: string
          tg_chat_id: number
          tg_message_id: number
        }
        Update: {
          author_display_name?: string | null
          author_user_id?: number | null
          author_username?: string | null
          chat_id?: string | null
          chat_title?: string | null
          chat_username?: string | null
          found_at?: string
          id?: string
          is_read?: boolean
          is_starred?: boolean
          matched_keyword_id?: string | null
          matched_niche_id?: string | null
          matched_phrase?: string | null
          message_link?: string | null
          message_text?: string
          notes?: string | null
          posted_at?: string
          tg_chat_id?: number
          tg_message_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "leads_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_matched_keyword_id_fkey"
            columns: ["matched_keyword_id"]
            isOneToOne: false
            referencedRelation: "keywords"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_matched_niche_id_fkey"
            columns: ["matched_niche_id"]
            isOneToOne: false
            referencedRelation: "niches"
            referencedColumns: ["id"]
          },
        ]
      }
      niches: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      worker_state: {
        Row: {
          id: number
          last_error: string | null
          last_heartbeat: string | null
          leads_found: number
          messages_processed: number
          updated_at: string
        }
        Insert: {
          id?: number
          last_error?: string | null
          last_heartbeat?: string | null
          leads_found?: number
          messages_processed?: number
          updated_at?: string
        }
        Update: {
          id?: number
          last_error?: string | null
          last_heartbeat?: string | null
          leads_found?: number
          messages_processed?: number
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
