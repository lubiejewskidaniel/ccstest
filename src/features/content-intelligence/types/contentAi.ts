import type { Locale } from "@/lib/routes";
import type { ContentBlock } from "@/features/insights/types/blocks";

/**
 * Provider-agnostic AI text-generation interface — the content-
 * intelligence sibling of `SearchPerformanceProvider`
 * (content-intelligence/types/searchProvider.ts) and `CRMProvider`
 * (src/lib/crm/types.ts). Master instruction §2: "AI is only a content
 * producer" — nothing in this pipeline depends on which provider answers
 * this interface, and every stage degrades to a clear, recorded failure
 * (never a thrown exception reaching the UI) when no provider is
 * configured.
 */
export type AiCompletionRequest = {
	system: string;
	prompt: string;
	maxTokens: number;
};

export type AiCompletionResult = {
	text: string;
	inputTokens: number;
	outputTokens: number;
};

export type ContentAiProvider = {
	id: string;
	model: string;
	isConfigured: () => boolean;
	complete: (request: AiCompletionRequest) => Promise<AiCompletionResult>;
};

export type PipelineStage = "research" | "generation" | "localisation" | "ai_visibility";

/** The structured shape a generation/localisation call must return —
 * validated against `articleBodySchema` before it's trusted, same
 * "server boundary is the real boundary" rule as human CMS input. */
export type GeneratedDraft = {
	title: string;
	excerpt: string;
	slug: string;
	body: ContentBlock[];
};

export type BriefStatus =
	| "draft"
	| "researching"
	| "researched"
	| "generating"
	| "generated"
	| "localising"
	| "localised"
	| "quality_check"
	| "quality_passed"
	| "quality_failed"
	| "promoted"
	| "failed";

export type QualityIssue = { field: string; message: string };

export type ContentBrief = {
	id: string;
	opportunityId: string | null;
	primaryLocale: Locale;
	categoryId: string;
	topic: string;
	keyPoints: string | null;
	status: BriefStatus;
	researchNotes: string | null;
	generated: GeneratedDraft | null;
	localizedLocale: Locale | null;
	localized: GeneratedDraft | null;
	qualityIssues: QualityIssue[];
	errorMessage: string | null;
	primaryArticleId: string | null;
	localizedArticleId: string | null;
	createdAt: string;
	updatedAt: string;
};

/** Shared result shape for every pipeline stage (research, generation,
 * localisation, quality gate, promotion) — one place to see the full set
 * of ways a stage can fail, rather than a slightly different shape per
 * stage module. */
export type StageResult =
	| { ok: true }
	| { ok: false; kind: "auth"; message: string }
	| { ok: false; kind: "not_found"; message: string }
	| { ok: false; kind: "not_configured"; message: string }
	| { ok: false; kind: "budget"; message: string }
	| { ok: false; kind: "provider_error"; message: string }
	| { ok: false; kind: "validation"; message: string }
	| { ok: false; kind: "persistence"; message: string };
