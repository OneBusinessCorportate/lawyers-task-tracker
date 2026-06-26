'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import type { LawyerTask } from '@/lib/supabase'

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

// Every section of the page can be shown or hidden.
const SECTIONS = [
  { key: 'summary', label: 'Сводка' },
  { key: 'breakdowns', label: 'Разбивки' },
  { key: 'filters', label: 'Фильтры' },
  { key: 'table', label: 'Таблица задач' },
] as const

// Every table column can be shown or hidden.
const COLUMNS = [
  { key: 'report_date', label: 'Дата' },
  { key: 'category', label: 'Категория' },
  { key: 'client_name', label: 'Клиент' },
  { key: 'task_description', label: 'Задача' },
  { key: 'time_minutes', label: 'Время' },
  { key: 'is_completed', label: 'Статус' },
  { key: 'source', label: 'Источник' },
  { key: 'raw_line', label: 'Исходная строка' },
] as const

type SectionKey = (typeof SECTIONS)[number]['key']
type ColumnKey = (typeof COLUMNS)[number]['key']

const DEFAULT_SECTIONS: Record<SectionKey, boolean> = {
  summary: true, breakdowns: true, filters: true, table: true,
}
const DEFAULT_COLUMNS: Record<ColumnKey, boolean> = {
  report_date: true, category: true, client_name: true, task_description: true,
  time_minutes: true, is_completed: true, source: false, raw_line: false,
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

  // Show / hide preferences — persisted to localStorage so the layout stays useful.
  const [sectionsOn, setSectionsOn] = useState<Record<SectionKey, boolean>>(DEFAULT_SECTIONS)
  const [columnsOn, setColumnsOn] = useState<Record<ColumnKey, boolean>>(DEFAULT_COLUMNS)
  const [showSettings, setShowSettings] = useState(false)
  const [prefsLoaded, setPrefsLoaded] = useState(false)
  const settingsRef = useRef<HTMLDivElement>(null)

  // Load saved preferences once on mount.
  useEffect(() => {
    try {
      const s = localStorage.getItem('ltt.sections')
      const c = localStorage.getItem('ltt.columns')
      // Syncing UI prefs from localStorage on mount is intentional.
      /* eslint-disable react-hooks/set-state-in-effect */
      if (s) setSectionsOn({ ...DEFAULT_SECTIONS, ...JSON.parse(s) })
      if (c) setColumnsOn({ ...DEFAULT_COLUMNS, ...JSON.parse(c) })
      /* eslint-enable react-hooks/set-state-in-effect */
    } catch { /* ignore corrupt prefs */ }
    setPrefsLoaded(true)
  }, [])

  // Persist whenever they change.
  useEffect(() => {
    if (!prefsLoaded) return
    localStorage.setItem('ltt.sections', JSON.stringify(sectionsOn))
    localStorage.setItem('ltt.columns', JSON.stringify(columnsOn))
  }, [sectionsOn, columnsOn, prefsLoaded])

  // Close the settings panel on outside click.
  useEffect(() => {
    if (!showSettings) return
    const onClick = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) setShowSettings(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [showSettings])

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

  // Fetch on mount and whenever a filter changes.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchTasks() }, [fetchTasks])

  const resetFilters = () => {
    setDateFrom(''); setDateTo(''); setFilterCategory(''); setFilterClient('')
    setFilterCompleted(''); setFilterHasTime(''); setFilterSource(''); setSearch('')
  }

  const visibleColumns = COLUMNS.filter(c => columnsOn[c.key])
  const anyHidden = SECTIONS.some(s => !sectionsOn[s.key]) || COLUMNS.some(c => !columnsOn[c.key])

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">Трекер задач юриста</h1>
          <p className="text-sm text-gray-500 mt-0.5">OneBusiness — учёт рабочего времени</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Show / hide control */}
          <div className="relative" ref={settingsRef}>
            <button
              onClick={() => setShowSettings(v => !v)}
              className={`text-sm px-4 py-2 rounded-lg border transition-colors ${
                showSettings || anyHidden
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Показать / скрыть
            </button>

            {showSettings && (
              <div className="absolute right-0 mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-lg z-20 p-4 space-y-4">
                <Toggles
                  title="Разделы"
                  items={SECTIONS.map(s => ({ key: s.key, label: s.label, on: sectionsOn[s.key] }))}
                  onToggle={k => setSectionsOn(p => ({ ...p, [k as SectionKey]: !p[k as SectionKey] }))}
                />
                <Toggles
                  title="Столбцы таблицы"
                  items={COLUMNS.map(c => ({ key: c.key, label: c.label, on: columnsOn[c.key] }))}
                  onToggle={k => setColumnsOn(p => ({ ...p, [k as ColumnKey]: !p[k as ColumnKey] }))}
                />
                <button
                  onClick={() => { setSectionsOn(DEFAULT_SECTIONS); setColumnsOn(DEFAULT_COLUMNS) }}
                  className="w-full text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg py-2"
                >
                  Сбросить вид
                </button>
              </div>
            )}
          </div>

          <button onClick={fetchTasks} className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            Обновить
          </button>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-6 py-6 space-y-6">

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
            Ошибка: {error}
          </div>
        )}

        {sectionsOn.summary && stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <SummaryCard label="Всего времени" value={minsToHours(stats.totalMinutes)} sub={`${stats.totalMinutes} мин`} color="blue" />
            <SummaryCard label="Всего задач" value={String(stats.totalTasks)} color="gray" />
            <SummaryCard label="Выполнено" value={String(stats.completedTasks)} sub={stats.totalTasks ? `${Math.round(stats.completedTasks / stats.totalTasks * 100)}%` : ''} color="green" />
            <SummaryCard label="Без времени" value={String(stats.tasksWithoutTime)} color={stats.tasksWithoutTime > 0 ? 'amber' : 'gray'} />
          </div>
        )}

        {sectionsOn.breakdowns && stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard title="Время по категориям">
              {Object.entries(stats.byCategory).sort((a, b) => b[1] - a[1]).map(([cat, mins]) => (
                <StatRow key={cat} label={CATEGORY_LABELS[cat] || cat} value={minsToHours(mins)} />
              ))}
              {Object.keys(stats.byCategory).length === 0 && <p className="text-gray-400 text-sm">Нет данных</p>}
            </StatCard>
            <StatCard title="Время по клиентам (топ 10)">
              {Object.entries(stats.byClient).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([client, mins]) => (
                <StatRow key={client} label={client} value={minsToHours(mins)} />
              ))}
              {Object.keys(stats.byClient).length === 0 && <p className="text-gray-400 text-sm">Нет данных</p>}
            </StatCard>
            <StatCard title="Минуты по дням">
              {Object.entries(stats.byDate).sort((a, b) => b[0].localeCompare(a[0])).map(([date, mins]) => (
                <StatRow key={date} label={date} value={minsToHours(mins)} />
              ))}
              {Object.keys(stats.byDate).length === 0 && <p className="text-gray-400 text-sm">Нет данных</p>}
            </StatCard>
          </div>
        )}

        {sectionsOn.filters && (
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
              <button onClick={resetFilters}
                className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2 border border-gray-300 rounded-lg">
                Сбросить
              </button>
            </div>
          </div>
        )}

        {sectionsOn.table && (
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
            ) : visibleColumns.length === 0 ? (
              <div className="p-8 text-center text-gray-400">Все столбцы скрыты — включите их в «Показать / скрыть»</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      {visibleColumns.map(c => (
                        <th key={c.key} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{c.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {tasks.map(t => (
                      <tr key={t.id} className={`hover:bg-gray-50 transition-colors ${!t.time_minutes ? 'bg-amber-50 hover:bg-amber-100' : ''}`}>
                        {visibleColumns.map(c => <Cell key={c.key} col={c.key} task={t} />)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

function Cell({ col, task: t }: { col: ColumnKey; task: LawyerTask }) {
  switch (col) {
    case 'report_date':
      return <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-700">{t.report_date}</td>
    case 'category':
      return (
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
      )
    case 'client_name':
      return (
        <td className="px-4 py-3 max-w-[160px]">
          <span className="block truncate text-gray-700" title={t.client_name || ''}>{t.client_name || '—'}</span>
        </td>
      )
    case 'task_description':
      return (
        <td className="px-4 py-3 max-w-[220px]">
          <span className="block truncate text-gray-700" title={t.task_description || ''}>{t.task_description || '—'}</span>
        </td>
      )
    case 'time_minutes':
      return (
        <td className="px-4 py-3 whitespace-nowrap">
          {t.time_minutes != null
            ? <span className="font-semibold text-gray-900">{t.time_minutes} мин</span>
            : <span className="text-amber-600 font-medium">⚠ нет</span>}
        </td>
      )
    case 'is_completed':
      return (
        <td className="px-4 py-3 whitespace-nowrap">
          {t.is_completed ? <span className="text-green-600">✅</span> : <span className="text-gray-400">—</span>}
        </td>
      )
    case 'source':
      return (
        <td className="px-4 py-3 whitespace-nowrap">
          <span className="text-xs text-gray-400">{SOURCE_LABELS[t.source] || t.source}</span>
        </td>
      )
    case 'raw_line':
      return (
        <td className="px-4 py-3 max-w-[200px]">
          <span className="block truncate text-gray-400 text-xs" title={t.raw_line || ''}>{t.raw_line || '—'}</span>
        </td>
      )
  }
}

function Toggles({ title, items, onToggle }: {
  title: string
  items: { key: string; label: string; on: boolean }[]
  onToggle: (key: string) => void
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{title}</p>
      <div className="space-y-1">
        {items.map(it => (
          <label key={it.key} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none py-1 px-1 rounded hover:bg-gray-50">
            <input type="checkbox" checked={it.on} onChange={() => onToggle(it.key)} className="accent-blue-600 w-4 h-4" />
            {it.label}
          </label>
        ))}
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
