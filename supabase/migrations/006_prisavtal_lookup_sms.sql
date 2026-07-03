-- Prisavtal: kundspecifika priser per artikel (override av standardpris)
create table if not exists kund_prisavtal (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  artikel_id uuid not null references artiklar(id) on delete cascade,
  avtalspris numeric not null default 0,
  created_at timestamptz not null default now(),
  unique (customer_id, artikel_id)
);

alter table kund_prisavtal enable row level security;

create policy "Authenticated users can do everything on kund_prisavtal"
  on kund_prisavtal for all
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);

create index on kund_prisavtal (customer_id);
