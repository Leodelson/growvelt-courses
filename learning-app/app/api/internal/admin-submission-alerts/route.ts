import {timingSafeEqual} from "node:crypto";
import {NextResponse} from "next/server";
import {drainAdminSubmissionAlerts} from "@/app/lib/email/admin-submission-runtime";
export const dynamic="force-dynamic";
export const maxDuration=60;
export async function GET(request:Request){
  const secret=process.env.CRON_SECRET,supplied=request.headers.get("authorization");
  if(!secret||!supplied)return new NextResponse(null,{status:401});
  const expected=Buffer.from(`Bearer ${secret}`),actual=Buffer.from(supplied);
  if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return new NextResponse(null,{status:401});
  try{return NextResponse.json(await drainAdminSubmissionAlerts(),{headers:{"Cache-Control":"no-store"}});}catch{return NextResponse.json({state:"needs_review"},{status:503});}
}
