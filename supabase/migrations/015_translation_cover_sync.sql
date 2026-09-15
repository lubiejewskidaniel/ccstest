-- Code Consulting Studio - Article Visual translation cover sync (Phase 1)
--
-- EN and PL translations of the same article share one physical
-- approved Article Visual. article_visuals stays single owner exactly
-- as before (migration 011) - no mirrored candidate rows, no duplicate
-- Storage objects. Sharing is implemented purely as propagation of
-- cover_image_url/cover_image_alt/cover_image_status between the two
-- linked insights_articles rows.

-- Resolves the one unambiguous linked translation for an article.
-- Considers the complete relationship around p_article_id before
-- returning anything, not just the forward direction: the candidate set
-- is this article's own translation_of (if set) together with every
-- other row whose translation_of points back at this article. Only
-- when that combined set names exactly one distinct article is a link
-- returned. A reciprocal pair (A.translation_of = B and
-- B.translation_of = A) names the same single article from both
-- directions, so it resolves the same as either direction alone -
-- nothing in the existing translation_of model forbids this shape, and
-- it identifies one unambiguous pair. Any other combination naming more
-- than one distinct article returns null - an ambiguous relationship is
-- never guessed at, and MIN(id) is only read once that uniqueness has
-- already been proven by the distinct count below, never used to pick
-- between real candidates.
create or replace function public.find_linked_translation_id(p_article_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_forward uuid;
  v_candidate_count int;
  v_candidate_id uuid;
begin
  select translation_of into v_forward
  from public.insights_articles
  where id = p_article_id;

  select count(distinct candidate_id), min(candidate_id)
    into v_candidate_count, v_candidate_id
  from (
    select v_forward as candidate_id
    where v_forward is not null

    union

    select id as candidate_id
    from public.insights_articles
    where translation_of = p_article_id
  ) as candidates;

  if v_candidate_count = 1 then
    return v_candidate_id;
  end if;

  return null;
end;
$$;

revoke all
  on function public.find_linked_translation_id(uuid)
  from public;

grant execute
  on function public.find_linked_translation_id(uuid)
  to authenticated;

grant execute
  on function public.find_linked_translation_id(uuid)
  to service_role;


-- Keeps a linked translation's cover fields in step with the article
-- passed in. Locks both rows (in id order, so two concurrent calls for
-- the same pair can never deadlock) before reading or writing either.
--
-- Two distinct forms of ambiguity, handled differently:
--
--   1. Which article is the linked translation - resolved once by
--      find_linked_translation_id above. More than one candidate means
--      null is returned and this function does nothing. Never guessed.
--
--   2. Which side's cover should win when both already show a valid
--      approved cover - resolved by p_source_is_authoritative below.
--
-- p_source_is_authoritative distinguishes the two callers:
--
--   true  - called right after this article's own cover was just
--           approved (approve_article_visual below). A newly approved
--           visual is authoritative: it always wins and is copied onto
--           the translation, unless the translation owns a real
--           approved article_visuals row of its own - that row is
--           independent review history and is never overwritten by
--           another locale's approval. The translation's own current
--           cover value is not otherwise a reason to skip - this is
--           also how a replacement approval reaches an already-synced
--           translation.
--
--   false - called after a translation link was newly created or
--           changed, with no way to know which side (if either) is the
--           "real" cover. Fails safe: if both sides already show a
--           valid approved cover, nothing is written to either row.
--           Only fills a genuine gap on one side.
--
-- Safe to call with either article's id, when there is no link at all,
-- or repeatedly (a no-op once both sides already agree).
create or replace function public.sync_linked_translation_cover(
  p_article_id uuid,
  p_source_is_authoritative boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_translation_id uuid;
  v_a_status text;
  v_a_url text;
  v_a_alt text;
  v_b_status text;
  v_b_url text;
  v_b_alt text;
  v_a_valid boolean;
  v_b_valid boolean;
  v_b_owns boolean;
  r record;
begin
  v_translation_id := public.find_linked_translation_id(p_article_id);
  if v_translation_id is null then
    return;
  end if;

  for r in
    select id, cover_image_status, cover_image_url, cover_image_alt
    from public.insights_articles
    where id in (p_article_id, v_translation_id)
    order by id
    for update
  loop
    if r.id = p_article_id then
      v_a_status := r.cover_image_status;
      v_a_url := r.cover_image_url;
      v_a_alt := r.cover_image_alt;
    else
      v_b_status := r.cover_image_status;
      v_b_url := r.cover_image_url;
      v_b_alt := r.cover_image_alt;
    end if;
  end loop;

  v_a_valid := v_a_status = 'approved' and coalesce(btrim(v_a_url), '') <> '';
  v_b_valid := v_b_status = 'approved' and coalesce(btrim(v_b_url), '') <> '';

  if p_source_is_authoritative then
    select exists (
      select 1 from public.article_visuals
      where article_id = v_translation_id and status = 'approved'
    ) into v_b_owns;

    if v_a_valid and not v_b_owns then
      update public.insights_articles
      set cover_image_url = v_a_url, cover_image_alt = v_a_alt, cover_image_status = 'approved'
      where id = v_translation_id;
    end if;

    return;
  end if;

  -- Direction unknown. Only fill a genuine gap on one side.
  if v_a_valid and v_b_valid then
    return;
  end if;

  if v_a_valid then
    update public.insights_articles
    set cover_image_url = v_a_url, cover_image_alt = v_a_alt, cover_image_status = 'approved'
    where id = v_translation_id;
    return;
  end if;

  if v_b_valid then
    update public.insights_articles
    set cover_image_url = v_b_url, cover_image_alt = v_b_alt, cover_image_status = 'approved'
    where id = p_article_id;
    return;
  end if;
end;
$$;

revoke all
  on function public.sync_linked_translation_cover(uuid, boolean)
  from public;

grant execute
  on function public.sync_linked_translation_cover(uuid, boolean)
  to authenticated;

grant execute
  on function public.sync_linked_translation_cover(uuid, boolean)
  to service_role;


-- approve_article_visual now also keeps a linked translation in sync,
-- inside the same transaction, so an approval and its propagation to
-- the translation always succeed or fail together. Everything above
-- the added perform call is unchanged from migration 012.
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

  if
    v_visual_status = 'approved'
    and v_article_cover_status = 'approved'
    and v_article_cover_url = p_public_url
    and v_article_cover_alt = v_alt_text
  then
    return;
  end if;

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

  perform public.sync_linked_translation_cover(p_article_id, true);
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
