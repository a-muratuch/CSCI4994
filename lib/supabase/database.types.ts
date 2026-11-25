export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      conversation_reads: {
        Row: {
          conversation_id: string;
          read_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          conversation_id: string;
          read_at?: string;
          user_id: string;
        };
        Update: {
          conversation_id?: string;
          read_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conversation_reads_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversation_reads_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      conversations: {
        Row: {
          created_at: string;
          id: string;
          job_id: string | null;
          kind: string;
          owner_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          job_id?: string | null;
          kind: string;
          owner_id?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          job_id?: string | null;
          kind?: string;
          owner_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "conversations_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: true;
            referencedRelation: "analytics_crew";
            referencedColumns: ["job_id"];
          },
          {
            foreignKeyName: "conversations_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: true;
            referencedRelation: "analytics_jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversations_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: true;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversations_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      estimate_events: {
        Row: {
          actor_id: string;
          estimate_id: string;
          id: string;
          new_status: string;
          occurred_at: string;
          previous_status: string;
        };
        ComputedFields: never;
        Insert: {
          actor_id: string;
          estimate_id: string;
          id?: string;
          new_status: string;
          occurred_at?: string;
          previous_status: string;
        };
        Update: {
          actor_id?: string;
          estimate_id?: string;
          id?: string;
          new_status?: string;
          occurred_at?: string;
          previous_status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "estimate_events_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "estimate_events_estimate_id_fkey";
            columns: ["estimate_id"];
            isOneToOne: false;
            referencedRelation: "estimates";
            referencedColumns: ["id"];
          },
        ];
      };
      estimate_items: {
        Row: {
          amount_cents: number;
          estimate_id: string;
          id: string;
          label: string;
          position: number;
        };
        ComputedFields: never;
        Insert: {
          amount_cents: number;
          estimate_id: string;
          id?: string;
          label: string;
          position: number;
        };
        Update: {
          amount_cents?: number;
          estimate_id?: string;
          id?: string;
          label?: string;
          position?: number;
        };
        Relationships: [
          {
            foreignKeyName: "estimate_items_estimate_id_fkey";
            columns: ["estimate_id"];
            isOneToOne: false;
            referencedRelation: "estimates";
            referencedColumns: ["id"];
          },
        ];
      };
      estimate_proposals: {
        Row: {
          arrival_end: string;
          arrival_start: string;
          created_at: string;
          day_jobs: NonNullable<Json>;
          end_date: string;
          end_time: string;
          estimate_id: string;
          proposed_by: string;
          return_date: string | null;
          scheduled_date: string;
          start_time: string;
          truck_id: string;
          worker_ids: string[];
        };
        ComputedFields: never;
        Insert: {
          arrival_end: string;
          arrival_start: string;
          created_at?: string;
          day_jobs?: NonNullable<Json>;
          end_date: string;
          end_time: string;
          estimate_id: string;
          proposed_by: string;
          return_date?: string | null;
          scheduled_date: string;
          start_time: string;
          truck_id: string;
          worker_ids: string[];
        };
        Update: {
          arrival_end?: string;
          arrival_start?: string;
          created_at?: string;
          day_jobs?: NonNullable<Json>;
          end_date?: string;
          end_time?: string;
          estimate_id?: string;
          proposed_by?: string;
          return_date?: string | null;
          scheduled_date?: string;
          start_time?: string;
          truck_id?: string;
          worker_ids?: string[];
        };
        Relationships: [
          {
            foreignKeyName: "estimate_proposals_estimate_id_fkey";
            columns: ["estimate_id"];
            isOneToOne: true;
            referencedRelation: "estimates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "estimate_proposals_proposed_by_fkey";
            columns: ["proposed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "estimate_proposals_truck_id_fkey";
            columns: ["truck_id"];
            isOneToOne: false;
            referencedRelation: "trucks";
            referencedColumns: ["id"];
          },
        ];
      };
      estimates: {
        Row: {
          created_at: string;
          created_by: string;
          decided_at: string | null;
          decline_note: string | null;
          decline_reason: string | null;
          exclusions: string[];
          id: string;
          inclusions: string[];
          is_current: boolean;
          previous_estimate_id: string | null;
          proposed_arrival_end: string | null;
          proposed_arrival_start: string | null;
          proposed_date: string | null;
          published_at: string | null;
          request_id: string;
          request_revision: number;
          revision: number;
          status: string;
          terms: string;
          total_cents: number | null;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string;
          decided_at?: string | null;
          decline_note?: string | null;
          decline_reason?: string | null;
          exclusions?: string[];
          id?: string;
          inclusions?: string[];
          is_current?: boolean;
          previous_estimate_id?: string | null;
          proposed_arrival_end?: string | null;
          proposed_arrival_start?: string | null;
          proposed_date?: string | null;
          published_at?: string | null;
          request_id: string;
          request_revision?: number;
          revision?: number;
          status?: string;
          terms: string;
          total_cents?: number | null;
          version?: number;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          decided_at?: string | null;
          decline_note?: string | null;
          decline_reason?: string | null;
          exclusions?: string[];
          id?: string;
          inclusions?: string[];
          is_current?: boolean;
          previous_estimate_id?: string | null;
          proposed_arrival_end?: string | null;
          proposed_arrival_start?: string | null;
          proposed_date?: string | null;
          published_at?: string | null;
          request_id?: string;
          request_revision?: number;
          revision?: number;
          status?: string;
          terms?: string;
          total_cents?: number | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "estimates_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "estimates_previous_estimate_id_fkey";
            columns: ["previous_estimate_id"];
            isOneToOne: false;
            referencedRelation: "estimates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "estimates_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "analytics_requests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "estimates_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "move_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_catalog: {
        Row: {
          active: boolean;
          created_at: string;
          cubic_feet: number;
          id: string;
          name: string;
          room: string;
          updated_at: string;
          weight_lb: number;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          created_at?: string;
          cubic_feet: number;
          id?: string;
          name: string;
          room: string;
          updated_at?: string;
          weight_lb: number;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          cubic_feet?: number;
          id?: string;
          name?: string;
          room?: string;
          updated_at?: string;
          weight_lb?: number;
        };
        Relationships: [];
      };
      job_events: {
        Row: {
          action: string;
          actor_id: string;
          details: NonNullable<Json>;
          id: string;
          job_id: string;
          occurred_at: string;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          actor_id: string;
          details: NonNullable<Json>;
          id?: string;
          job_id: string;
          occurred_at?: string;
        };
        Update: {
          action?: string;
          actor_id?: string;
          details?: NonNullable<Json>;
          id?: string;
          job_id?: string;
          occurred_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "job_events_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "job_events_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "analytics_crew";
            referencedColumns: ["job_id"];
          },
          {
            foreignKeyName: "job_events_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "analytics_jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "job_events_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      job_workers: {
        Row: {
          job_id: string;
          worker_id: string;
        };
        ComputedFields: never;
        Insert: {
          job_id: string;
          worker_id: string;
        };
        Update: {
          job_id?: string;
          worker_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "job_workers_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "analytics_crew";
            referencedColumns: ["job_id"];
          },
          {
            foreignKeyName: "job_workers_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "analytics_jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "job_workers_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "job_workers_worker_id_fkey";
            columns: ["worker_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      jobs: {
        Row: {
          arrival_end: string;
          arrival_start: string;
          created_at: string;
          end_date: string;
          end_time: string;
          estimate_id: string;
          id: string;
          on_the_way_at: string | null;
          photo_waived_at: string | null;
          photo_waived_by: string | null;
          photo_waiver_note: string | null;
          request_id: string;
          return_date: string | null;
          revision: number;
          scheduled_date: string;
          start_time: string;
          status: string;
          truck_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          arrival_end: string;
          arrival_start: string;
          created_at?: string;
          end_date: string;
          end_time: string;
          estimate_id: string;
          id?: string;
          on_the_way_at?: string | null;
          photo_waived_at?: string | null;
          photo_waived_by?: string | null;
          photo_waiver_note?: string | null;
          request_id: string;
          return_date?: string | null;
          revision?: number;
          scheduled_date: string;
          start_time: string;
          status?: string;
          truck_id: string;
          updated_at?: string;
        };
        Update: {
          arrival_end?: string;
          arrival_start?: string;
          created_at?: string;
          end_date?: string;
          end_time?: string;
          estimate_id?: string;
          id?: string;
          on_the_way_at?: string | null;
          photo_waived_at?: string | null;
          photo_waived_by?: string | null;
          photo_waiver_note?: string | null;
          request_id?: string;
          return_date?: string | null;
          revision?: number;
          scheduled_date?: string;
          start_time?: string;
          status?: string;
          truck_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "jobs_estimate_id_request_id_fkey";
            columns: ["estimate_id", "request_id"];
            isOneToOne: false;
            referencedRelation: "estimates";
            referencedColumns: ["id", "request_id"];
          },
          {
            foreignKeyName: "jobs_photo_waived_by_fkey";
            columns: ["photo_waived_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "jobs_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: true;
            referencedRelation: "analytics_requests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "jobs_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: true;
            referencedRelation: "move_requests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "jobs_truck_id_fkey";
            columns: ["truck_id"];
            isOneToOne: false;
            referencedRelation: "trucks";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          body: string;
          conversation_id: string;
          created_at: string;
          id: string;
          request_id: string;
          sender_id: string;
        };
        ComputedFields: never;
        Insert: {
          body: string;
          conversation_id: string;
          created_at?: string;
          id?: string;
          request_id: string;
          sender_id: string;
        };
        Update: {
          body?: string;
          conversation_id?: string;
          created_at?: string;
          id?: string;
          request_id?: string;
          sender_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      move_photos: {
        Row: {
          content_type: string;
          created_at: string;
          id: string;
          job_id: string | null;
          request_id: string;
          size_bytes: number;
          stage: string;
          uploaded_by: string;
        };
        ComputedFields: never;
        Insert: {
          content_type: string;
          created_at?: string;
          id?: string;
          job_id?: string | null;
          request_id: string;
          size_bytes: number;
          stage: string;
          uploaded_by: string;
        };
        Update: {
          content_type?: string;
          created_at?: string;
          id?: string;
          job_id?: string | null;
          request_id?: string;
          size_bytes?: number;
          stage?: string;
          uploaded_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: "move_photos_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "analytics_crew";
            referencedColumns: ["job_id"];
          },
          {
            foreignKeyName: "move_photos_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "analytics_jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "move_photos_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "move_photos_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "analytics_requests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "move_photos_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "move_requests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "move_photos_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      move_requests: {
        Row: {
          access_details: string;
          client_request_id: string;
          created_at: string;
          customer_id: string;
          destination: string;
          destination_address: Json | null;
          id: string;
          items: string;
          move_size: string;
          notes: string;
          pickup: string;
          pickup_address: Json | null;
          preferred_window: string | null;
          property_type: string;
          requested_date: string;
          revision: number;
          status: string;
          submission_fingerprint: string | null;
        };
        ComputedFields: never;
        Insert: {
          access_details: string;
          client_request_id?: string;
          created_at?: string;
          customer_id?: string;
          destination: string;
          destination_address?: Json | null;
          id?: string;
          items: string;
          move_size: string;
          notes?: string;
          pickup: string;
          pickup_address?: Json | null;
          preferred_window?: string | null;
          property_type: string;
          requested_date: string;
          revision?: number;
          status?: string;
          submission_fingerprint?: string | null;
        };
        Update: {
          access_details?: string;
          client_request_id?: string;
          created_at?: string;
          customer_id?: string;
          destination?: string;
          destination_address?: Json | null;
          id?: string;
          items?: string;
          move_size?: string;
          notes?: string;
          pickup?: string;
          pickup_address?: Json | null;
          preferred_window?: string | null;
          property_type?: string;
          requested_date?: string;
          revision?: number;
          status?: string;
          submission_fingerprint?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "move_requests_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          conversation_id: string | null;
          created_at: string;
          estimate_id: string | null;
          event_id: string;
          id: string;
          job_id: string | null;
          kind: string;
          message_id: string | null;
          read_at: string | null;
          recipient_id: string;
        };
        ComputedFields: never;
        Insert: {
          conversation_id?: string | null;
          created_at?: string;
          estimate_id?: string | null;
          event_id: string;
          id?: string;
          job_id?: string | null;
          kind: string;
          message_id?: string | null;
          read_at?: string | null;
          recipient_id: string;
        };
        Update: {
          conversation_id?: string | null;
          created_at?: string;
          estimate_id?: string | null;
          event_id?: string;
          id?: string;
          job_id?: string | null;
          kind?: string;
          message_id?: string | null;
          read_at?: string | null;
          recipient_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_estimate_id_fkey";
            columns: ["estimate_id"];
            isOneToOne: false;
            referencedRelation: "estimates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "analytics_crew";
            referencedColumns: ["job_id"];
          },
          {
            foreignKeyName: "notifications_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "analytics_jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: false;
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_recipient_id_fkey";
            columns: ["recipient_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      pricing_settings: {
        Row: {
          cubic_feet_per_worker_hour: number;
          default_exclusions: string[];
          default_inclusions: string[];
          default_terms: string;
          id: boolean;
          minimum_hours: number;
          per_mile_cents: number;
          road_factor: number;
          travel_mph: number;
          truck_fee_cents: number;
          turnaround_minutes: number;
          updated_at: string;
          updated_by: string | null;
          worker_hourly_cents: number;
        };
        ComputedFields: never;
        Insert: {
          cubic_feet_per_worker_hour: number;
          default_exclusions?: string[];
          default_inclusions?: string[];
          default_terms?: string;
          id?: boolean;
          minimum_hours: number;
          per_mile_cents: number;
          road_factor: number;
          travel_mph: number;
          truck_fee_cents: number;
          turnaround_minutes?: number;
          updated_at?: string;
          updated_by?: string | null;
          worker_hourly_cents: number;
        };
        Update: {
          cubic_feet_per_worker_hour?: number;
          default_exclusions?: string[];
          default_inclusions?: string[];
          default_terms?: string;
          id?: boolean;
          minimum_hours?: number;
          per_mile_cents?: number;
          road_factor?: number;
          travel_mph?: number;
          truck_fee_cents?: number;
          turnaround_minutes?: number;
          updated_at?: string;
          updated_by?: string | null;
          worker_hourly_cents?: number;
        };
        Relationships: [
          {
            foreignKeyName: "pricing_settings_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          active: boolean;
          created_at: string;
          full_name: string;
          id: string;
          phone: string;
          role: string;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          created_at?: string;
          full_name?: string;
          id: string;
          phone?: string;
          role?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          full_name?: string;
          id?: string;
          phone?: string;
          role?: string;
        };
        Relationships: [];
      };
      request_events: {
        Row: {
          action: string;
          actor_id: string;
          id: string;
          occurred_at: string;
          request_id: string;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          actor_id: string;
          id?: string;
          occurred_at?: string;
          request_id: string;
        };
        Update: {
          action?: string;
          actor_id?: string;
          id?: string;
          occurred_at?: string;
          request_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "request_events_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "request_events_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "analytics_requests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "request_events_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "move_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      request_items: {
        Row: {
          catalog_id: string | null;
          cubic_feet: number;
          id: string;
          label: string;
          position: number;
          quantity: number;
          request_id: string;
          room: string;
          weight_lb: number;
        };
        ComputedFields: never;
        Insert: {
          catalog_id?: string | null;
          cubic_feet: number;
          id?: string;
          label: string;
          position: number;
          quantity: number;
          request_id: string;
          room: string;
          weight_lb: number;
        };
        Update: {
          catalog_id?: string | null;
          cubic_feet?: number;
          id?: string;
          label?: string;
          position?: number;
          quantity?: number;
          request_id?: string;
          room?: string;
          weight_lb?: number;
        };
        Relationships: [
          {
            foreignKeyName: "request_items_catalog_id_fkey";
            columns: ["catalog_id"];
            isOneToOne: false;
            referencedRelation: "inventory_catalog";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "request_items_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "analytics_requests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "request_items_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "move_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      trucks: {
        Row: {
          active: boolean;
          capacity_cubic_feet: number | null;
          created_at: string;
          id: string;
          name: string;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          capacity_cubic_feet?: number | null;
          created_at?: string;
          id?: string;
          name: string;
        };
        Update: {
          active?: boolean;
          capacity_cubic_feet?: number | null;
          created_at?: string;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      worker_availability: {
        Row: {
          available: boolean;
          day: number;
          end_time: string;
          start_time: string;
          worker_id: string;
        };
        ComputedFields: never;
        Insert: {
          available: boolean;
          day: number;
          end_time: string;
          start_time: string;
          worker_id: string;
        };
        Update: {
          available?: boolean;
          day?: number;
          end_time?: string;
          start_time?: string;
          worker_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "worker_availability_worker_id_fkey";
            columns: ["worker_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      analytics_crew: {
        Row: {
          active: boolean | null;
          full_name: string | null;
          job_id: string | null;
          scheduled_date: string | null;
          work_hours: number | null;
          worker_id: string | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "job_workers_worker_id_fkey";
            columns: ["worker_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      analytics_jobs: {
        Row: {
          id: string | null;
          scheduled_date: string | null;
          status: string | null;
          work_hours: number | null;
        };
        ComputedFields: never;
        Insert: {
          id?: string | null;
          scheduled_date?: string | null;
          status?: string | null;
          work_hours?: never;
        };
        Update: {
          id?: string | null;
          scheduled_date?: string | null;
          status?: string | null;
          work_hours?: never;
        };
        Relationships: [];
      };
      analytics_requests: {
        Row: {
          accepted_cents: number | null;
          accepted_on: string | null;
          cancelled: boolean | null;
          completed: boolean | null;
          id: string | null;
          published: boolean | null;
          requested_on: string | null;
          scheduled: boolean | null;
        };
        ComputedFields: never;
        Relationships: [];
      };
    };
    Functions: {
      accept_estimate: { Args: { p_estimate_id: string }; Returns: string };
      add_move_photo: {
        Args: {
          p_content_type: string;
          p_job_id: string;
          p_request_id: string;
          p_size_bytes: number;
          p_stage: string;
        };
        Returns: string;
      };
      admin_activity: {
        Args: { p_action?: string; p_kind?: string; p_page?: number };
        Returns: {
          action: string;
          actor: string;
          entity: string;
          id: string;
          occurred_at: string;
          record_id: string;
          total_count: number;
        }[];
      };
      admin_analytics: { Args: { p_weeks?: number }; Returns: Json };
      admin_records: {
        Args: {
          p_kind: string;
          p_page?: number;
          p_search?: string;
          p_sort?: string;
          p_status?: string;
        };
        Returns: {
          created_at: string;
          customer: string;
          destination: string;
          id: string;
          pickup: string;
          record_date: string;
          request_id: string;
          status: string;
          total_count: number;
        }[];
      };
      advance_job: {
        Args: {
          p_expected_revision: number;
          p_expected_status: string;
          p_job_id: string;
        };
        Returns: {
          arrival_end: string;
          arrival_start: string;
          created_at: string;
          end_date: string;
          end_time: string;
          estimate_id: string;
          id: string;
          on_the_way_at: string | null;
          photo_waived_at: string | null;
          photo_waived_by: string | null;
          photo_waiver_note: string | null;
          request_id: string;
          return_date: string | null;
          revision: number;
          scheduled_date: string;
          start_time: string;
          status: string;
          truck_id: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "jobs";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      arrival_window_capabilities: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      assigned_customer_phone: { Args: { p_job_id: string }; Returns: string };
      booking_capabilities: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      can_delete_move_photo: { Args: { p_id: string }; Returns: boolean };
      cancel_job: {
        Args: { p_id: string; p_revision: number };
        Returns: {
          arrival_end: string;
          arrival_start: string;
          created_at: string;
          end_date: string;
          end_time: string;
          estimate_id: string;
          id: string;
          on_the_way_at: string | null;
          photo_waived_at: string | null;
          photo_waived_by: string | null;
          photo_waiver_note: string | null;
          request_id: string;
          return_date: string | null;
          revision: number;
          scheduled_date: string;
          start_time: string;
          status: string;
          truck_id: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "jobs";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      change_request: {
        Args: {
          p_cancel?: boolean;
          p_id: string;
          p_input: Json;
          p_revision: number;
        };
        Returns: {
          access_details: string;
          client_request_id: string;
          created_at: string;
          customer_id: string;
          destination: string;
          destination_address: Json | null;
          id: string;
          items: string;
          move_size: string;
          notes: string;
          pickup: string;
          pickup_address: Json | null;
          preferred_window: string | null;
          property_type: string;
          requested_date: string;
          revision: number;
          status: string;
          submission_fingerprint: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "move_requests";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      complete_worker_invitation: {
        Args: { p_invitation: string; p_user: string };
        Returns: undefined;
      };
      crew_progress_capabilities: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      day_availability: {
        Args: { p_days: number; p_from: string };
        Returns: {
          day: string;
          status: string;
        }[];
      };
      decide_estimate: {
        Args: { p_decision: string; p_estimate_id: string };
        Returns: {
          created_at: string;
          created_by: string;
          decided_at: string | null;
          decline_note: string | null;
          decline_reason: string | null;
          exclusions: string[];
          id: string;
          inclusions: string[];
          is_current: boolean;
          previous_estimate_id: string | null;
          proposed_arrival_end: string | null;
          proposed_arrival_start: string | null;
          proposed_date: string | null;
          published_at: string | null;
          request_id: string;
          request_revision: number;
          revision: number;
          status: string;
          terms: string;
          total_cents: number | null;
          version: number;
        };
        SetofOptions: {
          from: "*";
          to: "estimates";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      decline_estimate: {
        Args: { p_estimate_id: string; p_note: string; p_reason: string };
        Returns: {
          created_at: string;
          created_by: string;
          decided_at: string | null;
          decline_note: string | null;
          decline_reason: string | null;
          exclusions: string[];
          id: string;
          inclusions: string[];
          is_current: boolean;
          previous_estimate_id: string | null;
          proposed_arrival_end: string | null;
          proposed_arrival_start: string | null;
          proposed_date: string | null;
          published_at: string | null;
          request_id: string;
          request_revision: number;
          revision: number;
          status: string;
          terms: string;
          total_cents: number | null;
          version: number;
        };
        SetofOptions: {
          from: "*";
          to: "estimates";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      delete_move_photo: { Args: { p_id: string }; Returns: undefined };
      estimate_change_capabilities: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      estimate_default_capabilities: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      get_conversation_people: {
        Args: { p_conversation_id: string };
        Returns: {
          full_name: string;
          person_id: string;
          role: string;
        }[];
      };
      get_job_team: {
        Args: { p_job_id: string };
        Returns: {
          full_name: string;
          worker_id: string;
        }[];
      };
      get_job_teams: {
        Args: { p_job_ids: string[] };
        Returns: {
          full_name: string;
          job_id: string;
          worker_id: string;
        }[];
      };
      inventory_capabilities: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      long_distance_capabilities: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      mark_conversation_read: {
        Args: { p_id: string; p_message_id: string };
        Returns: undefined;
      };
      mark_notifications: {
        Args: { p_id?: string; p_through?: string };
        Returns: undefined;
      };
      mark_on_the_way: {
        Args: { p_expected_revision: number; p_job_id: string };
        Returns: {
          arrival_end: string;
          arrival_start: string;
          created_at: string;
          end_date: string;
          end_time: string;
          estimate_id: string;
          id: string;
          on_the_way_at: string | null;
          photo_waived_at: string | null;
          photo_waived_by: string | null;
          photo_waiver_note: string | null;
          request_id: string;
          return_date: string | null;
          revision: number;
          scheduled_date: string;
          start_time: string;
          status: string;
          truck_id: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "jobs";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      notification_snapshot: {
        Args: { p_page?: number; p_unread?: boolean };
        Returns: Json;
      };
      open_conversation: {
        Args: { p_kind: string; p_target_id: string };
        Returns: {
          created_at: string;
          id: string;
          job_id: string | null;
          kind: string;
          owner_id: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "conversations";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      photo_capabilities: { Args: Record<PropertyKey, never>; Returns: number };
      prepare_worker_invitation: {
        Args: { p_email: string; p_name: string };
        Returns: string;
      };
      publish_estimate: {
        Args: { p_estimate_id: string };
        Returns: {
          created_at: string;
          created_by: string;
          decided_at: string | null;
          decline_note: string | null;
          decline_reason: string | null;
          exclusions: string[];
          id: string;
          inclusions: string[];
          is_current: boolean;
          previous_estimate_id: string | null;
          proposed_arrival_end: string | null;
          proposed_arrival_start: string | null;
          proposed_date: string | null;
          published_at: string | null;
          request_id: string;
          request_revision: number;
          revision: number;
          status: string;
          terms: string;
          total_cents: number | null;
          version: number;
        };
        SetofOptions: {
          from: "*";
          to: "estimates";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      publish_reviewed_estimate: {
        Args: { p_estimate_id: string; p_revision: number };
        Returns: {
          created_at: string;
          created_by: string;
          decided_at: string | null;
          decline_note: string | null;
          decline_reason: string | null;
          exclusions: string[];
          id: string;
          inclusions: string[];
          is_current: boolean;
          previous_estimate_id: string | null;
          proposed_arrival_end: string | null;
          proposed_arrival_start: string | null;
          proposed_date: string | null;
          published_at: string | null;
          request_id: string;
          request_revision: number;
          revision: number;
          status: string;
          terms: string;
          total_cents: number | null;
          version: number;
        };
        SetofOptions: {
          from: "*";
          to: "estimates";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      resource_bookings: {
        Args: { p_date: string };
        Returns: {
          end_time: string;
          job_id: string;
          start_time: string;
          truck_id: string;
          worker_ids: string[];
        }[];
      };
      revise_estimate: {
        Args: { p_id: string; p_revision: number };
        Returns: {
          created_at: string;
          created_by: string;
          decided_at: string | null;
          decline_note: string | null;
          decline_reason: string | null;
          exclusions: string[];
          id: string;
          inclusions: string[];
          is_current: boolean;
          previous_estimate_id: string | null;
          proposed_arrival_end: string | null;
          proposed_arrival_start: string | null;
          proposed_date: string | null;
          published_at: string | null;
          request_id: string;
          request_revision: number;
          revision: number;
          status: string;
          terms: string;
          total_cents: number | null;
          version: number;
        };
        SetofOptions: {
          from: "*";
          to: "estimates";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      save_estimate_defaults: {
        Args: {
          p_exclusions: string[];
          p_inclusions: string[];
          p_terms: string;
        };
        Returns: undefined;
      };
      save_estimate_draft: {
        Args: {
          p_estimate_id: string;
          p_input: Json;
          p_request_id: string;
          p_revision: number;
        };
        Returns: {
          created_at: string;
          created_by: string;
          decided_at: string | null;
          decline_note: string | null;
          decline_reason: string | null;
          exclusions: string[];
          id: string;
          inclusions: string[];
          is_current: boolean;
          previous_estimate_id: string | null;
          proposed_arrival_end: string | null;
          proposed_arrival_start: string | null;
          proposed_date: string | null;
          published_at: string | null;
          request_id: string;
          request_revision: number;
          revision: number;
          status: string;
          terms: string;
          total_cents: number | null;
          version: number;
        };
        SetofOptions: {
          from: "*";
          to: "estimates";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      save_inventory_item: {
        Args: {
          p_active: boolean;
          p_cubic_feet: number;
          p_id: string;
          p_name: string;
          p_room: string;
          p_weight_lb: number;
        };
        Returns: string;
      };
      save_job: {
        Args: {
          p_arrival_end: string;
          p_arrival_start: string;
          p_date: string;
          p_end: string;
          p_end_date?: string;
          p_estimate_id: string;
          p_expected_revision?: number;
          p_job_id?: string;
          p_return_date?: string;
          p_start: string;
          p_truck_id: string;
          p_worker_ids: string[];
        };
        Returns: {
          arrival_end: string;
          arrival_start: string;
          created_at: string;
          end_date: string;
          end_time: string;
          estimate_id: string;
          id: string;
          on_the_way_at: string | null;
          photo_waived_at: string | null;
          photo_waived_by: string | null;
          photo_waiver_note: string | null;
          request_id: string;
          return_date: string | null;
          revision: number;
          scheduled_date: string;
          start_time: string;
          status: string;
          truck_id: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "jobs";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      save_pricing_settings: {
        Args: {
          p_cubic_feet_per_worker_hour: number;
          p_minimum_hours: number;
          p_per_mile_cents: number;
          p_road_factor: number;
          p_travel_mph: number;
          p_truck_fee_cents: number;
          p_turnaround_minutes: number;
          p_worker_hourly_cents: number;
        };
        Returns: undefined;
      };
      save_truck: {
        Args: { p_active: boolean; p_id: string; p_name: string };
        Returns: {
          active: boolean;
          capacity_cubic_feet: number | null;
          created_at: string;
          id: string;
          name: string;
        };
        SetofOptions: {
          from: "*";
          to: "trucks";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      save_worker_availability: { Args: { p_days: Json }; Returns: undefined };
      schedule_candidates: {
        Args: {
          p_date: string;
          p_estimate_id: string;
          p_job_id?: string;
          p_until?: string;
        };
        Returns: Json;
      };
      scheduling_capabilities: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      security_capabilities: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      send_message: {
        Args: {
          p_body: string;
          p_conversation_id: string;
          p_request_id: string;
        };
        Returns: {
          body: string;
          conversation_id: string;
          created_at: string;
          id: string;
          request_id: string;
          sender_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "messages";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      set_account_active: {
        Args: { p_active: boolean; p_id: string };
        Returns: undefined;
      };
      set_estimate_proposal: {
        Args: {
          p_arrival_end: string;
          p_arrival_start: string;
          p_date: string;
          p_end: string;
          p_end_date?: string;
          p_estimate_id: string;
          p_return_date?: string;
          p_start: string;
          p_truck_id: string;
          p_worker_ids: string[];
        };
        Returns: undefined;
      };
      set_request_items: {
        Args: { p_items: Json; p_request_id: string; p_revision: number };
        Returns: number;
      };
      set_request_window: {
        Args: { p_request_id: string; p_revision: number; p_window: string };
        Returns: undefined;
      };
      set_truck_capacity: {
        Args: { p_capacity: number; p_id: string };
        Returns: undefined;
      };
      unread_messages: { Args: Record<PropertyKey, never>; Returns: number };
      waive_delivery_photo: {
        Args: { p_job_id: string; p_note: string };
        Returns: undefined;
      };
      workflow_capabilities: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

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
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
