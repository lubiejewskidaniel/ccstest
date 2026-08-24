/**
 * Adds the `@modal` parallel-route slot for the /work subtree only (this
 * layout does NOT touch the root layout in src/app/layout.tsx, so nothing
 * outside /work is affected). On a normal request `modal` resolves to
 * `@modal/default.tsx` (renders nothing); on a client-side navigation from
 * /work into /work/[slug], Next.js's intercepting route
 * (`@modal/(.)[slug]`) takes over that slot instead and renders the
 * case study as an overlay while `children` keeps showing the /work list
 * underneath - see docs/architecture notes in CaseStudyModal.tsx for why
 * a hard refresh or direct link never hits this path.
 */
export default function WorkLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
