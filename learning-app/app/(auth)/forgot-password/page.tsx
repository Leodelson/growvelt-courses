import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/app/components/auth/password-forms";
import { AuthFrame } from "@/app/components/auth/auth-frame";
export const metadata: Metadata = { title: "Reset password" };
export default function ForgotPasswordPage() { return <AuthFrame><ForgotPasswordForm /></AuthFrame>; }
