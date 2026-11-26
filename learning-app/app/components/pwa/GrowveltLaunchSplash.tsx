"use client";

import { useEffect, useRef } from "react";

const ICON_SRC = "/pwa/icon-any-512x512.png";

export default function GrowveltLaunchSplash() {
  const closingRef = useRef(false);

  useEffect(() => {
    const root = document.documentElement;
    if (root.dataset.growveltLaunchPending !== "true") return;

    const icon = new Image();
    icon.src = ICON_SRC;
    const iconReady = icon.decode().catch(() => undefined);

    let released = false;
    let frameOne = 0;
    let frameTwo = 0;
    const release = () => {
      if (released || closingRef.current) return;
      released = true;
      closingRef.current = true;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        delete root.dataset.growveltLaunchPending;
        delete root.dataset.growveltLaunchClosing;
        return;
      }
      root.dataset.growveltLaunchClosing = "true";
      window.setTimeout(() => {
        delete root.dataset.growveltLaunchPending;
        delete root.dataset.growveltLaunchClosing;
      }, 160);
    };

    const checkReady = async () => {
      if (document.readyState !== "complete" || !document.querySelector("main")) return;
      await iconReady;
      frameOne = window.requestAnimationFrame(() => {
        frameTwo = window.requestAnimationFrame(release);
      });
    };

    window.addEventListener("load", checkReady, { once: true });
    checkReady();

    return () => {
      window.removeEventListener("load", checkReady);
      window.cancelAnimationFrame(frameOne);
      window.cancelAnimationFrame(frameTwo);
    };
  }, []);

  return (
    <div
      aria-label="Growvelt is opening"
      className="growvelt-launch-splash"
      role="status"
    >
      <div className="growvelt-launch-lockup">
        <span className="growvelt-launch-mark" aria-hidden="true" />
        <p className="growvelt-launch-name">Growvelt</p>
      </div>
    </div>
  );
}
