"use client";

import type { SelectHTMLAttributes } from "react";

/** A select inside a GET form that applies itself as soon as it changes (the form still works without JS). */
export function AutoSubmitSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} onChange={(e) => e.currentTarget.form?.requestSubmit()} />;
}
