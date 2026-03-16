alter table profiles
add column if not exists payment_status text default 'paid';

