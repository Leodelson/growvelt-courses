"use client";

import { useRouter } from "next/navigation";

export function BrowserBackLink({ className, children }: { className?: string; children: React.ReactNode }) {
  const router = useRouter();
  return <button className={className} type="button" onClick={() => router.back()}>{children}</button>;
}
