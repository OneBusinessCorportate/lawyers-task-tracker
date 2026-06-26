import { createClient } from '@supabase/supabase-js'

// Server-side only — uses service role key, never exposed to browser
export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export type LawyerReport = {
  id: number
  telegram_message_id: number | null
  chat_id: number | null
  report_date: string
  sender_id: number | null
  sender_name: string | null
  raw_text: string
  created_at: string
}

export type LawyerTask = {
  id: number
  report_id: number | null
  report_date: string
  category: string
  client_name: string | null
  task_description: string | null
  time_minutes: number | null
  is_completed: boolean
  source: string
  raw_line: string | null
  created_at: string
}
