# Insights Subsystem — Database Design

Status: written before implementation, per master instruction §5.
Target: `supabase/migrations/003_insights_schema.sql` (additive, follows
the exact conventions of `001_initial.sql` / `002_lead_attribution.sql` —
see `docs/INSIGHTS_AUDIT.md` §1.2 for why those conventions are being
copied rather than reinvented).

Same caveat as the existing migrations carry: written and hand-checked,
**not run against a real Postgres/Supabase instance** in this sandbox (no
npm/network access). Review before applying to a real project.

---

## 1. Design principles carried from the existing schema

- RLS **enabled on every table**, no exceptions.
- Public reads go through an RLS policy that encodes "published only" in
  the policy itself (audit §4, "database / migrations" risk) — never
  relies on the application remembering to filter.
- Editor/admin writes go through the normal session-aware server client
  (editors are authenticated users, unlike anonymous lead submitters), so
  no privileged/service-role client is needed for CMS writes — only for
  the one case where the future Content Engine writes drafts without a
  human session (see §6).
- Role check reuses `public.is_active_admin()` for admin-only actions and
  adds one sibling helper, `public.is_active_editor_or_admin()`, since the
  brief requires an `editor` role distinct from `admin` (Decision 10) and
  the existing helper only checks for `'admin'`.
- `content_items` / `content_approvals` / `channel_connections` were noted
  in the prior round's status log as deliberately deferred "future-phase"
  tables. This schema does **not** create them — it creates the tables
  Checkpoint 2/3 actually need (`articles`, `categories`, `tags`,
  `article_tags`) and leaves approval-workflow and channel-connection
  tables for whichever checkpoint (7/8) actually needs their real shape,
  rather than guessing that shape now.

---

## 2. Tables

### 2.1 `categories`

```sql
create table if not exists public.insights_categories (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,                 -- stable machine key, e.g. "build" | "grow" | "learn"
  slug_en text not null unique,
  slug_pl text not null unique,
  name_en text not null,
  name_pl text not null,
  description_en text,
  description_pl text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
```

`key` matches the content-pillar model from the master instruction §9
(`BUILD` / `GROW` / `LEARN`, with `STUDIO` reserved for later) — a small,
curated set of pillars, not a free-form taxonomy. `slug_en`/`slug_pl` are
separate columns (not derived at request time) so a category's URL is
stable even if `name_en`/`name_pl` are edited later.

### 2.2 `tags`

```sql
create table if not exists public.insights_tags (
  id uuid primary key default gen_random_uuid(),
  slug_en text not null unique,
  slug_pl text not null unique,
  name_en text not null,
  name_pl text not null,
  created_at timestamptz not null default now()
);
```

Free-form, editor-created (unlike the fixed category set). No `key`
column — tags don't need a stable machine identifier the way pillars do.

### 2.3 `articles`

```sql
create table if not exists public.insights_articles (
  id uuid primary key default gen_random_uuid(),

  locale text not null check (locale in ('en', 'pl')),
  slug text not null,

  -- Pairs an EN article with its PL counterpart (and vice versa) so the
  -- language switch can resolve a real translation instead of always
  -- falling back to the hub (INSIGHTS_ARCHITECTURE.md §2). Nullable:
  -- an article may exist in only one language for a while.
  translation_of uuid references public.insights_articles (id) on delete set null,

  category_id uuid not null references public.insights_categories (id),

  title text not null check (char_length(title) between 3 and 200),
  excerpt text not null check (char_length(excerpt) between 20 and 400),
  cover_image_url text,
  cover_image_alt text,

  -- Ordered structured content blocks (INSIGHTS_ARCHITECTURE.md §4),
  -- validated by the Zod block schema before this column is ever written.
  body jsonb not null default '[]'::jsonb,

  reading_minutes int check (reading_minutes is null or reading_minutes > 0),

  -- Denormalized deliberately: `profiles` RLS only allows a "select own
  -- row" policy, so a public/anon query could never join
  -- profiles.display_name for an article page in the first place.
  -- author_id is kept for internal attribution; author_name is what
  -- every public page actually renders, set at save time in the CMS.
  author_id uuid references public.profiles (id),
  author_name text not null check (char_length(author_name) between 2 and 100),

  status text not null default 'draft'
    check (status in ('draft', 'in_review', 'scheduled', 'published', 'archived')),

  scheduled_at timestamptz,   -- required when status = 'scheduled'
  published_at timestamptz,   -- set on first transition into 'published', never cleared afterwards

  -- SEO fields kept separate from title/excerpt so an editor can tune
  -- the on-page title independently of the <title>/meta description,
  -- same separation buildPageMetadata() already assumes for static pages.
  seo_title text,
  seo_description text,

  -- Where this row came from — human CMS or the future Content Engine.
  -- Purely informational; never changes how the row is rendered or
  -- validated (INSIGHTS_ARCHITECTURE.md §7 — no special AI render path).
  source text not null default 'human' check (source in ('human', 'ai_assisted', 'ai_generated')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (locale, slug)
);

create index if not exists insights_articles_status_published_idx
  on public.insights_articles (status, published_at desc)
  where status = 'published';

create index if not exists insights_articles_category_idx
  on public.insights_articles (category_id);
```

Notes:
- `unique (locale, slug)` — a slug only has to be unique *within* a
  locale, since EN and PL slugs are naturally different strings anyway
  (e.g. `seo-strategy` vs `strategia-seo`); this also matches how
  `translation_of` pairs two independent rows rather than one row with
  two slugs.
- `status` has five states, not the three implied by "draft/scheduled/
  published" alone, because `in_review` is where Decision 10 (human
  approval required) actually happens for AI-assisted/AI-generated drafts,
  and `archived` is what content-refresh (Checkpoint 9) transitions stale
  articles to without deleting them.
- No separate "views" or "engagement" columns here — those are analytics
  events (§6 of the architecture doc), not article state. Keeping
  performance data out of the content table avoids write contention
  between "someone read an article" and "an editor is saving a draft".

### 2.4 `article_tags` (join table)

```sql
create table if not exists public.insights_article_tags (
  article_id uuid not null references public.insights_articles (id) on delete cascade,
  tag_id uuid not null references public.insights_tags (id) on delete cascade,
  primary key (article_id, tag_id)
);
```

---

## 3. Row Level Security

```sql
alter table public.insights_categories enable row level security;
alter table public.insights_tags enable row level security;
alter table public.insights_articles enable row level security;
alter table public.insights_article_tags enable row level security;

-- Categories & tags: public read (they're just taxonomy, not content),
-- admin/editor write.
create policy "insights_categories: public select"
  on public.insights_categories for select
  to anon, authenticated
  using (true);

create policy "insights_categories: editor write"
  on public.insights_categories for all
  to authenticated
  using (public.is_active_editor_or_admin())
  with check (public.is_active_editor_or_admin());

-- (same two policies, same shape, for insights_tags)

-- Articles: the important one. Public may only ever see published,
-- already-live rows - enforced in the policy itself, not the app layer.
create policy "insights_articles: public select published"
  on public.insights_articles for select
  to anon, authenticated
  using (status = 'published' and published_at is not null and published_at <= now());

create policy "insights_articles: editor select all"
  on public.insights_articles for select
  to authenticated
  using (public.is_active_editor_or_admin());

create policy "insights_articles: editor write"
  on public.insights_articles for insert
  to authenticated
  with check (public.is_active_editor_or_admin());

create policy "insights_articles: editor update"
  on public.insights_articles for update
  to authenticated
  using (public.is_active_editor_or_admin())
  with check (public.is_active_editor_or_admin());

-- Deliberately no delete policy for anyone via the normal client -
-- archiving (status = 'archived') is how content is retired; hard delete,
-- if ever needed, goes through the privileged client from an explicit
-- admin action, matching how destructive operations already stay off the
-- RLS-governed path elsewhere in this app.

create policy "insights_article_tags: public select"
  on public.insights_article_tags for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.insights_articles a
      where a.id = article_id
        and a.status = 'published'
        and a.published_at <= now()
    )
  );

create policy "insights_article_tags: editor write"
  on public.insights_article_tags for all
  to authenticated
  using (public.is_active_editor_or_admin())
  with check (public.is_active_editor_or_admin());
```

### New role helper

```sql
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
    join public.profiles p on p.id = ur.user_id
    where ur.user_id = auth.uid()
      and ur.role in ('admin', 'editor')
      and p.active = true
  );
$$;

revoke all on function public.is_active_editor_or_admin() from public;
grant execute on function public.is_active_editor_or_admin() to authenticated;
```

Mirrors `is_active_admin()` exactly (same `SECURITY DEFINER` /
`search_path` / active-account requirement), just widened to accept
either role — consistent with the audit's finding that `editor` already
exists in the `user_roles` check constraint but nothing uses it yet.

---

## 4. `updated_at` maintenance

```sql
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger insights_articles_set_updated_at
  before update on public.insights_articles
  for each row
  execute function public.set_updated_at();
```

---

## 5. Query surface (`src/features/insights/data/`)

Thin, purpose-named functions — never raw `.from(...)` calls scattered
across page components, matching how `src/features/leads/service.ts`
centralizes the lead-write logic behind names instead of inline queries:

```text
getPublishedArticleBySlug(locale, slug)
listPublishedArticles(locale, { category?, tag?, page, pageSize })
listFeaturedArticles(locale, limit)
listCategories(locale)
listTagsForArticle(articleId)
getArticleTranslation(articleId)       -- resolves translation_of both directions
```

Public pages call only these. CMS admin pages get a parallel, explicitly
separate set (`listAllArticlesForAdmin`, `createArticle`, `updateArticle`,
`transitionArticleStatus`) that use the session-aware client and are
never imported from anything under `src/app/insights/**` — keeping the
"public reads never need elevated access" property visible in the import
graph itself, not just in the RLS policy.

---

## 6. Where the future Content Engine writes

When Checkpoint 7 starts, AI-generated drafts are inserted with
`status = 'in_review'`, `source = 'ai_generated'` (or `'ai_assisted'` for
human-drafted-AI-edited content), via the **same** `createArticle`
function and Zod block schema an editor's CMS form uses — not a separate
write path. Whether that insert is authenticated as a service account
with the `editor` role, or proxied through an admin's session, is a
decision for that checkpoint (it depends on how the engine is deployed —
as a Next.js API route vs. an external worker), and is deliberately left
open here rather than guessed.

---

## 7. What's explicitly not modeled yet

- Revision history / version diffing — real CMS need, but not required
  for Checkpoint 3's "create, edit, preview, schedule, publish, archive"
  list. Adding an `article_revisions` table before an editor UI exists to
  populate it would be schema speculation; add it when Checkpoint 3 build
  work reaches the point of actually needing undo/diff.
- Search indexing (`tsvector`/full-text) — Checkpoint 4. Adding a
  generated `tsvector` column now, before the search UI and query
  patterns are designed, risks getting the indexed field weights wrong
  and having to redo it.
- Engagement/analytics rollups on articles — deliberately kept in the
  existing analytics pipeline (events → GA4 / first-party sink), not
  duplicated as columns here (see §2.3 note).
