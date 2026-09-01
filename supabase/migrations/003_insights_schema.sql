-- Code Consulting Studio — Insights foundation
--
-- Creates the database foundation for the bilingual Insights/blog system:
-- categories, tags, articles, translations and article-tag relationships.
--
-- Public visitors can only read content that is already published.
-- Editors and admins can manage content through the authenticated CMS.


-- ============================================================
-- 1. Editor / admin access helper
-- ============================================================
--
-- Checks whether the currently authenticated user has an active
-- editor or admin account.
--
-- SECURITY DEFINER allows this function to read profiles and
-- user_roles without being blocked by their own RLS policies.

create or replace function public.is_active_editor_or_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.profiles p
      on p.id = ur.user_id
    where ur.user_id = auth.uid()
      and ur.role in ('admin', 'editor')
      and p.active = true
  );
$$;

revoke all
  on function public.is_active_editor_or_admin()
  from public;

grant execute
  on function public.is_active_editor_or_admin()
  to authenticated;

grant execute
  on function public.is_active_editor_or_admin()
  to service_role;


-- ============================================================
-- 2. updated_at helper
-- ============================================================
--
-- Reusable trigger function that keeps updated_at current
-- whenever a row is changed.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ============================================================
-- 3. Insights categories
-- ============================================================
--
-- Fixed content pillars used by the Insights section.
-- Categories are publicly readable but only editors/admins
-- can create or change them.

create table if not exists public.insights_categories (
  id uuid primary key default gen_random_uuid(),

  key text not null unique
    check (
      key in (
        'build',
        'grow',
        'learn',
        'studio'
      )
    ),

  slug_en text not null unique,
  slug_pl text not null unique,

  name_en text not null,
  name_pl text not null,

  description_en text,
  description_pl text,

  sort_order int not null default 0,

  created_at timestamptz not null default now()
);

alter table public.insights_categories
  enable row level security;


-- Everyone can read categories.

create policy "insights_categories: public select"
  on public.insights_categories
  for select
  to anon, authenticated
  using (true);


-- Only active editors/admins can manage categories.

create policy "insights_categories: editor write"
  on public.insights_categories
  for all
  to authenticated
  using (public.is_active_editor_or_admin())
  with check (public.is_active_editor_or_admin());


-- ============================================================
-- 4. Insights tags
-- ============================================================
--
-- Tags are managed through the CMS and can be used by both
-- English and Polish versions of the site.

create table if not exists public.insights_tags (
  id uuid primary key default gen_random_uuid(),

  slug_en text not null unique,
  slug_pl text not null unique,

  name_en text not null,
  name_pl text not null,

  created_at timestamptz not null default now()
);

alter table public.insights_tags
  enable row level security;


-- Tags are safe to expose publicly.

create policy "insights_tags: public select"
  on public.insights_tags
  for select
  to anon, authenticated
  using (true);


-- Only active editors/admins can manage tags.

create policy "insights_tags: editor write"
  on public.insights_tags
  for all
  to authenticated
  using (public.is_active_editor_or_admin())
  with check (public.is_active_editor_or_admin());


-- ============================================================
-- 5. Insights articles
-- ============================================================
--
-- Stores both English and Polish articles.
--
-- translation_of links one language version to its counterpart.
-- It remains nullable because an article may exist in one
-- language before its translation is created.

create table if not exists public.insights_articles (
  id uuid primary key default gen_random_uuid(),

  locale text not null
    check (locale in ('en', 'pl')),

  slug text not null,

  translation_of uuid
    references public.insights_articles (id)
    on delete set null,

  category_id uuid not null
    references public.insights_categories (id),

  title text not null
    check (char_length(title) between 3 and 200),

  excerpt text not null
    check (char_length(excerpt) between 20 and 400),

  cover_image_url text,
  cover_image_alt text,

  -- Article content is stored as structured JSON blocks.
  -- The application validates the block structure before saving.

  body jsonb not null default '[]'::jsonb,

  reading_minutes int
    check (
      reading_minutes is null
      or reading_minutes > 0
    ),

  -- author_id keeps the internal relationship with the staff profile.
  -- author_name is stored separately because public visitors do not
  -- receive direct access to staff profiles.

  author_id uuid
    references public.profiles (id),

  author_name text not null
    check (char_length(author_name) between 2 and 100),

  status text not null default 'draft'
    check (
      status in (
        'draft',
        'in_review',
        'scheduled',
        'published',
        'archived'
      )
    ),

  scheduled_at timestamptz,
  published_at timestamptz,

  seo_title text,
  seo_description text,

  source text not null default 'human'
    check (
      source in (
        'human',
        'ai_assisted',
        'ai_generated'
      )
    ),

  featured boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (locale, slug)
);


-- ============================================================
-- Article indexes
-- ============================================================

create index if not exists insights_articles_status_published_idx
  on public.insights_articles (
    status,
    published_at desc
  )
  where status = 'published';

create index if not exists insights_articles_category_idx
  on public.insights_articles (category_id);

create index if not exists insights_articles_locale_idx
  on public.insights_articles (locale);


-- ============================================================
-- updated_at trigger
-- ============================================================
--
-- Dropping the trigger first keeps this migration safe to rerun
-- during development without creating a duplicate trigger.

drop trigger if exists insights_articles_set_updated_at
  on public.insights_articles;

create trigger insights_articles_set_updated_at
  before update
  on public.insights_articles
  for each row
  execute function public.set_updated_at();


-- ============================================================
-- Article RLS
-- ============================================================

alter table public.insights_articles
  enable row level security;


-- Public visitors can only see articles that are already live.
--
-- This rule lives in the database as well as the application,
-- so drafts or scheduled future articles cannot accidentally
-- become public because of a missing application-side filter.

create policy "insights_articles: public select published"
  on public.insights_articles
  for select
  to anon, authenticated
  using (
    status = 'published'
    and published_at is not null
    and published_at <= now()
  );


-- Active editors/admins can see every article in the CMS.

create policy "insights_articles: editor select all"
  on public.insights_articles
  for select
  to authenticated
  using (public.is_active_editor_or_admin());


-- Active editors/admins can create articles.

create policy "insights_articles: editor insert"
  on public.insights_articles
  for insert
  to authenticated
  with check (public.is_active_editor_or_admin());


-- Active editors/admins can update articles.

create policy "insights_articles: editor update"
  on public.insights_articles
  for update
  to authenticated
  using (public.is_active_editor_or_admin())
  with check (public.is_active_editor_or_admin());


-- There is intentionally no normal DELETE policy.
-- Articles are retired by changing their status to archived.


-- ============================================================
-- 6. Article-tag relationships
-- ============================================================

create table if not exists public.insights_article_tags (
  article_id uuid not null
    references public.insights_articles (id)
    on delete cascade,

  tag_id uuid not null
    references public.insights_tags (id)
    on delete cascade,

  primary key (article_id, tag_id)
);

alter table public.insights_article_tags
  enable row level security;


-- Public users can only see tag relationships belonging to
-- articles that are already published.

create policy "insights_article_tags: public select"
  on public.insights_article_tags
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.insights_articles a
      where a.id = article_id
        and a.status = 'published'
        and a.published_at is not null
        and a.published_at <= now()
    )
  );


-- Editors/admins can manage article-tag relationships.

create policy "insights_article_tags: editor write"
  on public.insights_article_tags
  for all
  to authenticated
  using (public.is_active_editor_or_admin())
  with check (public.is_active_editor_or_admin());


-- ============================================================
-- 7. Data API privileges
-- ============================================================
--
-- This Supabase project was created with automatic table
-- exposure disabled, so API privileges are granted explicitly.
--
-- GRANT gives the role access to the table through PostgreSQL.
-- RLS still decides which rows that role is actually allowed
-- to read or change.


-- ------------------------------------------------------------
-- Categories
-- ------------------------------------------------------------

grant select
  on table public.insights_categories
  to anon;

grant select, insert, update, delete
  on table public.insights_categories
  to authenticated;

grant all
  on table public.insights_categories
  to service_role;


-- ------------------------------------------------------------
-- Tags
-- ------------------------------------------------------------

grant select
  on table public.insights_tags
  to anon;

grant select, insert, update, delete
  on table public.insights_tags
  to authenticated;

grant all
  on table public.insights_tags
  to service_role;


-- ------------------------------------------------------------
-- Articles
-- ------------------------------------------------------------

grant select
  on table public.insights_articles
  to anon;

grant select, insert, update
  on table public.insights_articles
  to authenticated;

grant all
  on table public.insights_articles
  to service_role;


-- ------------------------------------------------------------
-- Article-tag relationships
-- ------------------------------------------------------------

grant select
  on table public.insights_article_tags
  to anon;

grant select, insert, update, delete
  on table public.insights_article_tags
  to authenticated;

grant all
  on table public.insights_article_tags
  to service_role;


-- ============================================================
-- 8. Initial content categories
-- ============================================================
--
-- Only real content pillars are seeded here.
-- Articles themselves are created through the CMS.

insert into public.insights_categories (
  key,
  slug_en,
  slug_pl,
  name_en,
  name_pl,
  description_en,
  description_pl,
  sort_order
)
values
  (
    'build',
    'build',
    'build',
    'Build',
    'Build',
    'Engineering practice, architecture and shipping software.',
    'Praktyka inżynierska, architektura i wdrażanie oprogramowania.',
    1
  ),

  (
    'grow',
    'grow',
    'grow',
    'Grow',
    'Grow',
    'Marketing, SEO and growth for service businesses.',
    'Marketing, SEO i growth dla firm usługowych.',
    2
  ),

  (
    'learn',
    'learn',
    'nauka',
    'Learn',
    'Nauka',
    'Mentoring notes and lessons for people learning to build.',
    'Notatki z mentoringu i lekcje dla osób uczących się budować.',
    3
  )

on conflict (key) do nothing;