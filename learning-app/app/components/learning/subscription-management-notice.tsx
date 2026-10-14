"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

export function SubscriptionManagementNotice({
  message,
  className,
  show,
}: {
  message: string;
  className: string;
  show: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [visible, setVisible] = useState(show);
  const handled = useRef(false);

  useEffect(() => {
    if (!show) {
      handled.current = false;
      return;
    }
    if (handled.current) return;
    handled.current = true;
    setVisible(true);

    const url = new URL(window.location.href);
    if (url.searchParams.get("management") === "unavailable") {
      url.searchParams.delete("management");
      router.replace(`${pathname}${url.search}${url.hash}`, { scroll: false });
    }

    window.setTimeout(() => setVisible(false), 8000);
  }, [pathname, router, show]);

  return visible ? <p className={className} role="status">{message}</p> : null;
}
