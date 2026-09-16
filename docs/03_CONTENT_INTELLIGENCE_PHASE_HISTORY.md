# Content Intelligence Phase History

## Phase 3B.1 - Market Intelligence foundation

Implemented:

- Bing keyword stats provider
- market types
- market keyword persistence
- observations
- explicit `no_data`
- idempotent observed rows
- migration `009_market_intelligence.sql`

Live Bing verification completed.

## Market trend

Implemented:

- strict/broad channels
- exact 4-vs-4 windows
- cadence/gaps
- duplicates
- low-volume protection
- volatility
- fetch-attempt grouping
- history depth

## Phase 3C.1A - Business relevance

Implemented CCS taxonomy, EN/PL matching, whole-token phrase matching, core/adjacent/none.

## Phase 3C.1B - Content coverage

Implemented published-only, locale-aware coverage with title_match / mention / none and mapping confidence.

## Phase 3C.1C - Evidence confidence

Implemented low/medium/high confidence, market agreement, freshness/no_data, mapping ambiguity and first-party history.

## Phase 3C.1D - Market opportunity evidence

Implemented market demand, deterministic first-party matching, visibility/trend, classifications and pure `evaluateMarketOpportunity`.

## Phase 3C.1E - Server orchestration

Implemented RLS-respecting Supabase orchestration, market observations, opportunity/history/article candidates.

## Phase 3C.1F - Market Opportunity Inspector

Implemented admin inspector, evidence presentation and safe route handling.

## Phase 3C.2 - Recommendation Engine

Implemented deterministic:

- create_content
- refresh_content
- research_further
- monitor
- no_action

Locked distinction:

- monitor = not enough evidence yet
- no_action = evidence supports deliberately doing nothing

## Phase 3C.3 - Human-reviewed handoff

Implemented recommendation display and safe handoff to the existing editorial workflow.

No automatic brief/article generation, as of this phase's completion. The automated research, generation, localisation and quality gate pipeline described under Checkpoint 7 below was implemented afterwards. Promotion of a brief into an article still requires the human quality gate and review process described there, not automatic publication.

## Checkpoint 7 - AI editorial pipeline

Migration:
`006_ai_editorial.sql`

Added `content_briefs`, one row per editorial pipeline run, optionally linked to a `content_opportunities` row, tracked through an explicit status column (draft, researching, researched, generating, generated, localising, localised, quality_check, quality_passed, quality_failed, promoted, failed). Added `ai_usage_log`, recording per-call token counts and estimated cost for research, generation and localisation.

Implemented four independent pipeline stages, each triggered by its own explicit editor action in `PipelineControls.tsx`. No stage runs automatically after another; an editor decides when to run research, generation, localisation and the quality check, and can rerun an earlier stage after a failure.

- `research.ts`: calls the configured Anthropic provider for a short research brief, stored as plain text on the brief for the generation stage to use as grounding.
- `generation.ts` and `AnthropicProvider.ts`: generates the structured article body, validated against the same block schema the human CMS editor's own form is validated against. Output length is bounded by a `maxTokens` request, itself capped by the `CONTENT_AI_MAX_OUTPUT_TOKENS` environment ceiling. A response cut off at that limit is identified from the provider's own stop reason and reported as an explicit truncation failure rather than mishandled as a JSON parsing error.
- `localisation.ts`: translates a generated draft into the brief's other locale. Its own output token limit is tuned separately from generation, since a translated body still carries the full block structure and is typically longer than the source draft.
- `quality/qualityGate.ts`: a pure, synchronous check with no database or AI call, covering word count, heading count, minimum block count, placeholder text and code blocks missing a language. A failed check blocks promotion, not editing.

Implemented `briefs/promote.ts`, the only place a brief's generated draft, and localised draft when present, become real `insights_articles` rows. Requires the brief's status to already be `quality_passed`. Both rows are created with `status = "in_review"` and `source = "ai_generated"`, through the same `createArticle()` function and Zod block schema the human CMS editor's own form submits to, never a separate write path. Promotion never sets an article to `published`. That remains a separate, later, human action through the existing `transitionArticleStatus`, unaffected by this pipeline.

Tests: research 15/15, generation 11/11, localisation 6/6. No test file exists yet for the quality gate or for promotion.

## Checkpoint 8 - Publishing automation

Implemented `src/app/api/v1/scheduler/publish/route.ts`, a daily cron-triggered route publishing whichever articles are already due under their own `scheduled_at` value. This automates the mechanical act of publishing at the scheduled time. It does not decide what to schedule or when. An article only reaches this route because an editor already set it to `status = "scheduled"` with a specific date and time through the existing, human-driven status action. No content is generated, promoted or approved by this route.

Search performance ingestion from Google Search Console and Bing remains editor-triggered through the existing admin toolbar. No scheduler was added for ingestion.

## Checkpoint 9 - Optimisation loop

Migrations:
`007_optimisation.sql`, `008_opportunity_source_history.sql`

Migration 007 links a `content_opportunities` row to the `insights_articles` row it produced (`resulting_article_id`) and records the opportunity score at the moment of promotion (`score_at_promotion`), closing the loop from opportunity to brief to article to later performance. It also adds `ai_visibility_checks` and `scoring_calibration`, and widens `ai_usage_log`'s stage constraint to include `ai_visibility`. Migration 008 adds explicit Google and Bing impression/click columns to `content_opportunities` and an append-only `opportunity_score_history` snapshot log.

Implemented:

- `monitoring/aiVisibility.ts`: an editor-triggered check asking the configured Anthropic provider a representative query and recording whether the studio was mentioned. Documented in the code itself as a proxy signal for one provider, not a measurement of any specific real-world AI search product.
- `monitoring/performanceAnalysis.ts`: combines existing page-view and CTA-click reads with a new join against `search_performance_metrics` into one per-article performance read, reused by both modules below.
- `refresh/staleness.ts`: ranks published articles for editorial attention by age past a configurable threshold and by a worsening search position trend, comparing the last 30 days against the prior 30 days, and states the specific reason an article was flagged rather than one opaque score.
- `conversion/conversionIntelligence.ts`: matches a lead submission's captured landing page back to the article that produced it. Admin-only, matching the existing admin-only RLS on the lead tables it reads.
- `learning/calibration.ts`: compares each promoted opportunity's `score_at_promotion` against that article's actual performance at least 14 days after publishing, and averages the resulting ratio into one multiplier that the existing opportunity scoring recompute applies going forward. Implemented as one transparent, auditable number, not a black box model.

All five are editor-triggered reads or recomputations. None of them writes to `insights_articles`, changes an article's status, or publishes anything.

Tests: AI visibility 4/4. No test file exists yet for performance analysis, staleness ranking, conversion intelligence or calibration.

## Phase 3C.4A - Article visual publication gate

Migration:
`010_article_visual_gate.sql`

Added:
`cover_image_status = missing | pending_review | approved`

New publication requires approved status + URL + alt.

## Phase 3C.4B.1 - Article Visual Brief

Implemented pure deterministic `buildArticleVisualBrief()`.

No LLM/provider/storage/network.

## Phase 3C.4B.2 - Visual Provider contract

Implemented provider-neutral generation contract supporting bytes or temporary URL.

No real provider yet.

## Phase 3C.4B.3A - Visual storage foundation

Migration:
`011_article_visuals.sql`

Implemented pure byte validation, dimensions, 8 MiB limit and storage-path logic.

DB guarantees max one approved candidate per article.

## Phase 3C.4B.3B - Real Supabase Storage integration

Implemented:

- `articleVisualStorageService.ts`
- generated bytes flow
- temporary URL flow
- manual upload flow
- auth/editor gates
- article existence check
- `upsert: false`
- `article_visuals` insert
- `missing -> pending_review`
- no downgrade of approved cover
- cleanup on DB insert failure
- warning on post-insert cover-status update failure

Windows verification:

- storage service tests: 41/41
- storage foundation tests: 45/45
- full suite: 699/699
- 31/31 test files
- typecheck passed
- production build passed

## Phase 3C.4B.4A - Article visual approval

Migration:
`012_article_visual_approval.sql`

Implemented `approve_article_visual`, a single Postgres function that supersedes the article's previous approved candidate, marks the selected candidate approved and updates the article's live cover fields (`cover_image_url`, `cover_image_alt`, `cover_image_status`) as one atomic operation. This is the only place `cover_image_status` is allowed to become `approved`.

Also implemented `articleVisualReviewService.ts` (auth, input validation, candidate lookup, calls the RPC) and idempotent re-approval of an already-consistent candidate.

Tests: articleVisualReviewService 41/41.

## Phase 3C.4B.4B - Visual candidate review UI

Implemented `articleVisualQueries.ts` (admin-only read model for stored candidates), `ArticleVisualReviewPanel.tsx` (server component loading candidates) and `ArticleVisualReviewList.tsx` (interactive review: per-candidate alt text, approval with confirmation when replacing an existing cover, and detection of an inconsistent state between the managed candidates and the article's own cover fields).

## Phase 3C.4B.5A - Real image generation provider

Implemented `OpenAiArticleVisualProvider.ts`, a real provider behind the Phase 3C.4B.2 contract.

Tests: 39/39.

## Phase 3C.4B.5B - Visual generation orchestration

Implemented `articleVisualGenerationService.ts`, connecting the article visual brief, the configured provider and Supabase Storage into one editor-triggered generation call. Every free rejection (configuration, auth, editor role, article existence, insufficient context) runs before the one billable provider call; a successful generation always produces an additional `pending_review` candidate, never an automatic approval.

Tests: 31/31.

## Phase 3C.4B.5C - Generate visual control

Implemented the human-triggered "Generate visual" control in `ArticleVisualReviewList.tsx` and `generateArticleVisualAction`. Generation is allowed regardless of existing candidates, approval state or article status, and never approves or optimistically inserts a candidate.

## Phase 3C.4B.6A/6B/6C - Manual visual upload

Design decision (6A): manual upload is a Route Handler, not a Server Action, because this Next.js version's default Server Action body-size ceiling is smaller than the existing 8 MB asset contract.

Implemented (6B): the upload Route Handler at `src/app/api/admin/article-visuals/upload/route.ts` as a thin transport adapter over `storeUploadedArticleVisual`, plus the upload control in `ArticleVisualReviewList.tsx`.

Transport-security correction (6C): moved the auth preflight before `request.formData()` and added a `file.size` check before `file.arrayBuffer()`, so an unauthenticated or oversized request is rejected before multipart parsing or byte buffering. The service's own auth and byte-level validation remain the authoritative checks.

Tests: upload route 13/13.

## Phase 3C.4B.7A - Deletion of unused visual candidates

Migration:
`013_article_visual_deletion.sql`

Added an editor-only DELETE policy on `article_visuals`. Implemented `articleVisualDeletionService.ts`: only `pending_review` or `superseded` candidates are deletable, an `approved` candidate is never deletable, the Storage object is removed before the database row, and a Storage failure leaves the row untouched.

Tests: 28/28.

## Phase 3C.4B.8A - Public cover rendering audit

Closed a coverage gap: added structural tests proving public article rendering (`ArticleHero.tsx`, `ArticleCard.tsx`, `mappers.ts`, the public `data/queries.ts` module) reads only the article's own `cover_image_url`/`cover_image_alt` columns and never queries `article_visuals` on a public render.

Tests: 11/11.

## Phase 3C.4C.1 - AI operation event foundation

Migration:
`014_ai_operation_events.sql`

Extended `public.ai_usage_log` with a provider-neutral operation type, execution mode, run id, duration, outcome, a closed failure classification and a cost basis, without dropping or renaming any existing column. Implemented `aiOperationEventWriter.ts` (validated, RLS-scoped insert) and `aiOperationEventQueries.ts` (admin read model), both distinct from and additive to the existing `costGuard.ts` budget tracking.

Tests: writer 27/27, queries 6/6.

## Phase 3C.4C.2 - Text pipeline instrumentation

Wired `recordAiOperationEvent` into research, generation, localisation and AI visibility, recording a success or failure event for each provider call without ever storing the prompt, response body or raw exception text.

Tests: deterministic-operations coverage 4/4, plus coverage added to each pipeline's own existing test file.

## Managed article cover ownership hardening

Production issue: the ordinary CMS content-save path (`updateArticle`) wrote `cover_image_url` and `cover_image_alt` directly from the editor form on every save. An editor approving a visual candidate and then saving an unrelated content edit in the same session could silently overwrite the just-approved cover with the form's stale local field state, while `cover_image_status` remained `approved` - a genuine data inconsistency, not a caching artefact.

Fix: removed `coverImageUrl`/`coverImageAlt` from `articleInputSchema` and from `ArticleEditorForm.tsx` entirely. `toRow()` in `cms/service.ts` no longer sets these two columns, so an ordinary update never touches them regardless of what a stale form might otherwise submit. `approve_article_visual` remains the only writer of `cover_image_url`, `cover_image_alt` and `cover_image_status`. `article_visuals` stays single-owner: one candidate row per article, at most one `approved` row per article, enforced by the existing partial unique index.

Tests: service.coverImageOwnership.test.ts, proving the update and insert payloads never carry the three managed cover columns.

## EN/PL translation cover sharing

Migration:
`015_translation_cover_sync.sql`

Goal: linked EN and PL translations of the same article share one approved Article Visual, without a second physical Storage object and without a second `article_visuals` candidate row. Sharing is implemented entirely as propagation of the managed cover fields between the two `insights_articles` rows.

Implemented `find_linked_translation_id(article_id)`: resolves the complete relationship around an article before deciding anything, combining its own `translation_of` with every row whose `translation_of` points back at it into one candidate set. Returns the linked article only when that set names exactly one distinct article. A reciprocal pair (`A.translation_of = B` and `B.translation_of = A`) resolves as the same unambiguous pair. Multiple distinct candidates, in either direction, return null rather than guessing.

Implemented `sync_linked_translation_cover(article_id, source_is_authoritative)`, locking both linked rows in a fixed id order before reading or writing either:

- authoritative mode, used immediately after an approval inside `approve_article_visual`, always propagates the just-approved cover onto the linked translation unless that translation owns its own approved `article_visuals` row
- non-authoritative mode, used when a translation link is newly created or changed, only fills a genuine gap and fails safe (writes nothing) if both sides already show a valid approved cover

Extended `approve_article_visual` to call `sync_linked_translation_cover` in authoritative mode inside the same transaction as the approval, so an approval and its propagation to the linked translation always succeed or fail together.

`createArticle`/`updateArticle` in `cms/service.ts` call the sync function whenever the saved article has a non-null `translationOf`, on every such save rather than only when the link changes, so a save retries and repairs a synchronisation that failed on an earlier save. The sync function is idempotent, so a repeated call on an already-synchronised pair is a no-op. Unlinking a translation never calls the sync function and never clears either article's existing cover. The ordinary update payload still never carries `cover_image_url`, `cover_image_alt` or `cover_image_status`.

Implemented `translationLink.ts` (`hasLinkedTranslation`) so the Article Visual admin UI recognises a linked translation in either direction, reusing the article list already loaded for the translation picker rather than an additional query. The review UI distinguishes a cover shared from a linked translation from a legacy manually-set cover.

Runtime bug found and fixed before production verification: the initial `find_linked_translation_id` used `min(candidate_id)` to read the single candidate once uniqueness was proven, which failed in production with `function min(uuid) does not exist`. Replaced with `array_agg` over the same deduplicated candidate set and `array_length(...) = 1`, reading the single element by array position only after that length check. No change to the resolver's semantics.

The publication gate is unaffected: it already reads each article's own `cover_image_status`/`cover_image_url`/`cover_image_alt` independently, so a synchronised translation satisfies it exactly like a directly approved cover.

Tests: translationCoverSyncMigration structural and scenario coverage, service.translationCoverSync.test.ts, translationLink.test.ts, plus the existing Article Visual and Insights suites re-run unmodified.

Production verification:

- migration 015 applied to production Supabase
- `find_linked_translation_id` verified against the real EN/PL article pair
- the uuid aggregate incompatibility above was corrected before this verification
- `sync_linked_translation_cover` executed successfully
- both the EN and PL `insights_articles` rows verified with `cover_image_status = approved` and a non-empty `cover_image_url`
- the published Polish article visually verified to display the same approved cover as its English counterpart
- production application updated to commit `f97d500`
- `npm run build` completed successfully, 67/67 static pages generated
- PM2 process `ccs-next-test` restarted successfully
- local production process check on `http://127.0.0.1:3001` returned HTTP 200

## AI Operations and Cost Visibility (Admin Dashboard)

Goal: surface the AI operation event data collected by Phase 3C.4C.1/3C.4C.2 (`ai_usage_log`, via `aiOperationEventWriter.ts`) somewhere an editor can actually see it. Before this work, `aiOperationEventQueries.ts` had no caller anywhere under `src/app` - every research/generation/localisation/AI-visibility call was already being recorded, but nothing read it back except `costGuard.checkBudget()`'s own pass/fail decision.

Added `/admin/insights/ai-operations`, a read-only server-rendered admin page consuming only functions that already existed:

- `getAiOperationEventsInRange` (`aiOperationEventQueries.ts`, unchanged) for a fixed 30-day window of recent operations
- a new `getMonthlyBudgetUsage()` in `costGuard.ts`, extracted from `checkBudget()` so the admin page can read the same monthly spend/budget figures the guard enforces against, without depending on a function whose contract is "may this AI call proceed". `checkBudget()` now delegates to it and its allow/deny outcome, including failing closed when Supabase isn't configured, is unchanged.

The page shows: current-month spend/budget/remaining/percentage used, a per-`operationType` summary (call count, success/failure count, total estimated cost) computed in application code by a new pure helper (`aiOperationEventSummary.ts`, `summariseAiOperationEventsByType`) rather than a new SQL aggregation, and a recent-operations table (stage, provider/model, execution mode, tokens, estimated cost, cost basis, duration, outcome, error kind on failure, timestamp). All cost figures are explicitly labelled as estimated, not provider billing or invoice cost, matching `costGuard.ts`'s own documented rate caveat.

Access control: the page relies on the same `(dashboard)` layout auth gate every other Insights admin page uses; no new session check, no privileged/service-role client, no RLS change. `ai_usage_log`'s existing "editor select" RLS policy already scopes every read.

Deliberate exclusion: Article Visual (image) generation is not instrumented into `ai_usage_log` at all - confirmed by inspection, `ArticleVisualProvider.ts` only mentions `costGuard`/`recordAiOperationEvent` in a comment and calls neither. The page carries an explicit note that it does not reflect every AI-related cost in Code Consulting Studio. Instrumenting image generation is out of scope for this phase and remains unbuilt.

Navigation: added an "AI operations" link from the Insights admin index and from the Performance admin page, matching the existing sibling cross-link convention - no navigation redesign.

Tests: `aiOperationEventSummary.test.ts` (6/6 - empty events, single/multiple operation types, cost totals, sort order, success/failure counts, ungrouped `operationType`), `costGuard.test.ts` (7/7 - `getMonthlyBudgetUsage` sum/not-configured/default-budget cases, `checkBudget` allow/block/fail-closed cases). Full `content-intelligence`/`insights` suites re-run unmodified: 43 files, 1042 tests passing.

Verification: `tsc --noEmit` clean; ESLint clean on every changed/new file; `npm run build`'s compile and TypeScript steps both completed successfully, but the subsequent static-page-generation step crashed with a native Turbopack worker access violation on this local Windows environment - confirmed pre-existing by reproducing the identical crash on the unmodified base commit (`1173512`) with this change fully removed, so it is an environment issue and not caused by this phase.
