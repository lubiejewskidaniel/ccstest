-- Code Consulting Studio — lead attribution columns
-- CRO/SEO/AEO/Analytics/Martech brief §8 "the database should support...
-- utm_source, utm_medium, utm_campaign, utm_content, utm_term, referrer,
-- landing_page" and §9 "attribution information should be associated with
-- the lead."
--
-- Unverified against a real Supabase instance in this sandbox — same
-- caveat as 001_initial.sql.

alter table public.project_leads
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists utm_content text,
  add column if not exists utm_term text,
  add column if not exists referrer text,
  add column if not exists landing_page text;

alter table public.marketing_enquiries
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists utm_content text,
  add column if not exists utm_term text,
  add column if not exists referrer text,
  add column if not exists landing_page text;

alter table public.mentoring_enquiries
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists utm_content text,
  add column if not exists utm_term text,
  add column if not exists referrer text,
  add column if not exists landing_page text;

-- Cheap source-attribution reporting ("which utm_source produced the most
-- leads") without a full warehouse — index the column most likely to be
-- filtered/grouped on directly.
create index if not exists project_leads_utm_source_idx on public.project_leads (utm_source);
create index if not exists marketing_enquiries_utm_source_idx on public.marketing_enquiries (utm_source);
create index if not exists mentoring_enquiries_utm_source_idx on public.mentoring_enquiries (utm_source);
