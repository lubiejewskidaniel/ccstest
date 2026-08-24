import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAllProjects, getProject } from "@/features/work/projects";
import { CaseStudy } from "@/features/work/CaseStudy";
import { buildProjectMetadata } from "@/lib/seo/metadata";
import { ProjectStructuredData } from "@/components/seo/ProjectStructuredData";

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return getAllProjects().map((project) => ({ slug: project.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) return {};
  return buildProjectMetadata({ project, locale: "pl" });
}

export default async function Page({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) notFound();

  return (
    <>
      <ProjectStructuredData project={project} locale="pl" />
      <main>
        <CaseStudy project={project} locale="pl" />
      </main>
    </>
  );
}
