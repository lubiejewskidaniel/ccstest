-- Code Consulting Studio — initial schema
-- Initial production schema for staff profiles, roles and lead enquiries.

-- ============================================================
-- 1. profiles
-- One row per authenticated staff member.
-- ============================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- A signed-in user can read their own profile.
-- Profile provisioning remains an administrative/server-side operation.

create policy "profiles: self select"
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());


-- ============================================================
-- 2. user_roles
-- Staff role assignment: admin / editor / mentor.
-- ============================================================

create table if not exists public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('admin', 'editor', 'mentor')),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

alter table public.user_roles enable row level security;

-- A signed-in user can read their own role assignments.

create policy "user_roles: self select"
  on public.user_roles
  for select
  to authenticated
  using (user_id = auth.uid());


-- ============================================================
-- Helper: is_active_admin()
--
-- SECURITY DEFINER allows this helper to inspect profiles and
-- user_roles without being blocked by their RLS policies.
--
-- Used by lead-table policies to determine whether the current
-- authenticated user is an active administrator.
-- ============================================================

create or replace function public.is_active_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.profiles p on p.id = ur.user_id
    where ur.user_id = auth.uid()
      and ur.role = 'admin'
      and p.active = true
  );
$$;

revoke all on function public.is_active_admin() from public;

grant execute
  on function public.is_active_admin()
  to authenticated;

grant execute
  on function public.is_active_admin()
  to service_role;


-- ============================================================
-- 3. project_leads
-- BUILD enquiries.
-- ============================================================

create table if not exists public.project_leads (
  id uuid primary key default gen_random_uuid(),

  locale text not null
    check (locale in ('en', 'pl')),

  name text not null
    check (char_length(name) between 2 and 100),

  email text not null
    check (char_length(email) <= 254),

  company text
    check (
      company is null
      or char_length(company) <= 160
    ),

  stage text not null
    check (
      stage in (
        'idea',
        'in-progress',
        'existing-product',
        'not-sure'
      )
    ),

  capability text not null
    check (
      capability in (
        'software-development',
        'product-development',
        'technology-consulting',
        'web-digital',
        'not-sure'
      )
    ),

  budget_range text
    check (
      budget_range is null
      or budget_range in (
        'under-5k',
        '5k-15k',
        '15k-50k',
        '50k-plus',
        'not-sure'
      )
    ),

  message text not null
    check (char_length(message) between 20 and 5000),

  status text not null default 'new'
    check (
      status in (
        'new',
        'contacted',
        'qualified',
        'closed'
      )
    ),

  created_at timestamptz not null default now()
);

alter table public.project_leads enable row level security;

-- Only an active admin can read project leads through
-- the authenticated Supabase client.

create policy "project_leads: admin select"
  on public.project_leads
  for select
  to authenticated
  using (public.is_active_admin());


-- ============================================================
-- 4. marketing_enquiries
-- GROW enquiries.
-- ============================================================

create table if not exists public.marketing_enquiries (
  id uuid primary key default gen_random_uuid(),

  locale text not null
    check (locale in ('en', 'pl')),

  name text not null
    check (char_length(name) between 2 and 100),

  email text not null
    check (char_length(email) <= 254),

  company text
    check (
      company is null
      or char_length(company) <= 160
    ),

  services text[] not null
    check (array_length(services, 1) >= 1),

  engagement_type text not null
    check (
      engagement_type in (
        'one-off',
        'managed-recurring',
        'not-sure'
      )
    ),

  current_presence text
    check (
      current_presence is null
      or current_presence in (
        'none',
        'some',
        'established'
      )
    ),

  message text not null
    check (char_length(message) between 20 and 5000),

  status text not null default 'new'
    check (
      status in (
        'new',
        'contacted',
        'qualified',
        'closed'
      )
    ),

  created_at timestamptz not null default now()
);

alter table public.marketing_enquiries enable row level security;

create policy "marketing_enquiries: admin select"
  on public.marketing_enquiries
  for select
  to authenticated
  using (public.is_active_admin());


-- ============================================================
-- 5. mentoring_enquiries
-- TEACH enquiries.
-- ============================================================

create table if not exists public.mentoring_enquiries (
  id uuid primary key default gen_random_uuid(),

  locale text not null
    check (locale in ('en', 'pl')),

  audience text not null
    check (
      audience in (
        'starting-out',
        'university-technical-study',
        'career-changer',
        'other'
      )
    ),

  name text not null
    check (char_length(name) between 2 and 100),

  email text not null
    check (char_length(email) <= 254),

  topic text not null
    check (char_length(topic) between 2 and 200),

  current_level text not null
    check (
      current_level in (
        'complete-beginner',
        'some-experience',
        'intermediate',
        'advanced'
      )
    ),

  goal text not null
    check (char_length(goal) between 20 and 5000),

  is_minor boolean not null default false,

  -- Required whenever is_minor = true.
  -- This protects the rule at database level as well as
  -- through application-side validation.

  parent_guardian_name text,
  parent_guardian_email text,

  status text not null default 'new'
    check (
      status in (
        'new',
        'contacted',
        'scheduled',
        'closed'
      )
    ),

  created_at timestamptz not null default now(),

  constraint mentoring_minor_requires_guardian
    check (
      is_minor = false
      or (
        parent_guardian_name is not null
        and parent_guardian_email is not null
      )
    )
);

alter table public.mentoring_enquiries enable row level security;

create policy "mentoring_enquiries: admin select"
  on public.mentoring_enquiries
  for select
  to authenticated
  using (public.is_active_admin());


-- ============================================================
-- Indexes
-- Optimise the admin dashboard's most-recent-first queries.
-- ============================================================

create index if not exists project_leads_created_at_idx
  on public.project_leads (created_at desc);

create index if not exists marketing_enquiries_created_at_idx
  on public.marketing_enquiries (created_at desc);

create index if not exists mentoring_enquiries_created_at_idx
  on public.mentoring_enquiries (created_at desc);


-- ============================================================
-- Data API privileges
--
-- The project was created with:
-- "Automatically expose new tables" = OFF.
--
-- Therefore Data API privileges are granted explicitly.
--
-- These GRANT statements do NOT bypass RLS for authenticated
-- users. RLS policies above still decide which rows can be read.
-- ============================================================

-- Staff authentication/session checks.

grant select
  on table public.profiles
  to authenticated;

grant select
  on table public.user_roles
  to authenticated;


-- Lead tables.
--
-- Authenticated users receive SELECT at PostgreSQL privilege
-- level, but RLS restricts actual rows to active admins.

grant select
  on table public.project_leads
  to authenticated;

grant select
  on table public.marketing_enquiries
  to authenticated;

grant select
  on table public.mentoring_enquiries
  to authenticated;


-- ============================================================
-- Privileged server access
--
-- Used only by trusted server-side application code.
-- The corresponding secret must never be exposed to the browser.
-- ============================================================

grant all
  on table public.profiles
  to service_role;

grant all
  on table public.user_roles
  to service_role;

grant all
  on table public.project_leads
  to service_role;

grant all
  on table public.marketing_enquiries
  to service_role;

grant all
  on table public.mentoring_enquiries
  to service_role;