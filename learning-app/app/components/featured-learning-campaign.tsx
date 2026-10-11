import { PublishedCourseCard } from "@/app/components/published-course-card";
import type { ActiveLearningCampaign } from "@/app/lib/catalog/published-courses";
import styles from "./featured-learning-campaign.module.css";

export function FeaturedLearningCampaign({
  campaign,
  authenticated,
  savedCourseIds,
  dashboard,
}: {
  campaign: ActiveLearningCampaign;
  authenticated: boolean;
  savedCourseIds: number[];
  dashboard: boolean;
}) {
  const courseHref = (slug: string) => `${dashboard ? "/dashboard/courses" : "/courses"}/${encodeURIComponent(slug)}`;

  const singleCourse = campaign.courses.length === 1;

  return <section className={`${styles.campaign} ${singleCourse ? styles.singleCourse : ""}`} aria-labelledby="featured-campaign-title">
    <div className={styles.heading}>
      <div>
        <p className="eyebrow">Featured learning</p>
        <h2 id="featured-campaign-title">{campaign.title}</h2>
        <p>{campaign.message}</p>
      </div>
      <span className={styles.editorial}>Curated by Growvelt</span>
    </div>
    <div className={`course-grid published-course-grid public-published-course-grid ${styles.courseGrid} ${singleCourse ? styles.singleCourseGrid : ""}`}>
      {campaign.courses.map((course, index) => <PublishedCourseCard
        course={course}
        index={index}
        href={courseHref(course.slug)}
        authenticated={authenticated}
        isSaved={savedCourseIds.includes(course.id)}
        key={course.id}
      />)}
    </div>
  </section>;
}
