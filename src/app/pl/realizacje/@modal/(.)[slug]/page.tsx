import { notFound } from "next/navigation";
import { getProject } from "@/features/work/projects";
import { CaseStudy } from "@/features/work/CaseStudy";
import { CaseStudyModal } from "@/components/work/CaseStudyModal";

type Params = { slug: string };

/** PL equivalent of work/@modal/(.)[slug]/page.tsx - see that file's comment. */
export default async function InterceptedCaseStudy({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) notFound();

  return (
    <CaseStudyModal closeLabel="Zamknij">
      <CaseStudy project={project} locale="pl" />
    </CaseStudyModal>
  );
}
