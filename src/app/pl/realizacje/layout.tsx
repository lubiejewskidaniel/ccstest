/** PL equivalent of src/app/work/layout.tsx - see that file's comment. */
export default function RealizacjeLayout({
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
