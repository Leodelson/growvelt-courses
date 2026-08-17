import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const { courseId } = await params;
  const parsedCourseId = Number(courseId);

  if (!Number.isSafeInteger(parsedCourseId) || parsedCourseId < 1) {
    return new NextResponse(null, { status: 404 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "get_own_or_published_learning_course_video_cover",
    { p_course_id: parsedCourseId },
  );
  const cover = data?.[0] as {
    course_video_cover_storage_path?: string | null;
    is_published?: boolean;
  } | undefined;

  if (error || !cover?.course_video_cover_storage_path) {
    return new NextResponse(null, { status: 404 });
  }

  const { data: signedCover, error: signedCoverError } = await supabase.storage
    .from("learning-course-video-covers")
    .createSignedUrl(cover.course_video_cover_storage_path, 60 * 60);

  if (signedCoverError || !signedCover?.signedUrl) {
    return new NextResponse(null, { status: 404 });
  }

  return NextResponse.redirect(signedCover.signedUrl, {
    headers: {
      "Cache-Control": cover.is_published
        ? "public, max-age=3600, s-maxage=3600"
        : "private, no-store",
    },
  });
}
