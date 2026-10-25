import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { renderGrowveltEmail } from "./growvelt-email-template";
import { learningAbsoluteUrl } from "../site-urls.mjs";

export type SubmissionAlert = {id:string;kind:string;source_id:string;source_version:string;actor_id:string|null;created_at:string};
export type SubmissionContent = {title:string;fields:{label:string;value:string}[];path:string};
const value=(input:unknown)=>Array.isArray(input)?input.join(", "):input===null||input===undefined?"Not supplied":String(input);
// Explicit allowlists exclude passwords, bank data, authentication tokens,
// honeypots, quiz answer keys and private uploaded files. Never dump a row.
export async function readAdminSubmission(database:Pick<SupabaseClient,"from">,alert:SubmissionAlert):Promise<SubmissionContent|null>{
  let table:string,columns:string,idColumn:string,path:string,title:string;
  switch(alert.kind){
    case "inquiry":table="learning_public_inquiries";columns="inquiry_type,full_name,email,subject,message,organization,phone,created_at";idColumn="id";path="/dashboard/admin/submissions";title="New inquiry";break;
    case "instructor":table="instructor_profiles";columns="user_id,headline,country,phone,expertise,years_experience,teaching_experience,bio,motivation,portfolio_url,created_at";idColumn="user_id";path=`/dashboard/admin/instructors/${alert.source_id}`;title="New instructor application";break;
    case "provider":table="learning_provider_organization_verifications";columns="legal_name,contact_email,website_url,verification_statement,submitted_at";idColumn="organization_id";path="/dashboard/admin/providers";title="Provider verification submitted";break;
    case "course":table="learning_courses";columns="title,summary,description,category,level,is_free,price_amount,price_currency,submitted_at";idColumn="id";path=`/dashboard/admin/courses/${alert.source_id}`;title="Course submitted for review";break;
    case "support":table="learning_support_messages";columns="conversation_id,body,created_at";idColumn="id";path="/dashboard/admin/support";title="New support message";break;
    default:throw new Error("Invalid submission type");
  }
  const result=await database.from(table).select(columns).eq(idColumn,alert.source_id).maybeSingle();
  if(result.error)throw new Error("Submission source unavailable");
  if(!result.data)return null;
  const row=result.data as unknown as Record<string,unknown>;
  const version=row.submitted_at??row.created_at;
  if(typeof version!=="string"||Date.parse(version)!==Date.parse(alert.source_version))return null;
  const labels:Record<string,string>={inquiry_type:"Request type",full_name:"Name",email:"Email",subject:"Subject",message:"Message",organization:"Organization",phone:"Phone",created_at:"Submitted",headline:"Headline",country:"Country",expertise:"Expertise",years_experience:"Years of experience",teaching_experience:"Teaching experience",bio:"Biography",motivation:"Motivation",portfolio_url:"Portfolio",legal_name:"Provider name",contact_email:"Contact email",website_url:"Website",verification_statement:"Verification statement",submitted_at:"Submitted",title:"Course title",summary:"Summary",description:"Description",category:"Category",level:"Level",is_free:"Free course",price_amount:"Price",price_currency:"Currency",body:"Message"};
  const fields=Object.entries(row).filter(([key])=>labels[key]).map(([key,data])=>({label:labels[key],value:value(data)}));
  if(alert.actor_id){const profile=await database.from("profiles").select("full_name,email").eq("id",alert.actor_id).maybeSingle();if(profile.error)throw new Error("Applicant identity unavailable");if(profile.data)fields.unshift({label:"Submitted by",value:`${profile.data.full_name||"Growvelt user"} (${profile.data.email||"email unavailable"})`});}
  if(alert.kind==="inquiry")title=row.inquiry_type==="partnership"?"New partnership request":"New contact request";
  if(alert.kind==="support"&&row.conversation_id){const thread=await database.from("learning_support_conversations").select("subject,topic").eq("id",row.conversation_id).maybeSingle();if(thread.error)throw new Error("Support thread unavailable");if(thread.data){fields.unshift({label:"Subject",value:thread.data.subject},{label:"Topic",value:thread.data.topic});if(thread.data.subject.startsWith("Lesson report:"))title="New lesson quality report";}path=`/dashboard/support/${row.conversation_id}`;}
  return{title,fields,path};
}
export function renderAdminSubmission(content:SubmissionContent){
  return renderGrowveltEmail({baseUrl:learningAbsoluteUrl("/"),greeting:"Growvelt administrator",title:content.title,
    paragraphs:["A new submission needs your attention. Sign in to review it; this email does not approve or change the request.",...content.fields.map(field=>`${field.label}: ${field.value}`)],
    primaryAction:{label:"Review submission",href:learningAbsoluteUrl(content.path)},
    reason:"You received this operational alert because you are a designated Growvelt administrator."});
}
