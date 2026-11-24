import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-line px-5 pb-6 pt-8 sm:flex-row sm:items-end sm:justify-between sm:px-8 lg:pt-10">
      <div className="min-w-0">
        <h1 className="type-display text-[38px] font-extrabold text-bone sm:text-[46px]">{title}</h1>
        {description ? <p className="mt-2 max-w-[68ch] text-fog">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export function PageBody({ children }: { children: ReactNode }) {
  return <div className="px-5 py-6 sm:px-8 sm:py-8">{children}</div>;
}
