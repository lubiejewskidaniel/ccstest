-- Code Consulting Studio — Article visual candidates (Phase 3C.4B.3A)
--
-- Stores every generated or uploaded visual CANDIDATE for an article --
-- pending/approved/superseded history -- separately from
-- insights_articles.cover_image_url/cover_image_alt/cover_image_status,
-- which remains the single source of truth for the article's currently
-- ACTIVE, approved cover (Phase 3C.4A, unchanged by this migration). A
-- future approval step copies one row's storage_path (resolved to a
-- public URL) and alt_text into insights_articles -- this table is
-- never the public read path for a live article's cover image, and
-- this migration does not implement that approval step, does not touch
-- insights_articles, and does not create a storage bucket.
--
-- Lifecycle (enforced by future application code, not this migration):
--   missing -> pending_review happens once, when the first-ever
--   candidate for an article is created. An already-"approved" article
--   cover is never implicitly downgraded just because a new replacement
--   candidate row is inserted here -- the live cover stays authoritative
--   until an explicit future approval action re-points it. This
--   migration only stores candidates; it does not encode that rule.

create table if not exists public.article_visuals (
  id uuid primary key default gen_random_uuid(),

  article_id uuid not null
    references public.insights_articles (id)
    on delete cascade,

  storage_path text not null,

  alt_text text,

  source_type text not null
    check (source_type in ('generated', 'uploaded')),

  provider text,

  status text not null default 'pending_review'
    check (
      status in (
        'pending_review',
        'approved',
        'superseded'
      )
    ),

  width int not null check (width > 0),
  height int not null check (height > 0),
  mime_type text not null,

  reviewed_at timestamptz,
  reviewed_by uuid
    references public.profiles (id),

  created_at timestamptz not null default now()
);

create index if not exists article_visuals_article_id_idx
  on public.article_visuals (article_id);

create index if not exists article_visuals_article_status_idx
  on public.article_visuals (article_id, status);

-- Database-level guarantee (not just an application-level convention):
-- an article can never have more than one approved article_visuals row
-- at a time.
create unique index if not exists article_visuals_one_approved_per_article_idx
  on public.article_visuals (article_id)
  where status = 'approved';

alter table public.article_visuals
  enable row level security;

create policy "article_visuals: editor select"
  on public.article_visuals
  for select
  to authenticated
  using (public.is_active_editor_or_admin());

create policy "article_visuals: editor insert"
  on public.article_visuals
  for insert
  to authenticated
  with check (public.is_active_editor_or_admin());

create policy "article_visuals: editor update"
  on public.article_visuals
  for update
  to authenticated
  using (public.is_active_editor_or_admin())
  with check (public.is_active_editor_or_admin());

-- No delete policy: candidate history is retained; rows are only ever
-- superseded via a status update, never removed by application code.

grant select, insert, update
  on table public.article_visuals
  to authenticated;

grant all
  on table public.article_visuals
  to service_role;
