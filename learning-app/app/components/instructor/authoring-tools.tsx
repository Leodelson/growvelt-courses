"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { useLanguage } from "@/app/components/language-provider";
import type { CurriculumModule } from "@/app/lib/instructor/curriculum";
import { curriculumSnapshot, draftDetailChecks, workbenchCopy } from "@/app/lib/instructor/workbench";
import styles from "./workbench.module.css";

export function CourseWorkflow({ courseId, active, draft = true }: {
  courseId?: number;
  active: "details" | "curriculum" | "cover" | "review";
  draft?: boolean;
}) {
  const { locale } = useLanguage();
  const text = workbenchCopy[locale];
  const base = `/dashboard/instructor/courses/${courseId}`;
  const steps = [
    { id: "details", label: text.details, href: base },
    { id: "curriculum", label: text.curriculum, href: `${base}/curriculum` },
    ...(draft ? [
      { id: "cover", label: locale === "fr" ? "Couverture" : locale === "es" ? "Portada" : "Course cover", href: `${base}?step=cover` },
      { id: "review", label: locale === "fr" ? "Soumission" : locale === "es" ? "Envío a revisión" : "Submit for review", href: `${base}?step=review` },
    ] : []),
  ];

  return (
    <nav className={styles.workflow} aria-label={text.workflow}>
      <Link href="/dashboard/instructor/courses">← {text.courses}</Link>
      <ol>{steps.map((step, index) => (
        <li key={step.id}>
          <span className={styles.stepNumber} aria-hidden="true">{index + 1}</span>
          {step.id === active
            ? <span aria-current="step">{step.label}</span>
            : courseId ? <Link href={step.href} prefetch={false}>{step.label}</Link> : <span>{step.label}</span>}
        </li>
      ))}</ol>
    </nav>
  );
}

export function CourseStepActions({ step, backHref, children }: {
  step: 1 | 2 | 3 | 4;
  backHref: string;
  children: ReactNode;
}) {
  const { locale } = useLanguage();
  const text = locale === "fr" ? { back: "Retour", step: `Étape ${step} sur 4` }
    : locale === "es" ? { back: "Atrás", step: `Paso ${step} de 4` }
    : { back: "Back", step: `Step ${step} of 4` };

  return <div className={styles.stepFooter}>
    <div className={styles.stepButtons}>
      <Link className="button button-secondary" href={backHref} prefetch={false}>{text.back}</Link>
      {children}
    </div>
    <span>{text.step}</span>
  </div>;
}
export function DraftDetailsChecklist({values,isFree,price}:{values:{title:string;summary:string;description:string};isFree:boolean;price:number|null}) {
  const {locale}=useLanguage(),text=workbenchCopy[locale], checks=draftDetailChecks(values,isFree,price),labels=[text.titleCheck,text.summaryCheck,text.descriptionCheck,text.accessCheck];
  return <aside className={styles.checklist} aria-labelledby="draft-checklist-title"><div><h2 id="draft-checklist-title">{text.checklist}</h2><strong>{checks.filter(Boolean).length} / 4</strong></div><ul>{checks.map((done,index)=><li key={labels[index]}><span aria-hidden="true">{done?"✓":"○"}</span><span>{labels[index]}</span><span className="sr-only">{done?" ✓":", "}</span></li>)}</ul><p>{text.checkCopy}</p></aside>;
}
export function CurriculumSnapshot({modules}:{modules:CurriculumModule[]}) {
  const {locale}=useLanguage(),text=workbenchCopy[locale],data=curriculumSnapshot(modules);
  return <section className={styles.snapshot} aria-label={text.curriculum}><dl>{[{label:text.modules,value:data.modules},{label:text.lessons,value:data.lessons},{label:text.quizzes,value:data.quizzes},{label:text.videoTime,value:data.videoMinutes}].map(item=><div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl><p>{text.videoNote}</p>{modules.length>0&&<nav aria-label={text.outline}><strong>{text.outline}</strong>{modules.map((module,index)=><a href={`#curriculum-module-${module.id}`} key={module.id}>{String(index+1).padStart(2,"0")} · {module.title}</a>)}</nav>}</section>;
}
