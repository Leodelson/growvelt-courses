"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { operationsHref, type OperationsQuery } from "@/app/lib/operations-query";
import { useLanguage } from "@/app/components/language-provider";

type FieldName = "query" | "status" | "category" | "level";

type SearchField = {
  name: FieldName;
  label: string;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
};

export function OperationsSearchControls({ basePath, query, fields }: { basePath: string; query: OperationsQuery; fields: SearchField[] }) {
  const router = useRouter();
  const { locale } = useLanguage();
  const text = locale === "fr" ? { search: "Rechercher", reset: "Réinitialiser" } : locale === "es" ? { search: "Buscar", reset: "Restablecer" } : { search: "Search", reset: "Reset" };
  const initialValues = useMemo(() => ({ query: query.query, status: query.status, category: query.category, level: query.level }), [query.category, query.level, query.query, query.status]);
  const initialKey = `${initialValues.query}\u0000${initialValues.status}\u0000${initialValues.category}\u0000${initialValues.level}`;
  const [draft, setDraft] = useState({ key: initialKey, values: initialValues });
  const values = draft.key === initialKey ? draft.values : initialValues;
  const setValues = useCallback((update: typeof values | ((current: typeof values) => typeof values)) => {
    setDraft((current) => {
      const currentValues = current.key === initialKey ? current.values : initialValues;
      return { key: initialKey, values: typeof update === "function" ? update(currentValues) : update };
    });
  }, [initialKey, initialValues]);

  const commit = useCallback((nextValues: typeof values) => {
    router.replace(operationsHref(basePath, { ...query, ...nextValues, page: 1 }), { scroll: false });
  }, [basePath, query, router]);

  useEffect(() => {
    if (Object.keys(values).every((key) => values[key as FieldName] === initialValues[key as FieldName])) return;
    const timer = window.setTimeout(() => commit(values), 280);
    return () => window.clearTimeout(timer);
  }, [commit, initialValues, values]);

  return <form className="operations-controls" onSubmit={(event) => { event.preventDefault(); commit(values); }}>
    {fields.map((field) => <label key={field.name}>
      {field.label}
      {field.options ? <select value={values[field.name]} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}>
        {field.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select> : <input type={field.name === "query" ? "search" : "text"} value={values[field.name]} placeholder={field.placeholder} maxLength={field.name === "query" ? 120 : 100} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))} />}
    </label>)}
    <button className="button button-primary" type="submit">{text.search}</button>
    <button className="button button-secondary" type="button" onClick={() => router.replace(basePath, { scroll: false })}>{text.reset}</button>
  </form>;
}
