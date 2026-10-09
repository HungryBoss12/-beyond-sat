export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      admin_telegram_link_codes: {
        Row: {
          admin_user_id: string;
          code: string;
          created_at: string;
          expires_at: string;
          used_at: string | null;
        };
        Insert: {
          admin_user_id: string;
          code: string;
          created_at?: string;
          expires_at: string;
          used_at?: string | null;
        };
        Update: {
          admin_user_id?: string;
          code?: string;
          created_at?: string;
          expires_at?: string;
          used_at?: string | null;
        };
        Relationships: [];
      };
      ai_conversations: {
        Row: {
          created_at: string;
          id: string;
          model_choice: string;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          model_choice?: string;
          title?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          model_choice?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      ai_messages: {
        Row: {
          content: string;
          conversation_id: string;
          created_at: string;
          id: string;
          image_url: string | null;
          role: string;
          user_id: string;
        };
        Insert: {
          content?: string;
          conversation_id: string;
          created_at?: string;
          id?: string;
          image_url?: string | null;
          role: string;
          user_id: string;
        };
        Update: {
          content?: string;
          conversation_id?: string;
          created_at?: string;
          id?: string;
          image_url?: string | null;
          role?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "ai_conversations";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_usage_daily: {
        Row: {
          count: number;
          day: string;
          user_id: string;
        };
        Insert: {
          count?: number;
          day: string;
          user_id: string;
        };
        Update: {
          count?: number;
          day?: string;
          user_id?: string;
        };
        Relationships: [];
      };
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
      chat_message_attachments: {
        Row: {
          byte_size: number | null;
          created_at: string;
          file_name: string;
          id: string;
          message_id: string;
          mime_type: string | null;
          storage_path: string;
        };
        Insert: {
          byte_size?: number | null;
          created_at?: string;
          file_name: string;
          id?: string;
          message_id: string;
          mime_type?: string | null;
          storage_path: string;
        };
        Update: {
          byte_size?: number | null;
          created_at?: string;
          file_name?: string;
          id?: string;
          message_id?: string;
          mime_type?: string | null;
          storage_path?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chat_message_attachments_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: false;
            referencedRelation: "chat_messages";
            referencedColumns: ["id"];
          },
        ];
      };
      chat_messages: {
        Row: {
          body: string;
          created_at: string;
          deleted_at: string | null;
          edited_at: string | null;
          id: string;
          sender_id: string;
          thread_id: string;
        };
        Insert: {
          body?: string;
          created_at?: string;
          deleted_at?: string | null;
          edited_at?: string | null;
          id?: string;
          sender_id: string;
          thread_id: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          deleted_at?: string | null;
          edited_at?: string | null;
          id?: string;
          sender_id?: string;
          thread_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chat_messages_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "chat_threads";
            referencedColumns: ["id"];
          },
        ];
      };
      chat_mutes: {
        Row: {
          class_id: string | null;
          created_at: string;
          id: string;
          muted_by: string | null;
          muted_until: string | null;
          reason: string | null;
          thread_id: string | null;
          user_id: string;
        };
        Insert: {
          class_id?: string | null;
          created_at?: string;
          id?: string;
          muted_by?: string | null;
          muted_until?: string | null;
          reason?: string | null;
          thread_id?: string | null;
          user_id: string;
        };
        Update: {
          class_id?: string | null;
          created_at?: string;
          id?: string;
          muted_by?: string | null;
          muted_until?: string | null;
          reason?: string | null;
          thread_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chat_mutes_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chat_mutes_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "chat_threads";
            referencedColumns: ["id"];
          },
        ];
      };
      chat_thread_members: {
        Row: {
          joined_at: string;
          last_read_at: string | null;
          thread_id: string;
          user_id: string;
        };
        Insert: {
          joined_at?: string;
          last_read_at?: string | null;
          thread_id: string;
          user_id: string;
        };
        Update: {
          joined_at?: string;
          last_read_at?: string | null;
          thread_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chat_thread_members_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "chat_threads";
            referencedColumns: ["id"];
          },
        ];
      };
      chat_threads: {
        Row: {
          class_id: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          kind: Database["public"]["Enums"]["chat_thread_kind"];
          pinned: boolean;
          subject: Database["public"]["Enums"]["class_subject"] | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          class_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          kind: Database["public"]["Enums"]["chat_thread_kind"];
          pinned?: boolean;
          subject?: Database["public"]["Enums"]["class_subject"] | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          class_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["chat_thread_kind"];
          pinned?: boolean;
          subject?: Database["public"]["Enums"]["class_subject"] | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chat_threads_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
        ];
      };
      class_fees: {
        Row: {
          class_id: string;
          created_at: string;
          created_by: string | null;
          effective_from: string;
          monthly_fee_uzs: number | null;
        };
        Insert: {
          class_id: string;
          created_at?: string;
          created_by?: string | null;
          effective_from: string;
          monthly_fee_uzs?: number | null;
        };
        Update: {
          class_id?: string;
          created_at?: string;
          created_by?: string | null;
          effective_from?: string;
          monthly_fee_uzs?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "class_fees_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
        ];
      };
      class_group_fees: {
        Row: {
          created_at: string;
          created_by: string | null;
          effective_from: string;
          group_id: string;
          monthly_fee_uzs: number | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          effective_from: string;
          group_id: string;
          monthly_fee_uzs?: number | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          effective_from?: string;
          group_id?: string;
          monthly_fee_uzs?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "class_group_fees_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "class_groups";
            referencedColumns: ["id"];
          },
        ];
      };
      class_group_memberships: {
        Row: {
          activated_on: string | null;
          class_id: string;
          enrolled_on: string;
          group_id: string;
          joined_at: string;
          status: Database["public"]["Enums"]["class_member_status"];
          subject: Database["public"]["Enums"]["class_subject"];
          user_id: string;
        };
        Insert: {
          activated_on?: string | null;
          class_id: string;
          enrolled_on?: string;
          group_id: string;
          joined_at?: string;
          status?: Database["public"]["Enums"]["class_member_status"];
          subject: Database["public"]["Enums"]["class_subject"];
          user_id: string;
        };
        Update: {
          activated_on?: string | null;
          class_id?: string;
          enrolled_on?: string;
          group_id?: string;
          joined_at?: string;
          status?: Database["public"]["Enums"]["class_member_status"];
          subject?: Database["public"]["Enums"]["class_subject"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "class_group_memberships_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "class_group_memberships_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "class_groups";
            referencedColumns: ["id"];
          },
        ];
      };
      class_groups: {
        Row: {
          active: boolean;
          class_id: string;
          created_at: string;
          end_time: string | null;
          id: string;
          level: string | null;
          name: string;
          room: string | null;
          schedule_days: number[] | null;
          start_time: string | null;
          subject: Database["public"]["Enums"]["class_subject"];
          teacher_id: string | null;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          class_id: string;
          created_at?: string;
          end_time?: string | null;
          id?: string;
          level?: string | null;
          name: string;
          room?: string | null;
          schedule_days?: number[] | null;
          start_time?: string | null;
          subject: Database["public"]["Enums"]["class_subject"];
          teacher_id?: string | null;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          class_id?: string;
          created_at?: string;
          end_time?: string | null;
          id?: string;
          level?: string | null;
          name?: string;
          room?: string | null;
          schedule_days?: number[] | null;
          start_time?: string | null;
          subject?: Database["public"]["Enums"]["class_subject"];
          teacher_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "class_groups_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
        ];
      };
      class_lessons: {
        Row: {
          class_id: string;
          created_at: string;
          created_by: string | null;
          group_id: string;
          id: string;
          lesson_date: string;
          subject: Database["public"]["Enums"]["class_subject"] | null;
          topic: string | null;
        };
        Insert: {
          class_id: string;
          created_at?: string;
          created_by?: string | null;
          group_id: string;
          id?: string;
          lesson_date: string;
          subject?: Database["public"]["Enums"]["class_subject"] | null;
          topic?: string | null;
        };
        Update: {
          class_id?: string;
          created_at?: string;
          created_by?: string | null;
          group_id?: string;
          id?: string;
          lesson_date?: string;
          subject?: Database["public"]["Enums"]["class_subject"] | null;
          topic?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "class_lessons_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "class_lessons_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "class_groups";
            referencedColumns: ["id"];
          },
        ];
      };
      class_membership_events: {
        Row: {
          changed_by: string | null;
          class_id: string;
          created_at: string;
          effective_on: string;
          group_id: string | null;
          id: string;
          kind: string;
          status: Database["public"]["Enums"]["class_member_status"];
          user_id: string;
        };
        Insert: {
          changed_by?: string | null;
          class_id: string;
          created_at?: string;
          effective_on: string;
          group_id?: string | null;
          id?: string;
          kind?: string;
          status: Database["public"]["Enums"]["class_member_status"];
          user_id: string;
        };
        Update: {
          changed_by?: string | null;
          class_id?: string;
          created_at?: string;
          effective_on?: string;
          group_id?: string | null;
          id?: string;
          kind?: string;
          status?: Database["public"]["Enums"]["class_member_status"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "class_membership_events_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "class_membership_events_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "class_groups";
            referencedColumns: ["id"];
          },
        ];
      };
      class_memberships: {
        Row: {
          class_id: string;
          enrolled_on: string;
          joined_at: string;
          status: Database["public"]["Enums"]["class_member_status"];
          user_id: string;
        };
        Insert: {
          class_id: string;
          enrolled_on?: string;
          joined_at?: string;
          status?: Database["public"]["Enums"]["class_member_status"];
          user_id: string;
        };
        Update: {
          class_id?: string;
          enrolled_on?: string;
          joined_at?: string;
          status?: Database["public"]["Enums"]["class_member_status"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "class_memberships_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
        ];
      };
      classes: {
        Row: {
          active: boolean;
          created_at: string;
          created_by: string | null;
          description: string | null;
          end_time: string | null;
          id: string;
          level: string | null;
          name: string;
          room: string | null;
          schedule_days: number[] | null;
          start_time: string | null;
          starts_on: string | null;
          teacher_id: string | null;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          end_time?: string | null;
          id?: string;
          level?: string | null;
          name: string;
          room?: string | null;
          schedule_days?: number[] | null;
          start_time?: string | null;
          starts_on?: string | null;
          teacher_id?: string | null;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          end_time?: string | null;
          id?: string;
          level?: string | null;
          name?: string;
          room?: string | null;
          schedule_days?: number[] | null;
          start_time?: string | null;
          starts_on?: string | null;
          teacher_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
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
      homework_assignments: {
        Row: {
          body: string;
          class_id: string;
          created_at: string;
          created_by: string | null;
          due_at: string | null;
          group_id: string;
          id: string;
          lesson_id: string | null;
          max_score: number | null;
          subject: Database["public"]["Enums"]["class_subject"];
          title: string;
          updated_at: string;
          var_kind: Database["public"]["Enums"]["hw_item"] | null;
          video_url: string | null;
        };
        Insert: {
          body?: string;
          class_id: string;
          created_at?: string;
          created_by?: string | null;
          due_at?: string | null;
          group_id: string;
          id?: string;
          lesson_id?: string | null;
          max_score?: number | null;
          subject: Database["public"]["Enums"]["class_subject"];
          title: string;
          updated_at?: string;
          var_kind?: Database["public"]["Enums"]["hw_item"] | null;
          video_url?: string | null;
        };
        Update: {
          body?: string;
          class_id?: string;
          created_at?: string;
          created_by?: string | null;
          due_at?: string | null;
          group_id?: string;
          id?: string;
          lesson_id?: string | null;
          max_score?: number | null;
          subject?: Database["public"]["Enums"]["class_subject"];
          title?: string;
          updated_at?: string;
          var_kind?: Database["public"]["Enums"]["hw_item"] | null;
          video_url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "homework_assignments_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "homework_assignments_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "class_groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "homework_assignments_lesson_id_fkey";
            columns: ["lesson_id"];
            isOneToOne: false;
            referencedRelation: "class_lessons";
            referencedColumns: ["id"];
          },
        ];
      };
      homework_files: {
        Row: {
          assignment_id: string;
          byte_size: number | null;
          created_at: string;
          file_name: string;
          id: string;
          mime_type: string | null;
          storage_path: string;
        };
        Insert: {
          assignment_id: string;
          byte_size?: number | null;
          created_at?: string;
          file_name: string;
          id?: string;
          mime_type?: string | null;
          storage_path: string;
        };
        Update: {
          assignment_id?: string;
          byte_size?: number | null;
          created_at?: string;
          file_name?: string;
          id?: string;
          mime_type?: string | null;
          storage_path?: string;
        };
        Relationships: [
          {
            foreignKeyName: "homework_files_assignment_id_fkey";
            columns: ["assignment_id"];
            isOneToOne: false;
            referencedRelation: "homework_assignments";
            referencedColumns: ["id"];
          },
        ];
      };
      homework_submission_files: {
        Row: {
          byte_size: number | null;
          created_at: string;
          file_name: string;
          id: string;
          mime_type: string | null;
          storage_path: string;
          submission_id: string;
        };
        Insert: {
          byte_size?: number | null;
          created_at?: string;
          file_name: string;
          id?: string;
          mime_type?: string | null;
          storage_path: string;
          submission_id: string;
        };
        Update: {
          byte_size?: number | null;
          created_at?: string;
          file_name?: string;
          id?: string;
          mime_type?: string | null;
          storage_path?: string;
          submission_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "homework_submission_files_submission_id_fkey";
            columns: ["submission_id"];
            isOneToOne: false;
            referencedRelation: "homework_submissions";
            referencedColumns: ["id"];
          },
        ];
      };
      homework_submissions: {
        Row: {
          assignment_id: string;
          created_at: string;
          graded_at: string | null;
          id: string;
          note: string;
          review_note: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          score: number | null;
          status: Database["public"]["Enums"]["homework_submission_status"];
          student_id: string;
          updated_at: string;
        };
        Insert: {
          assignment_id: string;
          created_at?: string;
          graded_at?: string | null;
          id?: string;
          note?: string;
          review_note?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          score?: number | null;
          status?: Database["public"]["Enums"]["homework_submission_status"];
          student_id: string;
          updated_at?: string;
        };
        Update: {
          assignment_id?: string;
          created_at?: string;
          graded_at?: string | null;
          id?: string;
          note?: string;
          review_note?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          score?: number | null;
          status?: Database["public"]["Enums"]["homework_submission_status"];
          student_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "homework_submissions_assignment_id_fkey";
            columns: ["assignment_id"];
            isOneToOne: false;
            referencedRelation: "homework_assignments";
            referencedColumns: ["id"];
          },
        ];
      };
      ledger_entries: {
        Row: {
          amount_uzs: number;
          class_id: string | null;
          created_at: string;
          created_by: string | null;
          group_id: string | null;
          id: string;
          idempotency_key: string | null;
          kind: Database["public"]["Enums"]["ledger_kind"];
          method: Database["public"]["Enums"]["pay_method"] | null;
          note: string | null;
          occurred_on: string;
          period: string | null;
          prorate_lessons: number | null;
          prorate_total: number | null;
          source: Database["public"]["Enums"]["ledger_source"];
          user_id: string;
          void_reason: string | null;
          voided_at: string | null;
          voided_by: string | null;
        };
        Insert: {
          amount_uzs: number;
          class_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          group_id?: string | null;
          id?: string;
          idempotency_key?: string | null;
          kind: Database["public"]["Enums"]["ledger_kind"];
          method?: Database["public"]["Enums"]["pay_method"] | null;
          note?: string | null;
          occurred_on: string;
          period?: string | null;
          prorate_lessons?: number | null;
          prorate_total?: number | null;
          source?: Database["public"]["Enums"]["ledger_source"];
          user_id: string;
          void_reason?: string | null;
          voided_at?: string | null;
          voided_by?: string | null;
        };
        Update: {
          amount_uzs?: number;
          class_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          group_id?: string | null;
          id?: string;
          idempotency_key?: string | null;
          kind?: Database["public"]["Enums"]["ledger_kind"];
          method?: Database["public"]["Enums"]["pay_method"] | null;
          note?: string | null;
          occurred_on?: string;
          period?: string | null;
          prorate_lessons?: number | null;
          prorate_total?: number | null;
          source?: Database["public"]["Enums"]["ledger_source"];
          user_id?: string;
          void_reason?: string | null;
          voided_at?: string | null;
          voided_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ledger_entries_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ledger_entries_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "class_groups";
            referencedColumns: ["id"];
          },
        ];
      };
      lesson_attendance: {
        Row: {
          class_id: string | null;
          created_at: string;
          group_id: string;
          id: string;
          lesson_date: string;
          marked_by: string | null;
          note: string | null;
          participated: boolean;
          subject: Database["public"]["Enums"]["class_subject"] | null;
          user_id: string;
        };
        Insert: {
          class_id?: string | null;
          created_at?: string;
          group_id: string;
          id?: string;
          lesson_date: string;
          marked_by?: string | null;
          note?: string | null;
          participated?: boolean;
          subject?: Database["public"]["Enums"]["class_subject"] | null;
          user_id: string;
        };
        Update: {
          class_id?: string | null;
          created_at?: string;
          group_id?: string;
          id?: string;
          lesson_date?: string;
          marked_by?: string | null;
          note?: string | null;
          participated?: boolean;
          subject?: Database["public"]["Enums"]["class_subject"] | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lesson_attendance_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lesson_attendance_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "class_groups";
            referencedColumns: ["id"];
          },
        ];
      };
      lesson_hw_marks: {
        Row: {
          done: boolean;
          group_id: string;
          item: Database["public"]["Enums"]["hw_item"];
          lesson_id: string;
          source: Database["public"]["Enums"]["var_source"];
          updated_at: string;
          updated_by: string | null;
          user_id: string;
        };
        Insert: {
          done?: boolean;
          group_id: string;
          item: Database["public"]["Enums"]["hw_item"];
          lesson_id: string;
          source?: Database["public"]["Enums"]["var_source"];
          updated_at?: string;
          updated_by?: string | null;
          user_id: string;
        };
        Update: {
          done?: boolean;
          group_id?: string;
          item?: Database["public"]["Enums"]["hw_item"];
          lesson_id?: string;
          source?: Database["public"]["Enums"]["var_source"];
          updated_at?: string;
          updated_by?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lesson_hw_marks_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "class_groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lesson_hw_marks_lesson_id_fkey";
            columns: ["lesson_id"];
            isOneToOne: false;
            referencedRelation: "class_lessons";
            referencedColumns: ["id"];
          },
        ];
      };
      lesson_progress: {
        Row: {
          completed_at: string;
          id: string;
          lesson_id: string;
          user_id: string;
        };
        Insert: {
          completed_at?: string;
          id?: string;
          lesson_id: string;
          user_id: string;
        };
        Update: {
          completed_at?: string;
          id?: string;
          lesson_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey";
            columns: ["lesson_id"];
            isOneToOne: false;
            referencedRelation: "lessons";
            referencedColumns: ["id"];
          },
        ];
      };
      lesson_recommended_videos: {
        Row: {
          created_at: string;
          duration_seconds: number | null;
          id: string;
          sort_order: number;
          title: string;
          topic_id: string;
          updated_at: string;
          youtube_url: string;
        };
        Insert: {
          created_at?: string;
          duration_seconds?: number | null;
          id?: string;
          sort_order?: number;
          title: string;
          topic_id: string;
          updated_at?: string;
          youtube_url: string;
        };
        Update: {
          created_at?: string;
          duration_seconds?: number | null;
          id?: string;
          sort_order?: number;
          title?: string;
          topic_id?: string;
          updated_at?: string;
          youtube_url?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lesson_recommended_videos_topic_id_fkey";
            columns: ["topic_id"];
            isOneToOne: false;
            referencedRelation: "lesson_topics";
            referencedColumns: ["id"];
          },
        ];
      };
      lesson_results: {
        Row: {
          group_id: string;
          lesson_id: string;
          m1: number | null;
          m2: number | null;
          updated_at: string;
          updated_by: string | null;
          user_id: string;
        };
        Insert: {
          group_id: string;
          lesson_id: string;
          m1?: number | null;
          m2?: number | null;
          updated_at?: string;
          updated_by?: string | null;
          user_id: string;
        };
        Update: {
          group_id?: string;
          lesson_id?: string;
          m1?: number | null;
          m2?: number | null;
          updated_at?: string;
          updated_by?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lesson_results_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "class_groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lesson_results_lesson_id_fkey";
            columns: ["lesson_id"];
            isOneToOne: false;
            referencedRelation: "class_lessons";
            referencedColumns: ["id"];
          },
        ];
      };
      lesson_subjects: {
        Row: {
          created_at: string;
          icon: string;
          id: string;
          slug: string;
          sort_order: number;
          title: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          icon?: string;
          id?: string;
          slug: string;
          sort_order?: number;
          title: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          icon?: string;
          id?: string;
          slug?: string;
          sort_order?: number;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      lesson_topics: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          sort_order: number;
          subject_id: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          sort_order?: number;
          subject_id: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          sort_order?: number;
          subject_id?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lesson_topics_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "lesson_subjects";
            referencedColumns: ["id"];
          },
        ];
      };
      lesson_video_catalog: {
        Row: {
          created_at: string;
          duration_seconds: number | null;
          score: number;
          title: string;
          updated_at: string;
          youtube_url: string;
          youtube_video_id: string;
        };
        Insert: {
          created_at?: string;
          duration_seconds?: number | null;
          score?: number;
          title: string;
          updated_at?: string;
          youtube_url: string;
          youtube_video_id: string;
        };
        Update: {
          created_at?: string;
          duration_seconds?: number | null;
          score?: number;
          title?: string;
          updated_at?: string;
          youtube_url?: string;
          youtube_video_id?: string;
        };
        Relationships: [];
      };
      lesson_video_votes: {
        Row: {
          created_at: string;
          updated_at: string;
          user_id: string;
          vote: number;
          youtube_video_id: string;
        };
        Insert: {
          created_at?: string;
          updated_at?: string;
          user_id: string;
          vote: number;
          youtube_video_id: string;
        };
        Update: {
          created_at?: string;
          updated_at?: string;
          user_id?: string;
          vote?: number;
          youtube_video_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lesson_video_votes_youtube_video_id_fkey";
            columns: ["youtube_video_id"];
            isOneToOne: false;
            referencedRelation: "lesson_video_catalog";
            referencedColumns: ["youtube_video_id"];
          },
        ];
      };
      lessons: {
        Row: {
          body: string;
          created_at: string;
          duration_seconds: number | null;
          id: string;
          published: boolean;
          sort_order: number;
          title: string;
          topic_id: string;
          updated_at: string;
          video_path: string | null;
          video_url: string | null;
        };
        Insert: {
          body?: string;
          created_at?: string;
          duration_seconds?: number | null;
          id?: string;
          published?: boolean;
          sort_order?: number;
          title: string;
          topic_id: string;
          updated_at?: string;
          video_path?: string | null;
          video_url?: string | null;
        };
        Update: {
          body?: string;
          created_at?: string;
          duration_seconds?: number | null;
          id?: string;
          published?: boolean;
          sort_order?: number;
          title?: string;
          topic_id?: string;
          updated_at?: string;
          video_path?: string | null;
          video_url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "lessons_topic_id_fkey";
            columns: ["topic_id"];
            isOneToOne: false;
            referencedRelation: "lesson_topics";
            referencedColumns: ["id"];
          },
        ];
      };
      level_sections: {
        Row: {
          active: boolean;
          display_order: number;
          id: string;
          name: string;
          slug: string;
          subject: Database["public"]["Enums"]["class_subject"];
          weight: number;
        };
        Insert: {
          active?: boolean;
          display_order: number;
          id?: string;
          name: string;
          slug: string;
          subject: Database["public"]["Enums"]["class_subject"];
          weight?: number;
        };
        Update: {
          active?: boolean;
          display_order?: number;
          id?: string;
          name?: string;
          slug?: string;
          subject?: Database["public"]["Enums"]["class_subject"];
          weight?: number;
        };
        Relationships: [];
      };
      linktree_blocks: {
        Row: {
          align: string;
          created_at: string;
          icon: string | null;
          id: string;
          kind: string;
          label: string;
          position: number;
          updated_at: string;
          url: string | null;
          visible: boolean;
        };
        Insert: {
          align?: string;
          created_at?: string;
          icon?: string | null;
          id?: string;
          kind?: string;
          label?: string;
          position?: number;
          updated_at?: string;
          url?: string | null;
          visible?: boolean;
        };
        Update: {
          align?: string;
          created_at?: string;
          icon?: string | null;
          id?: string;
          kind?: string;
          label?: string;
          position?: number;
          updated_at?: string;
          url?: string | null;
          visible?: boolean;
        };
        Relationships: [];
      };
      linktree_profile: {
        Row: {
          avatar_url: string | null;
          header_align: string;
          id: string;
          orb_align: string;
          section_order: string[];
          show_orb: boolean;
          subtitle: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          header_align?: string;
          id?: string;
          orb_align?: string;
          section_order?: string[];
          show_orb?: boolean;
          subtitle?: string;
          title?: string;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          header_align?: string;
          id?: string;
          orb_align?: string;
          section_order?: string[];
          show_orb?: boolean;
          subtitle?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      login_attempt_buckets: {
        Row: {
          bucket_key: string;
          tokens: number;
          updated_at: string;
        };
        Insert: {
          bucket_key: string;
          tokens: number;
          updated_at: string;
        };
        Update: {
          bucket_key?: string;
          tokens?: number;
          updated_at?: string;
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
          section_break_seconds: number;
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
          section_break_seconds?: number;
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
          section_break_seconds?: number;
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
          avatar_url: string | null;
          banned: boolean;
          banned_at: string | null;
          banned_reason: string | null;
          birth_date: string | null;
          chat_setup_completed: boolean;
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
          must_change_credentials: boolean;
          school: string | null;
          staff_created: boolean;
          telegram_admin_chat_id: number | null;
          telegram_connected_at: string | null;
          telegram_username: string | null;
          updated_at: string;
          username: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          banned?: boolean;
          banned_at?: string | null;
          banned_reason?: string | null;
          birth_date?: string | null;
          chat_setup_completed?: boolean;
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
          must_change_credentials?: boolean;
          school?: string | null;
          staff_created?: boolean;
          telegram_admin_chat_id?: number | null;
          telegram_connected_at?: string | null;
          telegram_username?: string | null;
          updated_at?: string;
          username?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          banned?: boolean;
          banned_at?: string | null;
          banned_reason?: string | null;
          birth_date?: string | null;
          chat_setup_completed?: boolean;
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
          must_change_credentials?: boolean;
          school?: string | null;
          staff_created?: boolean;
          telegram_admin_chat_id?: number | null;
          telegram_connected_at?: string | null;
          telegram_username?: string | null;
          updated_at?: string;
          username?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
        ];
      };
      questions: {
        Row: {
          assessment: string | null;
          bank_format: string;
          choices: Json;
          correct_choice_id: string | null;
          correct_grid_answers: string[] | null;
          created_at: string;
          created_by: string | null;
          difficulty: Database["public"]["Enums"]["sat_difficulty"];
          domain: string | null;
          explanation: string | null;
          external_id: string | null;
          id: string;
          image_alt: string | null;
          image_url: string | null;
          kind: Database["public"]["Enums"]["question_kind"];
          prompt: string | null;
          published: boolean;
          question_text: string;
          section: Database["public"]["Enums"]["sat_section"];
          skill: string;
          source_month: number | null;
          source_year: number | null;
          subskill: string | null;
          time_limit_seconds: number | null;
          updated_at: string;
        };
        Insert: {
          assessment?: string | null;
          bank_format?: string;
          choices?: Json;
          correct_choice_id?: string | null;
          correct_grid_answers?: string[] | null;
          created_at?: string;
          created_by?: string | null;
          difficulty: Database["public"]["Enums"]["sat_difficulty"];
          domain?: string | null;
          explanation?: string | null;
          external_id?: string | null;
          id?: string;
          image_alt?: string | null;
          image_url?: string | null;
          kind?: Database["public"]["Enums"]["question_kind"];
          prompt?: string | null;
          published?: boolean;
          question_text: string;
          section: Database["public"]["Enums"]["sat_section"];
          skill: string;
          source_month?: number | null;
          source_year?: number | null;
          subskill?: string | null;
          time_limit_seconds?: number | null;
          updated_at?: string;
        };
        Update: {
          assessment?: string | null;
          bank_format?: string;
          choices?: Json;
          correct_choice_id?: string | null;
          correct_grid_answers?: string[] | null;
          created_at?: string;
          created_by?: string | null;
          difficulty?: Database["public"]["Enums"]["sat_difficulty"];
          domain?: string | null;
          explanation?: string | null;
          external_id?: string | null;
          id?: string;
          image_alt?: string | null;
          image_url?: string | null;
          kind?: Database["public"]["Enums"]["question_kind"];
          prompt?: string | null;
          published?: boolean;
          question_text?: string;
          section?: Database["public"]["Enums"]["sat_section"];
          skill?: string;
          source_month?: number | null;
          source_year?: number | null;
          subskill?: string | null;
          time_limit_seconds?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      staff_account_passes: {
        Row: {
          created_at: string;
          email: string;
          expires_at: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          expires_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          expires_at?: string;
        };
        Relationships: [];
      };
      student_contacts: {
        Row: {
          parent_phone: string | null;
          phone: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          parent_phone?: string | null;
          phone?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          parent_phone?: string | null;
          phone?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      student_discounts: {
        Row: {
          class_id: string;
          created_at: string;
          created_by: string | null;
          ends_on: string | null;
          id: string;
          mode: string;
          user_id: string;
          value: number;
        };
        Insert: {
          class_id: string;
          created_at?: string;
          created_by?: string | null;
          ends_on?: string | null;
          id?: string;
          mode: string;
          user_id: string;
          value: number;
        };
        Update: {
          class_id?: string;
          created_at?: string;
          created_by?: string | null;
          ends_on?: string | null;
          id?: string;
          mode?: string;
          user_id?: string;
          value?: number;
        };
        Relationships: [
          {
            foreignKeyName: "student_discounts_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
        ];
      };
      student_fee_overrides: {
        Row: {
          created_at: string;
          created_by: string | null;
          effective_from: string;
          group_id: string;
          monthly_fee_uzs: number | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          effective_from: string;
          group_id: string;
          monthly_fee_uzs?: number | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          effective_from?: string;
          group_id?: string;
          monthly_fee_uzs?: number | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "student_fee_overrides_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "class_groups";
            referencedColumns: ["id"];
          },
        ];
      };
      student_invites: {
        Row: {
          activates_at: string;
          created_at: string;
          created_by: string | null;
          expires_at: string;
          id: string;
          student_id: string;
          token_hash: string;
          used_at: string | null;
        };
        Insert: {
          activates_at?: string;
          created_at?: string;
          created_by?: string | null;
          expires_at: string;
          id?: string;
          student_id: string;
          token_hash: string;
          used_at?: string | null;
        };
        Update: {
          activates_at?: string;
          created_at?: string;
          created_by?: string | null;
          expires_at?: string;
          id?: string;
          student_id?: string;
          token_hash?: string;
          used_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "student_invites_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      student_level_scores: {
        Row: {
          assessed_on: string;
          created_at: string;
          created_by: string | null;
          group_id: string;
          id: string;
          lesson_id: string | null;
          note: string | null;
          score: number;
          section_id: string;
          user_id: string;
          void_reason: string | null;
          voided_at: string | null;
          voided_by: string | null;
        };
        Insert: {
          assessed_on: string;
          created_at?: string;
          created_by?: string | null;
          group_id: string;
          id?: string;
          lesson_id?: string | null;
          note?: string | null;
          score: number;
          section_id: string;
          user_id: string;
          void_reason?: string | null;
          voided_at?: string | null;
          voided_by?: string | null;
        };
        Update: {
          assessed_on?: string;
          created_at?: string;
          created_by?: string | null;
          group_id?: string;
          id?: string;
          lesson_id?: string | null;
          note?: string | null;
          score?: number;
          section_id?: string;
          user_id?: string;
          void_reason?: string | null;
          voided_at?: string | null;
          voided_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "student_level_scores_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "class_groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_level_scores_lesson_id_fkey";
            columns: ["lesson_id"];
            isOneToOne: false;
            referencedRelation: "class_lessons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_level_scores_section_id_fkey";
            columns: ["section_id"];
            isOneToOne: false;
            referencedRelation: "level_sections";
            referencedColumns: ["id"];
          },
        ];
      };
      student_profiles: {
        Row: {
          created_at: string;
          current_streak: number;
          exam_date: string | null;
          fear_other: string | null;
          fears: string[];
          intro_completed_at: string | null;
          last_active_at: string | null;
          last_daily_completed_date: string | null;
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
          last_active_at?: string | null;
          last_daily_completed_date?: string | null;
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
          last_active_at?: string | null;
          last_daily_completed_date?: string | null;
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
      student_score_history: {
        Row: {
          created_at: string;
          id: string;
          math: number;
          rw: number;
          updated_by: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          math: number;
          rw: number;
          updated_by?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          math?: number;
          rw?: number;
          updated_by?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      student_scores: {
        Row: {
          math: number;
          rw: number;
          updated_at: string;
          updated_by: string | null;
          user_id: string;
        };
        Insert: {
          math: number;
          rw: number;
          updated_at?: string;
          updated_by?: string | null;
          user_id: string;
        };
        Update: {
          math?: number;
          rw?: number;
          updated_at?: string;
          updated_by?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      students: {
        Row: {
          billing_note: string | null;
          claimed_at: string | null;
          created_at: string;
          created_by: string | null;
          description: string | null;
          english_note: string | null;
          full_name: string;
          goal: string | null;
          grade: string | null;
          id: string;
          import_key: string | null;
          math_note: string | null;
          parent_phone: string | null;
          phone: string | null;
          user_id: string | null;
        };
        Insert: {
          billing_note?: string | null;
          claimed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          english_note?: string | null;
          full_name: string;
          goal?: string | null;
          grade?: string | null;
          id?: string;
          import_key?: string | null;
          math_note?: string | null;
          parent_phone?: string | null;
          phone?: string | null;
          user_id?: string | null;
        };
        Update: {
          billing_note?: string | null;
          claimed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          english_note?: string | null;
          full_name?: string;
          goal?: string | null;
          grade?: string | null;
          id?: string;
          import_key?: string | null;
          math_note?: string | null;
          parent_phone?: string | null;
          phone?: string | null;
          user_id?: string | null;
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
          bank_format: string;
          created_at: string;
          created_by: string | null;
          difficulty: Database["public"]["Enums"]["sat_difficulty"];
          id: string;
          in_test_base: boolean;
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
          bank_format?: string;
          created_at?: string;
          created_by?: string | null;
          difficulty?: Database["public"]["Enums"]["sat_difficulty"];
          id?: string;
          in_test_base?: boolean;
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
          bank_format?: string;
          created_at?: string;
          created_by?: string | null;
          difficulty?: Database["public"]["Enums"]["sat_difficulty"];
          id?: string;
          in_test_base?: boolean;
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
      tuition_accounts: {
        Row: {
          balance_uzs: number;
          monthly_fee_uzs: number;
          next_charge_on: string;
          updated_at: string;
          updated_by: string | null;
          user_id: string;
        };
        Insert: {
          balance_uzs?: number;
          monthly_fee_uzs?: number;
          next_charge_on?: string;
          updated_at?: string;
          updated_by?: string | null;
          user_id: string;
        };
        Update: {
          balance_uzs?: number;
          monthly_fee_uzs?: number;
          next_charge_on?: string;
          updated_at?: string;
          updated_by?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      tuition_ledger: {
        Row: {
          amount_uzs: number;
          created_at: string;
          created_by: string | null;
          id: string;
          kind: string;
          note: string | null;
          user_id: string;
        };
        Insert: {
          amount_uzs: number;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          kind: string;
          note?: string | null;
          user_id: string;
        };
        Update: {
          amount_uzs?: number;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          kind?: string;
          note?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      tuition_reminder_targets: {
        Row: {
          reminder_id: string;
          user_id: string;
        };
        Insert: {
          reminder_id: string;
          user_id: string;
        };
        Update: {
          reminder_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tuition_reminder_targets_reminder_id_fkey";
            columns: ["reminder_id"];
            isOneToOne: false;
            referencedRelation: "tuition_reminders";
            referencedColumns: ["id"];
          },
        ];
      };
      tuition_reminders: {
        Row: {
          active: boolean;
          all_students: boolean;
          body: string;
          created_at: string;
          created_by: string | null;
          due_date: string | null;
          id: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          all_students?: boolean;
          body?: string;
          created_at?: string;
          created_by?: string | null;
          due_date?: string | null;
          id?: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          all_students?: boolean;
          body?: string;
          created_at?: string;
          created_by?: string | null;
          due_date?: string | null;
          id?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      uinfo: {
        Row: {
          summary: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          summary?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          summary?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      uinfo_log: {
        Row: {
          created_at: string;
          d: string;
          id: string;
          k: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          d?: string;
          id?: string;
          k: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          d?: string;
          id?: string;
          k?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_card_states: {
        Row: {
          card_id: string;
          difficulty: number;
          due: string;
          elapsed_days: number;
          id: string;
          lapses: number;
          last_review: string | null;
          learning_steps: number;
          reps: number;
          scheduled_days: number;
          stability: number;
          state: number;
          user_id: string;
        };
        Insert: {
          card_id: string;
          difficulty?: number;
          due?: string;
          elapsed_days?: number;
          id?: string;
          lapses?: number;
          last_review?: string | null;
          learning_steps?: number;
          reps?: number;
          scheduled_days?: number;
          stability?: number;
          state?: number;
          user_id: string;
        };
        Update: {
          card_id?: string;
          difficulty?: number;
          due?: string;
          elapsed_days?: number;
          id?: string;
          lapses?: number;
          last_review?: string | null;
          learning_steps?: number;
          reps?: number;
          scheduled_days?: number;
          stability?: number;
          state?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_card_states_card_id_fkey";
            columns: ["card_id"];
            isOneToOne: false;
            referencedRelation: "vocab_cards";
            referencedColumns: ["id"];
          },
        ];
      };
      user_notification_recipients: {
        Row: {
          created_at: string;
          dismissed_at: string | null;
          notification_id: string;
          read_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          dismissed_at?: string | null;
          notification_id: string;
          read_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          dismissed_at?: string | null;
          notification_id?: string;
          read_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_notification_recipients_notification_id_fkey";
            columns: ["notification_id"];
            isOneToOne: false;
            referencedRelation: "user_notifications";
            referencedColumns: ["id"];
          },
        ];
      };
      user_notifications: {
        Row: {
          audience_type: Database["public"]["Enums"]["notification_audience"];
          body: string | null;
          class_id: string | null;
          created_at: string;
          created_by: string | null;
          expires_at: string;
          id: string;
          image_url: string | null;
          link_label: string | null;
          link_url: string | null;
          overlay_display_seconds: number;
          source_id: string | null;
          source_type: Database["public"]["Enums"]["notification_source"];
          title: string;
        };
        Insert: {
          audience_type?: Database["public"]["Enums"]["notification_audience"];
          body?: string | null;
          class_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          expires_at: string;
          id?: string;
          image_url?: string | null;
          link_label?: string | null;
          link_url?: string | null;
          overlay_display_seconds?: number;
          source_id?: string | null;
          source_type?: Database["public"]["Enums"]["notification_source"];
          title: string;
        };
        Update: {
          audience_type?: Database["public"]["Enums"]["notification_audience"];
          body?: string | null;
          class_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          expires_at?: string;
          id?: string;
          image_url?: string | null;
          link_label?: string | null;
          link_url?: string | null;
          overlay_display_seconds?: number;
          source_id?: string | null;
          source_type?: Database["public"]["Enums"]["notification_source"];
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_notifications_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
        ];
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
      vocab_activity_logs: {
        Row: {
          activity_date: string;
          cards_reviewed: number;
          completed_at: string;
          id: string;
          user_id: string;
        };
        Insert: {
          activity_date: string;
          cards_reviewed?: number;
          completed_at?: string;
          id?: string;
          user_id: string;
        };
        Update: {
          activity_date?: string;
          cards_reviewed?: number;
          completed_at?: string;
          id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      vocab_cards: {
        Row: {
          antonym: string | null;
          created_at: string;
          deck_id: string | null;
          definition: string;
          difficulty_tier: string;
          dsat_passage: string;
          example_sentence: string | null;
          id: string;
          part_of_speech: string;
          roots_etymology: string | null;
          sat_traps: string | null;
          set_label: string | null;
          synonyms: string[];
          word: string;
        };
        Insert: {
          antonym?: string | null;
          created_at?: string;
          deck_id?: string | null;
          definition: string;
          difficulty_tier?: string;
          dsat_passage: string;
          example_sentence?: string | null;
          id?: string;
          part_of_speech: string;
          roots_etymology?: string | null;
          sat_traps?: string | null;
          set_label?: string | null;
          synonyms?: string[];
          word: string;
        };
        Update: {
          antonym?: string | null;
          created_at?: string;
          deck_id?: string | null;
          definition?: string;
          difficulty_tier?: string;
          dsat_passage?: string;
          example_sentence?: string | null;
          id?: string;
          part_of_speech?: string;
          roots_etymology?: string | null;
          sat_traps?: string | null;
          set_label?: string | null;
          synonyms?: string[];
          word?: string;
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
          created_at: string;
          description: string | null;
          id: string;
          is_folder: boolean;
          owner_id: string | null;
          parent_id: string | null;
          path: string | null;
          sort_order: number;
          submitted_at: string | null;
          title: string;
          visibility: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_folder?: boolean;
          owner_id?: string | null;
          parent_id?: string | null;
          path?: string | null;
          sort_order?: number;
          submitted_at?: string | null;
          title: string;
          visibility?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_folder?: boolean;
          owner_id?: string | null;
          parent_id?: string | null;
          path?: string | null;
          sort_order?: number;
          submitted_at?: string | null;
          title?: string;
          visibility?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vocab_decks_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "vocab_decks";
            referencedColumns: ["id"];
          },
        ];
      };
      vocab_homework_assignment_users: {
        Row: {
          assignment_id: string;
          user_id: string;
        };
        Insert: {
          assignment_id: string;
          user_id: string;
        };
        Update: {
          assignment_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vocab_homework_assignment_users_assignment_id_fkey";
            columns: ["assignment_id"];
            isOneToOne: false;
            referencedRelation: "vocab_homework_assignments";
            referencedColumns: ["id"];
          },
        ];
      };
      vocab_homework_assignments: {
        Row: {
          active: boolean;
          audience_type: Database["public"]["Enums"]["notification_audience"];
          card_target: number | null;
          class_id: string | null;
          created_at: string;
          created_by: string | null;
          deck_id: string | null;
          display_seconds: number;
          due_at: string | null;
          ends_at: string | null;
          id: string;
          instructions: string | null;
          lesson_id: string | null;
          quiz_id: string | null;
          recurrence: Database["public"]["Enums"]["vocab_homework_recurrence"];
          require_green_only: boolean;
          starts_at: string;
          target_type: Database["public"]["Enums"]["vocab_homework_target"];
          title: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          audience_type?: Database["public"]["Enums"]["notification_audience"];
          card_target?: number | null;
          class_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          deck_id?: string | null;
          display_seconds?: number;
          due_at?: string | null;
          ends_at?: string | null;
          id?: string;
          instructions?: string | null;
          lesson_id?: string | null;
          quiz_id?: string | null;
          recurrence?: Database["public"]["Enums"]["vocab_homework_recurrence"];
          require_green_only?: boolean;
          starts_at?: string;
          target_type: Database["public"]["Enums"]["vocab_homework_target"];
          title: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          audience_type?: Database["public"]["Enums"]["notification_audience"];
          card_target?: number | null;
          class_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          deck_id?: string | null;
          display_seconds?: number;
          due_at?: string | null;
          ends_at?: string | null;
          id?: string;
          instructions?: string | null;
          lesson_id?: string | null;
          quiz_id?: string | null;
          recurrence?: Database["public"]["Enums"]["vocab_homework_recurrence"];
          require_green_only?: boolean;
          starts_at?: string;
          target_type?: Database["public"]["Enums"]["vocab_homework_target"];
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vocab_homework_assignments_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vocab_homework_assignments_deck_id_fkey";
            columns: ["deck_id"];
            isOneToOne: false;
            referencedRelation: "vocab_decks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vocab_homework_assignments_lesson_id_fkey";
            columns: ["lesson_id"];
            isOneToOne: false;
            referencedRelation: "class_lessons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vocab_homework_assignments_quiz_id_fkey";
            columns: ["quiz_id"];
            isOneToOne: false;
            referencedRelation: "vocab_quizzes";
            referencedColumns: ["id"];
          },
        ];
      };
      vocab_homework_completions: {
        Row: {
          assignment_id: string;
          cards_reviewed: number;
          completed_at: string | null;
          green_reviews: number;
          id: string;
          period_key: string;
          quiz_score: number | null;
          quiz_total: number | null;
          status: Database["public"]["Enums"]["vocab_homework_status"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          assignment_id: string;
          cards_reviewed?: number;
          completed_at?: string | null;
          green_reviews?: number;
          id?: string;
          period_key: string;
          quiz_score?: number | null;
          quiz_total?: number | null;
          status?: Database["public"]["Enums"]["vocab_homework_status"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          assignment_id?: string;
          cards_reviewed?: number;
          completed_at?: string | null;
          green_reviews?: number;
          id?: string;
          period_key?: string;
          quiz_score?: number | null;
          quiz_total?: number | null;
          status?: Database["public"]["Enums"]["vocab_homework_status"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vocab_homework_completions_assignment_id_fkey";
            columns: ["assignment_id"];
            isOneToOne: false;
            referencedRelation: "vocab_homework_assignments";
            referencedColumns: ["id"];
          },
        ];
      };
      vocab_quiz_attempts: {
        Row: {
          created_at: string;
          id: string;
          quiz_id: string;
          score: number;
          total: number;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          quiz_id: string;
          score: number;
          total: number;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          quiz_id?: string;
          score?: number;
          total?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vocab_quiz_attempts_quiz_id_fkey";
            columns: ["quiz_id"];
            isOneToOne: false;
            referencedRelation: "vocab_quizzes";
            referencedColumns: ["id"];
          },
        ];
      };
      vocab_quiz_questions: {
        Row: {
          correct_answer: string;
          explanation: string;
          id: string;
          options: string[];
          passage_text: string;
          position: number;
          quiz_id: string;
          vocab_card_id: string | null;
        };
        Insert: {
          correct_answer: string;
          explanation: string;
          id?: string;
          options: string[];
          passage_text: string;
          position?: number;
          quiz_id: string;
          vocab_card_id?: string | null;
        };
        Update: {
          correct_answer?: string;
          explanation?: string;
          id?: string;
          options?: string[];
          passage_text?: string;
          position?: number;
          quiz_id?: string;
          vocab_card_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "vocab_quiz_questions_quiz_id_fkey";
            columns: ["quiz_id"];
            isOneToOne: false;
            referencedRelation: "vocab_quizzes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vocab_quiz_questions_vocab_card_id_fkey";
            columns: ["vocab_card_id"];
            isOneToOne: false;
            referencedRelation: "vocab_cards";
            referencedColumns: ["id"];
          },
        ];
      };
      vocab_quizzes: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          owner_id: string | null;
          submitted_at: string | null;
          time_limit_seconds: number | null;
          title: string;
          visibility: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          owner_id?: string | null;
          submitted_at?: string | null;
          time_limit_seconds?: number | null;
          title: string;
          visibility?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          owner_id?: string | null;
          submitted_at?: string | null;
          time_limit_seconds?: number | null;
          title?: string;
          visibility?: string;
        };
        Relationships: [];
      };
      youtube_rec_cache: {
        Row: {
          query: string;
          section: string;
          updated_at: string;
          user_id: string;
          videos: Json;
        };
        Insert: {
          query: string;
          section: string;
          updated_at?: string;
          user_id: string;
          videos?: Json;
        };
        Update: {
          query?: string;
          section?: string;
          updated_at?: string;
          user_id?: string;
          videos?: Json;
        };
        Relationships: [];
      };
    };
    Views: {
      chat_directory: {
        Row: {
          avatar_url: string | null;
          chat_setup_completed: boolean | null;
          class_id: string | null;
          first_name: string | null;
          full_name: string | null;
          id: string | null;
          last_name: string | null;
          telegram_connected_at: string | null;
          telegram_username: string | null;
          username: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          chat_setup_completed?: boolean | null;
          class_id?: string | null;
          first_name?: string | null;
          full_name?: string | null;
          id?: string | null;
          last_name?: string | null;
          telegram_connected_at?: string | null;
          telegram_username?: string | null;
          username?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          chat_setup_completed?: boolean | null;
          class_id?: string | null;
          first_name?: string | null;
          full_name?: string | null;
          id?: string | null;
          last_name?: string | null;
          telegram_connected_at?: string | null;
          telegram_username?: string | null;
          username?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
        ];
      };
      student_level_current: {
        Row: {
          assessed_on: string | null;
          group_id: string | null;
          score: number | null;
          score_id: string | null;
          section_id: string | null;
          slug: string | null;
          user_id: string | null;
          weight: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "student_level_scores_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "class_groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_level_scores_section_id_fkey";
            columns: ["section_id"];
            isOneToOne: false;
            referencedRelation: "level_sections";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      _billing_apply_for_member: {
        Args: { p_as_of: string; p_group_id: string; p_user_id: string };
        Returns: number;
      };
      _billing_apply_recurring_fees: {
        Args: { p_as_of: string };
        Returns: number;
      };
      _billing_charge_class_month: {
        Args: {
          p_class_id: string;
          p_month: string;
          p_source: Database["public"]["Enums"]["ledger_source"];
          p_user_id: string;
        };
        Returns: string;
      };
      _billing_charge_group_month: {
        Args: {
          p_group_id: string;
          p_month: string;
          p_source: Database["public"]["Enums"]["ledger_source"];
          p_user_id: string;
        };
        Returns: string;
      };
      _billing_charge_note: {
        Args: {
          p_group_name: string;
          p_month: string;
          p_remaining: number;
          p_total: number;
        };
        Returns: string;
      };
      _billing_check_amount: {
        Args: { p_amount_uzs: number };
        Returns: undefined;
      };
      _bs_ensure_group_lessons: {
        Args: { p_group_id: string; p_month: string };
        Returns: number;
      };
      _bs_group_member: {
        Args: { _group_id: string; _uid: string };
        Returns: boolean;
      };
      _bs_in_class_subject: {
        Args: {
          _class_id: string;
          _subject: Database["public"]["Enums"]["class_subject"];
          _uid: string;
        };
        Returns: boolean;
      };
      _bs_live_members: {
        Args: { p_group_id: string; p_user_ids: string[] };
        Returns: string[];
      };
      _bs_set_group_attendance: {
        Args: {
          p_group_id: string;
          p_lesson_date: string;
          p_state: string;
          p_user_id: string;
        };
        Returns: undefined;
      };
      _bs_upsert_group_member: {
        Args: {
          p_activated_on: string;
          p_enrolled_on: string;
          p_group_id: string;
          p_status: Database["public"]["Enums"]["class_member_status"];
          p_user_id: string;
        };
        Returns: undefined;
      };
      _bs_user_is_staff: { Args: { _uid: string }; Returns: boolean };
      admin_apply_recurring_fees: {
        Args: { p_as_of?: string };
        Returns: number;
      };
      admin_billing_limits: {
        Args: never;
        Returns: {
          confirm_over_uzs: number;
          max_payment_uzs: number;
          min_payment_uzs: number;
        }[];
      };
      admin_billing_note: { Args: { p_user_id: string }; Returns: string };
      admin_by_telegram_chat: { Args: { p_chat_id: number }; Returns: string };
      admin_charge_month: {
        Args: { p_period: string; p_user_id: string };
        Returns: number;
      };
      admin_class_fees: {
        Args: never;
        Returns: {
          active: boolean;
          class_id: string;
          class_name: string;
          effective_from: string;
          monthly_fee_uzs: number;
        }[];
      };
      admin_clear_student_discount: {
        Args: { p_class_id: string; p_user_id: string };
        Returns: undefined;
      };
      admin_consume_telegram_link_code: {
        Args: { p_chat_id: number; p_code: string };
        Returns: Json;
      };
      admin_create_telegram_link_code: { Args: never; Returns: string };
      admin_delete_tuition_ledger: {
        Args: { p_id: string };
        Returns: undefined;
      };
      admin_discount_students: {
        Args: never;
        Returns: {
          class_id: string;
          class_name: string;
          full_name: string;
          user_id: string;
        }[];
      };
      admin_enroll_all_tuition_users: { Args: never; Returns: number };
      admin_enroll_tuition_user: {
        Args: { p_user_id: string };
        Returns: {
          balance_uzs: number;
          monthly_fee_uzs: number;
          next_charge_on: string;
          updated_at: string;
          updated_by: string | null;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "tuition_accounts";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      admin_get_question_answers: {
        Args: { p_question_id: string };
        Returns: {
          correct_choice_id: string;
          correct_grid_answers: string[];
          explanation: string;
        }[];
      };
      admin_group_fees: {
        Args: never;
        Returns: {
          active: boolean;
          class_id: string;
          class_name: string;
          effective_from: string;
          group_id: string;
          group_name: string;
          monthly_fee_uzs: number;
          subject: Database["public"]["Enums"]["class_subject"];
        }[];
      };
      admin_list_attendance_dates: {
        Args: {
          p_class_id: string;
          p_from: string;
          p_subject?: Database["public"]["Enums"]["class_subject"];
          p_to: string;
        };
        Returns: string[];
      };
      admin_list_attendance_on_date: {
        Args: {
          p_class_id?: string;
          p_lesson_date: string;
          p_subject?: Database["public"]["Enums"]["class_subject"];
        };
        Returns: Json;
      };
      admin_list_attendance_students: {
        Args: { p_class_id?: string; p_limit?: number };
        Returns: Json;
      };
      admin_list_student_discounts: {
        Args: never;
        Returns: {
          class_id: string;
          class_name: string;
          ends_on: string;
          full_name: string;
          id: string;
          mode: string;
          user_id: string;
          value: number;
        }[];
      };
      admin_list_telegram_admins: {
        Args: never;
        Returns: {
          banned: boolean;
          banned_reason: string;
          chat_id: number;
          email: string;
          full_name: string;
          is_self: boolean;
          user_id: string;
        }[];
      };
      admin_list_tuition_candidates: {
        Args: { p_limit?: number };
        Returns: Json;
      };
      admin_list_tuition_ledger: { Args: { p_limit?: number }; Returns: Json };
      admin_list_tuition_overview: { Args: never; Returns: Json };
      admin_payments_summary: {
        Args: never;
        Returns: {
          active_groups: number;
          creditors: number;
          credits: number;
          debtors: number;
          max_fee: number;
          min_fee: number;
          priced_groups: number;
          settled: number;
          total_owed: number;
        }[];
      };
      admin_preview_activation_change: {
        Args: { p_date: string; p_group_id: string; p_user_id: string };
        Returns: {
          amount_uzs: number;
          id: string;
          note: string;
          period: string;
        }[];
      };
      admin_record_discount: {
        Args: {
          p_amount_uzs: number;
          p_idempotency_key: string;
          p_note: string;
          p_occurred_on: string;
          p_user_id: string;
        };
        Returns: string;
      };
      admin_record_payment: {
        Args: {
          p_amount_uzs: number;
          p_idempotency_key: string;
          p_method: Database["public"]["Enums"]["pay_method"];
          p_note: string;
          p_occurred_on: string;
          p_user_id: string;
        };
        Returns: string;
      };
      admin_record_refund: {
        Args: {
          p_amount_uzs: number;
          p_idempotency_key: string;
          p_note: string;
          p_occurred_on: string;
          p_user_id: string;
        };
        Returns: string;
      };
      admin_record_tuition_payment: {
        Args: { p_amount_uzs: number; p_note?: string; p_user_id: string };
        Returns: {
          balance_uzs: number;
          monthly_fee_uzs: number;
          next_charge_on: string;
          updated_at: string;
          updated_by: string | null;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "tuition_accounts";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      admin_remove_tuition_user: {
        Args: { p_user_id: string };
        Returns: undefined;
      };
      admin_revoke_telegram_admin: {
        Args: { p_user_id: string };
        Returns: undefined;
      };
      admin_save_lesson_attendance: {
        Args: {
          p_class_id: string;
          p_lesson_date: string;
          p_present_user_ids?: string[];
          p_subject?: Database["public"]["Enums"]["class_subject"];
        };
        Returns: number;
      };
      admin_set_activation_date: {
        Args: { p_date: string; p_group_id: string; p_user_id: string };
        Returns: number;
      };
      admin_set_banned: {
        Args: { p_banned: boolean; p_reason?: string; p_user_id: string };
        Returns: undefined;
      };
      admin_set_billing_note: {
        Args: { p_note: string; p_user_id: string };
        Returns: undefined;
      };
      admin_set_class_fee: {
        Args: {
          p_class_id: string;
          p_effective_from?: string;
          p_fee_uzs: number;
        };
        Returns: undefined;
      };
      admin_set_class_member: {
        Args: {
          p_class_id: string;
          p_enrolled_on?: string;
          p_status?: Database["public"]["Enums"]["class_member_status"];
          p_user_id: string;
        };
        Returns: undefined;
      };
      admin_set_fee_override: {
        Args: {
          p_effective_from?: string;
          p_fee_uzs: number;
          p_group_id: string;
          p_user_id: string;
        };
        Returns: undefined;
      };
      admin_set_group_fee: {
        Args: {
          p_effective_from?: string;
          p_fee_uzs: number;
          p_group_id: string;
        };
        Returns: undefined;
      };
      admin_set_role: {
        Args: { p_role: string; p_user_id: string };
        Returns: undefined;
      };
      admin_set_student_discount: {
        Args: {
          p_class_id: string;
          p_ends_on?: string;
          p_mode: string;
          p_user_id: string;
          p_value: number;
        };
        Returns: undefined;
      };
      admin_set_student_fee: {
        Args: {
          p_class_id: string;
          p_effective_from?: string;
          p_fee_uzs: number;
          p_user_id: string;
        };
        Returns: number;
      };
      admin_set_tuition_balance: {
        Args: { p_balance_uzs: number; p_note?: string; p_user_id: string };
        Returns: {
          balance_uzs: number;
          monthly_fee_uzs: number;
          next_charge_on: string;
          updated_at: string;
          updated_by: string | null;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "tuition_accounts";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      admin_student_balances: {
        Args: {
          p_class_id?: string;
          p_group_id?: string;
          p_kind?: string;
          p_max_balance?: number;
          p_min_balance?: number;
          p_month?: string;
          p_months_in_debt?: number;
          p_rank?: string;
          p_search?: string;
          p_status?: string;
        };
        Returns: {
          balance: number;
          charged: number;
          class_id: string;
          class_name: string;
          expected_this_month: number;
          full_name: string;
          groups: Json;
          last_payment_on: string;
          math: number;
          monthly_fee: number;
          monthly_tuition: number;
          months_in_debt: number;
          paid: number;
          phone: string;
          rank_letter: string;
          recent: Json;
          rw: number;
          status: Database["public"]["Enums"]["class_member_status"];
          total_score: number;
          user_id: string;
          username: string;
        }[];
      };
      admin_student_billing: {
        Args: { p_user_id: string };
        Returns: {
          activated_on: string;
          charge_count: number;
          charged_uzs: number;
          class_id: string;
          enrolled_on: string;
          group_id: string;
          group_name: string;
          join_amount_uzs: number;
          join_remaining: number;
          join_total: number;
          monthly_fee_uzs: number;
          override_fee_uzs: number;
          status: Database["public"]["Enums"]["class_member_status"];
          subject: Database["public"]["Enums"]["class_subject"];
        }[];
      };
      admin_student_ledger: {
        Args: { p_user_id: string };
        Returns: {
          amount_uzs: number;
          created_at: string;
          group_id: string;
          group_name: string;
          id: string;
          kind: Database["public"]["Enums"]["ledger_kind"];
          method: Database["public"]["Enums"]["pay_method"];
          note: string;
          occurred_on: string;
          period: string;
          prorate_lessons: number;
          prorate_total: number;
          source: Database["public"]["Enums"]["ledger_source"];
          subject: Database["public"]["Enums"]["class_subject"];
          void_reason: string;
          voided_at: string;
        }[];
      };
      admin_telegram_link_status: { Args: never; Returns: Json };
      admin_unlink_telegram: { Args: never; Returns: undefined };
      admin_update_student_profile: {
        Args: { p_description: string; p_full_name: string; p_user_id: string };
        Returns: undefined;
      };
      admin_update_tuition_ledger: {
        Args: {
          p_amount_uzs: number;
          p_id: string;
          p_kind?: string;
          p_note?: string;
        };
        Returns: {
          amount_uzs: number;
          created_at: string;
          created_by: string | null;
          id: string;
          kind: string;
          note: string | null;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "tuition_ledger";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      admin_upsert_tuition_reminder: {
        Args: {
          p_active?: boolean;
          p_all_students?: boolean;
          p_body?: string;
          p_due_date?: string;
          p_id?: string;
          p_title?: string;
          p_user_ids?: string[];
        };
        Returns: {
          active: boolean;
          all_students: boolean;
          body: string;
          created_at: string;
          created_by: string | null;
          due_date: string | null;
          id: string;
          title: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "tuition_reminders";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      admin_user_activity: {
        Args: { p_limit?: number; p_user_id: string };
        Returns: {
          kind: string;
          meta: Json;
          occurred_at: string;
          summary: string;
        }[];
      };
      admin_user_detail: { Args: { p_user_id: string }; Returns: Json };
      admin_user_role: { Args: { p_user_id: string }; Returns: string };
      admin_user_sessions: {
        Args: { p_limit?: number; p_offset?: number; p_user_id: string };
        Returns: {
          completed_at: string;
          correct_count: number;
          id: string;
          in_progress: boolean;
          math_score: number;
          rw_score: number;
          score: number;
          started_at: string;
          title: string;
          total_questions: number;
          type: string;
        }[];
      };
      admin_users_summary: {
        Args: never;
        Returns: {
          accuracy_pct: number;
          banned: boolean;
          class_name: string;
          created_at: string;
          current_streak: number;
          email: string;
          full_name: string;
          id: string;
          last_active_at: string;
          last_seen_at: string;
          role: string;
          staff_created: boolean;
          tests_daily: number;
          tests_mock: number;
          tests_practice: number;
          tests_total: number;
          username: string;
        }[];
      };
      admin_void_entry: {
        Args: { p_id: string; p_reason: string };
        Returns: undefined;
      };
      apply_due_tuition_charges: { Args: never; Returns: number };
      billing_apply_recurring_fees_system: {
        Args: { p_as_of?: string };
        Returns: number;
      };
      bs_apply_discount: {
        Args: {
          p_amount: number;
          p_class_id: string;
          p_on: string;
          p_user_id: string;
        };
        Returns: number;
      };
      bs_bump_vocab_homework: {
        Args: {
          p_assignment_id: string;
          p_green: boolean;
          p_period_key: string;
        };
        Returns: Json;
      };
      bs_can_edit_discount: { Args: { p_user_id: string }; Returns: boolean };
      bs_can_read_chat_object: { Args: { _name: string }; Returns: boolean };
      bs_can_read_homework_object: { Args: { _name: string }; Returns: boolean };
      bs_class_fee_for_month: {
        Args: { p_class_id: string; p_month: string };
        Returns: number;
      };
      bs_class_join_month_charge: {
        Args: { p_activated_on: string; p_class_id: string; p_fee: number };
        Returns: {
          amount_uzs: number;
          remaining: number;
          total: number;
        }[];
      };
      bs_complete_first_login: {
        Args: { p_email: string; p_user_id: string; p_username: string };
        Returns: undefined;
      };
      bs_complete_intro: {
        Args: {
          p_exam_date: string;
          p_target_math: number;
          p_target_rw: number;
        };
        Returns: undefined;
      };
      bs_counted_groups: {
        Args: { p_user_id: string };
        Returns: {
          class_id: string;
          enrolled_on: string;
          group_id: string;
          joined_at: string;
          subject: Database["public"]["Enums"]["class_subject"];
        }[];
      };
      bs_expected_class_charge: {
        Args: {
          p_activated: string;
          p_class_id: string;
          p_fee: number;
          p_today: string;
        };
        Returns: number;
      };
      bs_grid_values_match: {
        Args: { p_given: string; p_key: string };
        Returns: boolean;
      };
      bs_group_default_name: {
        Args: {
          p_class_name: string;
          p_subject: Database["public"]["Enums"]["class_subject"];
        };
        Returns: string;
      };
      bs_group_fee_for_month: {
        Args: { p_group_id: string; p_month: string; p_user_id: string };
        Returns: number;
      };
      bs_group_scheme: {
        Args: { p_subject: Database["public"]["Enums"]["class_subject"] };
        Returns: string;
      };
      bs_half_subject_amount: {
        Args: { p_fee: number; p_subjects: number };
        Returns: number;
      };
      bs_in_class_subject: {
        Args: {
          _class_id: string;
          _subject: Database["public"]["Enums"]["class_subject"];
          _uid?: string;
        };
        Returns: boolean;
      };
      bs_is_admin: { Args: { _uid?: string }; Returns: boolean };
      bs_is_banned: { Args: { _uid?: string }; Returns: boolean };
      bs_is_chat_muted: {
        Args: { _thread_id: string; _uid?: string };
        Returns: boolean;
      };
      bs_is_class_member: {
        Args: { _class_id: string; _uid?: string };
        Returns: boolean;
      };
      bs_is_editor: { Args: { _uid?: string }; Returns: boolean };
      bs_is_group_member: {
        Args: { _group_id: string; _uid?: string };
        Returns: boolean;
      };
      bs_is_staff: { Args: { _uid?: string }; Returns: boolean };
      bs_is_thread_member: {
        Args: { _thread_id: string; _uid?: string };
        Returns: boolean;
      };
      bs_is_vocab_homework_assigned: {
        Args: { p_assignment_id: string; p_user_id?: string };
        Returns: boolean;
      };
      bs_join_month_charge: {
        Args: { p_activated_on: string; p_fee: number; p_group_id: string };
        Returns: {
          amount_uzs: number;
          remaining: number;
          total: number;
        }[];
      };
      bs_level_overall: {
        Args: { p_scores: number[]; p_weights: number[] };
        Returns: number;
      };
      bs_max_payment_uzs: { Args: never; Returns: number };
      bs_member_active_in_group_month: {
        Args: { p_group_id: string; p_month: string; p_user_id: string };
        Returns: boolean;
      };
      bs_parse_grid_number: { Args: { p_raw: string }; Returns: number };
      bs_rank_letter: { Args: { p_total: number }; Returns: string };
      bs_record_vocab_activity: { Args: { p_cards?: number }; Returns: Json };
      bs_scale_section: {
        Args: { p_correct: number; p_section: string; p_total: number };
        Returns: number;
      };
      bs_scheme_items: {
        Args: { p_subject: Database["public"]["Enums"]["class_subject"] };
        Returns: Database["public"]["Enums"]["hw_item"][];
      };
      bs_student_balance: { Args: { p_user_id: string }; Returns: number };
      bs_student_class_override: {
        Args: { p_class_id: string; p_month: string; p_user_id: string };
        Returns: number;
      };
      bs_sync_parent_membership: {
        Args: { p_class_id: string; p_user_id: string };
        Returns: undefined;
      };
      bs_take_ai_quota: {
        Args: { p_max: number; p_user_id: string };
        Returns: Json;
      };
      bs_take_login_attempt: { Args: { p_key: string }; Returns: Json };
      bs_take_rate_token: {
        Args: { p_capacity: number; p_key: string; p_per_minute: number };
        Returns: Json;
      };
      bs_tashkent_today: { Args: never; Returns: string };
      bs_teaches_group: { Args: { p_group_id: string }; Returns: boolean };
      bs_teaches_student: { Args: { p_user_id: string }; Returns: boolean };
      bs_upsert_lesson_video: {
        Args: {
          p_duration_seconds?: number;
          p_title: string;
          p_video_id: string;
          p_youtube_url: string;
        };
        Returns: undefined;
      };
      bs_user_class_id: { Args: { _uid?: string }; Returns: string };
      bs_var_autotick: {
        Args: { p_flag: string; p_lesson_id: string; p_user_id: string };
        Returns: undefined;
      };
      bs_vote_lesson_video: {
        Args: { p_video_id: string; p_vote: number };
        Returns: Json;
      };
      bs_youtube_video_id: { Args: { p_url: string }; Returns: string };
      complete_session: { Args: { p_session_id: string }; Returns: Json };
      ensure_class_lessons: {
        Args: { p_class_id: string; p_month: string };
        Returns: number;
      };
      ensure_class_threads: { Args: { p_class_id: string }; Returns: undefined };
      ensure_group_lessons: {
        Args: { p_group_id: string; p_month: string };
        Returns: number;
      };
      ensure_tuition_account: {
        Args: { p_user_id: string };
        Returns: {
          balance_uzs: number;
          monthly_fee_uzs: number;
          next_charge_on: string;
          updated_at: string;
          updated_by: string | null;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "tuition_accounts";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      fan_out_notification: {
        Args: {
          p_audience_type: Database["public"]["Enums"]["notification_audience"];
          p_class_id?: string;
          p_notification_id: string;
          p_user_ids?: string[];
        };
        Returns: number;
      };
      get_ai_models: {
        Args: never;
        Returns: {
          key: string;
          value: string;
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
      get_attempt_feedback: {
        Args: { p_question_id: string; p_session_id: string };
        Returns: {
          correct_choice_id: string;
          correct_grid_answers: string[];
          explanation: string;
        }[];
      };
      get_desmos_api_key: { Args: never; Returns: string };
      get_maintenance_state: {
        Args: never;
        Returns: {
          enabled: boolean;
          message: string;
        }[];
      };
      get_registration_state: { Args: never; Returns: boolean };
      grade_answer: {
        Args: {
          p_choice_id: string;
          p_grid_answer: string;
          p_question_id: string;
          p_session_id?: string;
        };
        Returns: boolean;
      };
      is_admin: { Args: never; Returns: boolean };
      join_class: { Args: { p_class_id: string }; Returns: undefined };
      my_tuition_snapshot: { Args: never; Returns: Json };
      open_direct_thread: { Args: { p_other_user_id: string }; Returns: string };
      practice_counts: { Args: never; Returns: Json };
      resolve_notification_recipients: {
        Args: {
          p_audience_type: Database["public"]["Enums"]["notification_audience"];
          p_class_id?: string;
          p_user_ids?: string[];
        };
        Returns: string[];
      };
      set_attendance: {
        Args: {
          p_class_id: string;
          p_lesson_date: string;
          p_state: string;
          p_subject: Database["public"]["Enums"]["class_subject"];
          p_user_id: string;
        };
        Returns: undefined;
      };
      set_group_attendance: {
        Args: {
          p_group_id: string;
          p_lesson_date: string;
          p_state: string;
          p_user_id: string;
        };
        Returns: undefined;
      };
      set_group_attendance_many: {
        Args: {
          p_group_id: string;
          p_lesson_date: string;
          p_state: string;
          p_user_ids: string[];
        };
        Returns: undefined;
      };
      staff_add_group_member: {
        Args: {
          p_activated_on?: string;
          p_enrolled_on?: string;
          p_from_class_id?: string;
          p_group_id: string;
          p_move?: boolean;
          p_status?: Database["public"]["Enums"]["class_member_status"];
          p_user_id: string;
        };
        Returns: undefined;
      };
      staff_decide_vocab_submission: {
        Args: { p_approve: boolean; p_id: string; p_kind: string };
        Returns: undefined;
      };
      staff_level_board: {
        Args: { p_group_id: string };
        Returns: {
          last_assessed_on: string;
          overall: number;
          previous_overall: number;
          scored: number;
          scores: Json;
          sections: number;
          user_id: string;
        }[];
      };
      staff_list_students: {
        Args: { p_search?: string };
        Returns: {
          claimed_at: string;
          class_id: string;
          class_ids: string[];
          class_name: string;
          english_note: string;
          full_name: string;
          goal: string;
          grade: string;
          id: string;
          math_note: string;
          parent_phone: string;
          phone: string;
          user_id: string;
          username: string;
        }[];
      };
      staff_publish_sqb_test: {
        Args: { p_publish: boolean; p_test_id: string };
        Returns: undefined;
      };
      staff_remove_group_member: {
        Args: { p_group_id: string; p_user_id: string };
        Returns: undefined;
      };
      staff_replace_daily_tests: {
        Args: { p_daily_test_id: string; p_test_ids: string[] };
        Returns: number;
      };
      staff_replace_mock_sections: {
        Args: { p_mock_id: string; p_rows: Json };
        Returns: number;
      };
      staff_replace_test_questions: {
        Args: { p_question_ids: string[]; p_test_id: string };
        Returns: number;
      };
      staff_save_level_scores: {
        Args: {
          p_assessed_on: string;
          p_group_id: string;
          p_lesson_id?: string;
          p_scores: Json;
          p_user_id: string;
        };
        Returns: number;
      };
      staff_set_group_member_status: {
        Args: {
          p_group_id: string;
          p_status: Database["public"]["Enums"]["class_member_status"];
          p_user_id: string;
        };
        Returns: undefined;
      };
      staff_set_hw_marks: {
        Args: {
          p_done: boolean;
          p_item: Database["public"]["Enums"]["hw_item"];
          p_lesson_id: string;
          p_user_ids: string[];
        };
        Returns: number;
      };
      staff_set_member_status: {
        Args: {
          p_status: Database["public"]["Enums"]["class_member_status"];
          p_user_id: string;
        };
        Returns: undefined;
      };
      staff_set_result: {
        Args: {
          p_lesson_id: string;
          p_m1: number;
          p_m2: number;
          p_user_id: string;
        };
        Returns: undefined;
      };
      staff_set_student_score: {
        Args: { p_math: number; p_rw: number; p_user_id: string };
        Returns: undefined;
      };
      staff_void_level_score: {
        Args: { p_id: string; p_reason: string };
        Returns: undefined;
      };
      start_daily_session: { Args: { p_date?: string }; Returns: Json };
      start_filtered_practice: {
        Args: {
          p_difficulty?: string;
          p_limit?: number;
          p_section: string;
          p_skill?: string;
        };
        Returns: string;
      };
      start_mock_session: { Args: { p_mock_exam_id: string }; Returns: string };
      start_published_test_session: {
        Args: { p_test_id: string };
        Returns: Json;
      };
      student_billing_home: { Args: never; Returns: Json };
      submit_attempt: {
        Args: {
          p_choice_id: string;
          p_eliminated?: string[];
          p_grid_answer: string;
          p_marked_for_review?: boolean;
          p_question_id: string;
          p_session_id: string;
          p_time_spent?: number;
        };
        Returns: boolean;
      };
      submit_vocab_quiz: {
        Args: {
          p_question_ids: string[];
          p_quiz_id: string;
          p_selected: string[];
        };
        Returns: Json;
      };
      tick_all_complete: {
        Args: { p_lesson_id: string; p_user_ids: string[] };
        Returns: undefined;
      };
      touch_presence: { Args: never; Returns: undefined };
      untick_all: {
        Args: { p_lesson_id: string; p_user_ids: string[] };
        Returns: undefined;
      };
      vocab_creator_names: {
        Args: { p_ids: string[] };
        Returns: {
          id: string;
          username: string;
        }[];
      };
      vocab_deck_descendant_ids: {
        Args: { p_deck_id: string };
        Returns: string[];
      };
      vocab_deck_overview: {
        Args: never;
        Returns: {
          deck_id: string;
          last_studied: string;
          learning_count: number;
          new_count: number;
          review_count: number;
          total_count: number;
        }[];
      };
      vocab_deck_stats: {
        Args: { p_deck_id?: string; p_user_id?: string };
        Returns: {
          learning_count: number;
          new_count: number;
          review_count: number;
          total_count: number;
        }[];
      };
      vocab_due_count: {
        Args: { p_deck_id?: string; p_user_id?: string };
        Returns: number;
      };
      vocab_homework_period_key: {
        Args: {
          p_at?: string;
          p_recurrence: Database["public"]["Enums"]["vocab_homework_recurrence"];
        };
        Returns: string;
      };
      vocab_new_cards: {
        Args: { p_deck_id?: string; p_limit?: number };
        Returns: {
          antonym: string | null;
          created_at: string;
          deck_id: string | null;
          definition: string;
          difficulty_tier: string;
          dsat_passage: string;
          example_sentence: string | null;
          id: string;
          part_of_speech: string;
          roots_etymology: string | null;
          sat_traps: string | null;
          set_label: string | null;
          synonyms: string[];
          word: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "vocab_cards";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      vocab_user_test_quota: {
        Args: never;
        Returns: {
          cap: number;
          used: number;
        }[];
      };
    };
    Enums: {
      app_role: "student" | "admin" | "editor" | "teacher";
      chat_thread_kind: "subject_group" | "class_group" | "direct";
      class_member_status: "active" | "trial" | "frozen" | "left";
      class_subject: "math" | "ebrw";
      homework_submission_status:
        "pending" | "submitted" | "reviewed" | "accepted" | "needs_revision";
      hw_item: "vocab" | "assignment" | "article" | "formulas";
      ledger_kind: "charge" | "payment" | "discount" | "refund";
      ledger_source: "auto" | "manual";
      notification_audience: "class" | "all" | "users";
      notification_source: "admin" | "vocab_homework";
      pay_method: "cash" | "card" | "transfer";
      question_kind: "multiple_choice" | "grid_in";
      sat_difficulty: "easy" | "medium" | "hard" | "C" | "B" | "D" | "A" | "S";
      sat_section: "reading_writing" | "math";
      test_type: "practice" | "daily" | "mock";
      var_kind: "vocab" | "assignment" | "article";
      var_source: "manual" | "auto";
      vocab_homework_recurrence: "once" | "daily" | "weekly";
      vocab_homework_status: "in_progress" | "completed" | "failed";
      vocab_homework_target: "deck" | "quiz";
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
      app_role: ["student", "admin", "editor", "teacher"],
      chat_thread_kind: ["subject_group", "class_group", "direct"],
      class_member_status: ["active", "trial", "frozen", "left"],
      class_subject: ["math", "ebrw"],
      homework_submission_status: [
        "pending",
        "submitted",
        "reviewed",
        "accepted",
        "needs_revision",
      ],
      hw_item: ["vocab", "assignment", "article", "formulas"],
      ledger_kind: ["charge", "payment", "discount", "refund"],
      ledger_source: ["auto", "manual"],
      notification_audience: ["class", "all", "users"],
      notification_source: ["admin", "vocab_homework"],
      pay_method: ["cash", "card", "transfer"],
      question_kind: ["multiple_choice", "grid_in"],
      sat_difficulty: ["easy", "medium", "hard", "C", "B", "D", "A", "S"],
      sat_section: ["reading_writing", "math"],
      test_type: ["practice", "daily", "mock"],
      var_kind: ["vocab", "assignment", "article"],
      var_source: ["manual", "auto"],
      vocab_homework_recurrence: ["once", "daily", "weekly"],
      vocab_homework_status: ["in_progress", "completed", "failed"],
      vocab_homework_target: ["deck", "quiz"],
    },
  },
} as const;
