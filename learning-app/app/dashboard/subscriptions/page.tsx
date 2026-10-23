import Link from "next/link";
import { EmptyState } from "@/app/components/ui/empty-state";
import { getRequestLocale } from "@/app/lib/i18n-server";
import { listOwnLearningSubscriptions } from "@/app/lib/learning/subscriptions";
import { LearningIcon } from "@/app/components/learning-icon";
import { SubscriptionManagementNotice } from "@/app/components/learning/subscription-management-notice";
import { SubscriptionWorkspace } from "@/app/components/learning/subscription-workspace";
import { accountCopy, formatSubscriptionDate } from "@/app/lib/learning/account-workspace";
import styles from "@/app/components/learning/subscriptions.module.css";

export const metadata = { title: "My subscriptions" };
export const dynamic = "force-dynamic";

const copy = {
  en: {
    eyebrow: "LEARNER BILLING", title: "My subscriptions", intro: "Review your recurring course access, next renewal status, and paid-through date.",
    emptyTitle: "No subscriptions yet", emptyCopy: "When you subscribe to an eligible course plan, its status and management options will appear here.", explore: "Explore courses",
    active: "Active", attention: "Payment needs attention", non_renewing: "Will not renew", cancelled: "Cancelled", completed: "Completed", expired: "Expired", pending: "Pending confirmation",
    paidThrough: "Access through", included: "Included courses", manage: "Manage or cancel with Paystack", manageCopy: "Paystack securely manages the recurring payment method. If you cancel, course access remains through the paid-through date.",
    noRenew: "Auto-renewal has been turned off. Your included course access remains available through the paid-through date.",
    error: "We could not open Paystack’s management page. Your subscription is unchanged; please try again later.",
    back: "Back to My Courses", end: "End of subscriptions",
  },
  fr: {
    eyebrow: "FACTURATION APPRENANT", title: "Mes abonnements", intro: "Consultez vos accès récurrents aux cours, le renouvellement et la date de fin de la période payée.",
    emptyTitle: "Aucun abonnement pour le moment", emptyCopy: "Après votre inscription à un forfait de cours, son statut et ses options de gestion apparaîtront ici.", explore: "Explorer les cours",
    active: "Actif", attention: "Paiement à vérifier", non_renewing: "Ne sera pas renouvelé", cancelled: "Annulé", completed: "Terminé", expired: "Expiré", pending: "Confirmation en attente",
    paidThrough: "Accès jusqu’au", included: "Cours inclus", manage: "Gérer ou annuler avec Paystack", manageCopy: "Paystack gère le moyen de paiement récurrent. En cas d’annulation, l’accès reste actif jusqu’à la fin de la période payée.",
    noRenew: "Le renouvellement automatique est désactivé. L’accès aux cours inclus reste disponible jusqu’à la fin de la période payée.",
    error: "Impossible d’ouvrir la page de gestion Paystack. Votre abonnement n’a pas changé ; réessayez plus tard.",
    back: "Retour à Mes cours", end: "Fin des abonnements",
  },
  es: {
    eyebrow: "FACTURACIÓN DEL ALUMNO", title: "Mis suscripciones", intro: "Consulta el acceso recurrente a tus cursos, el estado de renovación y la fecha hasta la que has pagado.",
    emptyTitle: "Aún no tienes suscripciones", emptyCopy: "Cuando te suscribas a un plan de cursos, aquí aparecerán su estado y las opciones de gestión.", explore: "Explorar cursos",
    active: "Activa", attention: "El pago requiere atención", non_renewing: "No se renovará", cancelled: "Cancelada", completed: "Completada", expired: "Vencida", pending: "Confirmación pendiente",
    paidThrough: "Acceso hasta", included: "Cursos incluidos", manage: "Gestionar o cancelar con Paystack", manageCopy: "Paystack gestiona de forma segura el método de pago recurrente. Si cancelas, conservarás el acceso hasta la fecha pagada.",
    noRenew: "La renovación automática está desactivada. El acceso a los cursos incluidos sigue disponible hasta la fecha pagada.",
    error: "No se pudo abrir la página de gestión de Paystack. La suscripción no ha cambiado; inténtalo más tarde.",
    back: "Volver a Mis cursos", end: "Fin de las suscripciones",
  },
} as const;

export default async function LearnerSubscriptionsPage({ searchParams }: { searchParams: Promise<{ management?: string }> }) {
  const [subscriptions, locale, params] = await Promise.all([
    listOwnLearningSubscriptions(), getRequestLocale(), searchParams,
  ]);
  const text = copy[locale];
  const dateLocale = locale === "fr" ? "fr-FR" : locale === "es" ? "es-ES" : "en-NG";
  const formatDate = (value: string | null) => formatSubscriptionDate(value, dateLocale);

  return <section className={`section-shell ${styles.page}`} aria-labelledby="learner-subscriptions-title">
    <Link className={`back-link ${styles.back}`} href="/dashboard/my-learning"><LearningIcon name="arrow-left" size={17} />{text.back}</Link>
    <header className={styles.hero}>
      <p className="eyebrow">{text.eyebrow}</p>
      <h1 id="learner-subscriptions-title">{text.title}</h1>
      <p>{text.intro}</p>
    </header>
    <SubscriptionManagementNotice
      message={text.error}
      className={styles.error}
      show={params.management === "unavailable"}
    />
    {subscriptions.length ? <SubscriptionWorkspace statuses={Object.fromEntries(["active", "attention", "non_renewing", "cancelled", "completed", "expired", "pending"].map((status) => [status, text[status as keyof typeof text]]))} items={subscriptions.map((subscription) => {
      const status = text[subscription.subscription_status];
      const paidThrough = formatDate(subscription.paid_through);
      return { id: subscription.subscription_id, title: subscription.plan_name, status: subscription.subscription_status, courses: subscription.course_titles, paidThrough: subscription.paid_through, content: <article className={styles.card}>
        <div className={styles.heading}>
          <div><span className={styles.status}>{status}</span><h2>{subscription.plan_name}</h2></div>
          <strong>{new Intl.NumberFormat(dateLocale, { style: "currency", currency: subscription.currency, minimumFractionDigits: 2 }).format(subscription.amount_minor / 100)}<small>{accountCopy[locale].month}</small></strong>
        </div>
        {paidThrough && <p className={styles.period}>{text.paidThrough}: <strong>{paidThrough}</strong></p>}
        {subscription.course_titles.length > 0 && <div className={styles.courses}><h3>{text.included}</h3><ul>{subscription.course_titles.map((title) => <li key={title}>{title}</li>)}</ul></div>}
        {subscription.subscription_status === "non_renewing" && <p className={styles.note} role="status">{text.noRenew}</p>}
        {subscription.provider_management_available || ["active", "attention"].includes(subscription.subscription_status)
          ? <div className={styles.manage}><Link prefetch={false} className="button button-primary" href={`/api/payments/paystack/subscriptions/manage?subscriptionId=${encodeURIComponent(subscription.subscription_id)}`}>{text.manage}</Link><p>{text.manageCopy}</p></div>
          : null}
      </article> };
    })} /> : <EmptyState titleId="subscriptions-empty-title" icon="courses"
      title={text.emptyTitle} description={text.emptyCopy}
      primaryAction={{ href: "/dashboard/explore", label: text.explore }}
    />}
    <div className={styles.footer}>{text.end}</div>
  </section>;
}
