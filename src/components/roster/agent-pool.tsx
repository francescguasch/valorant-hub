"use client";

import { useState } from "react";
import clsx from "clsx";
import { AGENT_ROLE_LABEL, AGENT_ROLE_ORDER } from "@/lib/constants";

export type AgentOpt = { id: string; name: string; role: string };
type Pick = "main" | "secondary" | undefined;

/** Tap once for main, twice for secondary, a third time to clear. Posts main_agent / secondary_agent fields. */
export function AgentPoolPicker({
  agents,
  main,
  secondary,
}: {
  agents: AgentOpt[];
  main: string[];
  secondary: string[];
}) {
  const [picks, setPicks] = useState<Record<string, Pick>>(() => {
    const out: Record<string, Pick> = {};
    main.forEach((a) => (out[a] = "main"));
    secondary.forEach((a) => (out[a] = out[a] ?? "secondary"));
    return out;
  });
  const cycle = (id: string) =>
    setPicks((p) => ({ ...p, [id]: p[id] === undefined ? "main" : p[id] === "main" ? "secondary" : undefined }));

  return (
    <>
      <div className="flex flex-col gap-4">
        {AGENT_ROLE_ORDER.map((role) => (
          <div key={role}>
            <p className="mb-2 text-[13px] text-fog">{AGENT_ROLE_LABEL[role]}s</p>
            <div className="flex flex-wrap gap-2">
              {agents
                .filter((a) => a.role === role)
                .map((a) => {
                  const pick = picks[a.id];
                  return (
                    <button
                      type="button"
                      key={a.id}
                      onClick={() => cycle(a.id)}
                      aria-pressed={Boolean(pick)}
                      className={clsx(
                        "h-9 border px-3 text-[14px] transition-colors",
                        pick === "main" && "border-accent bg-accent/15 text-bone",
                        pick === "secondary" && "border-bone/50 bg-white/[0.06] text-bone",
                        !pick && "border-line text-fog hover:text-bone",
                      )}
                    >
                      {a.name}
                      {pick ? (
                        <span className="ml-1.5 text-[11px] uppercase tracking-wide opacity-75">{pick}</span>
                      ) : null}
                    </button>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
      {Object.entries(picks).map(([id, pick]) =>
        pick ? (
          <input key={id} type="hidden" name={pick === "main" ? "main_agent" : "secondary_agent"} value={id} />
        ) : null,
      )}
    </>
  );
}
