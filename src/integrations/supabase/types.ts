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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      achievements: {
        Row: {
          artwork: string
          code: string
          criteria: string
          kind: string
          points: number
          title: string
        }
        Insert: {
          artwork?: string
          code: string
          criteria?: string
          kind?: string
          points?: number
          title: string
        }
        Update: {
          artwork?: string
          code?: string
          criteria?: string
          kind?: string
          points?: number
          title?: string
        }
        Relationships: []
      }
      admin_profiles: {
        Row: {
          created_at: string
          designation: string
          office: string
          staff_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          designation?: string
          office?: string
          staff_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          designation?: string
          office?: string
          staff_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          accent: string
          description: string
          id: number
          name: string
          slug: string
        }
        Insert: {
          accent?: string
          description?: string
          id: number
          name: string
          slug: string
        }
        Update: {
          accent?: string
          description?: string
          id?: number
          name?: string
          slug?: string
        }
        Relationships: []
      }
      event_badges: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          emoji: string
          event_id: number
          id: string
          points: number
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string
          emoji?: string
          event_id: number
          id?: string
          points?: number
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          emoji?: string
          event_id?: number
          id?: string
          points?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_badges_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          artists: Json
          category_id: number
          created_at: string
          description: string
          end_at: string
          featured: boolean
          festival_id: number | null
          id: number
          max_seats: number
          name: string
          organiser_id: string | null
          poster: string
          price: number
          published: boolean
          start_at: string
          subtitle: string
          terms: string
          venue: string
        }
        Insert: {
          artists?: Json
          category_id: number
          created_at?: string
          description?: string
          end_at?: string
          featured?: boolean
          festival_id?: number | null
          id?: number
          max_seats?: number
          name?: string
          organiser_id?: string | null
          poster?: string
          price?: number
          published?: boolean
          start_at?: string
          subtitle?: string
          terms?: string
          venue?: string
        }
        Update: {
          artists?: Json
          category_id?: number
          created_at?: string
          description?: string
          end_at?: string
          featured?: boolean
          festival_id?: number | null
          id?: number
          max_seats?: number
          name?: string
          organiser_id?: string | null
          poster?: string
          price?: number
          published?: boolean
          start_at?: string
          subtitle?: string
          terms?: string
          venue?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_festival_id_fkey"
            columns: ["festival_id"]
            isOneToOne: false
            referencedRelation: "festivals"
            referencedColumns: ["id"]
          },
        ]
      }
      festivals: {
        Row: {
          banner: string
          created_by: string | null
          description: string
          end_date: string
          id: number
          name: string
          start_date: string
          tagline: string
          theme: string
        }
        Insert: {
          banner?: string
          created_by?: string | null
          description?: string
          end_date: string
          id?: number
          name: string
          start_date: string
          tagline?: string
          theme?: string
        }
        Update: {
          banner?: string
          created_by?: string | null
          description?: string
          end_date?: string
          id?: number
          name?: string
          start_date?: string
          tagline?: string
          theme?: string
        }
        Relationships: []
      }
      help_requests: {
        Row: {
          answer: string | null
          author_name: string
          category: string
          created_at: string
          event_id: number | null
          id: string
          message: string
          routed_to: string | null
          status: string
          subject: string
          user_id: string
        }
        Insert: {
          answer?: string | null
          author_name?: string
          category?: string
          created_at?: string
          event_id?: number | null
          id?: string
          message: string
          routed_to?: string | null
          status?: string
          subject: string
          user_id: string
        }
        Update: {
          answer?: string | null
          author_name?: string
          category?: string
          created_at?: string
          event_id?: number | null
          id?: string
          message?: string
          routed_to?: string | null
          status?: string
          subject?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "help_requests_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      leaderboard: {
        Row: {
          department: string | null
          display_name: string
          points: number
          updated_at: string
          user_id: string
        }
        Insert: {
          department?: string | null
          display_name: string
          points?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          department?: string | null
          display_name?: string
          points?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      organiser_profiles: {
        Row: {
          created_at: string
          description: string | null
          institutional_id: string | null
          org_name: string
          org_type: string
          position: string
          review_note: string | null
          reviewed_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          institutional_id?: string | null
          org_name?: string
          org_type?: string
          position?: string
          review_note?: string | null
          reviewed_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          institutional_id?: string | null
          org_name?: string
          org_type?: string
          position?: string
          review_note?: string | null
          reviewed_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          course: string | null
          created_at: string
          department: string | null
          email: string | null
          full_name: string
          id: string
          phone: string | null
          preferences: string[]
        }
        Insert: {
          address?: string | null
          course?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          full_name?: string
          id: string
          phone?: string | null
          preferences?: string[]
        }
        Update: {
          address?: string | null
          course?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          preferences?: string[]
        }
        Relationships: []
      }
      registrations: {
        Row: {
          created_at: string
          event_id: number
          id: string
          kind: string
          pass_code: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: number
          id?: string
          kind?: string
          pass_code?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: number
          id?: string
          kind?: string
          pass_code?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      review_likes: {
        Row: {
          created_at: string
          review_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          review_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          review_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_likes_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          author_name: string
          comment: string
          created_at: string
          event_id: number
          id: string
          liked_by_organiser: boolean
          media: Json
          rating: number
          tagged_friends: string[]
          user_id: string
        }
        Insert: {
          author_name?: string
          comment?: string
          created_at?: string
          event_id: number
          id?: string
          liked_by_organiser?: boolean
          media?: Json
          rating: number
          tagged_friends?: string[]
          user_id: string
        }
        Update: {
          author_name?: string
          comment?: string
          created_at?: string
          event_id?: number
          id?: string
          liked_by_organiser?: boolean
          media?: Json
          rating?: number
          tagged_friends?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_awards: {
        Row: {
          awarded_by: string | null
          created_at: string
          description: string
          display_name: string
          id: string
          note: string
          points: number
          title: string
          user_id: string
        }
        Insert: {
          awarded_by?: string | null
          created_at?: string
          description?: string
          display_name?: string
          id?: string
          note?: string
          points?: number
          title: string
          user_id: string
        }
        Update: {
          awarded_by?: string | null
          created_at?: string
          description?: string
          display_name?: string
          id?: string
          note?: string
          points?: number
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      sponsors: {
        Row: {
          amount: number
          contact: string | null
          contact_email: string | null
          created_at: string
          id: string
          message: string | null
          name: string
          requested_by: string | null
          status: string
          tier: string
          user_id: string | null
        }
        Insert: {
          amount?: number
          contact?: string | null
          contact_email?: string | null
          created_at?: string
          id?: string
          message?: string | null
          name: string
          requested_by?: string | null
          status?: string
          tier?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          contact?: string | null
          contact_email?: string | null
          created_at?: string
          id?: string
          message?: string | null
          name?: string
          requested_by?: string | null
          status?: string
          tier?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_achievements: {
        Row: {
          code: string
          earned_at: string
          user_id: string
        }
        Insert: {
          code: string
          earned_at?: string
          user_id: string
        }
        Update: {
          code?: string
          earned_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_code_fkey"
            columns: ["code"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["code"]
          },
        ]
      }
      user_event_badges: {
        Row: {
          badge_id: string
          earned_at: string
          user_id: string
        }
        Insert: {
          badge_id: string
          earned_at?: string
          user_id: string
        }
        Update: {
          badge_id?: string
          earned_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_event_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "event_badges"
            referencedColumns: ["id"]
          },
        ]
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
      user_vouchers: {
        Row: {
          campaign_id: number
          code: string
          id: string
          issued_at: string
          user_id: string
        }
        Insert: {
          campaign_id: number
          code?: string
          id?: string
          issued_at?: string
          user_id: string
        }
        Update: {
          campaign_id?: number
          code?: string
          id?: string
          issued_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_vouchers_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "voucher_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      voucher_campaigns: {
        Row: {
          description: string
          id: number
          pct: number
          stock: number
          title: string
          type: string
          valid_until: string | null
        }
        Insert: {
          description?: string
          id: number
          pct?: number
          stock?: number
          title: string
          type?: string
          valid_until?: string | null
        }
        Update: {
          description?: string
          id?: number
          pct?: number
          stock?: number
          title?: string
          type?: string
          valid_until?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_manage_event: { Args: { _eid: number }; Returns: boolean }
      event_booked_counts: {
        Args: never
        Returns: {
          booked: number
          event_id: number
        }[]
      }
      event_clashes: {
        Args: never
        Returns: {
          a_id: number
          a_name: string
          b_id: number
          b_name: string
          venue: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_approved_organiser: { Args: { _uid: string }; Returns: boolean }
      platform_stats: { Args: never; Returns: Json }
      recompute_rewards: { Args: { _uid: string }; Returns: undefined }
      toggle_review_like: { Args: { _rid: string }; Returns: boolean }
    }
    Enums: {
      app_role: "participant" | "organizer" | "admin"
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
      app_role: ["participant", "organizer", "admin"],
    },
  },
} as const
