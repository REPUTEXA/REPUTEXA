alter table profiles
add column if not exists payment_failed_at timestamptz;

