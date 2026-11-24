"use client";

import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { usePWA } from "./PWAProvider";

const SESSION_DISMISSED_KEY = "growvelt-update-banner-dismissed";

function isDismissed() {
  try {
    return window.sessionStorage.getItem(SESSION_DISMISSED_KEY) === "true";
  } catch {
    return false;
  }
}

function rememberDismissal() {
  try {
    window.sessionStorage.setItem(SESSION_DISMISSED_KEY, "true");
  } catch {
    // Keep the banner dismissible for this render when browser storage is unavailable.
  }
}

export default function GrowveltUpdateBanner() {
  const { updateAvailable, applyingUpdate, applyUpdate } = usePWA();
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return isDismissed();
  });

  const dismiss = () => {
    rememberDismissal();
    setDismissed(true);
  };

  if (!updateAvailable || dismissed) {
    return null;
  }

  return (
    <aside
      aria-label="New Growvelt update available"
      className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-1/2 z-[10050] w-[min(calc(100vw-2rem),22rem)] -translate-x-1/2 rounded-xl border border-gray-200 bg-white/95 p-2.5 text-gray-950 shadow-2xl shadow-slate-950/15 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/95 dark:text-white sm:w-[28rem] sm:p-3"
    >
      <div className="flex items-start gap-2.5 sm:gap-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white shadow-lg shadow-slate-950/20 dark:bg-white dark:text-slate-950 sm:h-8 sm:w-8">
          <RefreshCw aria-hidden="true" className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-extrabold tracking-tight sm:text-sm">
            New Growvelt Learning version available
          </p>
          <p role="status" className="mt-0.5 text-[11px] leading-4 text-gray-600 dark:text-gray-300 sm:text-xs sm:leading-5">
            {applyingUpdate ? "Applying the update…" : "Refresh to see the latest changes."}
          </p>

          <div className="mt-2.5 flex justify-end gap-2 sm:mt-3">
            <button
              aria-label="Dismiss update notification"
              className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-gray-200 px-2.5 py-1.5 text-[11px] font-bold text-gray-700 transition hover:bg-gray-100 hover:text-gray-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white dark:focus-visible:ring-offset-slate-950 sm:px-3 sm:py-2 sm:text-xs"
              type="button"
              onClick={dismiss}
            >
              Not now
            </button>
            <button
              aria-label="Refresh Growvelt Learning to apply the latest update"
              className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-gradient-to-r from-purple-700 to-fuchsia-600 px-2.5 py-1.5 text-[11px] font-extrabold text-white transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-purple-900/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:from-purple-500 dark:to-fuchsia-500 dark:focus-visible:ring-offset-slate-950 sm:px-3 sm:py-2 sm:text-xs"
              type="button"
              onClick={applyUpdate}
              disabled={applyingUpdate}
            >
              Refresh
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
