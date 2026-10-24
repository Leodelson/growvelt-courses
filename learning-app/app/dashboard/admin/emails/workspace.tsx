"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Bell, Bold, Check, ChevronRight, Eye, FileText, Italic, List, Mail, Send, ShieldCheck, Users } from "lucide-react";
import { audienceChoices, emptyEmailDocument, senderChoices, type EmailDocument } from "@/app/lib/email/email-center";
import styles from "./workspace.module.css";

type Draft = {id:string;document:EmailDocument;revision:number;status:string;updated_at:string};
type Legacy = {id:string;subject:string;status:string;sent_count:number;failed_count:number};
type BroadcastOperation = {draft_id:string;revision:number;phase:string;provider_status:string|null};
export type EmailCenterState = {drafts:Draft[];legacy:Legacy[];senders:{id:string;configured:boolean}[];deliveryEnabled:boolean;recoveryEnabled?:boolean;deliveryNotice:string;operations?:BroadcastOperation[];attempts?:{draft_id:string;target_key:string;state:string}[]};
const api = "/api/learning/admin/emails";
export function LearningEmailCenter({initialState}:{initialState?:EmailCenterState} = {}) {
  const [data,setData] = useState<EmailCenterState|null>(initialState ?? null);
  const [document,setDocument] = useState<EmailDocument>({...emptyEmailDocument});
  const [revision,setRevision] = useState(0);
  const [saved,setSaved] = useState("");
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");
  const [preview,setPreview] = useState<{html:string;fingerprint:string}|null>(null);
  const [review,setReview] = useState<{recipients:number;revision:number}|null>(null);
  const [release,setRelease] = useState<{targets:{email:string;userId:string}[];subject:string;sender:string;mode:string}|null>(null);
  const [approved,setApproved] = useState(false);
  const [confirmation,setConfirmation] = useState<{action:string;operation?:BroadcastOperation}|null>(null);
  const confirmationRef = useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if (!confirmation) return;
    const previous=window.document.activeElement instanceof HTMLElement ? window.document.activeElement : null;
    const buttons=confirmationRef.current?.querySelectorAll<HTMLButtonElement>("button");
    buttons?.[0]?.focus();
    function keydown(event:KeyboardEvent) {
      if (event.key==="Escape") {event.preventDefault();setConfirmation(null);}
      if (event.key==="Tab" && buttons?.length) {
        event.preventDefault();
        const index=Array.from(buttons).indexOf(window.document.activeElement as HTMLButtonElement);
        buttons[(index+(event.shiftKey ? -1 : 1)+buttons.length)%buttons.length].focus();
      }
    }
    window.document.addEventListener("keydown",keydown);
    return ()=>{window.document.removeEventListener("keydown",keydown);if(previous?.isConnected)previous.focus();};
  },[confirmation]);
  const draftId = useRef<string|null>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const actionFocus = useRef<HTMLElement|null>(null);
  const fingerprint = JSON.stringify(document);
  const unchanged = saved === fingerprint;
  useEffect(()=>{
    if (busy) return;
    if (actionFocus.current?.isConnected && window.document.activeElement===window.document.body) actionFocus.current.focus();
    actionFocus.current=null;
  },[busy]);
  useEffect(()=>{
    if (initialState) return;
    const controller = new AbortController();
    fetch(api,{credentials:"same-origin",cache:"no-store",signal:controller.signal}).then(async response=>{
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Email Center could not be loaded.");
      return payload as EmailCenterState;
    }).then(payload=>{if (!controller.signal.aborted) setData(payload);})
      .catch(cause=>{if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Email Center could not be loaded.");});
    return ()=>controller.abort();
  },[initialState]);
  function patch(update:Partial<EmailDocument>) {setDocument(current=>({...current,...update}));setReview(null);setRelease(null);setApproved(false);setNotice("");}
  async function post(body:unknown) {
    const response = await fetch(api,{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "The request could not be completed.");
    return payload;
  }
  async function perform(action:"preview"|"save"|"review") {
    actionFocus.current=window.document.activeElement instanceof HTMLElement ? window.document.activeElement : null;
    setBusy(true);setError("");setNotice("");
    try {
      if (action === "preview") {
        const payload = await post({action,document});
        setPreview({html:payload.html,fingerprint});
      } else if (action === "save") {
        draftId.current ??= crypto.randomUUID();
        const payload = await post({action,id:draftId.current,revision,document});
        setRevision(payload.revision);setSaved(fingerprint);setReview(null);setRelease(null);setApproved(false);
        setData(current=>current ? {...current,drafts:[{id:payload.id,revision:payload.revision,document,status:"draft",updated_at:new Date().toISOString()},...current.drafts.filter(item=>item.id!==payload.id)].slice(0,30)} : current);
        setNotice("Draft saved. No email was sent.");
      } else {
        if (!unchanged || !draftId.current || !revision) throw new Error("Save your current changes before reviewing recipients.");
        const payload = await post({action,id:draftId.current,revision});
        setReview({recipients:payload.recipients,revision});setRelease(null);setApproved(false);
        setData(current=>current ? {...current,drafts:current.drafts.map(item=>item.id===draftId.current ? {...item,status:"reviewed"} : item)} : current);
        setNotice("Recipient review saved. No email or notification was sent.");
      }
    } catch(cause) {setError(cause instanceof Error ? cause.message : "Please try again. Your text has been kept.");}
    finally {setBusy(false);}
  }
  async function delivery(action:string, operation?:BroadcastOperation, confirmed=false) {
    if (!confirmed && ["approve-release","dispatch-broadcast","send","cancel-broadcast"].includes(action)) {setConfirmation({action,operation});return;}
    setBusy(true);setError("");setNotice("");
    try {
      const id=operation?.draft_id ?? draftId.current,rev=operation?.revision ?? revision;
      if (!id || !rev) throw new Error("Load a saved review first.");
      if (!operation && !unchanged) throw new Error("Unsaved changes cannot be released.");
      if (action==="approve-release" && !release) throw new Error("Check the exact release recipients first.");
      if (action==="send") {
        if (!release) throw new Error("Check the exact release recipients first.");
        const results=[];
        for (const target of release.targets) results.push(await post({action,id,revision:rev,targetUserId:target.userId}));
        setNotice(results.map(result=>result.state).join(" · ")+". Provider acceptance is not inbox delivery. No automatic retries.");
      } else {
        const result=await post({action,id,revision:rev,...(action==="approve-release" ? {recipients:release!.targets.map(target=>target.email).sort()} : {})});
        if (action==="release-review") {setRelease(result);setApproved(false);}
        else if (action==="approve-release") setApproved(true);
        setNotice(result.notice || `Operation: ${result.state || "reviewed"}.`);
      }
      const response=await fetch(api,{credentials:"same-origin",cache:"no-store"});
      if (response.ok) setData(await response.json());
    } catch(cause) {setError(cause instanceof Error ? cause.message : "Outcome unknown. Check delivery status before taking any further action. Do not resend.");}
    finally {setBusy(false);}
  }
  function canDiscard() {return unchanged || !document.subject && !document.message || window.confirm("Discard the unsaved changes in this composer? Saved drafts will be kept.");}
  function loadDraft(draft:Draft) {if (!canDiscard()) return;draftId.current=draft.id;setRevision(draft.revision);setDocument(draft.document);setSaved(JSON.stringify(draft.document));setReview(["reviewed","sending"].includes(draft.status) ? {recipients:0,revision:draft.revision} : null);setRelease(null);setApproved(false);setPreview(null);setError("");setNotice("Saved content loaded. Sending content is locked against edits. Check exact release recipients before approval.");}
  function newDraft() {if (!canDiscard()) return;draftId.current=null;setRevision(0);setDocument({...emptyEmailDocument});setSaved("");setReview(null);setRelease(null);setApproved(false);setPreview(null);setError("");setNotice("");}
  function format(prefix:string,suffix=prefix) {
    const field=messageRef.current;
    if (!field) return;
    const start=field.selectionStart,end=field.selectionEnd;
    patch({message:document.message.slice(0,start)+prefix+(document.message.slice(start,end)||"your text")+suffix+document.message.slice(end)});
    field.focus();
  }
  const configured = data?.senders.find(item=>item.id===document.sender)?.configured;
  return <main className={styles.page}>
    {confirmation && <div className={styles.confirmationBackdrop}><div ref={confirmationRef} className={styles.confirmation} role="dialog" aria-modal="true" aria-labelledby="email-release-confirm-title" aria-describedby="email-release-confirm-description">
      <h2 id="email-release-confirm-title">{confirmation.action==="approve-release" ? "Approve exact release?" : confirmation.action==="cancel-broadcast" ? "Cancel queued remainder?" : "Send the approved email?"}</h2>
      <p id="email-release-confirm-description">{confirmation.action==="approve-release" ? "Approval lasts 15 minutes and does not send anything. Consent and suppression checks still apply." : confirmation.action==="cancel-broadcast" ? "This stops remaining queued mail where supported. Already sent messages cannot be recalled." : "This sends real email when the release is activated. If the outcome is unknown, reconcile, do not repeat the send."}</p>
      {confirmation.action!=="cancel-broadcast" && release && <><strong>{release.subject}</strong><p>Sender: {release.sender} · {release.mode}</p><ul>{release.targets.map(target=><li key={target.userId}>{target.email}</li>)}</ul></>}
      <div className={styles.actions}><button type="button" className="button button-secondary" onClick={()=>setConfirmation(null)}>Go back</button><button type="button" className="button button-primary" onClick={()=>{const current=confirmation;setConfirmation(null);void delivery(current.action,current.operation,true);}}>{confirmation.action==="approve-release" ? "Confirm release approval" : confirmation.action==="cancel-broadcast" ? "Confirm cancellation" : "Send this email"}</button></div>
    </div></div>}
    <p className={styles.breadcrumb}>Growvelt administration <ChevronRight size={14} aria-hidden="true"/> Email Center</p>
    <header className={styles.hero}><span className={styles.heroIcon}><Mail size={28} aria-hidden="true"/></span><div><h1>Admin Email Center</h1><p>Thoughtful messages for your Growvelt community.</p></div><span className={styles.badge}><span/> {review && unchanged ? "Reviewed" : revision && !unchanged ? "Unsaved changes" : revision ? "Saved draft" : "New draft"}</span></header>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {notice && <p className={styles.notice} role="status">{notice}</p>}
    <div className={styles.layout}>
      <form onSubmit={event=>{event.preventDefault();void perform("save");}}>
        <fieldset className={styles.composer} disabled={busy}>
          <legend className="sr-only">Compose a Growvelt email</legend>
          <section className={styles.section}><h2>Sender</h2><p>Choose the Growvelt identity for this message. Addresses must be verified before activation.</p>
            <div className={styles.choices}>{senderChoices.map(sender=><button key={sender.id} type="button" aria-pressed={document.sender===sender.id} className={styles.choice} onClick={()=>patch({sender:sender.id})}><Mail size={19} aria-hidden="true"/><strong>{sender.label}</strong><span>{sender.description}</span>{document.sender===sender.id && <Check className={styles.check} size={16} aria-hidden="true"/>}</button>)}</div>
            <p className={styles.hint}>{configured ? "Sender address configured; provider verification is still required." : "Sender configuration pending in Growvelt. No fallback to a Careers mailbox."}</p>
          </section>
          <section className={styles.section}><h2>Email delivery</h2><p>Choose by message purpose, not by recipient count.</p><div className={styles.choices}>
            <button type="button" className={styles.choice} aria-pressed={document.mode==="marketing"} onClick={()=>patch({mode:"marketing"})}><Users size={20} aria-hidden="true"/><strong>Announcement broadcast</strong><span>News and promotions for opted-in Growvelt contacts. Uses the marketing allowance, not transactional sending.</span></button>
            <button type="button" className={styles.choice} aria-pressed={document.mode==="transactional"} onClick={()=>patch({mode:"transactional",audience:"specific",recipients:[]})}><ShieldCheck size={20} aria-hidden="true"/><strong>Account or support message</strong><span>Genuine account-specific messages to up to 10 selected Growvelt accounts. Promotions remain marketing.</span></button>
          </div></section>
          <section className={styles.section}><h2>Recipients</h2><p>Growvelt accounts only. Marketing consent is never inferred from a partnership inquiry or Careers account.</p>
            <div className={styles.choices}>{audienceChoices.map(audience=><button type="button" key={audience.id} disabled={document.mode==="transactional" && audience.id!=="specific"} aria-pressed={document.audience===audience.id} className={styles.choice} onClick={()=>patch({audience:audience.id,recipients:[]})}><Users size={19} aria-hidden="true"/><strong>{audience.label}</strong><span>{audience.description}</span></button>)}</div>
            {document.audience==="specific" && <label>Existing account emails or IDs, one per line<textarea aria-describedby="recipient-note" rows={4} value={document.recipients.join("\n")} onChange={event=>patch({recipients:event.target.value.split("\n")})}/><small id="recipient-note">Unknown accounts are rejected. Marketing still requires recorded marketing opt-in.</small></label>}
          </section>
          <section className={styles.section}><h2>Email content</h2><p>Your preview uses the same branded renderer as the email.</p><div className={styles.fields}>
            <label>Subject<input value={document.subject} minLength={3} maxLength={160} required placeholder="Your Growvelt community update" onChange={event=>patch({subject:event.target.value})}/></label>
            <label>Headline <small>(optional)</small><input value={document.headline} maxLength={160} placeholder="Leave blank for no heading" onChange={event=>patch({headline:event.target.value})}/><small>Separate from the inbox subject. Leave blank to show only the logo, greeting and message.</small></label>
          </div><label>Message</label><div className={styles.editor}>
            <div className={styles.toolbar} role="group" aria-label="Message formatting"><button type="button" aria-label="Add bold text" onClick={()=>format("**")}><Bold size={17}/></button><button type="button" aria-label="Add italic text" onClick={()=>format("_")}><Italic size={17}/></button><button type="button" aria-label="Add list item" onClick={()=>format("\n- ","")}><List size={18}/></button><small>Bold · italic · lists</small></div>
            <textarea ref={messageRef} aria-label="Email message" value={document.message} rows={10} minLength={10} maxLength={4000} required placeholder="Write your message…" onChange={event=>patch({message:event.target.value})}/>
          </div><p className={styles.hint}>HTML and embedded media are treated as text. Use the optional button for a Growvelt link.</p>
            <label className={styles.checkbox}><input type="checkbox" checked={document.personalized} onChange={event=>patch({personalized:event.target.checked})}/><span>Add a personalized first-name greeting<small>Preview uses “Alex” as an example. Otherwise the greeting is “Hello there”.</small></span></label>
            <div className={styles.fields}><label>Button text <small>(optional)</small><input value={document.buttonText} maxLength={60} placeholder="Explore courses" onChange={event=>patch({buttonText:event.target.value})}/></label><label>Button link<input type="url" value={document.buttonUrl} maxLength={1000} placeholder="https://www.growvelt.com/learn" onChange={event=>patch({buttonUrl:event.target.value})}/></label></div>
          </section>
          <section className={styles.section}><h2>Delivery channels</h2><label className={styles.checkbox}><input type="checkbox" checked readOnly/><span><Mail size={17} aria-hidden="true"/> Email <small>{data?.deliveryEnabled ? "Email release enabled. Every message still requires saved recipient review and final confirmation." : "Delivery remains locked until approved provider setup."}</small></span></label><label className={styles.checkbox}><input type="checkbox" disabled/><span><Bell size={17} aria-hidden="true"/> Also add to the notification bell <small>Separate delivery integration pending. Device push is not enabled.</small></span></label>
            <div className={styles.actions}><button type="submit" className="button button-primary" disabled={!data}>{busy ? "Working…" : "Save draft"}</button><button type="button" className="button button-secondary" onClick={()=>void perform("preview")}><Eye size={16} aria-hidden="true"/> Refresh preview</button><button type="button" className="button button-secondary" disabled={!data || !unchanged || !revision} onClick={()=>void perform("review")}>Review recipients <ArrowRight size={16} aria-hidden="true"/></button></div>
          </section>
        </fieldset>
      </form>
      <aside className={styles.sidebar} aria-label="Email preview and sending safeguards">
        <section className={styles.panel}><p className={styles.eyebrow}><Users size={16} aria-hidden="true"/> Recipients</p><h2>{audienceChoices.find(item=>item.id===document.audience)?.label}</h2><p>{review && unchanged ? `${review.recipients} eligible Growvelt ${review.recipients===1 ? "account" : "accounts"} at this review` : "Save and review to check actual account eligibility."}</p><small>Provider targeting must match this review before any broadcast.</small></section>
        <section className={styles.panel}><h2 className={styles.previewHeading}><Eye size={17} aria-hidden="true"/> Email preview</h2><p className={styles.eyebrow}>Subject</p><strong>{document.subject || "Your subject will appear here"}</strong>{preview ? <><p role="status" className={styles.hint}>{preview.fingerprint===fingerprint ? "Current renderer preview. No email sent." : "Preview is out of date. Refresh it before review."}</p><iframe title="Branded Growvelt email preview" sandbox="" referrerPolicy="no-referrer" srcDoc={preview.html}/></> : <div className={styles.previewEmpty}><Mail size={30} aria-hidden="true"/><p>Write your message, then refresh the branded preview.</p></div>}</section>
        <section className={styles.guardrails}><ShieldCheck size={22} aria-hidden="true"/><h2>Sending safeguards</h2><p>Marketing requires explicit marketing consent.</p><p>Saved drafts and reviews never send emails.</p><p>Shared provider quotas must leave room for account and security emails.</p></section>
        {review && unchanged && <section className={styles.panel} aria-label="Reviewed campaign"><h2><Check size={20} aria-hidden="true"/> Release review</h2><p>Saved revision {review.revision}. Confirm exact recipients, not only a count.</p>
          <button type="button" className="button button-secondary" disabled={busy || !data?.deliveryEnabled} onClick={()=>void delivery("release-review")}>Check release recipients</button>
          {release && <><strong>{release.subject}</strong><p>Sender: {release.sender} · {release.mode}</p><ul>{release.targets.map(target=><li key={target.userId}>{target.email}</li>)}</ul><small>Marketing only reaches opted-in, globally subscribed contacts. Suppressed addresses are excluded, never re-subscribed.</small>
            {document.mode==="marketing" && <button type="button" className="button button-secondary" disabled={busy} onClick={()=>void delivery("prepare-broadcast")}>Prepare provider draft (no send)</button>}
            <button type="button" className="button button-secondary" disabled={busy} onClick={()=>void delivery("approve-release")}>Approve exact release · 15 minutes</button>
            <button type="button" className="button button-primary" disabled={busy || !approved || preview?.fingerprint!==fingerprint} onClick={()=>void delivery(document.mode==="marketing" ? "dispatch-broadcast" : "send")}><Send size={17} aria-hidden="true"/> Confirm and send</button>
            <small>Refresh the preview before sending. Broadcasts must first be prepared. Account notices also require an approved short-lived quota allocation.</small></>}
          {!data?.deliveryEnabled && <button type="button" className="button button-primary" disabled>Sending not activated</button>}<p className={styles.hint}>{data?.deliveryNotice}</p></section>}
      </aside>
    </div>
    <section className={styles.panel}><div className={styles.historyHeading}><div><p className={styles.eyebrow}>Your workspace</p><h2>Saved drafts and reviews</h2></div><button type="button" className="button button-secondary" disabled={busy} onClick={newDraft}>New draft</button></div>
      {!data ? <p>Waiting for Email Center setup… Your unsaved text stays on this page.</p> : !data.drafts.length ? <p>No saved drafts yet. Start with a message above.</p> : <div className={styles.history}>{data.drafts.map(draft=><button type="button" disabled={busy} key={draft.id} onClick={()=>loadDraft(draft)}><FileText size={20} aria-hidden="true"/><span><strong>{draft.document.subject}</strong><small>{draft.status} · revision {draft.revision} · {new Date(draft.updated_at).toLocaleDateString()}</small></span><ChevronRight size={17} aria-hidden="true"/></button>)}</div>}
      {!!data?.legacy.length && <details><summary>Previous campaigns (read-only)</summary>{data.legacy.map(item=><p key={item.id}>{item.subject} · {item.status} · {item.sent_count} provider accepted · {item.failed_count} failed. Previous claims are not retried here.</p>)}</details>}
    </section>
    <section className={styles.panel} aria-label="Delivery recovery"><h2>Delivery history and recovery</h2><p>Check delivery status looks up the existing send. It does not send another copy. If the result is uncertain, keep the saved operation and investigate before starting a new campaign. A queued audience stays reserved until its outcome is verified.</p><p>Automatic administrator form alerts are tracked separately in <a href="/learning/dashboard/admin/submissions">Submission alerts</a>.</p>
      {!data?.operations?.length && <p>No broadcast operations yet.</p>}
      {data?.operations?.map(operation=><div className={styles.recovery} key={operation.draft_id}><strong>{data.drafts.find(draft=>draft.id===operation.draft_id)?.document.subject || "Saved broadcast"}</strong><small>{operation.phase} · provider {operation.provider_status || "not confirmed"}</small><div className={styles.actions}><button type="button" className="button button-secondary" disabled={busy || !(data.deliveryEnabled || data.recoveryEnabled)} onClick={()=>void delivery("reconcile-broadcast",operation)}>Check delivery status</button>{["dispatching","queued"].includes(operation.phase) && <button type="button" className="button button-secondary" disabled={busy || !(data.deliveryEnabled || data.recoveryEnabled)} onClick={()=>void delivery("cancel-broadcast",operation)}>Cancel queued remainder</button>}</div></div>)}
      {data?.attempts?.filter(attempt=>attempt.target_key!=="broadcast").map(attempt=><p key={`${attempt.draft_id}-${attempt.target_key}`}>Account notice · {attempt.state}. {attempt.state==="accepted" ? "Provider accepted; not proof of delivery." : "No automatic resend. Keep this claim and reconcile provider logs before any separate follow-up."}</p>)}
    </section>
  </main>;
}
