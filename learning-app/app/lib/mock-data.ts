// Local illustration data only. This file must not be treated as platform data.
export type MockCourse = { slug: string; title: string; category: string; level: string; outcome: string; duration: string; proof: string; price: string; visual: string; visualLabel: string };
export type MockLearningPath = { index: string; title: string; description: string; focus: string; stage: string };
export type MockProgressCourse = { title: string; category: string; progress: number; nextLesson: string; visual: string; shortLabel: string };

export const mockSkillAreas = [
  { name: "Data & Analytics", shortLabel: "DA", description: "Turn information into useful decisions." },
  { name: "AI for Work", shortLabel: "AI", description: "Use modern tools with sound judgement." },
  { name: "Digital Product", shortLabel: "DP", description: "Design clearer digital experiences." },
  { name: "Growth & Marketing", shortLabel: "GM", description: "Build practical communication skills." },
];

export const mockLearningPaths: MockLearningPath[] = [
  { index: "01", title: "Data confidence", description: "A steady route through spreadsheets, SQL thinking, and practical reporting.", focus: "Data Analytics", stage: "Foundation" },
  { index: "02", title: "Digital builder", description: "Learn the language of products, interfaces, and useful web experiences.", focus: "Product skills", stage: "In development" },
  { index: "03", title: "AI at work", description: "Apply AI thoughtfully to research, workflow, and better everyday output.", focus: "Applied AI", stage: "Foundation" },
];

export const mockCourses: MockCourse[] = [
  { slug: "data-analytics-foundations", title: "Data Analytics Foundations", category: "Data & Analytics", level: "Beginner", outcome: "Build a practical reporting workflow from question to insight.", duration: "6 guided lessons", proof: "Practice project", price: "Free preview", visual: "data", visualLabel: "DATA" },
  { slug: "sql-for-clearer-questions", title: "SQL for Clearer Questions", category: "Data & Analytics", level: "Beginner", outcome: "Learn to explore structured data with confidence and care.", duration: "8 guided lessons", proof: "Skill exercise", price: "Planned paid course", visual: "sql", visualLabel: "SQL" },
  { slug: "ai-workflows-that-help", title: "AI Workflows That Help", category: "AI for Work", level: "Intermediate", outcome: "Build useful, responsible AI-assisted work habits.", duration: "5 guided lessons", proof: "Practical workflow", price: "Free preview", visual: "ai", visualLabel: "AI" },
  { slug: "product-thinking-for-teams", title: "Product Thinking for Teams", category: "Digital Product", level: "Beginner", outcome: "Frame user problems and turn them into clearer product choices.", duration: "7 guided lessons", proof: "Project brief", price: "Planned paid course", visual: "product", visualLabel: "PRODUCT" },
];

export const mockDashboardLearning = {
  currentCourse: { title: "Data Analytics Foundations", nextLesson: "Next: Turn a business question into a useful metric", progress: 42 },
  courses: [
    { title: "Data Analytics Foundations", category: "Data & Analytics", progress: 42, nextLesson: "Next: Useful metrics", visual: "data", shortLabel: "DA" },
    { title: "AI Workflows That Help", category: "AI for Work", progress: 16, nextLesson: "Next: Framing a task", visual: "ai", shortLabel: "AI" },
  ] satisfies MockProgressCourse[],
  milestone: { title: "Draft your first insight brief", description: "Your next demo milestone turns a learning concept into a short practical summary." },
};
