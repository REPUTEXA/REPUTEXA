/** Convertit l'id TOC (ex. `roles-rgpd`, `force-majeure`) en clé JSON (`roles_rgpd`, `force_majeure`). */
export function legalSectionKey(id: string): string {
  return id.replace(/-/g, '_');
}

/** Découpe le texte sur les doubles sauts de ligne en paragraphes distincts. */
export function LegalRichText({ content }: { content: string }) {
  const blocks = content
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);
  return (
    <div className="space-y-4">
      {blocks.map((block, i) => (
        <p key={i} className="legal-doc-paragraph">
          {block}
        </p>
      ))}
    </div>
  );
}

/**
 * Section légale avec ancrage correct sous le header sticky (scroll-margin).
 * Les ids doivent correspondre exactement aux entrées `toc[].id` dans les messages.
 */
export function LegalSection({
  id,
  title,
  children,
}: {
  id: string;
  title: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="mb-12 scroll-mt-28 md:scroll-mt-32"
      aria-labelledby={`${id}-heading`}
    >
      <h2
        id={`${id}-heading`}
        className="text-[1.125rem] sm:text-xl font-semibold text-slate-900 dark:text-slate-50 mb-5 tracking-tight scroll-mt-28"
      >
        {title}
      </h2>
      <div className="text-slate-600 dark:text-slate-400 legal-doc-section-inner [&_a]:text-[#2563eb] [&_a]:font-medium [&_a]:underline [&_a]:underline-offset-[3px] [&_a]:decoration-slate-300 dark:[&_a]:decoration-slate-600 [&_a]:hover:text-[#1d4ed8]">
        {children}
      </div>
    </section>
  );
}
