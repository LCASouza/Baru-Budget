export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          active: boolean
          color: string | null
          created_at: string
          created_by: string
          id: string
          institution: string | null
          name: string
          opening_balance: number
          owner_user_id: string
          type: Database["public"]["Enums"]["account_type"]
          updated_at: string
          updated_by: string
        }
        Insert: {
          active?: boolean
          color?: string | null
          created_at?: string
          created_by?: string
          id?: string
          institution?: string | null
          name: string
          opening_balance?: number
          owner_user_id: string
          type: Database["public"]["Enums"]["account_type"]
          updated_at?: string
          updated_by?: string
        }
        Update: {
          active?: boolean
          color?: string | null
          created_at?: string
          created_by?: string
          id?: string
          institution?: string | null
          name?: string
          opening_balance?: number
          owner_user_id?: string
          type?: Database["public"]["Enums"]["account_type"]
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          active: boolean
          color: string | null
          created_at: string
          created_by: string
          icon: string | null
          id: string
          kind: Database["public"]["Enums"]["category_kind"]
          name: string
          owner_user_id: string
          updated_at: string
          updated_by: string
        }
        Insert: {
          active?: boolean
          color?: string | null
          created_at?: string
          created_by?: string
          icon?: string | null
          id?: string
          kind: Database["public"]["Enums"]["category_kind"]
          name: string
          owner_user_id: string
          updated_at?: string
          updated_by?: string
        }
        Update: {
          active?: boolean
          color?: string | null
          created_at?: string
          created_by?: string
          icon?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["category_kind"]
          name?: string
          owner_user_id?: string
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_cards: {
        Row: {
          active: boolean
          closing_day: number
          color: string | null
          created_at: string
          created_by: string
          due_day: number
          id: string
          institution: string | null
          limit_amount: number | null
          name: string
          owner_user_id: string
          updated_at: string
          updated_by: string
        }
        Insert: {
          active?: boolean
          closing_day: number
          color?: string | null
          created_at?: string
          created_by?: string
          due_day: number
          id?: string
          institution?: string | null
          limit_amount?: number | null
          name: string
          owner_user_id: string
          updated_at?: string
          updated_by?: string
        }
        Update: {
          active?: boolean
          closing_day?: number
          color?: string | null
          created_at?: string
          created_by?: string
          due_day?: number
          id?: string
          institution?: string | null
          limit_amount?: number | null
          name?: string
          owner_user_id?: string
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_cards_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_cards_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_cards_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_access_grants: {
        Row: {
          created_at: string
          created_by: string
          granted_user_id: string
          id: string
          owner_user_id: string
          permission: Database["public"]["Enums"]["access_permission"]
          revoked_at: string | null
          updated_at: string
          updated_by: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          granted_user_id: string
          id?: string
          owner_user_id: string
          permission: Database["public"]["Enums"]["access_permission"]
          revoked_at?: string | null
          updated_at?: string
          updated_by?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          granted_user_id?: string
          id?: string
          owner_user_id?: string
          permission?: Database["public"]["Enums"]["access_permission"]
          revoked_at?: string | null
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_access_grants_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_access_grants_granted_user_id_fkey"
            columns: ["granted_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_access_grants_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_access_grants_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fixed_expenses: {
        Row: {
          account_id: string | null
          active: boolean
          anchor_month: number | null
          category_id: string
          created_at: string
          created_by: string
          credit_card_id: string | null
          default_amount: number
          description: string
          due_day: number
          frequency: Database["public"]["Enums"]["recurrence_frequency"]
          household_id: string | null
          id: string
          notes: string | null
          owner_user_id: string
          updated_at: string
          updated_by: string
        }
        Insert: {
          account_id?: string | null
          active?: boolean
          anchor_month?: number | null
          category_id: string
          created_at?: string
          created_by?: string
          credit_card_id?: string | null
          default_amount: number
          description: string
          due_day: number
          frequency?: Database["public"]["Enums"]["recurrence_frequency"]
          household_id?: string | null
          id?: string
          notes?: string | null
          owner_user_id: string
          updated_at?: string
          updated_by?: string
        }
        Update: {
          account_id?: string | null
          active?: boolean
          anchor_month?: number | null
          category_id?: string
          created_at?: string
          created_by?: string
          credit_card_id?: string | null
          default_amount?: number
          description?: string
          due_day?: number
          frequency?: Database["public"]["Enums"]["recurrence_frequency"]
          household_id?: string | null
          id?: string
          notes?: string | null
          owner_user_id?: string
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "fixed_expenses_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "fixed_expenses_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_expenses_credit_card_id_fkey"
            columns: ["credit_card_id"]
            isOneToOne: false
            referencedRelation: "credit_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_expenses_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_expenses_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_expenses_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      household_members: {
        Row: {
          created_at: string
          created_by: string
          household_id: string
          joined_at: string
          role: Database["public"]["Enums"]["household_role"]
          status: Database["public"]["Enums"]["household_member_status"]
          updated_at: string
          updated_by: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          household_id: string
          joined_at?: string
          role?: Database["public"]["Enums"]["household_role"]
          status?: Database["public"]["Enums"]["household_member_status"]
          updated_at?: string
          updated_by?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          household_id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["household_role"]
          status?: Database["public"]["Enums"]["household_member_status"]
          updated_at?: string
          updated_by?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_members_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_members_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          updated_at: string
          updated_by: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          id?: string
          name: string
          updated_at?: string
          updated_by?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "households_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "households_updated_by_fkey"
            columns: ["updated_by"]
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
          display_name: string
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name: string
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      recurring_incomes: {
        Row: {
          account_id: string
          active: boolean
          anchor_month: number | null
          category_id: string
          created_at: string
          created_by: string
          default_amount: number
          description: string
          frequency: Database["public"]["Enums"]["recurrence_frequency"]
          household_id: string | null
          id: string
          notes: string | null
          owner_user_id: string
          receipt_day: number
          updated_at: string
          updated_by: string
        }
        Insert: {
          account_id: string
          active?: boolean
          anchor_month?: number | null
          category_id: string
          created_at?: string
          created_by?: string
          default_amount: number
          description: string
          frequency?: Database["public"]["Enums"]["recurrence_frequency"]
          household_id?: string | null
          id?: string
          notes?: string | null
          owner_user_id: string
          receipt_day: number
          updated_at?: string
          updated_by?: string
        }
        Update: {
          account_id?: string
          active?: boolean
          anchor_month?: number | null
          category_id?: string
          created_at?: string
          created_by?: string
          default_amount?: number
          description?: string
          frequency?: Database["public"]["Enums"]["recurrence_frequency"]
          household_id?: string | null
          id?: string
          notes?: string | null
          owner_user_id?: string
          receipt_day?: number
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_incomes_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "recurring_incomes_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_incomes_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_incomes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_incomes_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_incomes_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_incomes_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_allocations: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          id: string
          transaction_id: string
          updated_at: string
          updated_by: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string
          id?: string
          transaction_id: string
          updated_at?: string
          updated_by?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          id?: string
          transaction_id?: string
          updated_at?: string
          updated_by?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_allocations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_allocations_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_allocations_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_allocations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string | null
          amount: number
          category_id: string | null
          counterparty_user_id: string | null
          created_at: string
          created_by: string
          credit_card_id: string | null
          date: string
          description: string
          destination_account_id: string | null
          due_date: string | null
          fixed_expense_id: string | null
          household_id: string | null
          id: string
          installment_count: number | null
          installment_group_id: string | null
          installment_number: number | null
          invoice_due_date: string | null
          kind: Database["public"]["Enums"]["transaction_kind"]
          notes: string | null
          owner_user_id: string
          recurrence_month: string | null
          recurring_income_id: string | null
          settlement_direction:
            | Database["public"]["Enums"]["settlement_direction"]
            | null
          status: Database["public"]["Enums"]["transaction_status"]
          updated_at: string
          updated_by: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          category_id?: string | null
          counterparty_user_id?: string | null
          created_at?: string
          created_by?: string
          credit_card_id?: string | null
          date: string
          description: string
          destination_account_id?: string | null
          due_date?: string | null
          fixed_expense_id?: string | null
          household_id?: string | null
          id?: string
          installment_count?: number | null
          installment_group_id?: string | null
          installment_number?: number | null
          invoice_due_date?: string | null
          kind: Database["public"]["Enums"]["transaction_kind"]
          notes?: string | null
          owner_user_id: string
          recurrence_month?: string | null
          recurring_income_id?: string | null
          settlement_direction?:
            | Database["public"]["Enums"]["settlement_direction"]
            | null
          status?: Database["public"]["Enums"]["transaction_status"]
          updated_at?: string
          updated_by?: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          category_id?: string | null
          counterparty_user_id?: string | null
          created_at?: string
          created_by?: string
          credit_card_id?: string | null
          date?: string
          description?: string
          destination_account_id?: string | null
          due_date?: string | null
          fixed_expense_id?: string | null
          household_id?: string | null
          id?: string
          installment_count?: number | null
          installment_group_id?: string | null
          installment_number?: number | null
          invoice_due_date?: string | null
          kind?: Database["public"]["Enums"]["transaction_kind"]
          notes?: string | null
          owner_user_id?: string
          recurrence_month?: string | null
          recurring_income_id?: string | null
          settlement_direction?:
            | Database["public"]["Enums"]["settlement_direction"]
            | null
          status?: Database["public"]["Enums"]["transaction_status"]
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_counterparty_user_id_fkey"
            columns: ["counterparty_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_credit_card_id_fkey"
            columns: ["credit_card_id"]
            isOneToOne: false
            referencedRelation: "credit_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_destination_account_id_fkey"
            columns: ["destination_account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "transactions_destination_account_id_fkey"
            columns: ["destination_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_fixed_expense_id_fkey"
            columns: ["fixed_expense_id"]
            isOneToOne: false
            referencedRelation: "fixed_expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_recurring_income_id_fkey"
            columns: ["recurring_income_id"]
            isOneToOne: false
            referencedRelation: "recurring_incomes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      account_balances: {
        Row: {
          account_id: string | null
          current_balance: number | null
          opening_balance: number | null
          owner_user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_card_invoices: {
        Row: {
          credit_card_id: string | null
          invoice_due_date: string | null
          paid: number | null
          purchase_count: number | null
          total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_credit_card_id_fkey"
            columns: ["credit_card_id"]
            isOneToOne: false
            referencedRelation: "credit_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      installment_purchases: {
        Row: {
          account_id: string | null
          category_id: string | null
          credit_card_id: string | null
          description: string | null
          first_competence: string | null
          id: string | null
          installment_count: number | null
          last_competence: string | null
          owner_user_id: string | null
          recorded_count: number | null
          remaining_amount: number | null
          remaining_count: number | null
          total_amount: number | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_credit_card_id_fkey"
            columns: ["credit_card_id"]
            isOneToOne: false
            referencedRelation: "credit_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_transaction_totals: {
        Row: {
          household_id: string | null
          kind: Database["public"]["Enums"]["transaction_kind"] | null
          month: string | null
          owner_user_id: string | null
          total: number | null
          transaction_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      people_balances: {
        Row: {
          balance: number | null
          counterparty_user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      assert_household_member: {
        Args: { household: string; owner: string }
        Returns: undefined
      }
      assert_owned_account: {
        Args: { account: string; owner: string }
        Returns: undefined
      }
      assert_owned_card: {
        Args: { card: string; owner: string }
        Returns: undefined
      }
      assert_owned_category: {
        Args: {
          category: string
          expected: Database["public"]["Enums"]["category_kind"]
          owner: string
        }
        Returns: undefined
      }
      can_manage: { Args: { owner: string }; Returns: boolean }
      can_manage_transaction_owner: {
        Args: { p_transaction: string }
        Returns: boolean
      }
      can_view: { Args: { owner: string }; Returns: boolean }
      can_view_transaction_owner: {
        Args: { p_transaction: string }
        Returns: boolean
      }
      category_used_in_my_households: {
        Args: { category: string }
        Returns: boolean
      }
      check_allocation_sum_for: {
        Args: { p_transaction: string }
        Returns: undefined
      }
      create_installment_purchase: {
        Args: {
          p_account_id?: string
          p_category_id: string
          p_credit_card_id?: string
          p_date: string
          p_description: string
          p_household_id?: string
          p_installment_count: number
          p_notes?: string
          p_owner_user_id: string
          p_total_amount: number
        }
        Returns: string
      }
      generate_recurrences: {
        Args: { p_month: string; p_owner_user_id: string }
        Returns: number
      }
      invoice_due_date_for: {
        Args: { closing_day: number; due_day: number; purchase_date: string }
        Returns: string
      }
      is_active_member: {
        Args: { household: string; member: string }
        Returns: boolean
      }
      is_allocated_to_me: { Args: { p_transaction: string }; Returns: boolean }
      is_grant_counterpart: { Args: { other: string }; Returns: boolean }
      is_household_admin: { Args: { household: string }; Returns: boolean }
      is_household_member: { Args: { household: string }; Returns: boolean }
      last_day_of_month: { Args: { reference: string }; Returns: number }
      leave_household: { Args: { household: string }; Returns: undefined }
      lookup_user_by_email: {
        Args: { email_address: string }
        Returns: {
          display_name: string
          id: string
        }[]
      }
      seed_default_categories: {
        Args: { profile_id: string }
        Returns: undefined
      }
      set_transaction_allocations: {
        Args: {
          p_amounts: number[]
          p_transaction_id: string
          p_user_ids: string[]
        }
        Returns: number
      }
      shares_household_with: { Args: { other: string }; Returns: boolean }
      shares_ledger_with: { Args: { other: string }; Returns: boolean }
      shift_month_day: {
        Args: { months: number; reference: string }
        Returns: string
      }
      split_installment_amounts: {
        Args: { count: number; total: number }
        Returns: number[]
      }
    }
    Enums: {
      access_permission: "VIEW" | "MANAGE"
      account_type: "BANK" | "CASH" | "BENEFIT" | "OTHER"
      category_kind: "INCOME" | "EXPENSE"
      household_member_status: "ACTIVE" | "INACTIVE"
      household_role: "ADMIN" | "MEMBER"
      recurrence_frequency: "MONTHLY" | "YEARLY"
      settlement_direction: "PAY" | "RECEIVE"
      transaction_kind: "INCOME" | "EXPENSE" | "TRANSFER" | "SETTLEMENT"
      transaction_status: "PENDING" | "PAID" | "CANCELLED"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      access_permission: ["VIEW", "MANAGE"],
      account_type: ["BANK", "CASH", "BENEFIT", "OTHER"],
      category_kind: ["INCOME", "EXPENSE"],
      household_member_status: ["ACTIVE", "INACTIVE"],
      household_role: ["ADMIN", "MEMBER"],
      recurrence_frequency: ["MONTHLY", "YEARLY"],
      settlement_direction: ["PAY", "RECEIVE"],
      transaction_kind: ["INCOME", "EXPENSE", "TRANSFER", "SETTLEMENT"],
      transaction_status: ["PENDING", "PAID", "CANCELLED"],
    },
  },
} as const

