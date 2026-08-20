"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ActionButton } from "@/app/components/ui/action-button";
import { InlineFeedback } from "@/app/components/ui/inline-feedback";
import { useLanguage } from "@/app/components/language-provider";
import { createClient } from "@/app/lib/supabase/browser";
import { courseCategories, courseLevels, type CourseStatus } from "@/app/lib/instructor/course-options";

type CourseValues = {
  title: string;
  summary: string;
  description: string;
  category: string;
  level: string;
  is_free: boolean;
  price_amount: number | null;
  price_currency: string | null;
};

type CourseDraftFormProps = {
  mode: "create" | "edit";
  courseId?: number;
  initialValues?: CourseValues;
  status?: CourseStatus;
};

const defaultValues: CourseValues = {
  title: "",
  summary: "",
  description: "",
  category: "Data Analytics",
  level: "Beginner",
  is_free: true,
  price_amount: null,
  price_currency: "NGN",
};

function getSafePrice(value: FormDataEntryValue | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function CourseDraftForm({ mode, courseId, initialValues = defaultValues, status = "draft" }: CourseDraftFormProps) {
  const router = useRouter();
  const { locale } = useLanguage();
  const text = locale === "fr" ? { invalid: "Complétez les informations obligatoires et indiquez un prix NGN valide pour un brouillon payant.", saved: "Modifications enregistrées. Ce cours reste privé et non publié.", createError: "Nous n’avons pas pu créer ce brouillon. Vérifiez les informations et réessayez.", saveError: "Nous n’avons pas pu enregistrer ces modifications. Votre brouillon n’a pas été mis à jour.", readOnly: "Les informations de ce cours sont en lecture seule pour les instructeurs dans cette phase.", title: "Titre du cours", titleHelp: "Utilisez un titre clair axé sur le résultat. L’URL du cours est créée une fois et reste stable.", summary: "Résumé court", summaryHelp: "Affiché dans la découverte des cours. Restez précis et pratique.", description: "Description du cours", descriptionHelp: "Expliquez le résultat pratique, le public visé et l’approche pédagogique.", category: "Catégorie", level: "Niveau", access: "Accès au cours", free: "Cours gratuit", freeHelp: "Éligible à l’examen, à la publication et à l’inscription des apprenants lorsque le cours est terminé.", paid: "Cours payant", paidHelp: "Informations tarifaires uniquement. Le paiement et l’accès payant ne sont pas encore activés.", price: "Prix (NGN)", priceHelp: "Définir un prix ne publie pas le cours et n’accorde pas l’accès aux apprenants.", creating: "Création du brouillon…", saving: "Enregistrement…", create: "Créer le brouillon", save: "Enregistrer" } : locale === "es" ? { invalid: "Completa los datos obligatorios e indica un precio NGN válido para un borrador de pago.", saved: "Cambios guardados. Este curso sigue siendo privado y no está publicado.", createError: "No pudimos crear este borrador. Revisa los datos e inténtalo de nuevo.", saveError: "No pudimos guardar estos cambios. Tu borrador no se ha actualizado.", readOnly: "Los datos de este curso son de solo lectura para los instructores en esta fase.", title: "Título del curso", titleHelp: "Usa un título claro orientado al resultado. La URL del curso se crea una vez y permanece estable.", summary: "Resumen breve", summaryHelp: "Se muestra al descubrir cursos. Hazlo claro y práctico.", description: "Descripción del curso", descriptionHelp: "Explica el resultado práctico, el estudiante previsto y el enfoque de aprendizaje.", category: "Categoría", level: "Nivel", access: "Acceso al curso", free: "Curso gratuito", freeHelp: "Elegible para revisión, publicación e inscripción cuando el curso esté completo.", paid: "Curso de pago", paidHelp: "Solo información de precio. El pago y acceso de pago aún no están habilitados.", price: "Precio (NGN)", priceHelp: "Establecer un precio no publica el curso ni concede acceso.", creating: "Creando borrador…", saving: "Guardando cambios…", create: "Crear borrador", save: "Guardar cambios" } : { invalid: "Complete the required metadata and provide a valid NGN price for a paid draft.", saved: "Draft changes saved. This course is still private and unpublished.", createError: "We couldn’t create this draft. Review the details and try again.", saveError: "We couldn’t save these changes. Your draft has not been updated.", readOnly: "This course metadata is read-only for Instructors in this phase.", title: "Course title", titleHelp: "Use a clear, outcome-led title. Your course URL is created once and stays stable.", summary: "Short summary", summaryHelp: "Shown in course discovery. Keep it focused and practical.", description: "Course description", descriptionHelp: "Explain the practical outcome, intended learner, and learning approach.", category: "Category", level: "Level", access: "Course access", free: "Free course", freeHelp: "Eligible for review, publication, and learner enrollment when the course is complete.", paid: "Paid course", paidHelp: "Pricing metadata only. Paid checkout and access are not enabled yet.", price: "Price (NGN)", priceHelp: "Setting a price does not publish the course or grant learner access.", creating: "Creating draft…", saving: "Saving changes…", create: "Create draft", save: "Save changes" };
  const [isFree, setIsFree] = useState(initialValues.is_free);
  const [isPending, setIsPending] = useState(false);
  const [feedback, setFeedback] = useState<{ variant: "error" | "success" | "info"; message: string } | null>(null);
  const isEditable = status === "draft";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending || !isEditable) return;

    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    const summary = String(form.get("summary") ?? "").trim();
    const description = String(form.get("description") ?? "").trim();
    const category = String(form.get("category") ?? "");
    const level = String(form.get("level") ?? "");
    const priceAmount = isFree ? 0 : getSafePrice(form.get("price_amount"));

    if (title.length < 3 || summary.length < 10 || description.length < 40 || (!isFree && (!priceAmount || priceAmount <= 0))) {
      setFeedback({ variant: "error", message: text.invalid });
      return;
    }

    setFeedback(null);
    setIsPending(true);

    try {
      const supabase = createClient();
      const input = {
        p_title: title,
        p_summary: summary,
        p_description: description,
        p_category: category,
        p_level: level,
        p_is_free: isFree,
        p_price_amount: priceAmount,
        p_price_currency: "NGN",
      };

      if (mode === "create") {
        const { data, error } = await supabase.rpc("create_instructor_course_draft", input);
        const created = data?.[0] as { course_id?: number } | undefined;
        if (error || !created?.course_id) throw new Error("create_failed");
        router.replace(`/dashboard/instructor/courses/${created.course_id}`);
        router.refresh();
        return;
      }

      const { error } = await supabase.rpc("update_instructor_course_draft", { p_course_id: courseId, ...input });
      if (error) throw new Error("save_failed");
      setFeedback({ variant: "success", message: text.saved });
      router.refresh();
    } catch {
      setFeedback({ variant: "error", message: mode === "create" ? text.createError : text.saveError });
    } finally {
      setIsPending(false);
    }
  }

  return <form className="course-draft-form" onSubmit={handleSubmit}>
    {!isEditable && <InlineFeedback variant="info">{text.readOnly}</InlineFeedback>}
    {feedback && <InlineFeedback variant={feedback.variant}>{feedback.message}</InlineFeedback>}
    <fieldset disabled={isPending || !isEditable}>
      <label className="course-field">{text.title}<input name="title" defaultValue={initialValues.title} minLength={3} maxLength={160} required /><span>{text.titleHelp}</span></label>
      <label className="course-field">{text.summary}<textarea name="summary" defaultValue={initialValues.summary} minLength={10} maxLength={320} rows={3} required /><span>{text.summaryHelp}</span></label>
      <label className="course-field">{text.description}<textarea name="description" defaultValue={initialValues.description} minLength={40} maxLength={10000} rows={7} required /><span>{text.descriptionHelp}</span></label>
      <div className="course-form-grid">
        <label className="course-field">{text.category}<select name="category" defaultValue={initialValues.category} required>{courseCategories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
        <label className="course-field">{text.level}<select name="level" defaultValue={initialValues.level} required>{courseLevels.map((level) => <option key={level} value={level}>{level}</option>)}</select></label>
      </div>
      <fieldset className="course-pricing-fieldset">
        <legend>{text.access}</legend><label className="course-choice"><input type="radio" name="access" checked={isFree} onChange={() => setIsFree(true)} />{text.free}<span>{text.freeHelp}</span></label><label className="course-choice"><input type="radio" name="access" checked={!isFree} onChange={() => setIsFree(false)} />{text.paid}<span>{text.paidHelp}</span></label>{!isFree && <label className="course-field course-price-field">{text.price}<input name="price_amount" type="number" min="1" max="10000000" step="0.01" defaultValue={initialValues.price_amount ?? ""} required /><span>{text.priceHelp}</span></label>}
      </fieldset>
    </fieldset>
    {isEditable && <ActionButton className="button button-primary" type="submit" isPending={isPending} pendingLabel={mode === "create" ? text.creating : text.saving}>{mode === "create" ? text.create : text.save}</ActionButton>}
  </form>;
}
