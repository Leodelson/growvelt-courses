"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type BeforeInstallPromptChoice = {
  outcome: "accepted" | "dismissed";
  platform: string;
};

type BeforeInstallPromptEvent = Event & {
  platforms?: string[];
  userChoice: Promise<BeforeInstallPromptChoice>;
  prompt: () => Promise<void>;
};

type InstallResult = "accepted" | "dismissed" | "unavailable" | "installed";

type PWAContextValue = {
  canInstall: boolean;
  isInstalled: boolean;
  isStandalone: boolean;
  isIOS: boolean;
  isReady: boolean;
  updateAvailable: boolean;
  applyingUpdate: boolean;
  promptInstall: () => Promise<InstallResult>;
  applyUpdate: () => void;
};

const PWAContext = createContext<PWAContextValue | null>(null);

function getStandaloneState() {
  if (typeof window === "undefined") {
    return false;
  }

  const standaloneMedia = window.matchMedia?.("(display-mode: standalone)").matches ?? false;
  const navigatorStandalone =
    getIOSState() &&
    "standalone" in window.navigator &&
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

  return standaloneMedia || navigatorStandalone;
}

function getIOSState() {
  if (typeof window === "undefined") {
    return false;
  }

  const userAgent = window.navigator.userAgent.toLowerCase();
  const touchMac = window.navigator.maxTouchPoints > 1 && userAgent.includes("macintosh");

  return /iphone|ipad|ipod/.test(userAgent) || touchMac;
}

async function registerServiceWorker(onUpdateReady: (worker: ServiceWorker) => void) {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }

  if (window.location.protocol !== "https:" && window.location.hostname !== "localhost") {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });

    // Ask the browser to compare the service worker promptly after a deployment.
    // This never caches app data or affects authentication requests.
    if (registration.waiting && navigator.serviceWorker.controller) {
      onUpdateReady(registration.waiting);
    }

    registration.addEventListener("updatefound", () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener("statechange", () => {
        if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
          onUpdateReady(newWorker);
        }
      });
    });
    void registration.update().catch(() => { /* Offline browsers retry later. */ });
  } catch (error) {
    console.warn("Growvelt service worker registration failed", error);
  }
}

export function PWAProvider({ children }: { children: ReactNode }) {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [applyingUpdate, setApplyingUpdate] = useState(false);
  const waitingWorkerRef = useRef<ServiceWorker | null>(null);
  const applyingWorkerRef = useRef<ServiceWorker | null>(null);

  useEffect(() => {
    const updateStandaloneState = () => {
      const standalone = getStandaloneState();
      setIsStandalone(standalone);
      setIsInstalled(standalone);
    };

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setInstallPrompt(null);
      setIsInstalled(true);
      setIsStandalone(true);
    };

    const handleUpdateReady = (worker: ServiceWorker) => {
      waitingWorkerRef.current = worker;
      setUpdateAvailable(true);
    };

    const handleLoad = () => registerServiceWorker(handleUpdateReady);

    const standaloneQuery = window.matchMedia?.("(display-mode: standalone)");

    const readyTimer = window.setTimeout(() => {
      setIsIOS(getIOSState());
      updateStandaloneState();
      setIsReady(true);
    }, 0);

    if (document.readyState === "complete") {
      registerServiceWorker(handleUpdateReady);
    } else {
      window.addEventListener("load", handleLoad, { once: true });
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    standaloneQuery?.addEventListener?.("change", updateStandaloneState);

    return () => {
      window.removeEventListener("load", handleLoad);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      standaloneQuery?.removeEventListener?.("change", updateStandaloneState);
      window.clearTimeout(readyTimer);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<InstallResult> => {
    if (isInstalled || getStandaloneState()) {
      setIsInstalled(true);
      setIsStandalone(true);
      return "installed";
    }

    if (!installPrompt) {
      return "unavailable";
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setInstallPrompt(null);

    if (choice.outcome === "accepted") {
      setIsInstalled(true);
    }

    return choice.outcome;
  }, [installPrompt, isInstalled]);

  const applyUpdate = useCallback(() => {
    const waitingWorker = waitingWorkerRef.current;
    if (!waitingWorker || applyingWorkerRef.current) return;
    applyingWorkerRef.current = waitingWorker;
    setApplyingUpdate(true);

    const checkActivation = () => {
      if (waitingWorker.state === "activated") {
        waitingWorker.removeEventListener("statechange", checkActivation);
        window.location.reload();
      } else if (waitingWorker.state === "redundant") {
        waitingWorker.removeEventListener("statechange", checkActivation);
        applyingWorkerRef.current = null;
        setApplyingUpdate(false);
        if (waitingWorkerRef.current === waitingWorker) {
          waitingWorkerRef.current = null;
          setUpdateAvailable(false);
        }
      }
    };

    waitingWorker.addEventListener("statechange", checkActivation);
    if (waitingWorker.state === "installed") {
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
    } else {
      checkActivation();
    }
  }, []);

  const value = useMemo<PWAContextValue>(
    () => ({
      canInstall: Boolean(installPrompt) && !isInstalled && !isStandalone,
      isInstalled,
      isStandalone,
      isIOS,
      isReady,
      updateAvailable,
      applyingUpdate,
      promptInstall,
      applyUpdate,
    }),
    [installPrompt, isInstalled, isStandalone, isIOS, isReady, updateAvailable, applyingUpdate, promptInstall, applyUpdate]
  );

  return <PWAContext.Provider value={value}>{children}</PWAContext.Provider>;
}

export function usePWA() {
  const context = useContext(PWAContext);

  if (!context) {
    throw new Error("usePWA must be used within PWAProvider");
  }

  return context;
}
