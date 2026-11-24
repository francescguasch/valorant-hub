import { Hammer } from "lucide-react";
import { PageBody, PageHeader } from "./page-header";

/** Shown on sections scheduled for a later build phase. */
export function ComingNext({
  title,
  description,
  phase,
  items,
}: {
  title: string;
  description: string;
  phase: 2 | 3;
  items: string[];
}) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <PageBody>
        <div className="max-w-2xl border border-line bg-panel p-6">
          <p className="flex items-center gap-2 font-semibold text-bone">
            <Hammer className="size-4 text-accent" aria-hidden /> Arrives in phase {phase}
          </p>
          <p className="mt-2 text-fog">
            The database for this section is already in place. The screens to enter and review the data are built in
            phase {phase}. It will include:
          </p>
          <ul className="mt-4 grid gap-x-6 gap-y-1.5 text-[14.5px] text-bone sm:grid-cols-2">
            {items.map((i) => (
              <li key={i} className="flex items-start gap-2">
                <span aria-hidden className="mt-[10px] h-[2px] w-2.5 shrink-0 bg-accent" />
                {i}
              </li>
            ))}
          </ul>
        </div>
      </PageBody>
    </>
  );
}
