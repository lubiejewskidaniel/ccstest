import {
	paragraphBlockSchema,
	headingBlockSchema,
	imageBlockSchema,
	codeBlockSchema,
	calloutBlockSchema,
	quoteBlockSchema,
	listBlockSchema,
	type ContentBlock,
} from "@/features/insights/types/blocks";

/**
 * Field-level validation for one block, reusing the exact same
 * per-type Zod schemas the server validates the whole body against
 * (`@/features/insights/types/blocks`) — no second, looser set of
 * rules for the editor UI to drift out of sync with what the server
 * will actually accept.
 */
export function validateBlock(block: ContentBlock): Record<string, string> {
	const schema = {
		paragraph: paragraphBlockSchema,
		heading: headingBlockSchema,
		image: imageBlockSchema,
		code: codeBlockSchema,
		callout: calloutBlockSchema,
		quote: quoteBlockSchema,
		list: listBlockSchema,
	}[block.type];

	const result = schema.safeParse(block);
	if (result.success) return {};

	const errors: Record<string, string> = {};
	for (const issue of result.error.issues) {
		const key = issue.path.join(".") || "_block";
		if (!errors[key]) errors[key] = issue.message;
	}
	return errors;
}
