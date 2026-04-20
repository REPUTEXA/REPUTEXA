create table if not exists conversation_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  channel text not null default 'google',
  google_conversation_id text not null unique,
  customer_name text,
  patron_whatsapp_number text,
  status text not null default 'open',
  last_customer_message text,
  last_customer_at timestamptz,
  last_owner_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_conversation_threads_user_channel
  on conversation_threads (user_id, channel, status);

create or replace function set_conversation_threads_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_conversation_threads_updated_at on conversation_threads;

create trigger trg_conversation_threads_updated_at
before update on conversation_threads
for each row
execute procedure set_conversation_threads_updated_at();

