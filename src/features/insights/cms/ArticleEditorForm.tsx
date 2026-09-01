"use client";

import { useActionState } from "react";
import type { Article, Category, Tag } from "../types/article";
import type { CmsFormState } from "@/lib/actions/insightsCms";
import styles from "./ArticleEditorForm.module.css";

const idle: CmsFormState = { status: "idle" };

type Mode =
	| { kind: "create"; action: (prevState: CmsFormState, formData: FormData) => Promise<CmsFormState> }
	| { kind: "edit"; article: Article; action: (prevState: CmsFormState, formData: FormData) => Promise<CmsFormState> };

export function ArticleEditorForm({
	mode,
	categories,
	tags,
}: {
	mode: Mode;
	categories: Category[];
	tags: Tag[];
}) {
	const [state, formAction, pending] = useActionState(mode.action, idle);
	const article = mode.kind === "edit" ? mode.article : null;

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
					<select id="locale" name="locale" defaultValue={article?.locale ?? "en"} required>
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
				<input id="title" name="title" type="text" defaultValue={article?.title} required />
				{fieldError("title") ? <span className="field-error">{fieldError("title")}</span> : null}
			</div>

			<div className="field">
				<label htmlFor="excerpt">Excerpt</label>
				<textarea id="excerpt" name="excerpt" defaultValue={article?.excerpt} required rows={3} />
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
				<label htmlFor="translationOf">
					Translation of <span className="opt">optional — id of the counterpart article in the other language</span>
				</label>
				<input id="translationOf" name="translationOf" type="text" defaultValue={article?.translationOf ?? ""} />
				{fieldError("translationOf") ? <span className="field-error">{fieldError("translationOf")}</span> : null}
				<p className={styles.hint}>
					A lookup-by-slug picker is a good candidate for a later CMS iteration — pasting the other article&apos;s
					id is Checkpoint 3&apos;s minimal v1 (find it in this article list&apos;s URL when editing it).
				</p>
			</div>

			<div className={styles.tagGrid}>
				<span className={styles.tagLabel}>Tags</span>
				<div className={styles.tagOptions}>
					{tags.length === 0 ? (
						<span className={styles.tagEmpty}>No tags yet — create some from the database while the tag manager is still Checkpoint 3+.</span>
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
					<input id="coverImageUrl" name="coverImageUrl" type="text" defaultValue={article?.coverImageUrl ?? ""} />
					{fieldError("coverImageUrl") ? <span className="field-error">{fieldError("coverImageUrl")}</span> : null}
				</div>
				<div className="field">
					<label htmlFor="coverImageAlt">
						Cover image alt text <span className="opt">optional</span>
					</label>
					<input id="coverImageAlt" name="coverImageAlt" type="text" defaultValue={article?.coverImageAlt ?? ""} />
				</div>
			</div>

			<div className="field">
				<label htmlFor="bodyJson">
					Body <span className="opt">JSON array of content blocks</span>
				</label>
				<textarea
					id="bodyJson"
					name="bodyJson"
					className={styles.bodyTextarea}
					defaultValue={JSON.stringify(article?.body ?? [], null, 2)}
					rows={16}
					spellCheck={false}
				/>
				<p className={styles.hint}>
					Each block is <code>{"{ type: \"paragraph\" | \"heading\" | \"image\" | \"code\" | \"callout\" | \"quote\" | \"list\", ... }"}</code>.
					See <code>src/features/insights/types/blocks.ts</code> for the exact shape of each type. A visual block
					editor is a good candidate for a later CMS iteration — this raw-JSON editor is Checkpoint 3&apos;s
					deliberately minimal v1.
				</p>
				{fieldError("body") ? <span className="field-error">{fieldError("body")}</span> : null}
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
				<legend>SEO overrides (optional)</legend>
				<div className="field">
					<label htmlFor="seoTitle">Search title</label>
					<input id="seoTitle" name="seoTitle" type="text" defaultValue={article?.seoTitle ?? ""} />
				</div>
				<div className="field">
					<label htmlFor="seoDescription">Search description</label>
					<textarea id="seoDescription" name="seoDescription" defaultValue={article?.seoDescription ?? ""} rows={2} />
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
