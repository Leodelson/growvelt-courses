"use client";

import { useEffect, useRef, useState } from "react";
import { Bold, Check, FileText, Italic, List, Mail, Send, Users } from "lucide-react";
import { audienceChoices, emailUuid, emptyEmailDocument, senderChoices, type EmailDocument } from "@/app/lib/email/email-center";
import styles from "./workspace.module.css";

type Draft = {id:string;document:EmailDocument;revision:number;status:string;updated_at:string};
type Legacy = {id:string;subject:string;status:string;sent_count:number;failed_count:number};
type BroadcastOperation = {draft_id:string;revision:number;phase:string;provider_status:string|null};
type SendConfirmation = {
  id: string;
  revision: number;
  subject: string;
  sender: string;
  mode: EmailDocument["mode"];
  targets: {email: string; userId: string}[];
};
type Confirmation = { kind: "send"; message: SendConfirmation } | { kind: "cancel"; operation: BroadcastOperation };
export type EmailCenterState = {drafts:Draft[];legacy:Legacy[];senders:{id:string;configured:boolean}[];deliveryEnabled:boolean;recoveryEnabled?:boolean;deliveryNotice:string;operations?:BroadcastOperation[];attempts?:{draft_id:string;target_key:string;state:string}[]};
const api = "/api/learning/admin/emails";
const broadcastStatuses: Record<string, string> = {
  draft: "Draft · no email sent",
  queued: "Queued with Resend",
  scheduled: "Scheduled with Resend",
  sent: "Resend marked the broadcast sent · inbox delivery unverified",
  canceled: "Canceled",
  dispatching: "Send started · waiting for provider status",
};
const accountStatuses: Record<string, string> = {
  accepted: "Accepted by Resend · inbox delivery unverified",
  skipped: "Not sent · sending budget or provider usage check did not pass",
  claimed: "Send status pending",
  uncertain: "Delivery unconfirmed · check Resend before resending",
};
type ComposerSnapshot = {
  document: EmailDocument;
  id: string | null;
  revision: number;
  saved: string;
  sendLocked: boolean;
};
function readComposer(key: string): ComposerSnapshot | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) ?? "null") as ComposerSnapshot | null;
    if (!value?.document || (value.id !== null && !emailUuid.test(value.id))
      || !Number.isSafeInteger(value.revision) || value.revision < 0
      || typeof value.saved !== "string" || typeof value.sendLocked !== "boolean") return null;
    const draft = value.document;
    if (!senderChoices.some(sender => sender.id === draft.sender)
      || !audienceChoices.some(audience => audience.id === draft.audience)
      || (draft.mode !== "marketing" && draft.mode !== "transactional")
      || !Array.isArray(draft.recipients) || !draft.recipients.every(item => typeof item === "string")
      || ![draft.subject, draft.headline, draft.message, draft.buttonText, draft.buttonUrl].every(item => typeof item === "string")
      || typeof draft.personalized !== "boolean" || typeof draft.bell !== "boolean") return null;
    return value;
  } catch {
    return null;
  }
}
function writeComposer(key: string, snapshot: ComposerSnapshot) {
  try {
    sessionStorage.setItem(key, JSON.stringify(snapshot));
  } catch {
    // The composer remains usable when the browser blocks storage.
  }
}
export function LearningEmailCenter({initialState,operatorId}:{initialState?:EmailCenterState;operatorId?:string} = {}) {
  const [data,setData] = useState<EmailCenterState|null>(initialState ?? null);
  const [document,setDocument] = useState<EmailDocument>({...emptyEmailDocument});
  const [revision,setRevision] = useState(0);
  const [saved,setSaved] = useState("");
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");
  const [confirmation,setConfirmation] = useState<Confirmation|null>(null);
  const [sendLocked,setSendLocked] = useState(false);
  const storageKey = operatorId ? `growvelt-learning:email-composer:v1:${operatorId}` : null;
  const [restoredKey, setRestoredKey] = useState<string | null>(null);
  const running = useRef(false);
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
        const focusable=Array.from(confirmationRef.current?.querySelectorAll<HTMLElement>("button, summary") ?? []);
        const index=focusable.indexOf(window.document.activeElement as HTMLElement);
        focusable[(index+(event.shiftKey ? -1 : 1)+focusable.length)%focusable.length]?.focus();
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
  const composerReady = restoredKey === storageKey;
  useEffect(() => {
    if (!storageKey) return;
    const snapshot = readComposer(storageKey);
    draftId.current = snapshot?.id ?? null;
    setDocument(snapshot?.document ?? { ...emptyEmailDocument });
    setRevision(snapshot?.revision ?? 0);
    setSaved(snapshot?.saved ?? "");
    setSendLocked(snapshot?.sendLocked ?? false);
    setRestoredKey(storageKey);
  }, [storageKey]);
  useEffect(() => {
    if (!storageKey || !composerReady) return;
    writeComposer(storageKey, { document, id: draftId.current, revision, saved, sendLocked });
  }, [storageKey, composerReady, document, revision, saved, sendLocked]);
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
  function patch(update:Partial<EmailDocument>) {
    setDocument(current=>({...current,...update}));
    setNotice("");
  }
  async function post(body:unknown) {
    const response = await fetch(api,{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "The request could not be completed.");
    return payload;
  }
  function beginAction() {
    if (running.current) return false;
    running.current=true;
    actionFocus.current=window.document.activeElement instanceof HTMLElement ? window.document.activeElement : null;
    setBusy(true);
    setError("");
    setNotice("");
    return true;
  }
  function finishAction() {
    running.current=false;
    setBusy(false);
  }
  async function refreshHistory() {
    try {
      const response=await fetch(api,{credentials:"same-origin",cache:"no-store"});
      if (response.ok) setData(await response.json());
    } catch {
      // The send outcome is independent of whether history could be refreshed.
    }
  }
  async function prepareSend() {
    if (!composerReady || !data?.deliveryEnabled || sendLocked || !beginAction()) return;
    try {
      draftId.current ??= crypto.randomUUID();
      const id=draftId.current;
      let currentRevision=revision;
      if (!unchanged || !currentRevision) {
        const payload = await post({action:"save",id,revision,document});
        currentRevision=payload.revision;
        setRevision(currentRevision);
        setSaved(fingerprint);
        setData(current=>current ? {...current,drafts:[{id:payload.id,revision:payload.revision,document,status:"draft",updated_at:new Date().toISOString()},...current.drafts.filter(item=>item.id!==payload.id)].slice(0,30)} : current);
      }
      await post({action:"review",id,revision:currentRevision});
      const release = await post({action:"release-review",id,revision:currentRevision});
      setConfirmation({kind:"send",message:{...release,id,revision:currentRevision}});
    } catch(cause) {
      setError(cause instanceof Error ? cause.message : "This email could not be prepared. Your message is still here.");
    } finally {finishAction();}
  }
  async function sendEmail(message:SendConfirmation) {
    if (sendLocked || !beginAction()) return;
    const {id,revision,mode,targets}=message;
    let dispatchStarted=false;
    try {
      if (mode==="marketing") await post({action:"prepare-broadcast",id,revision});
      await post({action:"approve-release",id,revision,recipients:targets.map(target=>target.email).sort()});
      dispatchStarted=true;
      if (storageKey) writeComposer(storageKey, { document, id, revision, saved: fingerprint, sendLocked: true });
      setSendLocked(true);
      if (mode==="marketing") {
        const result=await post({action:"dispatch-broadcast",id,revision});
        setNotice(result.state==="sent" ? "Resend marked the broadcast sent. Inbox delivery is unverified." : result.state==="queued" || result.state==="scheduled"
          ? "Email queued." : result.notice || "Check the status in Email activity.");
      } else {
        const results=[];
        for (const target of targets) results.push(await post({action:"send",id,revision,targetUserId:target.userId}));
        const accepted=results.filter(result=>result.state==="accepted").length;
        setNotice(accepted===targets.length ? "Resend accepted the email for delivery. Inbox delivery is unverified."
          : results.every(result=>result.state==="budget_blocked") ? "No email was sent. The account email budget or provider usage check did not pass."
          : `${accepted} of ${targets.length} accepted for delivery. Check Email activity for the remaining statuses.`);
      }
    } catch(cause) {
      const reason=cause instanceof Error ? cause.message : "The request could not be completed.";
      setError(dispatchStarted ? `${reason} Check Email activity before sending again.` : reason);
    } finally {await refreshHistory();finishAction();}
  }
  async function checkDelivery(action:"reconcile-broadcast"|"cancel-broadcast", operation:BroadcastOperation) {
    if (!beginAction()) return;
    try {
      const result=await post({action,id:operation.draft_id,revision:operation.revision});
      setNotice(broadcastStatuses[result.state] || result.notice || `Email status: ${result.state}.`);
    } catch(cause) {
      setError(cause instanceof Error ? cause.message : "Email status is unavailable.");
    } finally {await refreshHistory();finishAction();}
  }
  function canDiscard() {
    if (!composerReady) return false;
    return unchanged || fingerprint === JSON.stringify(emptyEmailDocument)
      || window.confirm("Discard the unsaved changes in this composer? Saved drafts will be kept.");
  }
  function loadDraft(draft:Draft) {
    if (!canDiscard()) return;
    draftId.current=draft.id;setRevision(draft.revision);setDocument(draft.document);
    setSaved(JSON.stringify(draft.document));setSendLocked(false);setError("");setNotice("");
  }
  function newDraft() {
    if (!canDiscard()) return;
    draftId.current=null;setRevision(0);setDocument({...emptyEmailDocument});
    setSaved("");setSendLocked(false);setError("");setNotice("");
  }
  function format(prefix:string,suffix=prefix) {
    const field=messageRef.current;
    if (!field) return;
    const start=field.selectionStart,end=field.selectionEnd;
    patch({message:document.message.slice(0,start)+prefix+(document.message.slice(start,end)||"your text")+suffix+document.message.slice(end)});
    field.focus();
  }
  const configured = data?.senders.find(item=>item.id===document.sender)?.configured;
  const canSend = data?.deliveryEnabled && configured && !sendLocked;
  const savedEmails = data?.drafts.filter(draft=>["draft","reviewed"].includes(draft.status)
    && !data.operations?.some(operation=>operation.draft_id===draft.id)
    && !data.attempts?.some(attempt=>attempt.draft_id===draft.id)) ?? [];
  return <main className={styles.page}>
    {confirmation && <div className={styles.confirmationBackdrop}>
      <div ref={confirmationRef} className={styles.confirmation} role="dialog" aria-modal="true" aria-labelledby="email-confirm-title">
        <h2 id="email-confirm-title">{confirmation.kind==="send" ? "Send this email?" : "Cancel queued email?"}</h2>
        {confirmation.kind==="send" ? <>
          <strong>{confirmation.message.subject}</strong>
          <p>{confirmation.message.sender} · {confirmation.message.mode==="marketing" && "Up to "}{confirmation.message.targets.length} {confirmation.message.targets.length===1 ? "recipient" : "recipients"}</p>
          <details>
            <summary>See recipients</summary>
            <ul>{confirmation.message.targets.map(target=><li key={target.userId}>{target.email}</li>)}</ul>
          </details>
        </> : <p>This stops messages still in the queue. Sent messages cannot be recalled.</p>}
        <div className={styles.actions}>
          <button type="button" className="button button-secondary" onClick={()=>setConfirmation(null)}>Go back</button>
          <button type="button" className="button button-primary" onClick={()=>{
            const current=confirmation;
            setConfirmation(null);
            if (current.kind==="send") void sendEmail(current.message);
            else void checkDelivery("cancel-broadcast",current.operation);
          }}>{confirmation.kind==="send" ? "Send email" : "Cancel queued email"}</button>
        </div>
      </div>
    </div>}
    <header className={styles.hero}>
      <span className={styles.heroIcon}><Mail size={28} aria-hidden="true"/></span>
      <div><h1>Email Center</h1><p>Send emails to Growvelt Learning users.</p></div>
    </header>
    <form onSubmit={event=>{event.preventDefault();void prepareSend();}}>
      <fieldset className={styles.composer} disabled={!composerReady || busy || sendLocked}>
        <legend className="sr-only">Compose a Growvelt email</legend>
        <section className={styles.section}>
          <h2>Sender</h2>
          <div className={styles.choices}>{senderChoices.map(sender=><button key={sender.id} type="button" aria-pressed={document.sender===sender.id} className={styles.choice} onClick={()=>patch({sender:sender.id})}>
            <Mail size={19} aria-hidden="true"/><strong>{sender.label}</strong>
            <span>{sender.description}</span>
            {document.sender===sender.id && <Check className={styles.check} size={16} aria-hidden="true"/>}
          </button>)}</div>
        </section>
        <section className={styles.section}>
          <h2>Email type</h2>
          <div className={styles.choices}>
            <button type="button" className={styles.choice} aria-pressed={document.mode==="marketing"} onClick={()=>patch({mode:"marketing"})}><Mail size={19} aria-hidden="true"/><strong>Announcement</strong><span>Course news, newsletters, and promotions for users who opted in.</span></button>
            <button type="button" className={styles.choice} aria-pressed={document.mode==="transactional"} onClick={()=>{if (document.mode!=="transactional") patch({mode:"transactional",audience:"specific",recipients:[]});}}><Mail size={19} aria-hidden="true"/><strong>Account or support</strong><span>Individual account notices and support follow-ups for up to 10 selected users.</span></button>
          </div>
        </section>
        <section className={styles.section}>
          <h2>Recipients</h2>
          <div className={styles.choices}>{audienceChoices.filter(audience=>document.mode==="marketing" || audience.id==="specific").map(audience=><button type="button" key={audience.id} aria-pressed={document.audience===audience.id} className={styles.choice} onClick={()=>{
            if (document.audience!==audience.id) patch({audience:audience.id,recipients:[]});
          }}><Users size={19} aria-hidden="true"/><strong>{audience.label}</strong><span>{audience.description}</span>{document.audience===audience.id && <Check className={styles.check} size={16} aria-hidden="true"/>}</button>)}</div>
          {document.audience==="specific" && <label>Account emails or IDs, one per line<textarea rows={4} required value={document.recipients.join("\n")} onChange={event=>patch({recipients:event.target.value.split("\n")})}/></label>}
        </section>
        <section className={styles.section}>
          <h2>Email</h2>
          <label>Subject<input value={document.subject} minLength={3} maxLength={160} required placeholder="Your email subject" onChange={event=>patch({subject:event.target.value})}/></label>
          <label htmlFor="learning-email-body">Message</label>
          <div className={styles.editor}>
            <div className={styles.toolbar} role="group" aria-label="Message formatting">
              <button type="button" aria-label="Add bold text" onClick={()=>format("**")}><Bold size={17}/></button>
              <button type="button" aria-label="Add italic text" onClick={()=>format("_")}><Italic size={17}/></button>
              <button type="button" aria-label="Add list item" onClick={()=>format("\n- ","")}><List size={18}/></button>
            </div>
            <textarea id="learning-email-body" ref={messageRef} value={document.message} rows={8} minLength={10} maxLength={4000} required placeholder="Write your message…" onChange={event=>patch({message:event.target.value})}/>
          </div>
          <details className={styles.optional}>
            <summary>Optional email details</summary>
            <label>Headline<input value={document.headline} maxLength={160} onChange={event=>patch({headline:event.target.value})}/></label>
            <label className={styles.checkbox}><input type="checkbox" checked={document.personalized} onChange={event=>patch({personalized:event.target.checked})}/><span>Greet recipients by first name</span></label>
            <div className={styles.fields}><label>Button text<input value={document.buttonText} maxLength={60} placeholder="Explore courses" onChange={event=>patch({buttonText:event.target.value})}/></label><label>Button link<input type="url" value={document.buttonUrl} maxLength={1000} placeholder="https://www.growvelt.com/explore" onChange={event=>patch({buttonUrl:event.target.value})}/></label></div>
          </details>
        </section>
      </fieldset>
      <div className={styles.sendFooter}>
        {error && <p className={styles.error} role="alert">{error}</p>}
        {notice && <p className={styles.notice} role="status">{notice}</p>}
        {!error && data && !data.deliveryEnabled && <p className={styles.hint}>Email sending is unavailable until provider setup is complete.</p>}
        {!error && data?.deliveryEnabled && !configured && <p className={styles.hint}>Choose a configured sender to continue.</p>}
        <div className={styles.actions}>
          {sendLocked ? <button type="button" className="button button-secondary" disabled={busy} onClick={newDraft}>New email</button>
            : <button type="submit" className="button button-primary" disabled={busy || !canSend}><Send size={17} aria-hidden="true"/>{busy ? "Working…" : "Send email"}</button>}
        </div>
      </div>
    </form>
    <details className={styles.panel}>
      <summary>Email activity</summary>
      {!data?.operations?.length && !data?.attempts?.length && !data?.legacy.length && <p>No send activity yet.</p>}
      {data?.operations?.map(operation=><div className={styles.recovery} key={operation.draft_id}>
        <strong>{data.drafts.find(draft=>draft.id===operation.draft_id)?.document.subject || "Saved broadcast"}</strong>
        <small>{broadcastStatuses[operation.phase] || operation.phase}</small>
        <div className={styles.actions}>
          {!["sent","canceled","abandoned"].includes(operation.phase) && <button type="button" className="button button-secondary" disabled={busy || !(data.deliveryEnabled || data.recoveryEnabled)} onClick={()=>void checkDelivery("reconcile-broadcast",operation)}>Check broadcast status</button>}
          {["dispatching","queued"].includes(operation.phase) && <button type="button" className="button button-secondary" disabled={busy || !(data.deliveryEnabled || data.recoveryEnabled)} onClick={()=>setConfirmation({kind:"cancel",operation})}>Cancel queued email</button>}
        </div>
      </div>)}
      {data?.attempts?.filter(attempt=>attempt.target_key!=="broadcast").map(attempt=><div className={styles.recovery} key={`${attempt.draft_id}-${attempt.target_key}`}>
        <strong>{data.drafts.find(draft=>draft.id===attempt.draft_id)?.document.subject || "Account email"}</strong>
        <small>{accountStatuses[attempt.state] || attempt.state}</small>
      </div>)}
      {data?.legacy.map(item=><p key={item.id}>{item.subject} · {item.status} · {item.sent_count} accepted · {item.failed_count} failed</p>)}
      {savedEmails.length>0 && <details>
        <summary>Continue a saved email</summary>
        <div className={styles.history}>{savedEmails.map(draft=>
          <button type="button" disabled={busy} key={draft.id} onClick={()=>loadDraft(draft)}><FileText size={18} aria-hidden="true"/><span>{draft.document.subject}</span></button>
        )}</div>
      </details>}
    </details>
  </main>;
}
