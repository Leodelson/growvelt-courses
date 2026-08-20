import Link from "next/link";
import { CourseStatusBadge } from "@/app/components/instructor/course-status-badge";
import { InstructorCourseActions } from "@/app/components/instructor/instructor-course-actions";
import { OperationsSearchControls } from "@/app/components/operations-search-controls";
import { SearchHighlight } from "@/app/components/search-highlight";
import { searchOwnInstructorCourses } from "@/app/lib/instructor/courses";
import { normalizeOperationsQuery, operationsHref } from "@/app/lib/operations-query";
import { getRequestLocale } from "@/app/lib/i18n-server";

export const metadata = { title: "Your courses" };

export default async function DashboardInstructorCoursesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [resolvedSearchParams, locale] = await Promise.all([searchParams, getRequestLocale()]);
  const query = normalizeOperationsQuery(resolvedSearchParams);
  const text = locale === "fr" ? { eyebrow: "Espace instructeur", archived: "Cours archivés", all: "Tous les cours", title: "Vos cours", archivedCopy: "Les cours archivés sont masqués du catalogue. Restaurez-en un lorsque vous êtes prêt à le proposer de nouveau.", copy: "Créez des leçons et des quiz structurés, soumettez des brouillons complets à l’examen et suivez chaque cours tout au long de son cycle de publication.", create: "Créer un cours", search: "Rechercher vos cours", placeholder: "Titre, sujet, catégorie ou niveau", status: "Statut", allStatuses: "Tous les statuts", matching: "correspondants", course: "cours", courses: "cours", page: "Page", previous: "Précédent", next: "Suivant", end: "Fin de Mes cours", showing: "Affichage de", noMatch: "Aucun cours correspondant", first: "Votre premier cours", different: "Essayez une autre recherche ou un autre filtre.", clearCopy: "Effacez votre recherche ou filtre de statut pour voir tous les cours de votre espace.", firstTitle: "Commencez avec une idée de cours claire.", firstCopy: "Créez les détails du cours, ajoutez des modules avec des activités texte, vidéo et quiz, puis soumettez le brouillon terminé à Growvelt.", clear: "Effacer les filtres", firstDraft: "Créer votre premier brouillon" } : locale === "es" ? { eyebrow: "Espacio del instructor", archived: "Cursos archivados", all: "Todos los cursos", title: "Tus cursos", archivedCopy: "Los cursos archivados se ocultan del catálogo. Restaura uno cuando estés listo para volver a ofrecerlo.", copy: "Crea lecciones y cuestionarios estructurados, envía borradores completos a revisión y sigue cada curso durante su ciclo de publicación.", create: "Crear curso", search: "Buscar tus cursos", placeholder: "Título, tema, categoría o nivel", status: "Estado", allStatuses: "Todos los estados", matching: "coincidentes", course: "curso", courses: "cursos", page: "Página", previous: "Anterior", next: "Siguiente", end: "Fin de Mis cursos", showing: "Mostrando", noMatch: "No hay cursos coincidentes", first: "Tu primer curso", different: "Prueba con otra búsqueda o filtro.", clearCopy: "Borra la búsqueda o el filtro de estado para ver todos los cursos de tu espacio.", firstTitle: "Comienza con una idea de curso clara.", firstCopy: "Crea los detalles del curso, añade módulos con actividades de texto, vídeo y cuestionarios y después envía el borrador terminado a Growvelt.", clear: "Limpiar filtros", firstDraft: "Crear tu primer borrador" } : { eyebrow: "Instructor workspace", archived: "Archived courses", all: "All courses", title: "Your courses", archivedCopy: "Archived courses are hidden from the catalog. Restore one whenever you are ready to offer it again.", copy: "Create structured lessons and quizzes, submit complete drafts for review, and follow each course through its publishing lifecycle.", create: "Create course", search: "Search your courses", placeholder: "Title, topic, category, or level", status: "Status", allStatuses: "All statuses", matching: "matching", course: "course", courses: "courses", page: "Page", previous: "Previous", next: "Next", end: "End of My Courses", showing: "Showing", noMatch: "No matching courses", first: "Your first course", different: "Try a different search or filter.", clearCopy: "Clear your search or status filter to see every course in your workspace.", firstTitle: "Start with a clear course idea.", firstCopy: "Create the course details, build modules with text, video, and quiz activities, then submit the finished draft for Growvelt review.", clear: "Clear filters", firstDraft: "Create your first draft" };
  const result = await searchOwnInstructorCourses(query.query, query.status, query.page);
  const { courses, total, page, pageSize } = result;
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const isArchivedView = query.status === "archived";

  return (
    <section className="course-management-page section-shell">
      <header className="course-management-heading">
        <div>
          <p className="eyebrow">{text.eyebrow}</p><h1>{isArchivedView ? text.archived : text.title}</h1><p>{isArchivedView ? text.archivedCopy : text.copy}</p>
        </div>
        <div className="course-management-actions"><Link className="button button-secondary" href={isArchivedView ? "/dashboard/instructor/courses" : "/dashboard/instructor/courses?status=archived"}>{isArchivedView ? text.all : text.archived}</Link><Link className="button button-primary" href="/dashboard/instructor/courses/new">{text.create}</Link></div>
      </header>
      <OperationsSearchControls basePath="/dashboard/instructor/courses" query={query} fields={[
        { name: "query", label: text.search, placeholder: text.placeholder },
        { name: "status", label: text.status, options: [{ value: "", label: text.allStatuses }, { value: "draft", label: locale === "fr" ? "Brouillon" : locale === "es" ? "Borrador" : "Draft" }, { value: "pending_review", label: locale === "fr" ? "En attente" : locale === "es" ? "En revisión" : "Pending review" }, { value: "published", label: locale === "fr" ? "Publié" : locale === "es" ? "Publicado" : "Published" }, { value: "archived", label: locale === "fr" ? "Archivé" : locale === "es" ? "Archivado" : "Archived" }] },
      ]} />
      {courses.length ? <>
        <div className="instructor-course-summary" aria-label={`${text.search} ${text.title}`}><span><strong>{total}</strong> {text.matching} {total === 1 ? text.course : text.courses}</span><span>{text.page} {page} / {lastPage}</span></div>
        <section className="instructor-course-list" aria-label={text.title}>
          {courses.map((course) => <article className="instructor-course-row" key={course.course_id}>
            <div><div className="course-row-meta"><CourseStatusBadge status={course.status} /><span><SearchHighlight text={course.category || "Uncategorized"} query={query.query} /></span><span><SearchHighlight text={course.level || "Level not set"} query={query.query} /></span></div><h2><SearchHighlight text={course.title} query={query.query} /></h2><p><SearchHighlight text={course.summary || "No summary added yet."} query={query.query} /></p></div>
            <div className="course-row-actions"><span>{course.is_free ? "Free" : `${course.price_currency || "NGN"} ${Number(course.price_amount ?? 0).toLocaleString("en-NG")}`}</span><InstructorCourseActions courseId={course.course_id} status={course.status} title={course.title} /></div>
          </article>)}
        </section>
        <nav className="operations-pagination" aria-label="Course results pages">
          {page > 1 && <Link className="button button-secondary" href={operationsHref("/dashboard/instructor/courses", query, { page: page - 1 })}>{text.previous}</Link>}
          {page < lastPage && <Link className="button button-secondary" href={operationsHref("/dashboard/instructor/courses", query, { page: page + 1 })}>{text.next}</Link>}
        </nav>
        <div className="results-end-marker instructor-courses-end-marker">{page === lastPage ? text.end : `${text.showing} ${courses.length} / ${total} ${text.courses}`}</div>
      </> : <section className="course-empty-state instructor-course-empty">
        <p className="eyebrow">{query.query || query.status ? text.noMatch : text.first}</p><h2>{query.query || query.status ? text.different : text.firstTitle}</h2><p>{query.query || query.status ? text.clearCopy : text.firstCopy}</p>{query.query || query.status ? <Link className="button button-secondary" href="/dashboard/instructor/courses">{text.clear}</Link> : <Link className="button button-primary" href="/dashboard/instructor/courses/new">{text.firstDraft}</Link>}
      </section>}
    </section>
  );
}
