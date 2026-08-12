"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ActionButton } from "@/app/components/ui/action-button";
import { InlineFeedback } from "@/app/components/ui/inline-feedback";
import { createClient } from "@/app/lib/supabase/browser";
export function CertificateIssueButton({ courseId }: { courseId: number }) { const router = useRouter(); const [pending,setPending]=useState(false); const [error,setError]=useState<string|null>(null); async function issue(){if(pending)return;setPending(true);setError(null);const {data,error:rpcError}=await createClient().rpc("issue_own_learning_certificate",{p_course_id:courseId});setPending(false);if(rpcError){setError("We couldn’t issue your certificate. Please try again.");return;}const code=data?.[0]?.certificate_code;if(code)router.push(`/dashboard/certificates/${encodeURIComponent(code)}`);else router.refresh();} return <div className="certificate-issue-action"><ActionButton className="button button-primary" type="button" isPending={pending} pendingLabel="Issuing certificate…" onClick={issue}>Get certificate</ActionButton>{error&&<InlineFeedback variant="error">{error}</InlineFeedback>}</div>; }
