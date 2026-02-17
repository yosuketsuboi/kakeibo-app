export type Database = {
  public: {
    Tables: {
      households: {
        Row: {
          id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
        }
        Relationships: []
      }
      household_members: {
        Row: {
          id: string
          household_id: string
          user_id: string
          role: 'owner' | 'member'
          created_at: string
        }
        Insert: {
          id?: string
          household_id: string
          user_id: string
          role?: 'owner' | 'member'
          created_at?: string
        }
        Update: {
          id?: string
          household_id?: string
          user_id?: string
          role?: 'owner' | 'member'
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          }
        ]
      }
      categories: {
        Row: {
          id: string
          household_id: string
          name: string
          color: string
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          household_id: string
          name: string
          color: string
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          household_id?: string
          name?: string
          color?: string
          sort_order?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          }
        ]
      }
      receipts: {
        Row: {
          id: string
          household_id: string
          user_id: string
          image_path: string
          store_name: string | null
          total_amount: number | null
          purchased_at: string | null
          ocr_status: 'pending' | 'processing' | 'done' | 'error'
          ocr_raw: string | null
          created_at: string
        }
        Insert: {
          id?: string
          household_id: string
          user_id: string
          image_path: string
          store_name?: string | null
          total_amount?: number | null
          purchased_at?: string | null
          ocr_status?: 'pending' | 'processing' | 'done' | 'error'
          ocr_raw?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          household_id?: string
          user_id?: string
          image_path?: string
          store_name?: string | null
          total_amount?: number | null
          purchased_at?: string | null
          ocr_status?: 'pending' | 'processing' | 'done' | 'error'
          ocr_raw?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipts_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          }
        ]
      }
      receipt_items: {
        Row: {
          id: string
          receipt_id: string
          name: string
          quantity: number
          unit_price: number
          category_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          receipt_id: string
          name: string
          quantity?: number
          unit_price: number
          category_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          receipt_id?: string
          name?: string
          quantity?: number
          unit_price?: number
          category_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipt_items_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          }
        ]
      }
      manual_expenses: {
        Row: {
          id: string
          household_id: string
          user_id: string
          category_id: string | null
          amount: number
          description: string
          expense_date: string
          created_at: string
        }
        Insert: {
          id?: string
          household_id: string
          user_id: string
          category_id?: string | null
          amount: number
          description: string
          expense_date: string
          created_at?: string
        }
        Update: {
          id?: string
          household_id?: string
          user_id?: string
          category_id?: string | null
          amount?: number
          description?: string
          expense_date?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "manual_expenses_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          }
        ]
      }
      invitations: {
        Row: {
          id: string
          household_id: string
          email: string
          token: string
          invited_by: string
          accepted_at: string | null
          expires_at: string
          created_at: string
        }
        Insert: {
          id?: string
          household_id: string
          email: string
          token?: string
          invited_by: string
          accepted_at?: string | null
          expires_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          household_id?: string
          email?: string
          token?: string
          invited_by?: string
          accepted_at?: string | null
          expires_at?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_my_household_ids: {
        Args: Record<string, never>
        Returns: string[]
      }
      create_household_for_user: {
        Args: { p_household_name: string }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']
export type InsertTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']
