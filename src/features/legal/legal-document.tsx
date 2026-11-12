import type { ReactNode } from "react";

/** Long-form legal text: numbered sections with readable spacing. */
export function LegalDocument({ title, updatedAt, intro, children }: { title: string; updatedAt: string; intro: ReactNode; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl">
      <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
      <p className="mt-2 text-sm text-fg-subtle">Última atualização: {updatedAt}</p>
      <div className="mt-6 text-[15px] leading-relaxed text-fg-muted">{intro}</div>
      <div className="mt-8 flex flex-col gap-8 text-[15px] leading-relaxed text-fg-muted [&_a]:text-accent [&_a]:underline [&_li]:mt-1 [&_strong]:text-fg [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5">{children}</div>
    </article>
  );
}

export function Clause({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`clausula-${n}`}>
      <h2 id={`clausula-${n}`} className="mb-2 font-display text-lg font-semibold text-fg">
        {n}. {title}
      </h2>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}
