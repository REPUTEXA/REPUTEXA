alter table profiles
add column if not exists onboarding_paid_sent boolean default false;

