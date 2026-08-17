"use client";

import { useState } from "react";

export function CourseVideoCover({
  courseId,
  alt,
  className = "course-video-cover-image",
  loading = "lazy",
}: {
  courseId: number;
  alt: string;
  className?: string;
  loading?: "eager" | "lazy";
}) {
  const [unavailable, setUnavailable] = useState(false);

  if (unavailable) return null;

  return (
    <img
      className={className}
      src={`/api/course-video-covers/${courseId}`}
      alt={alt}
      loading={loading}
      decoding="async"
      onError={() => setUnavailable(true)}
    />
  );
}
