import type { ReactNode } from "react";

export function SearchHighlight({ text, query }: { text: string; query: string }): ReactNode {
  const term = query.trim();
  if (!term) return text;
  const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.split(new RegExp(`(${escapedTerm})`, "ig")).map((part, index) => part.toLowerCase() === term.toLowerCase() ? <mark key={index}>{part}</mark> : part);
}
