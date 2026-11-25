"use client";

import { ChevronDown, Check, Plus, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createClient } from "@/app/lib/supabase/browser";
import styles from "./promotions.module.css";

type Course = {
  course_id: number;
  title: string;
  category: string | null;
  total_courses: number;
};

type SearchResult = { key: string; courses: Course[]; total: number; failed: boolean };

const pageSize = 24;
const maxSelections = 6;

export function FeaturedCoursePicker() {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<Course[]>([]);
  const [result, setResult] = useState<SearchResult | null>(null);
  const term = query.trim();
  const requestKey = JSON.stringify([term, page, retry]);
  const current = result?.key === requestKey ? result : null;

  useEffect(() => {
    if (open) search.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open || current) return;
    const abort = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        // The public search uses the same course eligibility rules as editorial campaigns.
        const { data, error } = await createClient().rpc("search_public_published_learning_courses", {
          p_query: term || null,
          p_sort: "newest",
          p_limit: pageSize,
          p_offset: page * pageSize,
        }).select("course_id,title,category,total_courses").abortSignal(abort.signal);
        if (abort.signal.aborted) return;
        if (error || !Array.isArray(data)) throw new Error("Course search failed.");
        const courses = data as Course[];
        setResult({ key: requestKey, courses, total: Number(courses[0]?.total_courses ?? 0), failed: false });
      } catch {
        if (!abort.signal.aborted) setResult({ key: requestKey, courses: [], total: 0, failed: true });
      }
    }, term ? 220 : 0);
    return () => {
      window.clearTimeout(timer);
      abort.abort();
    };
  }, [current, open, page, requestKey, term]);

  function toggleCourse(course: Course) {
    setSelected((items) => {
      if (items.some((item) => item.course_id === course.course_id)) {
        return items.filter((item) => item.course_id !== course.course_id);
      }
      return items.length < maxSelections ? [...items, course] : items;
    });
  }

  return (
    <fieldset className={styles.courseField} aria-describedby={id + "-hint"} onKeyDown={(event) => {
      if (open && event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        trigger.current?.focus();
      }
    }}>
      <legend>Featured courses</legend>
      <small id={id + "-hint"}>Select one to six published courses. The first selection opens from the Home banner.</small>
      <button ref={trigger} type="button" className={styles.pickerTrigger} aria-expanded={open}
        aria-controls={id + "-panel"} onClick={() => setOpen(!open)}>
        <Plus size={18} aria-hidden="true" />
        <span>Add courses</span>
        <ChevronDown size={17} aria-hidden="true" />
      </button>

      <div id={id + "-panel"} className={styles.pickerPanel} hidden={!open}>
        <label htmlFor={id + "-search"}>Search published courses</label>
        <input ref={search} id={id + "-search"} type="search" value={query} maxLength={120}
          placeholder="Enter a title, topic, or keyword"
          onChange={(event) => { setQuery(event.target.value); setPage(0); }}
          onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }} />

        {!current ? <p role="status">Loading courses…</p> : current.failed ? (
          <div className={styles.pickerPagination}>
            <p role="status">Courses could not be loaded.</p>
            <button type="button" onClick={() => setRetry((value) => value + 1)}>Try again</button>
          </div>
        ) : current.courses.length === 0 ? <p role="status">No courses found.</p> : (
          <ul key={requestKey} className={styles.pickerResults} aria-label="Published courses">
            {current.courses.map((course) => {
              const chosen = selected.some((item) => item.course_id === course.course_id);
              const Icon = chosen ? Check : Plus;
              return (
                <li key={course.course_id}>
                  <button type="button" aria-pressed={chosen} disabled={!chosen && selected.length >= maxSelections}
                    onClick={() => toggleCourse(course)}>
                    <span>{course.title}{course.category && <small>{course.category}</small>}</span>
                    <Icon size={17} aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <div className={styles.pickerPagination}>
          {page > 0 && <button type="button" onClick={() => setPage(page - 1)}>Previous page</button>}
          {current && !current.failed && (page + 1) * pageSize < current.total && (
            <button type="button" onClick={() => setPage(page + 1)}>Next page</button>
          )}
        </div>
      </div>

      {selected.length > 0 && (
        <ul className={styles.pickerSelections} aria-label="Selected courses">
          {selected.map((course) => (
            <li key={course.course_id}>
              <input type="hidden" name="campaignCourseIds" value={course.course_id} />
              <button type="button" onClick={() => toggleCourse(course)} aria-label={`Remove ${course.title}`}>
                <span>{course.title}</span><X size={15} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <small role="status">{selected.length} of {maxSelections} selected</small>
    </fieldset>
  );
}
