-- Buzzcook shared product list. Paste this whole file into Supabase → SQL Editor → Run.
-- Anyone with the app can look a barcode up and add a product that isn't there yet.
-- Nobody can change or delete products from the app; you edit them in Supabase → Table Editor.

create table if not exists public.products (
  barcode    text primary key check (barcode ~ '^[0-9]{8,14}$'),
  name       text not null check (char_length(name) between 1 and 120),
  kcal       numeric not null check (kcal > 0 and kcal < 1000),  -- per 100 g
  protein    numeric not null default 0 check (protein >= 0 and protein <= 100),
  fat        numeric not null default 0 check (fat >= 0 and fat <= 100),
  carbs      numeric not null default 0 check (carbs >= 0 and carbs <= 100),
  portion    numeric not null default 100 check (portion > 0 and portion <= 5000),
  created_at timestamptz not null default now()
);

alter table public.products enable row level security;

drop policy if exists "anyone can read products" on public.products;
create policy "anyone can read products" on public.products
  for select to anon, authenticated using (true);

drop policy if exists "anyone can add a new product" on public.products;
create policy "anyone can add a new product" on public.products
  for insert to anon, authenticated with check (true);

-- No update or delete policies: the app can't change or remove what is already there.
grant select, insert on public.products to anon, authenticated;
