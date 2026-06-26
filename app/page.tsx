'use client'

import { useEffect, useState, useCallback } from 'react'
import { LawyerTask } from '@/lib/supabase'

type Stats = {
  totalMinutes: number
  totalTasks: number
  completedTasks: number
  tasksWithoutTime: number
  byCategory: Record<string, number>
  byClient: Record<string, number>
  byDate: Record<string, number>
}

const CATEGORY_LABELS: Record<string, string> = {
  communication: 'Коммуникация',
  task: 'Задача',
  chats: 'Чаты',
  uncategorized: 'Без категории',
}

const SOURCE_LABELS: Record<string, string> = {
  manual_historical_import: 'Ручной импорт',
  telegram_bot: 'Telegram бот',
}

function minsToHours(m: number) {
  const h = Math.floor(m / 60)
  const min = m % 60
  return h > 0 ? `${h}ч ${min > 0 ? min + 'м' : ''}`.trim() : `${min}м`
}

export default function Dashboard() {
  const [tasks, setTasks] = useState<LawyerTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)

  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterClient, setFilterClient] = useState('')
  const [filterCompleted, setFilterCompleted] = useState('')
  const [filterHasTime, setFilterHasTime] = useState('')
  const [filterSource, setFilterSource] = useState('')
  const [search, setSearch] = useState('')

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    setError(null)

    const params = new URLSearchParams()
    if (dateFrom) params.set('dateFrom', dateFrom)
    if (dateTo) params.set('dateTo', dateTo)
    if (filterCategory) params.set('category', filterCategory)
    if (filterCompleted) params.set('completed', filterCompleted)
    if (filterHasTime) params.set('hasTime', filterHasTime)
    if (filterSource) params.set('source', filterSource)

    try {
      const res = await fetch(`/api/tasks?${params}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      let result: LawyerTask[] = await res.json()

      if (filterClient) result = result.filter(t => t.client_name?.toLowerCase().includes(filterClient.toLowerCase()))
      if (search) result = result.filter(t =>
        t.task_description?.toLowerCase().includes(search.toLowerCase()) ||
        t.client_name?.toLowerCase().includes(search.toLowerCase()) ||
        t.raw_line?.toLowerCase().includes(search.toLowerCase())
      )

      setTasks(result)

      const s: Stats = { totalMinutes: 0, totalTasks: result.length, completedTasks: 0, tasksWithoutTime: 0, byCategory: {}, byClient: {}, byDate: {} }
      for (const t of result) {
        if (t.time_minutes) s.totalMinutes += t.time_minutes
        if (t.is_completed) s.completedTasks++
        if (!t.time_minutes) s.tasksWithoutTime++
        const cat = t.category || 'uncategorized'
        s.byCategory[cat] = (s.byCategory[cat] || 0) + (t.time_minutes || 0)
        if (t.client_name) s.byClient[t.client_name] = (s.byClient[t.client_name] || 0) + (t.time_minutes || 0)
        if (t.report_date) s.byDate[t.report_date] = (s.byDate[t.report_date] || 0) + (t.time_minutes || 0)
      }
      setStats(s)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo, filterCategory, filterCompleted, filterHasTime, filterSource, filterClient, search])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Трекер задач юриста</h1>
          <p className="text-sm text-gray-500 mt-0.5">OneBusiness — учёт рабочего времени</p>
        </div>
        <button onClick={fetchTasks} className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
          Обновить
        </button>
      </div>

      <div className="max-w-screen-xl mx-auto px-6 py-6 space-y-6">

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
            Ошибка: {error}
          </div>
        )}

        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <SummaryCard label="Всего времени" value={`${stats.totalMinutes} мин`} sub={minsToHours(stats.totalMinutes)} color="blue" />
            <SummaryCard label="Всего задач" value={String(stats.totalTasks)} color="gray" />
            <SummaryCard label="Выполнено" value={String(stats.completedTasks)} sub={stats.totalTasks ? `${Math.round(stats.completedTasks / stats.totalTasks * 100)}%` : ''} color="green" />
            <SummaryCard label="Без времени" value={String(stats.tasksWithoutTime)} color={stats.tasksWithoutTime > 0 ? 'amber' : 'gray'} />
          </div>
        )}

        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard title="Время по категориям">
              {Object.entries(stats.byCategory).sort((a, b) => b[1] - a[1]).map(([cat, mins]) => (
                <StatRow key={cat} label={CATEGORY_LABELS[cat] || cat} value={`${mins} мин (${minsToHours(mins)})`} />
              ))}
              {Object.keys(stats.byCategory).length === 0 && <p className="text-gray-400 text-sm">Нет данных</p>}
            </StatCard>
            <StatCard title="Время по клиентам (топ 10)">
              {Object.entries(stats.byClient).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([client, mins]) => (
                <StatRow key={client} label={client} value={`${mins} мин`} />
              ))}
              {Object.keys(stats.byClient).length === 0 && <p className="text-gray-400 text-sm">Нет данных</p>}
            </StatCard>
            <StatCard title="Минуты по дням">
              {Object.entries(stats.byDate).sort((a, b) => b[0].localeCompare(a[0])).map(([date, mins]) => (
                <StatRow key={date} label={date} value={`${mins} мин / ${minsToHours(mins)}`} />
              ))}
              {Object.keys(stats.byDate).length === 0 && <p className="text-gray-400 text-sm">Нет данных</p>}
            </StatCard>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">Фильтры</p>
          <div className="flex flex-wrap gap-3">
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="">Все категории</option>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input value={filterClient} onChange={e => setFilterClient(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-44" placeholder="Клиент..." />
            <select value={filterCompleted} onChange={e => setFilterCompleted(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="">Статус (все)</option>
              <option value="yes">Выполнено ✅</option>
              <option value="no">Не выполнено</option>
            </select>
            <select value={filterHasTime} onChange={e => setFilterHasTime(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="">Время (все)</option>
              <option value="yes">Есть время</option>
              <option value="no">Нет времени ⚠️</option>
            </select>
            <select value={filterSource} onChange={e => setFilterSource(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="">Все источники</option>
              <option value="manual_historical_import">Ручной импорт</option>
              <option value="telegram_bot">Telegram бот</option>
            </select>
            <input value={search} onChange={e => setSearch(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-48" placeholder="Поиск..." />
            <button onClick={() => { setDateFrom(''); setDateTo(''); setFilterCategory(''); setFilterClient(''); setFilterCompleted(''); setFilterHasTime(''); setFilterSource(''); setSearch('') }}
              className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2 border border-gray-300 rounded-lg">
              Сбросить
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
            <p className="text-sm font-semibold text-gray-700">Задачи</p>
            {!loading && <span className="text-sm text-gray-400">({tasks.length})</span>}
            {stats && stats.tasksWithoutTime > 0 && (
              <span className="ml-auto text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded font-medium">
                ⚠ {stats.tasksWithoutTime} задач без времени
              </span>
            )}
          </div>
          {loading ? (
            <div className="p-8 text-center text-gray-400">Загрузка...</div>
          ) : tasks.length === 0 ? (
            <div className="p-8 text-center text-gray-400">Задач не найдено</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Дата', 'Категория', 'Клиент', 'Задача', 'Время', 'Статус', 'Источник', 'Исходная строка'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {tasks.map(t => (
                    <tr key={t.id} className={`hover:bg-gray-50 transition-colors ${!t.time_minutes ? 'bg-amber-50 hover:bg-amber-100' : ''}`}>
                      <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-700">{t.report_date}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                          t.category === 'communication' ? 'bg-blue-100 text-blue-700' :
                          t.category === 'task' ? 'bg-purple-100 text-purple-700' :
                          t.category === 'chats' ? 'bg-green-100 text-green-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {CATEGORY_LABELS[t.category] || t.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-[160px]">
                        <span className="block truncate text-gray-700" title={t.client_name || ''}>{t.client_name || '—'}</span>
                      </td>
                      <td className="px-4 py-3 max-w-[220px]">
                        <span className="block truncate text-gray-700" title={t.task_description || ''}>{t.task_description || '—'}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {t.time_minutes != null
                          ? <span className="font-semibold text-gray-900">{t.time_minutes} мин</span>
                          : <span className="text-amber-600 font-medium">⚠ нет</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {t.is_completed ? <span className="text-green-600">✅</span> : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-xs text-gray-400">{SOURCE_LABELS[t.source] || t.source}</span>
                      </td>
                      <td className="px-4 py-3 max-w-[200px]">
                        <span className="block truncate text-gray-400 text-xs" title={t.raw_line || ''}>{t.raw_line || '—'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SummaryCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: 'blue' | 'green' | 'amber' | 'gray' }) {
  const colors = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    gray: 'bg-white border-gray-200 text-gray-700',
  }
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
      {sub && <p className="text-sm mt-0.5 opacity-60">{sub}</p>}
    </div>
  )
}

function StatCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-sm font-semibold text-gray-700 mb-3">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-gray-600 truncate" title={label}>{label}</span>
      <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">{value}</span>
    </div>
  )
}
