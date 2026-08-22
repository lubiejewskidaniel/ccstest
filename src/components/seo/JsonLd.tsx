/**
 * Renders one or more JSON-LD `<script>` tags. Pure Server Component - no
 * hooks, no client JS shipped for this (brief engineering principle:
 * "minimum unnecessary client-side JavaScript").
 */
export function JsonLd({ data }: { data: object | object[] }) {
  const items = Array.isArray(data) ? data : [data];

  return (
    <>
      {items.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          // `<` is escaped so a string value can never accidentally close
          // the surrounding <script> tag early - the JSON itself is
          // unaffected since `<` round-trips through JSON.parse to `<`.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item).replace(/</g, "\\u003c") }}
        />
      ))}
    </>
  );
}
