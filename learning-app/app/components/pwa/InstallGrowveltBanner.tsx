"use client";

import { Download, HelpCircle, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import InstallInstructionsDialog from "./InstallInstructionsDialog";
import { usePWA } from "./PWAProvider";

const DISMISSED_UNTIL_KEY = "growvelt-install-banner-dismissed-until";
const SESSION_SHOWN_KEY = "growvelt-install-banner-shown";
const SESSION_VISITED_KEY = "growvelt-install-banner-visited-paths";
const DISMISSAL_DAYS = 30;
const ENGAGEMENT_DELAY_MS = 60_000;

const excludedPrefixes = [
  "/api",
  "/auth",
  "/dashboard",
  "/settings",
  "/payments",
  "/learn",
  "/instructor",
  "/company-learning",
  "/admin",
  "/certificates",
  "/verify-certificate",
  "/signed-out",
];

function getStoredTimestamp(key: string) {
  if (typeof window === "undefined") {
    return 0;
  }

  let value: string | null = null;
  try {
    value = window.localStorage.getItem(key);
  } catch {
    return 0;
  }
  const timestamp = value ? Number(value) : 0;

  return Number.isFinite(timestamp) ? timestamp : 0;
}

function isExcludedRoute(pathname: string) {
  return excludedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function readVisitedPaths() {
  try {
    const raw = window.sessionStorage.getItem(SESSION_VISITED_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function writeVisitedPaths(paths: string[]) {
  try {
    window.sessionStorage.setItem(SESSION_VISITED_KEY, JSON.stringify(paths.slice(-5)));
  } catch {
    // The install prompt remains usable when browser storage is unavailable.
  }
}

function hasSessionFlag(key: string) {
  try {
    return window.sessionStorage.getItem(key) === "true";
  } catch {
    return false;
  }
}

function setSessionFlag(key: string) {
  try {
    window.sessionStorage.setItem(key, "true");
  } catch {
    // The prompt may repeat in a later render when browser storage is unavailable.
  }
}

function setDismissalTimestamp(timestamp: number) {
  try {
    window.localStorage.setItem(DISMISSED_UNTIL_KEY, String(timestamp));
  } catch {
    // Dismissal still applies for the current render without persistent storage.
  }
}

export default function InstallGrowveltBanner() {
  const pathname = usePathname() || "/";
  const { isInstalled, isStandalone, isReady, promptInstall } = usePWA();
  const [visible, setVisible] = useState(false);
  const [instructionsOpen, setInstructionsOpen] = useState(false);

  const excluded = useMemo(() => isExcludedRoute(pathname), [pathname]);
  const installed = isInstalled || isStandalone;

  useEffect(() => {
    if (!isReady || installed || excluded || visible) {
      return;
    }

    const now = Date.now();
    const dismissedUntil = getStoredTimestamp(DISMISSED_UNTIL_KEY);

    if (dismissedUntil > now || hasSessionFlag(SESSION_SHOWN_KEY)) {
      return;
    }

    const visitedPaths = readVisitedPaths();
    const nextVisitedPaths = visitedPaths.includes(pathname) ? visitedPaths : [...visitedPaths, pathname];
    writeVisitedPaths(nextVisitedPaths);

    if (nextVisitedPaths.length >= 2) {
      setSessionFlag(SESSION_SHOWN_KEY);
      const showTimer = window.setTimeout(() => setVisible(true), 0);
      return () => window.clearTimeout(showTimer);
    }

    const timer = window.setTimeout(() => {
      if (hasSessionFlag(SESSION_SHOWN_KEY)) {
        return;
      }

      const dismissed = getStoredTimestamp(DISMISSED_UNTIL_KEY);
      if (dismissed <= Date.now() && !isExcludedRoute(window.location.pathname)) {
        setVisible(true);
        setSessionFlag(SESSION_SHOWN_KEY);
      }
    }, ENGAGEMENT_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [excluded, installed, isReady, pathname, visible]);

  const dismiss = () => {
    const dismissedUntil = Date.now() + DISMISSAL_DAYS * 24 * 60 * 60 * 1000;
    setDismissalTimestamp(dismissedUntil);
    setSessionFlag(SESSION_SHOWN_KEY);
    setVisible(false);
  };

  const handleInstall = async () => {
    const result = await promptInstall();

    if (result === "unavailable") {
      setInstructionsOpen(true);
      return;
    }

    if (result === "accepted" || result === "installed") {
      setVisible(false);
      setSessionFlag(SESSION_SHOWN_KEY);
    }
  };

  if (!visible || installed || excluded) {
    return <InstallInstructionsDialog open={instructionsOpen} onClose={() => setInstructionsOpen(false)} />;
  }

  return (
    <>
      <aside
        aria-label="Install Growvelt app"
        className="fixed inset-x-3 bottom-3 z-[1090] mx-auto max-w-4xl rounded-3xl border border-purple-200 bg-white/95 p-4 text-gray-950 shadow-2xl shadow-purple-950/15 backdrop-blur-xl dark:border-purple-400/20 dark:bg-slate-950/95 dark:text-white sm:bottom-5 sm:p-5"
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-700 to-fuchsia-600 text-white shadow-lg shadow-purple-900/20">
              <Download aria-hidden="true" className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-black tracking-tight sm:text-base">Get the Growvelt Learning App</p>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300">
                Install Growvelt Learning for quicker access to courses, lessons, and your learning workspace.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center md:shrink-0">
            <button
              aria-label="Install Growvelt on this device"
              className="inline-flex cursor-pointer items-center justify-center rounded-full bg-gradient-to-r from-purple-700 to-fuchsia-600 px-4 py-2.5 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-purple-900/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:from-purple-500 dark:to-fuchsia-500 dark:focus-visible:ring-offset-slate-950"
              type="button"
              onClick={handleInstall}
            >
              Install
            </button>
            <button
              aria-label="Learn how to install Growvelt"
              className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-700 transition hover:border-purple-300 hover:bg-purple-50 hover:text-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-white/10 dark:text-gray-200 dark:hover:border-purple-400/30 dark:hover:bg-white/10 dark:hover:text-white dark:focus-visible:ring-offset-slate-950"
              type="button"
              onClick={() => setInstructionsOpen(true)}
            >
              <HelpCircle aria-hidden="true" className="h-4 w-4" />
              Learn How
            </button>
            <button
              aria-label="Dismiss Growvelt install suggestion"
              className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-gray-200 text-gray-500 transition hover:bg-gray-100 hover:text-gray-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white dark:focus-visible:ring-offset-slate-950"
              type="button"
              onClick={dismiss}
            >
              <X aria-hidden="true" className="h-5 w-5" />
            </button>
          </div>
        </div>
      </aside>

      <InstallInstructionsDialog open={instructionsOpen} onClose={() => setInstructionsOpen(false)} />
    </>
  );
}
