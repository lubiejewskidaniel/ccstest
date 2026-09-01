-- Code Consulting Studio — lead attribution
--
-- Stores basic traffic attribution data with each enquiry.
-- This lets us understand where a lead came from, for example
-- Google, social media, a campaign or another website.


-- ============================================================
-- Project enquiries
-- ============================================================

alter table public.project_leads
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists utm_content text,
  add column if not exists utm_term text,
  add column if not exists referrer text,
  add column if not exists landing_page text;


-- ============================================================
-- Marketing enquiries
-- ============================================================

alter table public.marketing_enquiries
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists utm_content text,
  add column if not exists utm_term text,
  add column if not exists referrer text,
  add column if not exists landing_page text;


-- ============================================================
-- Mentoring enquiries
-- ============================================================

alter table public.mentoring_enquiries
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists utm_content text,
  add column if not exists utm_term text,
  add column if not exists referrer text,
  add column if not exists landing_page text;


-- ============================================================
-- Attribution indexes
-- ============================================================
--
-- utm_source is the main field used when comparing where leads
-- come from, so indexing it keeps simple attribution reports fast.

create index if not exists project_leads_utm_source_idx
  on public.project_leads (utm_source);

create index if not exists marketing_enquiries_utm_source_idx
  on public.marketing_enquiries (utm_source);

create index if not exists mentoring_enquiries_utm_source_idx
  on public.mentoring_enquiries (utm_source);