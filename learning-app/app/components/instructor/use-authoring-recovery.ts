"use client";

import { useEffect, useRef, useState } from "react";

type FormValue = string | number | boolean | string[];
type Snapshot<T> = { key: string; changes: Partial<T> };

export function authoringRecoveryKey(userId: string | undefined, ...parts: (string | number)[]) {
  return userId ? ["growvelt-learning", "authoring-v1", userId, ...parts].join(":") : null;
}

function readChanges<T extends Record<string, FormValue>>(key: string, defaults: T): Partial<T> {
  try {
    const stored = window.localStorage.getItem(key);
    if (!stored) return {};
    const data: Record<string, unknown> | null = JSON.parse(stored);
    if (!data || typeof data !== "object") return {};
    return Object.fromEntries(Object.entries(defaults).filter(([field, fallback]) => {
      const value = data[field];
      return Array.isArray(fallback)
        ? Array.isArray(value) && value.every((item) => typeof item === "string")
        : typeof value === typeof fallback;
    }).map(([field]) => [field, data[field]])) as Partial<T>;
  } catch {
    return {};
  }
}

export function useAuthoringRecovery<T extends Record<string, FormValue>>(key: string | null, defaults: T) {
  const [snapshot, setSnapshot] = useState<Snapshot<T> | null>(null);
  const latest = useRef<Snapshot<T> | null>(null);
  // Controls can receive newer saved defaults after router.refresh().
  const initialDefaults = useRef(defaults);

  useEffect(() => {
    if (!key) return;
    const timer = window.setTimeout(() => {
      if (latest.current?.key === key) return;
      const restored = { key, changes: readChanges(key, initialDefaults.current) };
      latest.current = restored;
      setSnapshot(restored);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [key]);

  function update(changes: Partial<T>) {
    if (!key) return;
    const previous = latest.current?.key === key ? latest.current.changes : readChanges(key, defaults);
    const next = { key, changes: { ...previous, ...changes } };
    latest.current = next;
    setSnapshot(next);
    try {
      window.localStorage.setItem(key, JSON.stringify(next.changes));
    } catch {
      // Continue to support manual saves when browser storage is unavailable.
    }
  }

  function clear() {
    if (!key) return;
    const cleared = { key, changes: {} };
    latest.current = cleared;
    setSnapshot(cleared);
    try {
      window.localStorage.removeItem(key);
    } catch {
      // The server save still succeeded.
    }
  }

  const changes = key && snapshot?.key === key ? snapshot.changes : {};
  return { values: { ...defaults, ...changes }, dirty: Object.keys(changes).length > 0, update, clear };
}
