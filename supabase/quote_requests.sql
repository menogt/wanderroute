-- WanderRoute — verified driver quote requests
-- Run this once in Supabase → SQL Editor → New query → Run.

create table if not exists public.quote_requests (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),

  -- Traveller
  full_name         text not null,
  email             text not null,
  whatsapp          text,
  start_date        date,
  travellers        int,
  note              text,

  -- Trip snapshot (so the driver can be quoted the exact route)
  trip_id           text,
  route_name        text,
  cities            text[],
  total_days        int,
  travel_style      text,
  estimated_total   numeric,
  currency          text,
  itinerary_json    jsonb,

  -- Ops
  status            text not null default 'new',   -- new | quoted | booked | lost
  driver_name       text,
  driver_licence    text,
  quoted_price_usd  numeric,
  quoted_at         timestamptz,
  internal_notes    text,

  device_id         text,
  user_agent        text
);

create index if not exists quote_requests_created_at_idx
  on public.quote_requests (created_at desc);

create index if not exists quote_requests_status_idx
  on public.quote_requests (status);

alter table public.quote_requests enable row level security;

-- Anonymous visitors may submit a request, but may not read anyone's data.
-- You read the table from the Supabase dashboard (service role), not the app.
drop policy if exists "anon can insert quote requests" on public.quote_requests;
create policy "anon can insert quote requests"
  on public.quote_requests
  for insert
  to anon
  with check (true);

-- Conversion rate = count(quote_requests) / count(trips)
-- Both tables are already populated automatically. Run this before Demo Day:
--
--   select
--     (select count(*) from trips)          as plans_generated,
--     (select count(*) from quote_requests) as quote_requests,
--     round(
--       100.0 * (select count(*) from quote_requests)
--             / nullif((select count(*) from trips), 0)
--     , 1) as conversion_pct;
