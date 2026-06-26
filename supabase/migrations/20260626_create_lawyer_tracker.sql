-- Lawyer task tracker tables for OB FAQ Supabase project

create table if not exists public.lawyer_reports (
  id bigserial primary key,
  telegram_message_id bigint,
  chat_id bigint,
  report_date date,
  sender_id bigint,
  sender_name text,
  raw_text text not null,
  created_at timestamptz default now(),
  unique (telegram_message_id, chat_id)
);

create table if not exists public.lawyer_tasks (
  id bigserial primary key,
  report_id bigint references public.lawyer_reports(id) on delete cascade,
  report_date date,
  category text default 'uncategorized',
  client_name text,
  task_description text,
  time_minutes integer,
  is_completed boolean default false,
  source text not null default 'telegram_bot',
  raw_line text,
  created_at timestamptz default now()
);

create index if not exists idx_lawyer_reports_date on public.lawyer_reports(report_date);
create index if not exists idx_lawyer_tasks_date on public.lawyer_tasks(report_date);
create index if not exists idx_lawyer_tasks_report_id on public.lawyer_tasks(report_id);
create index if not exists idx_lawyer_tasks_category on public.lawyer_tasks(category);

alter table public.lawyer_reports enable row level security;
alter table public.lawyer_tasks enable row level security;

create policy "Allow anon read lawyer_reports" on public.lawyer_reports for select to anon using (true);
create policy "Allow anon read lawyer_tasks" on public.lawyer_tasks for select to anon using (true);
create policy "Allow service insert lawyer_reports" on public.lawyer_reports for insert to service_role with check (true);
create policy "Allow service insert lawyer_tasks" on public.lawyer_tasks for insert to service_role with check (true);
create policy "Allow service update lawyer_reports" on public.lawyer_reports for update to service_role using (true);
create policy "Allow service update lawyer_tasks" on public.lawyer_tasks for update to service_role using (true);
