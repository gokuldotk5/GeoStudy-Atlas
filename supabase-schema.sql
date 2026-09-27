-- GeoStudy Atlas - Supabase setup
-- 1) Create a free Supabase project.
-- 2) Open SQL Editor and run this whole script.
-- 3) Enable Email/Password authentication in Authentication > Providers.
-- 4) Put the project URL + anon key in config.js.

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  category text not null default 'Other',
  region text,
  notes text,
  lat double precision,
  lng double precision,
  important boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notes enable row level security;

-- This is a shared study atlas: every signed-in user can read/write notes.
drop policy if exists "authenticated can read notes" on public.notes;
create policy "authenticated can read notes"
on public.notes for select to authenticated using (true);

drop policy if exists "authenticated can insert notes" on public.notes;
create policy "authenticated can insert notes"
on public.notes for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "authenticated can update notes" on public.notes;
create policy "authenticated can update notes"
on public.notes for update to authenticated using (true) with check (true);

drop policy if exists "authenticated can delete notes" on public.notes;
create policy "authenticated can delete notes"
on public.notes for delete to authenticated using (true);

create index if not exists notes_region_idx on public.notes(region);
create index if not exists notes_category_idx on public.notes(category);

-- Optional updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists notes_updated_at on public.notes;
create trigger notes_updated_at before update on public.notes
for each row execute function public.set_updated_at();
