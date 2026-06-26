import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// This route reads request params and live data, so it must never be statically
// optimised. Forcing dynamic also avoids build-time evaluation of the handler.
export const dynamic = 'force-dynamic'

function getClient() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

export async function GET(req: NextRequest) {
  const supabase = getClient()
  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing)' },
      { status: 500 }
    )
  }

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
