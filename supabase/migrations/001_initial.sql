-- Code Consulting Studio — initial schema
-- Doc 08 "Data Model, Supabase, Authentication & Security" v4 — MVP entities
-- (profiles, user_roles, project_leads, marketing_enquiries,
-- mentoring_enquiries). content_items / content_approvals /
-- channel_connections are FUTURE-phase (doc 08 §1) and deliberately not
-- created here — add them in a later migration when that phase starts.
--
-- Unverified against a real Supabase instance in this sandbox (no network
-- access to run `supabase db push` / `psql`) — review before applying to a
-- real project, especially the RLS policies.

-- ============================================================
-- 1. profiles — one row per authenticated staff member (doc 08 §1)
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- A signed-in user may read (and only read) their own profile — this is
-- what the admin auth check (`getAdminSession`) relies on to confirm the
-- "active account" half of SEC-006.
create policy "profiles: self select"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

-- No insert/update/delete policy for regular users: profile rows are
-- provisioned by an operator directly (e.g. via the Supabase dashboard or
-- a service-role script) rather than self-service sign-up, since this is a
-- staff/admin table, not a public account system.

-- ============================================================
-- 2. user_roles — role assignment (doc 08 §1: admin/editor/mentor)
-- ============================================================
create table if not exists public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('admin', 'editor', 'mentor')),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

alter table public.user_roles enable row level security;

create policy "user_roles: self select"
  on public.user_roles for select
  to authenticated
  using (user_id = auth.uid());

-- ============================================================
-- Helper: is_active_admin() — SECURITY DEFINER so it can read profiles /
-- user_roles without being blocked by their own RLS policies above, and
-- without the recursive-policy problem of referencing those tables
-- directly inside another table's policy. Used by the lead-table SELECT
-- policies below so an authenticated admin (doc 15 "authenticated admin
-- area") can read enquiries via the normal session-aware client, while
-- everyone else is denied (doc 08 SEC-002).
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
grant execute on function public.is_active_admin() to authenticated;

-- ============================================================
-- 3. project_leads — BUILD enquiries
-- ============================================================
create table if not exists public.project_leads (
  id uuid primary key default gen_random_uuid(),
  locale text not null check (locale in ('en', 'pl')),
  name text not null check (char_length(name) between 2 and 100),
  email text not null check (char_length(email) <= 254),
  company text check (company is null or char_length(company) <= 160),
  stage text not null check (stage in ('idea', 'in-progress', 'existing-product', 'not-sure')),
  capability text not null check (
    capability in ('software-development', 'product-development', 'technology-consulting', 'web-digital', 'not-sure')
  ),
  budget_range text check (
    budget_range is null or budget_range in ('under-5k', '5k-15k', '15k-50k', '50k-plus', 'not-sure')
  ),
  message text not null check (char_length(message) between 20 and 5000),
  status text not null default 'new' check (status in ('new', 'contacted', 'qualified', 'closed')),
  created_at timestamptz not null default now()
);

alter table public.project_leads enable row level security;

create policy "project_leads: admin select"
  on public.project_leads for select
  to authenticated
  using (public.is_active_admin());

-- Deliberately no insert/update/delete policy for anon/authenticated:
-- public submissions go through the Server Action using the service-role
-- client (`createSupabasePrivilegedClient`), which bypasses RLS entirely —
-- see doc 08 SEC-002/SEC-003 ("anonymous clients SHALL NOT have direct
-- SELECT access"; "public lead submission SHALL pass through a trusted
-- server boundary").

-- ============================================================
-- 4. marketing_enquiries — GROW enquiries
-- ============================================================
create table if not exists public.marketing_enquiries (
  id uuid primary key default gen_random_uuid(),
  locale text not null check (locale in ('en', 'pl')),
  name text not null check (char_length(name) between 2 and 100),
  email text not null check (char_length(email) <= 254),
  company text check (company is null or char_length(company) <= 160),
  services text[] not null check (array_length(services, 1) >= 1),
  engagement_type text not null check (engagement_type in ('one-off', 'managed-recurring', 'not-sure')),
  current_presence text check (current_presence is null or current_presence in ('none', 'some', 'established')),
  message text not null check (char_length(message) between 20 and 5000),
  status text not null default 'new' check (status in ('new', 'contacted', 'qualified', 'closed')),
  created_at timestamptz not null default now()
);

alter table public.marketing_enquiries enable row level security;

create policy "marketing_enquiries: admin select"
  on public.marketing_enquiries for select
  to authenticated
  using (public.is_active_admin());

-- ============================================================
-- 5. mentoring_enquiries — TEACH enquiries
-- ============================================================
create table if not exists public.mentoring_enquiries (
  id uuid primary key default gen_random_uuid(),
  locale text not null check (locale in ('en', 'pl')),
  audience text not null check (
    audience in ('starting-out', 'university-technical-study', 'career-changer', 'other')
  ),
  name text not null check (char_length(name) between 2 and 100),
  email text not null check (char_length(email) <= 254),
  topic text not null check (char_length(topic) between 2 and 200),
  current_level text not null check (
    current_level in ('complete-beginner', 'some-experience', 'intermediate', 'advanced')
  ),
  goal text not null check (char_length(goal) between 20 and 5000),
  is_minor boolean not null default false,
  -- required by the app-level Zod schema whenever is_minor = true (doc 12
  -- PRIV-008); enforced again here so a direct DB write can't skip it.
  parent_guardian_name text,
  parent_guardian_email text,
  status text not null default 'new' check (status in ('new', 'contacted', 'scheduled', 'closed')),
  created_at timestamptz not null default now(),
  constraint mentoring_minor_requires_guardian check (
    is_minor = false or (parent_guardian_name is not null and parent_guardian_email is not null)
  )
);

alter table public.mentoring_enquiries enable row level security;

create policy "mentoring_enquiries: admin select"
  on public.mentoring_enquiries for select
  to authenticated
  using (public.is_active_admin());

-- ============================================================
-- Indexes for the admin dashboard's "most recent" queries
-- ============================================================
create index if not exists project_leads_created_at_idx on public.project_leads (created_at desc);
create index if not exists marketing_enquiries_created_at_idx on public.marketing_enquiries (created_at desc);
create index if not exists mentoring_enquiries_created_at_idx on public.mentoring_enquiries (created_at desc);
