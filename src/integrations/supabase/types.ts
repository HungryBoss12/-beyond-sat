export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      app_settings: {
        Row: {
          key: string;
          updated_at: string;
          value: string | null;
        };
        Insert: {
          key: string;
          updated_at?: string;
          value?: string | null;
        };
        Update: {
          key?: string;
          updated_at?: string;
          value?: string | null;
        };
        Relationships: [];
      };
      attempts: {
        Row: {
          created_at: string;
          eliminated_choice_ids: string[];
          grid_answer: string | null;
          id: string;
          is_correct: boolean | null;
          marked_for_review: boolean;
          question_id: string | null;
          selected_choice_id: string | null;
          session_id: string | null;
          test_type: Database["public"]["Enums"]["test_type"];
          time_spent_seconds: number | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          eliminated_choice_ids?: string[];
          grid_answer?: string | null;
          id?: string;
          is_correct?: boolean | null;
          marked_for_review?: boolean;
          question_id?: string | null;
          selected_choice_id?: string | null;
          session_id?: string | null;
          test_type: Database["public"]["Enums"]["test_type"];
          time_spent_seconds?: number | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          eliminated_choice_ids?: string[];
          grid_answer?: string | null;
          id?: string;
          is_correct?: boolean | null;
          marked_for_review?: boolean;
          question_id?: string | null;
          selected_choice_id?: string | null;
          session_id?: string | null;
          test_type?: Database["public"]["Enums"]["test_type"];
          time_spent_seconds?: number | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "attempts_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attempts_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "test_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      daily_test_questions: {
        Row: {
          daily_test_id: string;
          position: number;
          question_id: string;
        };
        Insert: {
          daily_test_id: string;
          position?: number;
          question_id: string;
        };
        Update: {
          daily_test_id?: string;
          position?: number;
          question_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "daily_test_questions_daily_test_id_fkey";
            columns: ["daily_test_id"];
            isOneToOne: false;
            referencedRelation: "daily_tests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "daily_test_questions_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          },
        ];
      };
      daily_test_tests: {
        Row: {
          daily_test_id: string;
          position: number;
          test_id: string;
        };
        Insert: {
          daily_test_id: string;
          position: number;
          test_id: string;
        };
        Update: {
          daily_test_id?: string;
          position?: number;
          test_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "daily_test_tests_daily_test_id_fkey";
            columns: ["daily_test_id"];
            isOneToOne: false;
            referencedRelation: "daily_tests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "daily_test_tests_test_id_fkey";
            columns: ["test_id"];
            isOneToOne: false;
            referencedRelation: "tests";
            referencedColumns: ["id"];
          },
        ];
      };
      daily_tests: {
        Row: {
          created_at: string;
          created_by: string | null;
          date: string;
          id: string;
          title: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          date: string;
          id?: string;
          title?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          date?: string;
          id?: string;
          title?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      exam_dates: {
        Row: {
          active: boolean;
          created_at: string;
          exam_date: string;
          id: string;
          label: string | null;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          exam_date: string;
          id?: string;
          label?: string | null;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          exam_date?: string;
          id?: string;
          label?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      homepage_sections: {
        Row: {
          created_at: string;
          data: Json;
          id: string;
          kind: string;
          position: number;
          updated_at: string;
          visible: boolean;
        };
        Insert: {
          created_at?: string;
          data?: Json;
          id?: string;
          kind: string;
          position?: number;
          updated_at?: string;
          visible?: boolean;
        };
        Update: {
          created_at?: string;
          data?: Json;
          id?: string;
          kind?: string;
          position?: number;
          updated_at?: string;
          visible?: boolean;
        };
        Relationships: [];
      };
      mock_exam_questions: {
        Row: {
          id: string;
          mock_exam_id: string;
          module: number;
          position: number;
          question_id: string;
          section: Database["public"]["Enums"]["sat_section"];
          variant: string;
        };
        Insert: {
          id?: string;
          mock_exam_id: string;
          module: number;
          position?: number;
          question_id: string;
          section: Database["public"]["Enums"]["sat_section"];
          variant?: string;
        };
        Update: {
          id?: string;
          mock_exam_id?: string;
          module?: number;
          position?: number;
          question_id?: string;
          section?: Database["public"]["Enums"]["sat_section"];
          variant?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mock_exam_questions_mock_exam_id_fkey";
            columns: ["mock_exam_id"];
            isOneToOne: false;
            referencedRelation: "mock_exams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mock_exam_questions_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          },
        ];
      };
      mock_exam_sections: {
        Row: {
          id: string;
          mock_exam_id: string;
          module: number;
          section_index: number;
          section_name: string;
          test_id: string | null;
        };
        Insert: {
          id?: string;
          mock_exam_id: string;
          module: number;
          section_index: number;
          section_name: string;
          test_id?: string | null;
        };
        Update: {
          id?: string;
          mock_exam_id?: string;
          module?: number;
          section_index?: number;
          section_name?: string;
          test_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "mock_exam_sections_mock_exam_id_fkey";
            columns: ["mock_exam_id"];
            isOneToOne: false;
            referencedRelation: "mock_exams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mock_exam_sections_test_id_fkey";
            columns: ["test_id"];
            isOneToOne: false;
            referencedRelation: "tests";
            referencedColumns: ["id"];
          },
        ];
      };
      mock_exams: {
        Row: {
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          math_module1_threshold: number;
          math_module1_time_seconds: number;
          math_module2_time_seconds: number;
          published: boolean;
          rw_module1_threshold: number;
          rw_module1_time_seconds: number;
          rw_module2_time_seconds: number;
          title: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          math_module1_threshold?: number;
          math_module1_time_seconds?: number;
          math_module2_time_seconds?: number;
          published?: boolean;
          rw_module1_threshold?: number;
          rw_module1_time_seconds?: number;
          rw_module2_time_seconds?: number;
          title: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          math_module1_threshold?: number;
          math_module1_time_seconds?: number;
          math_module2_time_seconds?: number;
          published?: boolean;
          rw_module1_threshold?: number;
          rw_module1_time_seconds?: number;
          rw_module2_time_seconds?: number;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      news_articles: {
        Row: {
          author_id: string | null;
          body: string;
          cover_image_url: string | null;
          created_at: string;
          excerpt: string | null;
          id: string;
          published: boolean;
          published_at: string | null;
          slug: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          author_id?: string | null;
          body: string;
          cover_image_url?: string | null;
          created_at?: string;
          excerpt?: string | null;
          id?: string;
          published?: boolean;
          published_at?: string | null;
          slug: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          author_id?: string | null;
          body?: string;
          cover_image_url?: string | null;
          created_at?: string;
          excerpt?: string | null;
          id?: string;
          published?: boolean;
          published_at?: string | null;
          slug?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          banned: boolean;
          banned_at: string | null;
          banned_reason: string | null;
          birth_date: string | null;
          city: string | null;
          class_id: string | null;
          created_at: string;
          email: string | null;
          first_name: string | null;
          full_name: string | null;
          grade: number | null;
          id: string;
          intro_completed: boolean;
          last_name: string | null;
          last_seen_at: string | null;
          school: string | null;
          telegram_admin_chat_id: number | null;
          telegram_username: string | null;
          updated_at: string;
          username: string | null;
        };
        Insert: {
          banned?: boolean;
          banned_at?: string | null;
          banned_reason?: string | null;
          birth_date?: string | null;
          city?: string | null;
          class_id?: string | null;
          created_at?: string;
          email?: string | null;
          first_name?: string | null;
          full_name?: string | null;
          grade?: number | null;
          id: string;
          intro_completed?: boolean;
          last_name?: string | null;
          last_seen_at?: string | null;
          school?: string | null;
          telegram_admin_chat_id?: number | null;
          telegram_username?: string | null;
          updated_at?: string;
          username?: string | null;
        };
        Update: {
          banned?: boolean;
          banned_at?: string | null;
          banned_reason?: string | null;
          birth_date?: string | null;
          city?: string | null;
          class_id?: string | null;
          created_at?: string;
          email?: string | null;
          first_name?: string | null;
          full_name?: string | null;
          grade?: number | null;
          id?: string;
          intro_completed?: boolean;
          last_name?: string | null;
          last_seen_at?: string | null;
          school?: string | null;
          telegram_admin_chat_id?: number | null;
          telegram_username?: string | null;
          updated_at?: string;
          username?: string | null;
        };
        Relationships: [];
      };
      questions: {
        Row: {
          choices: Json;
          correct_choice_id: string | null;
          correct_grid_answers: string[] | null;
          created_at: string;
          created_by: string | null;
          difficulty: Database["public"]["Enums"]["sat_difficulty"];
          explanation: string | null;
          id: string;
          image_url: string | null;
          kind: Database["public"]["Enums"]["question_kind"];
          prompt: string | null;
          question_text: string;
          section: Database["public"]["Enums"]["sat_section"];
          skill: string;
          source_month: number | null;
          source_year: number | null;
          time_limit_seconds: number | null;
          updated_at: string;
        };
        Insert: {
          choices?: Json;
          correct_choice_id?: string | null;
          correct_grid_answers?: string[] | null;
          created_at?: string;
          created_by?: string | null;
          difficulty: Database["public"]["Enums"]["sat_difficulty"];
          explanation?: string | null;
          id?: string;
          image_url?: string | null;
          kind?: Database["public"]["Enums"]["question_kind"];
          prompt?: string | null;
          question_text: string;
          section: Database["public"]["Enums"]["sat_section"];
          skill: string;
          source_month?: number | null;
          source_year?: number | null;
          time_limit_seconds?: number | null;
          updated_at?: string;
        };
        Update: {
          choices?: Json;
          correct_choice_id?: string | null;
          correct_grid_answers?: string[] | null;
          created_at?: string;
          created_by?: string | null;
          difficulty?: Database["public"]["Enums"]["sat_difficulty"];
          explanation?: string | null;
          id?: string;
          image_url?: string | null;
          kind?: Database["public"]["Enums"]["question_kind"];
          prompt?: string | null;
          question_text?: string;
          section?: Database["public"]["Enums"]["sat_section"];
          skill?: string;
          source_month?: number | null;
          source_year?: number | null;
          time_limit_seconds?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      student_profiles: {
        Row: {
          created_at: string;
          current_streak: number;
          exam_date: string | null;
          fear_other: string | null;
          fears: string[];
          intro_completed_at: string | null;
          last_daily_completed_date: string | null;
          last_active_at: string | null;
          level: string | null;
          longest_streak: number;
          step: number;
          target_math: number | null;
          target_rw: number | null;
          target_score: number | null;
          time_bucket: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          current_streak?: number;
          exam_date?: string | null;
          fear_other?: string | null;
          fears?: string[];
          intro_completed_at?: string | null;
          last_daily_completed_date?: string | null;
          last_active_at?: string | null;
          level?: string | null;
          longest_streak?: number;
          step?: number;
          target_math?: number | null;
          target_rw?: number | null;
          target_score?: number | null;
          time_bucket?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          current_streak?: number;
          exam_date?: string | null;
          fear_other?: string | null;
          fears?: string[];
          intro_completed_at?: string | null;
          last_daily_completed_date?: string | null;
          last_active_at?: string | null;
          level?: string | null;
          longest_streak?: number;
          step?: number;
          target_math?: number | null;
          target_rw?: number | null;
          target_score?: number | null;
          time_bucket?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      test_questions: {
        Row: {
          position: number;
          question_id: string;
          test_id: string;
        };
        Insert: {
          position: number;
          question_id: string;
          test_id: string;
        };
        Update: {
          position?: number;
          question_id?: string;
          test_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "test_questions_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "test_questions_test_id_fkey";
            columns: ["test_id"];
            isOneToOne: false;
            referencedRelation: "tests";
            referencedColumns: ["id"];
          },
        ];
      };
      test_sessions: {
        Row: {
          completed_at: string | null;
          correct_count: number | null;
          created_at: string;
          daily_test_id: string | null;
          id: string;
          math_score: number | null;
          metadata: Json;
          mock_exam_id: string | null;
          rw_score: number | null;
          score: number | null;
          started_at: string;
          total_questions: number | null;
          type: Database["public"]["Enums"]["test_type"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          completed_at?: string | null;
          correct_count?: number | null;
          created_at?: string;
          daily_test_id?: string | null;
          id?: string;
          math_score?: number | null;
          metadata?: Json;
          mock_exam_id?: string | null;
          rw_score?: number | null;
          score?: number | null;
          started_at?: string;
          total_questions?: number | null;
          type: Database["public"]["Enums"]["test_type"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          completed_at?: string | null;
          correct_count?: number | null;
          created_at?: string;
          daily_test_id?: string | null;
          id?: string;
          math_score?: number | null;
          metadata?: Json;
          mock_exam_id?: string | null;
          rw_score?: number | null;
          score?: number | null;
          started_at?: string;
          total_questions?: number | null;
          type?: Database["public"]["Enums"]["test_type"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "test_sessions_daily_test_id_fkey";
            columns: ["daily_test_id"];
            isOneToOne: false;
            referencedRelation: "daily_tests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "test_sessions_mock_exam_id_fkey";
            columns: ["mock_exam_id"];
            isOneToOne: false;
            referencedRelation: "mock_exams";
            referencedColumns: ["id"];
          },
        ];
      };
      tests: {
        Row: {
          created_at: string;
          created_by: string | null;
          difficulty: Database["public"]["Enums"]["sat_difficulty"];
          id: string;
          module: number;
          published: boolean;
          section: Database["public"]["Enums"]["sat_section"];
          source_month: number | null;
          source_year: number | null;
          time_limit_seconds: number | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          difficulty?: Database["public"]["Enums"]["sat_difficulty"];
          id?: string;
          module: number;
          published?: boolean;
          section: Database["public"]["Enums"]["sat_section"];
          source_month?: number | null;
          source_year?: number | null;
          time_limit_seconds?: number | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          difficulty?: Database["public"]["Enums"]["sat_difficulty"];
          id?: string;
          module?: number;
          published?: boolean;
          section?: Database["public"]["Enums"]["sat_section"];
          source_month?: number | null;
          source_year?: number | null;
          time_limit_seconds?: number | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      vocab_cards: {
        Row: {
          id: string;
          word: string;
          part_of_speech: string;
          definition: string;
          dsat_passage: string;
          roots_etymology: string | null;
          synonyms: string[];
          sat_traps: string | null;
          difficulty_tier: string;
          deck_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          word: string;
          part_of_speech: string;
          definition: string;
          dsat_passage: string;
          roots_etymology?: string | null;
          synonyms?: string[];
          sat_traps?: string | null;
          difficulty_tier?: string;
          deck_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          word?: string;
          part_of_speech?: string;
          definition?: string;
          dsat_passage?: string;
          roots_etymology?: string | null;
          synonyms?: string[];
          sat_traps?: string | null;
          difficulty_tier?: string;
          deck_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vocab_cards_deck_id_fkey";
            columns: ["deck_id"];
            isOneToOne: false;
            referencedRelation: "vocab_decks";
            referencedColumns: ["id"];
          },
        ];
      };
      vocab_decks: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      user_card_states: {
        Row: {
          id: string;
          user_id: string;
          card_id: string;
          due: string;
          stability: number;
          difficulty: number;
          elapsed_days: number;
          scheduled_days: number;
          reps: number;
          lapses: number;
          state: number;
          last_review: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          card_id: string;
          due?: string;
          stability?: number;
          difficulty?: number;
          elapsed_days?: number;
          scheduled_days?: number;
          reps?: number;
          lapses?: number;
          state?: number;
          last_review?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          card_id?: string;
          due?: string;
          stability?: number;
          difficulty?: number;
          elapsed_days?: number;
          scheduled_days?: number;
          reps?: number;
          lapses?: number;
          state?: number;
          last_review?: string | null;
        };
        Relationships: [];
      };
      vocab_quizzes: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          time_limit_seconds: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          time_limit_seconds?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          time_limit_seconds?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      vocab_quiz_questions: {
        Row: {
          id: string;
          quiz_id: string;
          vocab_card_id: string | null;
          passage_text: string;
          correct_answer: string;
          options: string[];
          explanation: string;
          position: number;
        };
        Insert: {
          id?: string;
          quiz_id: string;
          vocab_card_id?: string | null;
          passage_text: string;
          correct_answer: string;
          options: string[];
          explanation: string;
          position?: number;
        };
        Update: {
          id?: string;
          quiz_id?: string;
          vocab_card_id?: string | null;
          passage_text?: string;
          correct_answer?: string;
          options?: string[];
          explanation?: string;
          position?: number;
        };
        Relationships: [];
      };
      vocab_quiz_attempts: {
        Row: {
          id: string;
          user_id: string;
          quiz_id: string;
          score: number;
          total: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          quiz_id: string;
          score: number;
          total: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          quiz_id?: string;
          score?: number;
          total?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      vocab_activity_logs: {
        Row: {
          id: string;
          user_id: string;
          activity_date: string;
          cards_reviewed: number;
          completed_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          activity_date: string;
          cards_reviewed?: number;
          completed_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          activity_date?: string;
          cards_reviewed?: number;
          completed_at?: string;
        };
        Relationships: [];
      };
      admin_telegram_link_codes: {
        Row: {
          code: string;
          admin_user_id: string;
          expires_at: string;
          used_at: string | null;
          created_at: string;
        };
        Insert: {
          code: string;
          admin_user_id: string;
          expires_at: string;
          used_at?: string | null;
          created_at?: string;
        };
        Update: {
          code?: string;
          admin_user_id?: string;
          expires_at?: string;
          used_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      admin_by_telegram_chat: { Args: { p_chat_id: number }; Returns: string | null };
      admin_consume_telegram_link_code: {
        Args: { p_code: string; p_chat_id: number };
        Returns: Json;
      };
      admin_create_telegram_link_code: { Args: never; Returns: string };
      admin_list_telegram_admins: {
        Args: never;
        Returns: {
          user_id: string;
          email: string | null;
          full_name: string | null;
          chat_id: number;
          banned: boolean;
          banned_reason: string | null;
          is_self: boolean;
        }[];
      };
      admin_revoke_telegram_admin: { Args: { p_user_id: string }; Returns: undefined };
      admin_set_banned: {
        Args: { p_user_id: string; p_banned: boolean; p_reason?: string | null };
        Returns: undefined;
      };
      admin_telegram_link_status: { Args: never; Returns: Json };
      admin_unlink_telegram: { Args: never; Returns: undefined };
      admin_user_activity: {
        Args: { p_user_id: string; p_limit?: number };
        Returns: {
          occurred_at: string;
          kind: string;
          summary: string;
          meta: Json;
        }[];
      };
      admin_user_detail: { Args: { p_user_id: string }; Returns: Json };
      admin_user_sessions: {
        Args: { p_user_id: string; p_limit?: number; p_offset?: number };
        Returns: {
          id: string;
          type: string;
          title: string;
          started_at: string;
          completed_at: string | null;
          score: number | null;
          rw_score: number | null;
          math_score: number | null;
          correct_count: number | null;
          total_questions: number | null;
          in_progress: boolean;
        }[];
      };
      admin_users_summary: {
        Args: never;
        Returns: {
          id: string;
          email: string | null;
          full_name: string | null;
          created_at: string;
          last_seen_at: string | null;
          banned: boolean;
          role: string;
          tests_total: number;
          tests_mock: number;
          tests_daily: number;
          tests_practice: number;
          current_streak: number;
          last_active_at: string | null;
          class_name: string | null;
          accuracy_pct: number | null;
        }[];
      };
      admin_set_role: {
        Args: { p_user_id: string; p_role: string };
        Returns: undefined;
      };
      touch_presence: { Args: never; Returns: undefined };
      admin_get_question_answers: {
        Args: { p_question_id: string };
        Returns: {
          correct_choice_id: string;
          correct_grid_answers: string[];
          explanation: string;
        }[];
      };
      get_answers_for_review: {
        Args: { p_question_ids: string[] };
        Returns: {
          correct_choice_id: string;
          correct_grid_answers: string[];
          explanation: string;
          question_id: string;
        }[];
      };
      get_desmos_api_key: { Args: never; Returns: string };
      grade_answer: {
        Args: {
          p_choice_id: string;
          p_grid_answer: string;
          p_question_id: string;
        };
        Returns: boolean;
      };
      bs_is_staff: { Args: { _uid?: string }; Returns: boolean };
      vocab_due_count: {
        Args: { p_user_id?: string; p_deck_id?: string | null };
        Returns: number;
      };
    };
    Enums: {
      app_role: "student" | "admin" | "editor";
      question_kind: "multiple_choice" | "grid_in";
      sat_difficulty: "easy" | "medium" | "hard" | "C" | "B" | "D" | "A" | "S";
      sat_section: "reading_writing" | "math";
      test_type: "practice" | "daily" | "mock";
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
      app_role: ["student", "admin"],
      question_kind: ["multiple_choice", "grid_in"],
      sat_difficulty: ["easy", "medium", "hard", "C", "B", "D", "A", "S"],
      sat_section: ["reading_writing", "math"],
      test_type: ["practice", "daily", "mock"],
    },
  },
} as const;
