"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import type { SectionKey } from "@/lib/sections";
import { NavLinks } from "./nav";

/** Top bar with a slide-in menu for phones and tablets. */
export function MobileNav({ brand, footer, locked }: { brand: ReactNode; footer: ReactNode; locked: SectionKey[] }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <div className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line bg-rail/95 pr-2 backdrop-blur">
        <div className="min-w-0 [&>a]:py-3">{brand}</div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="grid size-11 place-items-center text-bone"
          aria-expanded={open}
          aria-controls="mobile-menu"
        >
          <Menu className="size-6" aria-hidden />
          <span className="sr-only">Open menu</span>
        </button>
      </div>

      <div
        className={`fixed inset-0 z-40 bg-black/60 transition-opacity ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={() => setOpen(false)}
        aria-hidden
      />
      <div
        id="mobile-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        inert={!open}
        className={`fixed inset-y-0 left-0 z-50 flex w-[290px] max-w-[85vw] flex-col border-r border-line bg-rail transition-transform duration-200 ease-[var(--ease-snap)] ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between pr-2">
          <div className="min-w-0">{brand}</div>
          <button type="button" onClick={() => setOpen(false)} className="grid size-11 place-items-center text-fog hover:text-bone">
            <X className="size-6" aria-hidden />
            <span className="sr-only">Close menu</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto pb-4">
          <NavLinks locked={locked} onNavigate={() => setOpen(false)} />
        </div>
        {footer}
      </div>
    </div>
  );
}
