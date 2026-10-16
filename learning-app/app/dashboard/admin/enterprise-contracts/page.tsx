import { OperationsNavigation, OperationsSummary, OperationRecords } from "@/app/components/admin/operations-workspace";
import { reviewDate } from "@/app/lib/admin/review-presentation";
import ops from "@/app/components/admin/operations.module.css";
import { createClient } from "@/app/lib/supabase/server";
import { ActionSubmitButton } from "@/app/components/action-submit-button";
import { EmptyState } from "@/app/components/ui/empty-state";
import { ActionFeedback } from "../promotions/action-feedback";
import { recordLearningEnterpriseContractAction } from "./actions";
import styles from "../promotions/promotions.module.css";

export const metadata = { title: "Enterprise contracts" };
export const dynamic = "force-dynamic";

type WorkspaceOption = { workspace_id: number; workspace_name: string; workspace_slug: string; seat_limit: number };
type EnterpriseContract = {
  contract_id: number; workspace_id: number; workspace_name: string; contract_reference: string;
  starts_on: string; ends_on: string | null; seat_cap: number; scope_summary: string;
  recorded_at: string; contract_state: "scheduled" | "in_term" | "ended";
};

const dateLabel = (value: string | null) => value ? reviewDate(value+"T12:00:00.000Z","en") : "No end date";

export default async function AdminEnterpriseContractsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const [workspacesResult, contractsResult, query] = await Promise.all([
    supabase.rpc("list_learning_enterprise_contract_workspaces_for_admin"),
    supabase.rpc("list_learning_enterprise_contract_records_for_admin"),
    searchParams,
  ]);
  const workspaces = (Array.isArray(workspacesResult.data) ? workspacesResult.data : []) as WorkspaceOption[];
  const contracts = (Array.isArray(contractsResult.data) ? contractsResult.data : []) as EnterpriseContract[];
  const queryValue = (key: string) => Array.isArray(query[key]) ? query[key]?.[0] : query[key];
  const error = queryValue("error");
  const successMessage = queryValue("recorded") ? "Contract reference recorded. No billing, course access, seats, or seller proceeds were changed." : null;
  const errorMessage = error === "duplicate" ? "That reference already exists for this company workspace."
    : error === "invalid" ? "Check the reference, dates, seat cap, scope summary, and execution confirmation."
    : error ? "The record could not be saved. No billing or course access was changed. Try again later."
    : null;
  const workspaceError = Boolean(workspacesResult.error);
  const contractError = Boolean(contractsResult.error);

  return <section className={styles.page + " "+ops.page+" admin-page section-shell"}>
    <OperationsNavigation sections={[{id:"contract-create",label:"Record agreement"},{id:"contract-register",label:"Agreement register"}]} />
    <header className="admin-page-header admin-review-hero">
      <p className="eyebrow">Phase 4 · Learning Admin</p>
      <h1>Enterprise contracts</h1>
      <p>Keep a private register of enterprise agreements already executed outside Growvelt, linked to an existing company workspace.</p>
    </header>

    <OperationsSummary items={[{label:"Recorded agreements",value:contractError?"—":contracts.length,detail:"Private reference records"},{label:"Agreements in term",value:contractError?"—":contracts.filter(item=>item.contract_state==="in_term").length,detail:"Date-derived state only"},{label:"Available workspaces",value:workspaceError?"—":workspaces.length,detail:"Active workspaces eligible for linking"}]} note="The contract register does not grant course access, change workspace seats or collect payments. Counts cover the records returned for this workspace." />
    <ActionFeedback message={errorMessage ?? successMessage} kind={errorMessage ? "error" : "success"} />

    <aside className={styles.safety}>
      <strong>Recordkeeping only — no contract execution or commercial automation</strong>
      <p>This page stores a reference, term, reference-only seat cap, and a short internal scope summary. It does not create legal documents, collect payment, change the workspace seat limit, grant course access, or initiate seller payouts. Do not enter personal, bank, card, or secret information.</p>
    </aside>

    <section id="contract-create" className={styles.panel}>
      <header><p className="eyebrow">Private administration</p><h2>Record an executed agreement</h2><p>Only record an agreement that has already been signed or otherwise executed outside Growvelt. Records are append-only; correct mistakes by contacting the appropriate administrator, not by editing or deleting history.</p></header>
      {workspaceError ? <p className={styles.error}>Active company workspaces could not be loaded. The list is not being treated as empty. Confirm the enterprise-contract migration is applied before retrying.</p>
        : workspaces.length === 0 ? <p className={styles.muted}>There are no active company workspaces available to link yet.</p>
        : <form action={recordLearningEnterpriseContractAction} className={styles.form}>
          <label className={styles.courseField}>Company workspace<select name="workspaceId" required defaultValue=""><option value="" disabled>Choose an active workspace</option>{workspaces.map((workspace) => <option key={workspace.workspace_id} value={workspace.workspace_id}>{workspace.workspace_name} · {workspace.workspace_slug} · current workspace limit {workspace.seat_limit}</option>)}</select><small>The contract seat cap below is recorded for reference only and does not change the current workspace limit.</small></label>
          <label>External contract reference<input name="contractReference" required minLength={3} maxLength={100} pattern="[A-Za-z0-9][A-Za-z0-9._/-]{2,99}" autoComplete="off" placeholder="GV-ENT-2026-001" /></label>
          <label>Reference-only seat cap<input name="seatCap" type="number" min="1" max="100000" step="1" required /></label>
          <label>Agreement starts<input name="startsOn" type="date" required /></label>
          <label>Agreement ends (optional)<input name="endsOn" type="date" /></label>
          <label className={styles.courseField}>Short internal scope summary<textarea name="scopeSummary" required minLength={10} maxLength={500} rows={3} placeholder="For example: annual access for the client's customer-support team." /><small>Keep it brief. Do not paste agreement text, personal data, or payment details.</small></label>
          <label className={styles.attestation}><input name="executedExternally" type="checkbox" required /><span>I confirm this agreement has already been executed outside Growvelt.</span></label>
          <ActionSubmitButton label="Record contract reference" pendingLabel="Recording reference…" />
        </form>}
    </section>

    <section id="contract-register" className={styles.panel}>
      <header><p className="eyebrow">Private register</p><h2>Recorded agreements</h2><p>Visible only to Learning Admin. The term state is derived from the recorded dates and does not affect workspace access.</p></header>
      {contractError ? <p className={styles.error}>Contract records could not be loaded safely. The list is not being treated as empty. Confirm the enterprise-contract migration is applied before retrying.</p>
        : contracts.length === 0 ? <EmptyState titleId="enterprise-contracts-empty-title" headingLevel={3}
          icon="company" title="Your agreement register is ready"
          description="No enterprise contract references have been recorded. Use the form above to record an agreement already executed outside Growvelt."
        />
        : <div className={styles.list}><OperationRecords searchLabel="Find agreements by reference, company or scope" items={contracts.map((contract) => ({id:String(contract.contract_id),title:contract.contract_reference,group:contract.contract_state,keywords:contract.workspace_name+" "+contract.scope_summary,content:<article>
          <div className={styles.heading}><div><strong><code>{contract.contract_reference}</code></strong><span>{contract.workspace_name}</span></div><span className={contract.contract_state === "in_term" ? styles.active : styles.disabled}>{contract.contract_state === "in_term" ? "In term" : contract.contract_state === "scheduled" ? "Scheduled" : "Ended"}</span></div>
          <dl><div><dt>Agreement term</dt><dd>{dateLabel(contract.starts_on)} – {dateLabel(contract.ends_on)}</dd></div><div><dt>Reference-only seat cap</dt><dd>{contract.seat_cap.toLocaleString("en-NG")}</dd></div><div><dt>Recorded</dt><dd>{reviewDate(contract.recorded_at,"en",undefined,true)}</dd></div><div><dt>Scope</dt><dd>{contract.scope_summary}</dd></div></dl>
        </article>}))} /></div>}
    </section>
  </section>;
}
