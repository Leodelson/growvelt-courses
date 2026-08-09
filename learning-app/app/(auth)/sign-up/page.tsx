import type { Metadata } from "next";
import { AuthForm } from "@/app/components/auth/auth-form";
import { AuthFrame } from "@/app/components/auth/auth-frame";
export const metadata: Metadata = { title: "Create an account" };
export default function SignUpPage() { return <AuthFrame><AuthForm mode="sign-up" /></AuthFrame>; }
