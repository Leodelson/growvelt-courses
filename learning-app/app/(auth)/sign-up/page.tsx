import type { Metadata } from "next";
import { AuthForm } from "@/app/components/auth/auth-form";
import { LearningMark } from "@/app/components/learning-mark";
export const metadata: Metadata = { title: "Create an account" };
export default function SignUpPage() { return <main className="auth-page"><div className="auth-brand"><LearningMark /></div><AuthForm mode="sign-up" /></main>; }
