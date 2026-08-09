import type { Metadata } from "next";
import { ResetPasswordForm } from "@/app/components/auth/password-forms";
import { AuthFrame } from "@/app/components/auth/auth-frame";
export const metadata: Metadata = { title: "Choose a new password" };
export default function ResetPasswordPage() { return <AuthFrame><ResetPasswordForm /></AuthFrame>; }
