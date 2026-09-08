-- Code Consulting Studio — Article visual approval (Phase 3C.4B.4A)
--
-- Lets an editor approve one stored article_visuals candidate as the
-- article's live cover. This is the only place cover_image_status is
-- ever allowed to become "approved" — the manual coverImageUrl/
-- coverImageAlt fields on the ordinary CMS save path never touch this
-- column (see src/features/insights/cms/service.ts's toRow()), so the
-- legacy fields cannot bypass this review step.
--
-- The whole operation runs inside a single PL/pgSQL function so that
-- superseding the previous approved candidate, approving the selected
-- one and updating the article's live cover fields either all succeed
-- or all fail together — this is not three separate application-level
-- writes.

create or replace function public.approve_article_visual(
  p_article_id uuid,
  p_visual_id uuid,
  p_alt_text text,
  p_public_url text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_article_cover_status text;
  v_article_cover_url text;
  v_article_cover_alt text;
  v_visual_article_id uuid;
  v_visual_status text;
  v_alt_text text;
begin
  if not public.is_active_editor_or_admin() then
    raise exception 'CCS_NOT_AUTHORISED';
  end if;

  v_alt_text := btrim(coalesce(p_alt_text, ''));
  if v_alt_text = '' then
    raise exception 'CCS_ALT_TEXT_REQUIRED';
  end if;

  -- Lock the article row for the rest of this transaction. Two
  -- concurrent approval requests for the same article (whether for the
  -- same candidate or two different ones) are serialised through this
  -- lock, so the second request always sees the first request's
  -- fully-committed result before deciding what to do — the partial
  -- unique index on article_visuals(article_id) where status =
  -- 'approved' remains the final backstop, but the two never actually
  -- race to violate it.
  select cover_image_status, cover_image_url, cover_image_alt
    into v_article_cover_status, v_article_cover_url, v_article_cover_alt
  from public.insights_articles
  where id = p_article_id
  for update;

  if not found then
    raise exception 'CCS_ARTICLE_NOT_FOUND';
  end if;

  select article_id, status into v_visual_article_id, v_visual_status
  from public.article_visuals
  where id = p_visual_id
  for update;

  if not found then
    raise exception 'CCS_VISUAL_NOT_FOUND';
  end if;

  if v_visual_article_id <> p_article_id then
    raise exception 'CCS_VISUAL_WRONG_ARTICLE';
  end if;

  if v_visual_status = 'superseded' then
    raise exception 'CCS_VISUAL_NOT_APPROVABLE';
  end if;

  -- Idempotent no-op: repeating an approval request for the candidate
  -- that is already the article's live, consistently-approved cover is
  -- treated as a harmless success rather than an error — an editor
  -- double-clicking approve, or a retried request, should not fail.
  -- "Consistently-approved" means the candidate's own status, the
  -- article's cover_image_status AND the article's cover_image_url/alt
  -- all already agree with this exact candidate — proving only that
  -- both statuses say "approved" is not enough, since the article could
  -- still be pointing at a different approved visual (which should
  -- never happen given the unique index, but is not something to trust
  -- blindly). Any mismatch on any of the four conditions falls through
  -- and is reconciled by the ordinary approval writes below instead of
  -- being treated as done.
  if
    v_visual_status = 'approved'
    and v_article_cover_status = 'approved'
    and v_article_cover_url = p_public_url
    and v_article_cover_alt = v_alt_text
  then
    return;
  end if;

  -- Supersede the article's current approved candidate, if there is
  -- one and it is not the candidate being approved. Other pending
  -- candidates are left untouched — an editor may still want to review
  -- them later.
  update public.article_visuals
  set status = 'superseded'
  where article_id = p_article_id
    and status = 'approved'
    and id <> p_visual_id;

  update public.article_visuals
  set
    status = 'approved',
    alt_text = v_alt_text,
    reviewed_at = now(),
    reviewed_by = auth.uid()
  where id = p_visual_id;

  update public.insights_articles
  set
    cover_image_url = p_public_url,
    cover_image_alt = v_alt_text,
    cover_image_status = 'approved'
  where id = p_article_id;
end;
$$;

revoke all
  on function public.approve_article_visual(uuid, uuid, text, text)
  from public;

grant execute
  on function public.approve_article_visual(uuid, uuid, text, text)
  to authenticated;

grant execute
  on function public.approve_article_visual(uuid, uuid, text, text)
  to service_role;
