import type { Metadata } from "next";
import { ResetPasswordForm } from "@/app/components/auth/password-forms";
import { LearningMark } from "@/app/components/learning-mark";
export const metadata: Metadata = { title: "Choose a new password" };
export default function ResetPasswordPage() { return <main className="auth-page"><div className="auth-brand"><LearningMark /></div><ResetPasswordForm /></main>; }
