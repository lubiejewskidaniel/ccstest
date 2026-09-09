-- Code Consulting Studio — Article visual candidate deletion (Phase 3C.4B.7A)
--
-- Migration 011 deliberately created no DELETE policy on
-- public.article_visuals: candidate history was retained, and rows were
-- only ever superseded via a status update, never removed by
-- application code. This phase introduces real, editor-triggered
-- deletion of unused candidates (pending_review or superseded only —
-- an approved candidate is the article's live cover and is never
-- deletable in this phase, enforced independently in application code
-- at src/features/content-intelligence/visuals/articleVisualDeletionService.ts).
--
-- This is the smallest possible policy/grant addition: one DELETE
-- policy, mirroring the existing "editor select/insert/update" policies
-- exactly (same public.is_active_editor_or_admin() gate, same
-- `authenticated` role — never anonymous), plus the matching DELETE
-- grant. Nothing else about this table changes: SELECT/INSERT/UPDATE
-- policies, the check constraints, and the partial unique index
-- guaranteeing at most one approved candidate per article
-- (article_visuals_one_approved_per_article_idx) are all left exactly
-- as migration 011 defined them.

create policy "article_visuals: editor delete"
  on public.article_visuals
  for delete
  to authenticated
  using (public.is_active_editor_or_admin());

grant delete
  on table public.article_visuals
  to authenticated;
