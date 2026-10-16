"use client";
import { RouteError } from "@/app/components/ui/route-error";
export default function ErrorState({reset}:{reset:()=>void}){return <RouteError title="We couldn’t load your subscriptions." description="Try again or return to your workspace. No action has been submitted by this error page." reset={reset} recoveryHref="/dashboard/my-learning" recoveryLabel="My Learning"/>;}
