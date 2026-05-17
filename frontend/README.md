## Overview

Medclara Web is a marketing site and early-access intake form for the Medclara clinical documentation platform. The project is built with Next.js 15 (App Router), React 19, Supabase, and Tailwind CSS.

## Quickstart

```bash
npm install
npm run dev
```

Visit <http://localhost:3000> to view the site.

## Environment variables

Create a `.env.local` file with the following entries:

```bash
NEXT_PUBLIC_SUPABASE_URL="https://<your-project>.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="<public-anon-key>"
```

You may also use `NEXT_PUBLIC_SUPABASE_ANON_KEY` if preferred—the server helper will read either variable. Do **not** store the service role key in `.env.local`; RLS policies protect the data instead.

## Database policy

The interest form writes to `public.interest_signups`. Ensure row level security is enabled and add an insert policy that allows anonymous submissions. A sample SQL snippet is available in `supabase/policies/interest_signups.sql`:

```sql
alter table public.interest_signups enable row level security;

create policy "Allow anonymous interest submissions"
	on public.interest_signups
	for insert
	using (true)
	with check (true);
```

Apply the SQL in your Supabase project via the dashboard or CLI.

## Deploying

Run a production build locally with:

```bash
npm run build && npm run start
```

For deployment, configure the same environment variables in your hosting provider (e.g., Vercel) and run the build command above.
