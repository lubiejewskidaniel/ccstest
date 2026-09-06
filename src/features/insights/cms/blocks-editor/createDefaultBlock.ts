import type { ContentBlock } from "@/features/insights/types/blocks";

export type BlockType = ContentBlock["type"];

export const BLOCK_TYPE_LABEL: Record<BlockType, string> = {
	paragraph: "Paragraph",
	heading: "Heading",
	image: "Image",
	list: "List",
	callout: "Callout",
	quote: "Quote",
	code: "Code",
};

/** A new block starts empty/minimal but schema-shaped — validation
 * naturally flags the required fields as the editor fills them in,
 * rather than this factory guessing at placeholder content. */
export function createDefaultBlock(type: BlockType): ContentBlock {
	switch (type) {
		case "paragraph":
			return { type: "paragraph", text: "" };
		case "heading":
			return { type: "heading", level: 2, text: "", id: "" };
		case "image":
			return { type: "image", src: "", alt: "", width: 1200, height: 675 };
		case "list":
			return { type: "list", style: "unordered", items: [""] };
		case "callout":
			return { type: "callout", variant: "info", text: "" };
		case "quote":
			return { type: "quote", text: "" };
		case "code":
			return { type: "code", code: "" };
	}
}
