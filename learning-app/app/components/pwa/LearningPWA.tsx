"use client";

import type { ReactNode } from "react";
import { PWAProvider } from "./PWAProvider";
import InstallGrowveltBanner from "./InstallGrowveltBanner";
import GrowveltUpdateBanner from "./GrowveltUpdateBanner";
import GrowveltLaunchSplash from "./GrowveltLaunchSplash";

export default function LearningPWA({ children }: { children: ReactNode }) {
  return (
    <PWAProvider>
      {children}
      <InstallGrowveltBanner />
      <GrowveltUpdateBanner />
      <GrowveltLaunchSplash />
    </PWAProvider>
  );
}
