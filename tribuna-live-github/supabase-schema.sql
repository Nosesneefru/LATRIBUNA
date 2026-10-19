-- Tribuna: base inicial para contenido y control de administradores.
-- Ejecutar en Supabase Dashboard > SQL Editor después de crear el proyecto.

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  league text not null,
  starts_at timestamptz not null,
  home_team text not null,
  away_team text not null,
  channel_name text not null,
  stream_url text not null,
  rights_confirmed boolean not null default false check (rights_confirmed = true),
  published boolean not null default true,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.content_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Para cobro manual, el admin habilita acceso por un período después de verificar
-- la transferencia. El navegador del suscriptor nunca puede cambiar su estado.
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider text not null default 'manual',
  provider_subscription_id text unique,
  status text not null default 'pending'
    check (status in ('pending', 'authorized', 'active', 'paused', 'cancelled', 'past_due')),
  current_period_end timestamptz,
  approved_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.streams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  stream_url text not null unique,
  rights_confirmed boolean not null default false check (rights_confirmed = true),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.matches enable row level security;
alter table public.content_admins enable row level security;
alter table public.subscriptions enable row level security;
alter table public.streams enable row level security;

grant select on public.matches to anon, authenticated;
grant insert, update, delete on public.matches to authenticated;
grant select on public.content_admins to authenticated;
grant select on public.subscriptions to authenticated;
grant insert, update, delete on public.subscriptions to authenticated;
grant select, insert, update, delete on public.streams to authenticated;

drop policy if exists "Anyone can view published matches" on public.matches;
drop policy if exists "Subscribers and admins can view published matches" on public.matches;
create policy "Subscribers and admins can view published matches"
  on public.matches for select
  to authenticated
  using (
    published = true
    and (
      exists (select 1 from public.content_admins a where a.user_id = (select auth.uid()))
      or exists (
        select 1 from public.subscriptions s
        where s.user_id = (select auth.uid())
          and s.status = 'active'
          and (s.current_period_end is null or s.current_period_end > now())
      )
    )
  );

drop policy if exists "Admins can manage matches" on public.matches;
create policy "Admins can manage matches"
  on public.matches for all
  to authenticated
  using (
    exists (select 1 from public.content_admins a where a.user_id = (select auth.uid()))
  )
  with check (
    exists (select 1 from public.content_admins a where a.user_id = (select auth.uid()))
    and created_by = (select auth.uid())
    and rights_confirmed = true
  );

drop policy if exists "Admins can read own admin entry" on public.content_admins;
create policy "Admins can read own admin entry"
  on public.content_admins for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users can read own subscription" on public.subscriptions;
create policy "Users can read own subscription"
  on public.subscriptions for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Admins can manage subscriptions" on public.subscriptions;
create policy "Admins can manage subscriptions"
  on public.subscriptions for all
  to authenticated
  using (
    exists (select 1 from public.content_admins a where a.user_id = (select auth.uid()))
  )
  with check (
    exists (select 1 from public.content_admins a where a.user_id = (select auth.uid()))
  );

drop policy if exists "Members and admins can view authorized streams" on public.streams;
create policy "Members and admins can view authorized streams"
  on public.streams for select
  to authenticated
  using (
    exists (select 1 from public.content_admins a where a.user_id = (select auth.uid()))
    or exists (
      select 1 from public.subscriptions s
      where s.user_id = (select auth.uid())
        and s.status = 'active'
        and (s.current_period_end is null or s.current_period_end > now())
    )
  );

drop policy if exists "Admins can manage authorized streams" on public.streams;
create policy "Admins can manage authorized streams"
  on public.streams for all
  to authenticated
  using (
    exists (select 1 from public.content_admins a where a.user_id = (select auth.uid()))
  )
  with check (
    exists (select 1 from public.content_admins a where a.user_id = (select auth.uid()))
    and created_by = (select auth.uid())
    and rights_confirmed = true
  );

-- Después de crear/invitar tu usuario en Authentication > Users,
-- reemplazá el correo y ejecutá esta consulta para darle acceso de admin:
-- insert into public.content_admins (user_id)
-- select id from auth.users where email = 'TU_CORREO@EJEMPLO.COM'
-- on conflict do nothing;
