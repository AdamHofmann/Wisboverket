-- Förfrågningar från hofmannsab.se (uthyrningsintresse, offertförfrågan, kontaktformulär)
create table if not exists forfragningar (
  id uuid primary key default gen_random_uuid(),
  typ text not null check (typ in ('uthyrning', 'offert', 'kontakt')),
  namn text,
  telefon text,
  epost text,
  meddelande text,
  objekt_titel text,
  tjanst text,
  amne text,
  fastighet text,
  status text not null default 'ny' check (status in ('ny', 'hanterad')),
  created_at timestamptz not null default now()
);

alter table forfragningar enable row level security;

create policy "Anon kan skapa förfrågningar"
  on forfragningar for insert
  to anon
  with check (true);

create policy "Authenticated users can do everything on forfragningar"
  on forfragningar for all
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);

-- Felanmälningar från hyresgäster (hofmannsab.se)
create table if not exists felanmalningar (
  id uuid primary key default gen_random_uuid(),
  kategori text not null default 'annat' check (kategori in ('el', 'vvs', 'snickeri', 'stad', 'las', 'annat')),
  prioritet text not null default 'normal' check (prioritet in ('lag', 'normal', 'hog', 'akut')),
  namn text,
  telefon text,
  epost text,
  fastighet text,
  lagenhet text,
  beskrivning text,
  status text not null default 'ny' check (status in ('ny', 'hanterad')),
  order_id uuid references orders(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table felanmalningar enable row level security;

create policy "Anon kan skapa felanmälningar"
  on felanmalningar for insert
  to anon
  with check (true);

create policy "Authenticated users can do everything on felanmalningar"
  on felanmalningar for all
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);

create index on forfragningar (status);
create index on felanmalningar (status);
