import type { Metadata } from "next";
import { AuthForm } from "@/app/components/auth/auth-form";
import { AuthFrame } from "@/app/components/auth/auth-frame";
export const metadata: Metadata = { title: "Create an account" };
export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) { const { next } = await searchParams; return <AuthFrame><AuthForm mode="sign-up" next={next} /></AuthFrame>; }
