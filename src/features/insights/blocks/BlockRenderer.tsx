import type { ContentBlock } from "../types/blocks";
import { ParagraphBlock } from "./ParagraphBlock";
import { HeadingBlock } from "./HeadingBlock";
import { ImageBlock } from "./ImageBlock";
import { CodeBlock } from "./CodeBlock";
import { CalloutBlock } from "./CalloutBlock";
import { QuoteBlock } from "./QuoteBlock";
import { ListBlock } from "./ListBlock";

/**
 * The single place that switches on a content block's `type`
 * (docs/INSIGHTS_ARCHITECTURE.md §5). New block types are added here and
 * in `types/blocks.ts` together — never by branching inside a page
 * component.
 */
export function BlockRenderer({ blocks }: { blocks: ContentBlock[] }) {
	return (
		<>
			{blocks.map((block, index) => {
				const key = block.type === "heading" ? block.id : `${block.type}-${index}`;
				switch (block.type) {
					case "paragraph":
						return <ParagraphBlock key={key} block={block} />;
					case "heading":
						return <HeadingBlock key={key} block={block} />;
					case "image":
						return <ImageBlock key={key} block={block} />;
					case "code":
						return <CodeBlock key={key} block={block} />;
					case "callout":
						return <CalloutBlock key={key} block={block} />;
					case "quote":
						return <QuoteBlock key={key} block={block} />;
					case "list":
						return <ListBlock key={key} block={block} />;
					default:
						return null;
				}
			})}
		</>
	);
}
