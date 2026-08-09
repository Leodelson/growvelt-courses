import { CourseCard } from "@/app/components/course-card";
import { PublicHeader } from "@/app/components/public-header";
import { mockCourses, mockSkillAreas } from "@/app/lib/mock-data";

export const metadata = { title: "Explore" };

export default function LearnPage() {
  return <div className="public-page"><PublicHeader /><main className="catalog-page section-shell"><header className="catalog-hero"><p className="eyebrow">Explore Growvelt Learning</p><h1>Find a focused place to begin.</h1><p>This is a preview of the future catalog. Search, filters, and course details will become available with the course-data foundation.</p></header><section className="catalog-controls" aria-label="Catalog discovery preview" aria-describedby="catalog-preview-note"><label>Search courses<input type="search" placeholder="Try data, design, AI, or marketing" disabled /></label><button type="button" disabled>All skill areas <span aria-hidden="true">⌄</span></button><button type="button" disabled>All levels <span aria-hidden="true">⌄</span></button></section><p id="catalog-preview-note" className="catalog-preview-note">Catalog controls are preview-only in this foundation.</p><div className="catalog-layout"><aside className="catalog-aside"><p className="eyebrow">Skill areas</p>{mockSkillAreas.map((skill) => <button key={skill.name} type="button" disabled>{skill.name}</button>)}</aside><section aria-labelledby="catalog-title"><div className="section-heading"><div><p className="eyebrow">Curated courses</p><h2 id="catalog-title">Practical learning, clearly organised.</h2></div><p className="demo-chip">Catalog preview</p></div><div className="course-grid">{mockCourses.map((course) => <CourseCard course={course} key={course.slug} />)}</div></section></div></main></div>;
}
