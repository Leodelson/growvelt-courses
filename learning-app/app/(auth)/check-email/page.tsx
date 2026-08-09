import Link from "next/link";
import type { Metadata } from "next";
import { AuthFrame } from "@/app/components/auth/auth-frame";
export const metadata: Metadata = { title: "Check your email" };
export default function CheckEmailPage() { return <AuthFrame><section className="auth-card auth-notice-card"><p className="eyebrow">One more step</p><h1>Check your email.</h1><p>We’ve requested a confirmation email for your Growvelt Learning account. Open the confirmation link before signing in for the first time.</p><p>Check your spam or junk folder if it does not arrive shortly.</p><Link className="button button-primary" href="/sign-in">Return to sign in</Link></section></AuthFrame>; }
