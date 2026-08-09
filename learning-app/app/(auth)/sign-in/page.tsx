import type { Metadata } from "next";
import { AuthForm } from "@/app/components/auth/auth-form";
import { LearningMark } from "@/app/components/learning-mark";
export const metadata: Metadata = { title: "Sign in" };
export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) { const { next } = await searchParams; return <main className="auth-page"><div className="auth-brand"><LearningMark /></div><AuthForm mode="sign-in" next={next} /></main>; }
