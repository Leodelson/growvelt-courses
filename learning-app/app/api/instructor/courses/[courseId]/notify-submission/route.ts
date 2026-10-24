import {NextResponse} from "next/server";
import {createClient} from "@/app/lib/supabase/server";
import {isSameOriginRequest} from "@/app/lib/security/request-origin";
import {scheduleAdminSubmissionAlerts} from "@/app/lib/email/admin-submission-runtime";
export const maxDuration=60;
export async function POST(request:Request,{params}:{params:Promise<{courseId:string}>}){
  if(!isSameOriginRequest(request))return new NextResponse(null,{status:403});
  const id=Number((await params).courseId);if(!Number.isSafeInteger(id)||id<1)return new NextResponse(null,{status:400});
  const database=await createClient();const{data:{user}}=await database.auth.getUser();if(!user)return new NextResponse(null,{status:401});
  const result=await database.from("learning_courses").select("id").eq("id",id).eq("instructor_id",user.id).eq("status","pending_review").maybeSingle();
  if(result.error||!result.data)return new NextResponse(null,{status:404});
  // Triggers already captured the event atomically. This endpoint creates no
  // recipients/content/events and cannot approve or submit a course itself.
  scheduleAdminSubmissionAlerts();return new NextResponse(null,{status:202});
}
