"use client";
import Link from "next/link";
import { useLanguage } from "@/app/components/language-provider";
import type { CurriculumModule } from "@/app/lib/instructor/curriculum";
import { curriculumSnapshot, draftDetailChecks, workbenchCopy } from "@/app/lib/instructor/workbench";
import styles from "./workbench.module.css";

export function CourseWorkflow({courseId,active}:{courseId?:number;active:"details"|"curriculum"}) {
  const {locale}=useLanguage(),text=workbenchCopy[locale];
  return <nav className={styles.workflow} aria-label={text.workflow}><Link href="/dashboard/instructor/courses">← {text.courses}</Link><ol>{(["details","curriculum","review"] as const).map((key,index)=><li key={key}><span className={styles.stepNumber} aria-hidden="true">{index+1}</span>{key===active?<span aria-current="step">{text[key]}</span>:courseId&&key==="details"?<Link href={`/dashboard/instructor/courses/${courseId}`}>{text[key]}</Link>:<span>{text[key]}</span>}</li>)}</ol></nav>;
}
export function DraftDetailsChecklist({values,isFree,price}:{values:{title:string;summary:string;description:string};isFree:boolean;price:number|null}) {
  const {locale}=useLanguage(),text=workbenchCopy[locale], checks=draftDetailChecks(values,isFree,price),labels=[text.titleCheck,text.summaryCheck,text.descriptionCheck,text.accessCheck];
  return <aside className={styles.checklist} aria-labelledby="draft-checklist-title"><div><h2 id="draft-checklist-title">{text.checklist}</h2><strong>{checks.filter(Boolean).length} / 4</strong></div><ul>{checks.map((done,index)=><li key={labels[index]}><span aria-hidden="true">{done?"✓":"○"}</span><span>{labels[index]}</span><span className="sr-only">{done?" ✓":" —"}</span></li>)}</ul><p>{text.checkCopy}</p></aside>;
}
export function CurriculumSnapshot({modules}:{modules:CurriculumModule[]}) {
  const {locale}=useLanguage(),text=workbenchCopy[locale],data=curriculumSnapshot(modules);
  return <section className={styles.snapshot} aria-label={text.curriculum}><dl>{[{label:text.modules,value:data.modules},{label:text.lessons,value:data.lessons},{label:text.quizzes,value:data.quizzes},{label:text.videoTime,value:data.videoMinutes}].map(item=><div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl><p>{text.videoNote}</p>{modules.length>0&&<nav aria-label={text.outline}><strong>{text.outline}</strong>{modules.map((module,index)=><a href={`#curriculum-module-${module.id}`} key={module.id}>{String(index+1).padStart(2,"0")} · {module.title}</a>)}</nav>}</section>;
}
