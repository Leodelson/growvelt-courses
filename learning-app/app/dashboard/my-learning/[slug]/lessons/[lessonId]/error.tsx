"use client";
import { RouteError } from "@/app/components/ui/route-error";
export default function LessonError({ reset }: { reset: () => void }) { return <RouteError title="Unable to load this lesson" description="Try again, or return to your enrolled course." reset={reset} recoveryHref="/dashboard/my-learning" recoveryLabel="My Learning" />; }
