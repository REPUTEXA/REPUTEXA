create table if not exists ai_reminders (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references conversation_threads (id) on delete cascade,
  run_at timestamptz not null,
  processed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_reminders_run_at_processed
  on ai_reminders (processed, run_at);

