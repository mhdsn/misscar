-- ============================================
-- MissCarr - Script SQL pour Supabase
-- Coller dans : SQL Editor > New Query > Run
-- ============================================

-- =====================
-- TABLE PROFILES
-- =====================

-- 1. Table publique des profils utilisateurs
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  created_at timestamptz default now()
);

-- 2. RLS sur profiles
alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- 3. Trigger : créer automatiquement un profil à chaque inscription
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.email
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================
-- TABLE POLICIES
-- =====================

-- 4. Création de la table policies
create table if not exists public.policies (
  id text primary key,
  "ownerName" text not null,
  "carBrand" text not null,
  "carModel" text not null,
  "licensePlate" text not null,
  "startDate" text not null,
  "endDate" text not null,
  "reminderDays" integer default 7,
  "clientEmail" text,
  "notificationSent" boolean default false,
  "createdAt" bigint not null,
  "userId" text not null
);

-- 5. Activer Row Level Security
alter table public.policies enable row level security;

-- 6. Politique : chaque utilisateur ne voit que ses propres données
create policy "Users can select their own policies"
  on public.policies for select
  using (auth.uid()::text = "userId");

create policy "Users can insert their own policies"
  on public.policies for insert
  with check (auth.uid()::text = "userId");

create policy "Users can update their own policies"
  on public.policies for update
  using (auth.uid()::text = "userId");

create policy "Users can delete their own policies"
  on public.policies for delete
  using (auth.uid()::text = "userId");

-- 8. Activer le Realtime sur les tables
alter publication supabase_realtime add table public.policies;
alter publication supabase_realtime add table public.profiles;
