"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { LearningMark } from "@/app/components/learning-mark";
import { LearningIcon } from "@/app/components/learning-icon";

export function SidebarBrandControls({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (searchOpen && !collapsed) inputRef.current?.focus();
  }, [searchOpen, collapsed]);

  return <div className="sidebar-brand-controls">
    <div className="sidebar-brand-row">
      <LearningMark href="/dashboard" />
      <button ref={searchButtonRef} className="sidebar-search-button" type="button" aria-label="Search courses" title="Search courses" aria-expanded={searchOpen && !collapsed} aria-controls="sidebar-course-search" onClick={() => { if (collapsed) onToggle(); setSearchOpen(collapsed || !searchOpen); }}><Search size={20} aria-hidden="true" /></button>
      <button className="sidebar-collapse-button" type="button" aria-label={collapsed ? "Expand dashboard navigation" : "Collapse dashboard navigation"} title={collapsed ? "Expand navigation" : "Collapse navigation"} aria-expanded={!collapsed} onClick={() => { setSearchOpen(false); onToggle(); }}><LearningIcon name="collapse" /></button>
    </div>
    {searchOpen && !collapsed && <form id="sidebar-course-search" className="sidebar-course-search" role="search" aria-label="Search learning catalog" action="/dashboard/explore" method="get" onKeyDown={(event) => { if (event.key === "Escape") { setSearchOpen(false); searchButtonRef.current?.focus(); } }}>
      <label className="sr-only" htmlFor="sidebar-course-query">Search courses</label>
      <input ref={inputRef} id="sidebar-course-query" name="q" type="search" maxLength={120} placeholder="Search courses…" />
      <button type="submit" aria-label="Submit course search"><Search size={18} aria-hidden="true" /></button>
    </form>}
  </div>;
}
