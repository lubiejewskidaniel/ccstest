"use client";

import { useActionState, useState } from "react";
import type { Article, Category, Tag } from "../types/article";
import type { Locale } from "@/lib/routes";
import type { CmsFormState } from "@/lib/actions/insightsCms";
import styles from "./ArticleEditorForm.module.css";

import { BlockEditor } from "./blocks-editor/BlockEditor";
import { TranslationPicker, type TranslationCandidate } from "./TranslationPicker";

const idle: CmsFormState = { status: "idle" };

type Mode =
	| { kind: "create"; action: (prevState: CmsFormState, formData: FormData) => Promise<CmsFormState> }
	| { kind: "edit"; article: Article; action: (prevState: CmsFormState, formData: FormData) => Promise<CmsFormState> };

export function ArticleEditorForm({
	mode,
	categories,
	tags,
	translationCandidates,
}: {
	mode: Mode;
	categories: Category[];
	tags: Tag[];
	translationCandidates: TranslationCandidate[];
}) {
	const [state, formAction, pending] = useActionState(mode.action, idle);
	const article = mode.kind === "edit" ? mode.article : null;

	const [locale, setLocale] = useState<Locale>(article?.locale ?? "en");
	const [translationOf, setTranslationOf] = useState<string | null>(article?.translationOf ?? null);
	const [title, setTitle] = useState(article?.title ?? "");
	const [excerpt, setExcerpt] = useState(article?.excerpt ?? "");
	const [coverImageUrl, setCoverImageUrl] = useState(article?.coverImageUrl ?? "");
	const [seoTitle, setSeoTitle] = useState(article?.seoTitle ?? "");
	const [seoDescription, setSeoDescription] = useState(article?.seoDescription ?? "");

	const fieldError = (name: string) => state.fieldErrors?.[name];

	return (
		<form action={formAction} className={styles.form} noValidate>
			{state.status === "error" && state.message ? (
				<div className={styles.banner} role="alert">
					{state.message}
				</div>
			) : null}
			{state.status === "success" ? (
				<div className={styles.bannerSuccess} role="status">
					Saved.
				</div>
			) : null}

			<div className="field-row">
				<div className="field">
					<label htmlFor="locale">Language</label>
					<select id="locale" name="locale" value={locale} onChange={(e) => setLocale(e.target.value as Locale)} required>
						<option value="en">English</option>
						<option value="pl">Polish</option>
					</select>
				</div>
				<div className="field">
					<label htmlFor="slug">
						Slug <span className="opt">lowercase, hyphens only</span>
					</label>
					<input id="slug" name="slug" type="text" defaultValue={article?.slug} required />
					{fieldError("slug") ? <span className="field-error">{fieldError("slug")}</span> : null}
				</div>
			</div>

			<div className="field">
				<label htmlFor="title">Title</label>
				<input id="title" name="title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} required />
				{fieldError("title") ? <span className="field-error">{fieldError("title")}</span> : null}
			</div>

			<div className="field">
				<label htmlFor="excerpt">Excerpt</label>
				<textarea id="excerpt" name="excerpt" value={excerpt} onChange={(e) => setExcerpt(e.target.value)} required rows={3} />
				{fieldError("excerpt") ? <span className="field-error">{fieldError("excerpt")}</span> : null}
			</div>

			<div className="field-row">
				<div className="field">
					<label htmlFor="categoryId">Category</label>
					<select id="categoryId" name="categoryId" defaultValue={article?.category.id} required>
						{categories.map((category) => (
							<option key={category.id} value={category.id}>
								{category.name}
							</option>
						))}
					</select>
				</div>
				<div className="field">
					<label htmlFor="authorName">Author name</label>
					<input id="authorName" name="authorName" type="text" defaultValue={article?.authorName} required />
					{fieldError("authorName") ? <span className="field-error">{fieldError("authorName")}</span> : null}
				</div>
			</div>

			<div className="field">
				<label>
					Translation of <span className="opt">optional — link to the counterpart article in the other language</span>
				</label>
				<TranslationPicker
					candidates={translationCandidates}
					locale={locale}
					excludeId={article?.id}
					value={translationOf}
					onChange={setTranslationOf}
				/>
				{fieldError("translationOf") ? <span className="field-error">{fieldError("translationOf")}</span> : null}
			</div>

			<div className={styles.tagGrid}>
				<span className={styles.tagLabel}>Tags</span>
				<div className={styles.tagOptions}>
					{tags.length === 0 ? (
						<span className={styles.tagEmpty}>No tags yet — create some from the database first.</span>
					) : (
						tags.map((tag) => (
							<label key={tag.id} className={styles.tagOption}>
								<input
									type="checkbox"
									name="tagIds"
									value={tag.id}
									defaultChecked={article?.tags.some((t) => t.id === tag.id)}
								/>
								{tag.name}
							</label>
						))
					)}
				</div>
			</div>

			<div className="field-row">
				<div className="field">
					<label htmlFor="coverImageUrl">
						Cover image URL <span className="opt">optional</span>
					</label>
					<input
						id="coverImageUrl"
						name="coverImageUrl"
						type="text"
						value={coverImageUrl}
						onChange={(e) => setCoverImageUrl(e.target.value)}
					/>
					{fieldError("coverImageUrl") ? <span className="field-error">{fieldError("coverImageUrl")}</span> : null}
				</div>
				<div className="field">
					<label htmlFor="coverImageAlt">
						Cover image alt text <span className="opt">recommended for accessibility</span>
					</label>
					<input id="coverImageAlt" name="coverImageAlt" type="text" defaultValue={article?.coverImageAlt ?? ""} />
				</div>
			</div>

			{coverImageUrl ? (
				<div className={styles.coverPreviewWrap}>
					{/* eslint-disable-next-line @next/next/no-img-element -- editor-supplied URL on an unknown host */}
					<img
						src={coverImageUrl}
						alt=""
						className={styles.coverPreview}
						onError={(e) => {
							e.currentTarget.style.display = "none";
						}}
						onLoad={(e) => {
							e.currentTarget.style.display = "block";
						}}
					/>
				</div>
			) : null}

			<div className="field">
				<label>Body</label>
				<BlockEditor initialBlocks={article?.body ?? []} fieldError={fieldError("body")} />
			</div>

			<div className="field-row">
				<div className="field">
					<label htmlFor="readingMinutes">
						Reading time (minutes) <span className="opt">optional</span>
					</label>
					<input id="readingMinutes" name="readingMinutes" type="number" min={1} defaultValue={article?.readingMinutes ?? ""} />
				</div>
				<div className={styles.checkboxField}>
					<label>
						<input type="checkbox" name="featured" defaultChecked={article?.featured} />
						Feature on the Insights hub
					</label>
				</div>
			</div>

			<fieldset className={styles.seoFieldset}>
				<legend>Search appearance (optional)</legend>
				<p className={styles.seoLede}>
					Only for how this article looks in search results — it never changes the on-page title or intro. Leave
					either field blank to use the article&apos;s own title/excerpt instead.
				</p>
				<div className="field">
					<label htmlFor="seoTitle">
						Search title <span className="opt">optional — falls back to the article title</span>
					</label>
					<input
						id="seoTitle"
						name="seoTitle"
						type="text"
						value={seoTitle}
						onChange={(e) => setSeoTitle(e.target.value)}
						placeholder={title || "Untitled"}
					/>
					<span className={`${styles.charCount} ${seoTitle.length > 60 ? styles.charCountOver : ""}`}>
						{seoTitle.length} / ~60 characters shown in search results
					</span>
				</div>
				<div className="field">
					<label htmlFor="seoDescription">
						Search description <span className="opt">optional — falls back to the article excerpt</span>
					</label>
					<textarea
						id="seoDescription"
						name="seoDescription"
						value={seoDescription}
						onChange={(e) => setSeoDescription(e.target.value)}
						placeholder={excerpt || "No excerpt written yet"}
						rows={2}
					/>
					<span className={`${styles.charCount} ${seoDescription.length > 155 ? styles.charCountOver : ""}`}>
						{seoDescription.length} / ~155 characters shown in search results
					</span>
				</div>
			</fieldset>

			{mode.kind === "create" ? (
				<div className="field">
					<label htmlFor="status">Initial status</label>
					<select id="status" name="status" defaultValue="draft">
						<option value="draft">Draft</option>
						<option value="in_review">In review</option>
					</select>
					<p className={styles.hint}>Publishing and scheduling happen from the edit screen once the article exists.</p>
				</div>
			) : (
				<>
					<input type="hidden" name="status" value={article?.status} />
					{/* Content edits go through this form; status/scheduling go
					    through the separate quick-action buttons on the edit page
					    (ArticleStatusActions). Without this hidden field, saving
					    an unrelated content edit on a scheduled article would
					    silently wipe its scheduled_at back to null, since the
					    schema treats a missing scheduledAt as "clear it". */}
					<input type="hidden" name="scheduledAt" value={article?.scheduledAt ?? ""} />
					{/* Same reasoning as scheduledAt above: articleInputSchema
					    defaults a missing "source" to "human" (the CMS form has
					    no source field), which would silently overwrite an
					    AI-promoted article's "ai_generated"/"ai_assisted" source
					    back to "human" on its very first human edit. */}
					<input type="hidden" name="source" value={article?.source} />
				</>
			)}

			<button type="submit" className="btn btn-primary form-submit" disabled={pending}>
				{pending ? "Saving…" : mode.kind === "create" ? "Create article" : "Save changes"}
			</button>
		</form>
	);
}
