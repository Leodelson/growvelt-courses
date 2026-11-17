"use client";

import type { ReactNode } from "react";
import { PWAProvider } from "./PWAProvider";
import InstallGrowveltBanner from "./InstallGrowveltBanner";
import GrowveltUpdateBanner from "./GrowveltUpdateBanner";

export default function LearningPWA({ children }: { children: ReactNode }) {
  return (
    <PWAProvider>
      {children}
      <InstallGrowveltBanner />
      <GrowveltUpdateBanner />
    </PWAProvider>
  );
}
