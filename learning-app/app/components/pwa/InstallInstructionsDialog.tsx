"use client";

import { X } from "lucide-react";
import { useEffect, useId } from "react";

type InstallInstructionsDialogProps = {
  open: boolean;
  onClose: () => void;
};

const instructionGroups = [
  {
    title: "Android Chrome",
    steps: ["Open Growvelt in Chrome.", "Tap the menu button.", "Choose Install app or Add to Home screen."],
  },
  {
    title: "Windows Chrome",
    steps: ["Open Growvelt in Chrome.", "Click the install icon in the address bar.", "Confirm Install."],
  },
  {
    title: "Microsoft Edge",
    steps: ["Open Growvelt in Edge.", "Click the Apps or install icon in the address bar.", "Choose Install this site as an app."],
  },
  {
    title: "macOS Chrome",
    steps: ["Open Growvelt in Chrome.", "Click the install icon in the address bar.", "Confirm Install."],
  },
  {
    title: "macOS Safari",
    steps: ["Open Growvelt in Safari.", "Choose File from the menu bar.", "Select Add to Dock if your Safari version supports it."],
  },
  {
    title: "iPhone and iPad Safari",
    steps: ["Open Growvelt in Safari.", "Tap Share.", "Choose Add to Home Screen, then tap Add."],
  },
];

export default function InstallInstructionsDialog({ open, onClose }: InstallInstructionsDialogProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div
      aria-labelledby={titleId}
      aria-modal="true"
      className="fixed inset-0 z-[1200] flex items-end justify-center bg-black/55 px-4 py-4 backdrop-blur-sm sm:items-center"
      role="dialog"
    >
      <div className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-gray-200 bg-white p-5 shadow-2xl outline-none dark:border-white/10 dark:bg-slate-950 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-purple-700 dark:text-purple-300">
              Install Growvelt
            </p>
            <h2 id={titleId} className="mt-2 text-2xl font-black tracking-tight text-gray-950 dark:text-white">
              Add Growvelt to your device
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300">
              Installation depends on your browser. Use the steps below if your device does not show the native install prompt.
            </p>
          </div>

          <button
            aria-label="Close install instructions"
            className="inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-gray-200 text-gray-600 transition hover:bg-gray-100 hover:text-gray-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white"
            type="button"
            onClick={onClose}
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {instructionGroups.map((group) => (
            <section
              className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-white/[0.04]"
              key={group.title}
            >
              <h3 className="text-sm font-bold text-gray-950 dark:text-white">{group.title}</h3>
              <ol className="mt-3 space-y-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
                {group.steps.map((step) => (
                  <li className="flex gap-2" key={step}>
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-purple-600" />
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
