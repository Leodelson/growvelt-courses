import Link from "next/link";

export const metadata = { title: "Admin Reviews" };

export default function DashboardAdminPage() {
  return <section className="admin-page admin-operations-page section-shell">
    <header className="admin-page-header admin-review-hero"><p className="eyebrow">Admin Reviews</p><h1>Protect the quality of Growvelt Learning.</h1><p>Review Instructor applications and submitted courses through separate, protected moderation workflows.</p></header>
    <div className="admin-operations-grid">
      <section className="admin-operation-card"><span className="admin-operation-number">01</span><div><p className="eyebrow">Instructor Reviews</p><h2>Review teaching applications.</h2><p>Inspect pending applications and grant teaching capability only through the authoritative Admin decision.</p></div><Link className="button button-primary" href="/dashboard/admin/instructors">Open Instructor Reviews <span aria-hidden="true">→</span></Link></section>
      <section className="admin-operation-card"><span className="admin-operation-number">02</span><div><p className="eyebrow">Course Reviews</p><h2>Moderate submitted learning.</h2><p>Inspect course metadata, rights declarations, curriculum, and secure quiz structure before publishing or returning a draft.</p></div><Link className="button button-secondary" href="/dashboard/admin/courses">Open Course Reviews <span aria-hidden="true">→</span></Link></section>
    </div>
  </section>;
}
