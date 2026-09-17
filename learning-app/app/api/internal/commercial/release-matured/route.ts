import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runMaturedInstructorEarningsRelease } from "@/app/lib/admin/instructor-earnings-release";

export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization");
  if (!secret || !supplied) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(supplied);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ code: "unauthorized" }, { status: 401 });
  try {
    const { releasedCount } = await runMaturedInstructorEarningsRelease("scheduler", null);
    return NextResponse.json({ status: "completed", releasedCount });
  } catch {
    return NextResponse.json({ code: "release_unavailable" }, { status: 503 });
  }
}
