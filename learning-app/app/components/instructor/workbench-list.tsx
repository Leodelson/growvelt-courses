"use client";
import { useState, type ReactNode } from "react";
import { useLanguage } from "@/app/components/language-provider";
import { filterWorkbench, workbenchCopy, type WorkbenchItem } from "@/app/lib/instructor/workbench";
import styles from "./workbench.module.css";

export function WorkbenchList({items,statuses,metricLabel}:{items:(WorkbenchItem & {content:ReactNode})[];statuses:Record<string,string>;metricLabel:string}) {
  const {locale}=useLanguage(), text=workbenchCopy[locale];
  const [search,setSearch]=useState(""),[status,setStatus]=useState("all"),[sort,setSort]=useState("default");
  const visible=filterWorkbench(items,search,status,sort,locale), ids=new Set(visible.map(item=>item.id));
  const ordered=[...visible,...items.filter(item=>!ids.has(item.id))];
  return <div className={styles.stack}>
    <div className={styles.controls}><label>{text.search}<input type="search" maxLength={120} value={search} onChange={event=>setSearch(event.target.value)}/></label><label>{text.status}<select value={status} onChange={event=>setStatus(event.target.value)}><option value="all">{text.all}</option>{Object.entries(statuses).map(([key,label])=><option value={key} key={key}>{label}</option>)}</select></label><label>{text.sort}<select value={sort} onChange={event=>setSort(event.target.value)}><option value="default">{text.original}</option><option value="title">{text.title}</option><option value="metric">{metricLabel}</option></select></label></div>
    <div className={styles.resultLine}><p role="status">{text.results}: {visible.length} / {items.length}</p>{(search||status!=="all"||sort!=="default")&&<button type="button" onClick={()=>{setSearch("");setStatus("all");setSort("default");}}>{text.reset}</button>}</div>
    {!visible.length&&<div className={styles.noMatch}><h3>{text.noMatch}</h3><p>{text.tryAgain}</p></div>}
    <div className={styles.stack}>{ordered.map(item=><div className={styles.item} key={item.id} hidden={!ids.has(item.id)}>{item.content}</div>)}</div>
  </div>;
}
