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
      activities: {
        Row: {
          created_at: string
          duration_seconds: number
          id: string
          is_published: boolean
          kind: Database["public"]["Enums"]["activity_kind"]
          points: number
          position: number
          prompt: string
          session_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number
          id?: string
          is_published?: boolean
          kind: Database["public"]["Enums"]["activity_kind"]
          points?: number
          position?: number
          prompt: string
          session_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number
          id?: string
          is_published?: boolean
          kind?: Database["public"]["Enums"]["activity_kind"]
          points?: number
          position?: number
          prompt?: string
          session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "event_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_answers: {
        Row: {
          activity_id: string
          correct_option_id: string
        }
        Insert: {
          activity_id: string
          correct_option_id: string
        }
        Update: {
          activity_id?: string
          correct_option_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_answers_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: true
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_answers_correct_option_id_fkey"
            columns: ["correct_option_id"]
            isOneToOne: false
            referencedRelation: "activity_options"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_options: {
        Row: {
          activity_id: string
          id: string
          is_correct: boolean
          label: string
          position: number
        }
        Insert: {
          activity_id: string
          id?: string
          is_correct?: boolean
          label: string
          position?: number
        }
        Update: {
          activity_id?: string
          id?: string
          is_correct?: boolean
          label?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "activity_options_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
        ]
      }
      event_sessions: {
        Row: {
          created_at: string
          current_activity_id: string | null
          id: string
          join_code: string
          owner_id: string | null
          status: Database["public"]["Enums"]["session_status"]
          theme: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_activity_id?: string | null
          id?: string
          join_code: string
          owner_id?: string | null
          status?: Database["public"]["Enums"]["session_status"]
          theme?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_activity_id?: string | null
          id?: string
          join_code?: string
          owner_id?: string | null
          status?: Database["public"]["Enums"]["session_status"]
          theme?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_sessions_current_activity_fk"
            columns: ["current_activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
        ]
      }
      participants: {
        Row: {
          id: string
          joined_at: string
          nickname: string
          score: number
          session_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          nickname: string
          score?: number
          session_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          nickname?: string
          score?: number
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "participants_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "event_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      responses: {
        Row: {
          activity_id: string
          created_at: string
          id: string
          option_id: string | null
          participant_id: string
          points_awarded: number
          rating: number | null
          text_answer: string | null
        }
        Insert: {
          activity_id: string
          created_at?: string
          id?: string
          option_id?: string | null
          participant_id: string
          points_awarded?: number
          rating?: number | null
          text_answer?: string | null
        }
        Update: {
          activity_id?: string
          created_at?: string
          id?: string
          option_id?: string | null
          participant_id?: string
          points_awarded?: number
          rating?: number | null
          text_answer?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "responses_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "responses_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "activity_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "responses_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_host_passcode: { Args: { p_passcode: string }; Returns: boolean }
      host_remove_all_participants: {
        Args: { p_passcode: string; p_session_id: string }
        Returns: number
      }
      host_remove_participant: {
        Args: { p_participant_id: string; p_passcode: string }
        Returns: boolean
      }
    }
    Enums: {
      activity_kind: "quiz" | "poll" | "word_cloud" | "rating" | "challenge"
      session_status: "draft" | "live" | "closed"
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
      activity_kind: ["quiz", "poll", "word_cloud", "rating", "challenge"],
      session_status: ["draft", "live", "closed"],
    },
  },
} as const
