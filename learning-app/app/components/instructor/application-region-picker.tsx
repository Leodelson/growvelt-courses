"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { CountryCode } from "libphonenumber-js/min";
import styles from "./application-region-picker.module.css";

export type ApplicationRegion = { code: CountryCode; name: string; dialCode: string };

function searchable(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

function Flag({ code }: { code: CountryCode }) {
  const flag = String.fromCodePoint(...Array.from(code, (letter) => 0x1f1e6 + letter.charCodeAt(0) - 65));
  return <span aria-hidden="true">{flag}</span>;
}

export function ApplicationRegionPicker({ regions, selected, onSelect, label, placeholder, searchLabel, emptyLabel, dial = false, disabled }: {
  regions: ApplicationRegion[];
  selected: CountryCode | "";
  onSelect: (code: CountryCode) => void;
  label: string;
  placeholder: string;
  searchLabel: string;
  emptyLabel: string;
  dial?: boolean;
  disabled: boolean;
}) {
  const id = useId();
  const picker = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const current = regions.find((region) => region.code === selected);

  useEffect(() => {
    if (!open) return;
    search.current?.focus();
    function dismissOutside(event: PointerEvent) {
      if (event.target instanceof Node && !picker.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("pointerdown", dismissOutside);
    return () => document.removeEventListener("pointerdown", dismissOutside);
  }, [open]);

  function closeAndFocus() {
    setOpen(false);
    trigger.current?.focus();
  }

  const term = searchable(query.trim());
  const matches = open ? regions.filter(({ name, code, dialCode }) =>
    searchable(`${name} ${code}${dial ? ` ${dialCode}` : ""}`).includes(term),
  ) : [];

  return <div ref={picker} className={styles.picker} onBlur={(event) => {
    if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }} onKeyDown={(event) => {
    if (open && event.key === "Escape") {
      event.preventDefault();
      closeAndFocus();
    }
  }}>
    <button ref={trigger} type="button" className={styles.trigger} disabled={disabled}
      aria-label={`${label}: ${current ? `${current.name}${dial ? ` ${current.dialCode}` : ""}` : placeholder}`}
      aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => {
        setQuery("");
        setOpen(!open);
      }}>
      {current && <Flag code={current.code} />}
      <span>{current ? (dial ? current.dialCode : current.name) : placeholder}</span>
      <span className={styles.chevron} aria-hidden="true" />
    </button>
    {open && <div className={styles.popup} id={id}>
      <input ref={search} type="search" aria-label={searchLabel} placeholder={searchLabel} value={query}
        onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => {
          if (event.key === "Enter") event.preventDefault();
          if (event.key === "ArrowDown") {
            event.preventDefault();
            event.currentTarget.nextElementSibling?.querySelector("button")?.focus();
          }
        }} />
      {matches.length ? <ul aria-label={label}>
        {matches.map(({ code, name, dialCode }) => <li key={code}>
          <button type="button" aria-pressed={selected === code} onClick={() => {
            onSelect(code);
            closeAndFocus();
          }}><Flag code={code} /><span>{name}</span>{dial && <span className={styles.dialCode}>{dialCode}</span>}</button>
        </li>)}
      </ul> : <p role="status">{emptyLabel}</p>}
    </div>}
  </div>;
}
