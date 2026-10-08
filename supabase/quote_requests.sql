-- WanderRoute — verified driver quote requests
-- Apply in Supabase SQL Editor; the table, indexes, grants and policy can be reapplied.

create table if not exists public.quote_requests (
  -- The browser supplies a UUID so a retry can target the same receipt.
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

-- RLS limits rows; column grants limit which fields a public insert can set.
-- The operator reads requests through the dashboard or a server-only key.
revoke all privileges on table public.quote_requests from public, anon, authenticated;
grant insert (
  id, full_name, email, whatsapp, start_date, travellers, note,
  trip_id, route_name, cities, total_days, travel_style, estimated_total,
  currency, itinerary_json, device_id, user_agent
) on table public.quote_requests to anon, authenticated;

-- Visitors may submit, but cannot read or change stored requests.
drop policy if exists "anon can insert quote requests" on public.quote_requests;
drop policy if exists "visitors can insert quote requests" on public.quote_requests;
create policy "visitors can insert quote requests"
  on public.quote_requests
  for insert
  to anon, authenticated
  with check (true);
