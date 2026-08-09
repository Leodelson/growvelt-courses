import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/app/components/auth/password-forms";
import { LearningMark } from "@/app/components/learning-mark";
export const metadata: Metadata = { title: "Reset password" };
export default function ForgotPasswordPage() { return <main className="auth-page"><div className="auth-brand"><LearningMark /></div><ForgotPasswordForm /></main>; }
