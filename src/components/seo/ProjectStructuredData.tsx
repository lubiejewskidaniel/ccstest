import { JsonLd } from "./JsonLd";
import { projectWebPageSchema, projectBreadcrumbs } from "@/lib/seo/structuredData";
import type { Locale } from "@/lib/routes";
import type { Project } from "@/features/work/projects";

type Props = {
  project: Project;
  locale: Locale;
};

/**
 * `WebPage` + `BreadcrumbList` structured data for one case-study page -
 * the dynamic-route sibling of `PageStructuredData` (case studies aren't
 * `RouteKey` entries, so they build their schemas from the project object
 * and `caseStudyPath` instead of a `routes[key]` lookup).
 */
export function ProjectStructuredData({ project, locale }: Props) {
  return (
    <JsonLd
      data={[
        projectWebPageSchema({ project, locale }),
        projectBreadcrumbs({ project, locale }),
      ]}
    />
  );
}
