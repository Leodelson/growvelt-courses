import type { Metadata } from "next";
import { AuthForm } from "@/app/components/auth/auth-form";
import { AuthFrame } from "@/app/components/auth/auth-frame";
export const metadata: Metadata = { title: "Sign in" };
export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) { const { next } = await searchParams; return <AuthFrame><AuthForm mode="sign-in" next={next} /></AuthFrame>; }
