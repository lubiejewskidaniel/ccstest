-- Code Consulting Studio — Article visual publication gate (Phase 3C.4A)
--
-- Establishes the gate-facing state for the "every published article
-- must have its own reviewed, approved cover visual" invariant. This
-- migration adds ONLY the column the publication gate itself checks --
-- it deliberately does NOT create an article_visuals asset-history
-- table, does NOT touch ai_usage_log, and does NOT add any storage
-- bucket. Those are later sub-phases (3C.4B+); this one only makes the
-- invariant enforceable.
--
-- cover_image_status is a small, independent state column alongside the
-- existing cover_image_url/cover_image_alt (both already present since
-- 003_insights_schema.sql, both left completely unchanged here) --
-- three columns the publish-time gate reads together, never any one of
-- them alone (a URL or alt text existing does not by itself mean a
-- human has approved the image for publication).
--
-- Defaults to 'missing' for every row, including every existing
-- article -- this migration does not backfill or guess approval for
-- content that already exists, and does not change the status of any
-- existing row. An already-published article keeps publishing exactly
-- as it is; the new gate only evaluates on a *future* transition into
-- "published" (enforced in application code, not by this migration).

alter table public.insights_articles
  add column if not exists cover_image_status text not null default 'missing'
    check (
      cover_image_status in (
        'missing',
        'pending_review',
        'approved'
      )
    );
