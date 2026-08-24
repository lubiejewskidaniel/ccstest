import { notFound } from "next/navigation";
import { getProject } from "@/features/work/projects";
import { CaseStudy } from "@/features/work/CaseStudy";
import { CaseStudyModal } from "@/components/work/CaseStudyModal";

type Params = { slug: string };

/**
 * Intercepted route: only ever reached by a client-side navigation from
 * /work into /work/[slug] (Next.js's `(.)` same-level intercept). A hard
 * refresh or direct link on /work/[slug] never resolves here - it renders
 * work/[slug]/page.tsx instead, as a normal standalone page. No
 * generateMetadata on purpose: the tab title/SEO tags for this URL are
 * owned by that standalone route, since that's the only version search
 * engines or shared links ever actually see.
 */
export default async function InterceptedCaseStudy({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) notFound();

  return (
    <CaseStudyModal closeLabel="Close">
      <CaseStudy project={project} locale="en" />
    </CaseStudyModal>
  );
}
