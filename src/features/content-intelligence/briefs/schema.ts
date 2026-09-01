import { z } from "zod";

/** Same "server boundary is the real boundary" rule as every other Zod
 * schema in this app — validates a brief before it's ever persisted,
 * whether created manually by an editor or seeded from a selected
 * content opportunity. */
export const createBriefSchema = z.object({
	opportunityId: z.union([z.string().uuid(), z.literal("")]).optional().transform((v) => v || null),
	primaryLocale: z.enum(["en", "pl"]),
	categoryId: z.string().uuid(),
	topic: z.string().trim().min(3, "Topic must be at least 3 characters.").max(200, "Topic is too long."),
	keyPoints: z.string().trim().max(4000).optional().transform((v) => v || null),
});

export type CreateBriefInput = z.infer<typeof createBriefSchema>;
