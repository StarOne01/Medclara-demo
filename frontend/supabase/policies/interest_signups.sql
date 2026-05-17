-- Allow inserts into interest_signups for anonymous visitors handled by RLS.
-- Enable RLS in your Supabase project if it is not already enabled.

-- Example setup:
-- alter table public.interest_signups enable row level security;
-- create policy "Allow anonymous interest submissions"
--   on public.interest_signups
--   for insert
--   using (true)
--   with check (true);
