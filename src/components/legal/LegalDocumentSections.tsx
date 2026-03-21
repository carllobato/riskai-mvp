export const legalBodyClass =
  "text-[13px] leading-[1.65] text-neutral-500 dark:text-neutral-400 sm:text-sm sm:leading-[1.7]";
export const legalSubheadClass =
  "text-[12px] font-semibold tracking-tight text-neutral-800 dark:text-neutral-200 sm:text-[13px]";
export const legalInlineLinkClass =
  "font-medium text-neutral-800 underline decoration-neutral-300 underline-offset-[3px] transition-colors hover:decoration-neutral-500 dark:text-neutral-200 dark:decoration-neutral-600 dark:hover:decoration-neutral-400";

export function LegalSection({ title, children, inModal = false }: { title: string; children: React.ReactNode; inModal?: boolean }) {
  return (
    <section
      className={`border-t border-neutral-200/50 pt-7 first:border-0 first:pt-0 dark:border-neutral-800/50 ${
        inModal ? "sm:pt-8" : "sm:pt-7"
      }`}
    >
      <h2 className="text-[15px] font-semibold tracking-tight text-neutral-900 dark:text-neutral-100 sm:text-base">
        {title}
      </h2>
      <div className={`mt-3.5 space-y-3.5 ${legalBodyClass}`}>{children}</div>
    </section>
  );
}

export function LegalBulletList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-2.5 pl-[1.25rem] marker:text-neutral-400 dark:marker:text-neutral-500 [&>li]:leading-[1.65]">
      {items.map((item) => (
        <li key={item}>
          {item}
        </li>
      ))}
    </ul>
  );
}
