"use client";
import { useState, type ReactNode } from "react";
import { useLanguage } from "@/app/components/language-provider";
import { filterReviewItems, reviewUi, type ReviewItem } from "@/app/lib/admin/review-presentation";
import styles from "./reviews.module.css";

export function ReviewCollection({items,searchLabel,groups,groupLabel,allGroupsLabel,dated=false,directory=false}:{items:(ReviewItem&{content:ReactNode})[];searchLabel:string;groups?:Record<string,string>;groupLabel?:string;allGroupsLabel?:string;dated?:boolean;directory?:boolean}) {
  const {locale}=useLanguage(),text=reviewUi[locale];
  const [search,setSearch]=useState(""),[group,setGroup]=useState("all"),[sort,setSort]=useState(dated?"newest":"default");
  const visible=filterReviewItems(items,search,group,sort,locale),ids=new Set(visible.map(item=>item.id));
  const ordered=[...visible,...items.filter(item=>!ids.has(item.id))];
  return <div className={styles.collection}>
    <div className={styles.controls}><label>{searchLabel}<input type="search" maxLength={120} value={search} onChange={event=>setSearch(event.target.value)}/></label>{groups&&<label>{groupLabel??text.group}<select value={group} onChange={event=>setGroup(event.target.value)}><option value="all">{allGroupsLabel??text.all}</option>{Object.entries(groups).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>}<label>{text.sort}<select value={sort} onChange={event=>setSort(event.target.value)}><option value="default">{text.original}</option><option value="name">{text.name}</option>{dated&&<><option value="newest">{text.newest}</option><option value="oldest">{text.oldest}</option></>}</select></label></div>
    <div className={styles.resultLine}><p role="status">{text.results}: {visible.length} / {items.length}</p>{(search||group!=="all"||sort!==(dated?"newest":"default"))&&<button type="button" onClick={()=>{setSearch("");setGroup("all");setSort(dated?"newest":"default");}}>{text.reset}</button>}</div>
    {!visible.length&&<section className={styles.noMatch}><h2>{text.none}</h2><p>{text.tryAgain}</p></section>}
    <div className={directory?styles.directory:styles.items}>{ordered.map(item=><div className={styles.item} hidden={!ids.has(item.id)} key={item.id}>{item.content}</div>)}</div>
  </div>;
}
