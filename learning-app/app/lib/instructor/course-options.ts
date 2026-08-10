export const courseCategories = [
  "Data Analytics",
  "Business",
  "Data Science",
  "Business Intelligence",
  "Programming",
  "Web Development",
  "Cybersecurity",
  "Digital Marketing",
  "Creative Skills",
  "Digital Skills",
  "Productivity",
] as const;

export const courseLevels = ["Beginner", "Intermediate", "Beginner to intermediate", "Beginner to job-ready"] as const;

export type CourseStatus = "draft" | "pending_review" | "published" | "archived";
