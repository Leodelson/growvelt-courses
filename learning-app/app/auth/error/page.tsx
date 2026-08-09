import Link from "next/link";
import type { Metadata } from "next";
import { AuthFrame } from "@/app/components/auth/auth-frame";
export const metadata: Metadata = { title: "Authentication issue" };
export default function AuthErrorPage() { return <AuthFrame><section className="auth-card auth-notice-card"><p className="eyebrow">Authentication issue</p><h1>We couldn’t complete that sign-in.</h1><p>The link may have expired or the sign-in could not be verified. Try again, or request a new password reset if needed.</p><div className="auth-actions-row"><Link className="button button-primary" href="/sign-in">Go to sign in</Link><Link className="button button-secondary" href="/forgot-password">Reset password</Link></div></section></AuthFrame>; }
