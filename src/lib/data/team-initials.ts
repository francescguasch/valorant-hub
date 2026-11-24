/** "University of North Dakota" -> "UND" */
export function teamInitials(name: string): string {
  const words = name.replace(/\b(of|the|and|at)\b/gi, " ").split(/\s+/).filter(Boolean);
  return words.slice(0, 3).map((w) => w[0]!.toUpperCase()).join("") || "VT";
}
