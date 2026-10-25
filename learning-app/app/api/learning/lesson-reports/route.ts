import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { isSameOriginRequest } from "@/app/lib/security/request-origin";
import { JsonBodyError, readBoundedJsonObject } from "@/app/lib/security/json-body";
import { scheduleAdminSubmissionAlerts } from "@/app/lib/email/admin-submission-runtime";

const reportReasons = new Map([
  ["playback", "Video will not play or keeps buffering"],
  ["quality", "Poor video or audio quality"],
  ["captions", "Captions or transcript need attention"],
  ["clarity", "The lesson is unclear or hard to follow"],
  ["accuracy", "The content may be inaccurate or outdated"],
  ["other", "Another lesson issue"],
]);

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return new NextResponse(null, { status: 403 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to report a lesson." }, { status: 401 });

  let input: Record<string, unknown>;
  try {
    input = await readBoundedJsonObject(request, 8 * 1024);
  } catch (error) {
    return NextResponse.json({ error: "Check the lesson report and try again." }, {
      status: error instanceof JsonBodyError ? error.status : 400,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  const slug = typeof input.courseSlug === "string" ? input.courseSlug.trim() : "";
  const lessonId = input.lessonId;
  const requestedReasons = Array.isArray(input.reasons) ? input.reasons : [];
  const details = typeof input.details === "string" ? input.details.trim() : "";
  if (!/^[a-z0-9][a-z0-9-]{0,219}$/i.test(slug)
    || !Number.isSafeInteger(lessonId) || Number(lessonId) < 1
    || requestedReasons.length < 1 || requestedReasons.length > 5
    || requestedReasons.some((reason) => typeof reason !== "string" || !reportReasons.has(reason))
    || new Set(requestedReasons).size !== requestedReasons.length
    || details.length > 1500
    || (requestedReasons.includes("other") && details.length < 10)) {
    return NextResponse.json({ error: "Choose a reason and add a short explanation for anything else." }, {
      status: 400,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  const { data: lessonRows, error: lessonError } = await supabase.rpc("get_own_enrolled_lesson_snapshot", {
    p_slug: slug,
    p_lesson_id: Number(lessonId),
  });
  if (lessonError) return NextResponse.json({ error: "We could not verify access to this lesson." }, { status: 503 });
  const lesson = Array.isArray(lessonRows)
    ? (lessonRows as Array<Record<string, unknown>>).find((row) => row.is_current === true)
    : null;
  if (!lesson || typeof lesson.course_title !== "string" || typeof lesson.lesson_title !== "string") {
    return NextResponse.json({ error: "This lesson is not available in your enrolled courses." }, { status: 403 });
  }

  const reasons = requestedReasons.map((reason) => reportReasons.get(reason as string) as string);
  const message = [
    "A learner submitted a lesson quality report for admin review.",
    `Course: ${lesson.course_title}`,
    `Lesson: ${lesson.lesson_title}`,
    `Reported issue: ${reasons.join("; ")}`,
    details ? `Additional details: ${details}` : null,
    "The instructor has not been notified. Please review this report before taking action.",
  ].filter(Boolean).join("\n");
  const subject = `Lesson report: ${lesson.course_title} - ${lesson.lesson_title}`.slice(0, 160);
  const { data: caseId, error: reportError } = await supabase.rpc("create_learning_support_case", {
    p_topic: "courses",
    p_subject: subject,
    p_message: message.slice(0, 5000),
  });
  if (reportError) {
    return NextResponse.json({ error: reportError.code === "22023"
      ? "Please wait before sending another course support request. Your report has not been submitted."
      : "We could not submit this lesson report. Please try again." }, {
      status: reportError.code === "22023" ? 429 : 503,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  scheduleAdminSubmissionAlerts();
  return NextResponse.json({ id: caseId }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
