import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const dateFrom = searchParams.get('dateFrom')
  const dateTo = searchParams.get('dateTo')
  const category = searchParams.get('category')
  const completed = searchParams.get('completed')
  const hasTime = searchParams.get('hasTime')
  const source = searchParams.get('source')

  let q = supabase
    .from('lawyer_tasks')
    .select('*')
    .order('report_date', { ascending: false })
    .order('id', { ascending: false })

  if (dateFrom) q = q.gte('report_date', dateFrom)
  if (dateTo) q = q.lte('report_date', dateTo)
  if (category) q = q.eq('category', category)
  if (completed === 'yes') q = q.eq('is_completed', true)
  if (completed === 'no') q = q.eq('is_completed', false)
  if (hasTime === 'yes') q = q.not('time_minutes', 'is', null)
  if (hasTime === 'no') q = q.is('time_minutes', null)
  if (source) q = q.eq('source', source)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
