import { AuthFrame } from "@/app/components/auth/auth-frame";
import { Skeleton } from "@/app/components/ui/skeleton";
export default function Loading(){return <AuthFrame><section className="auth-card" role="status" aria-busy="true"><h1 className="sr-only">Loading account access…</h1><Skeleton className="skeleton-title"/><Skeleton className="skeleton-copy"/><Skeleton className="skeleton-input"/><Skeleton className="skeleton-input"/><Skeleton className="skeleton-button"/></section></AuthFrame>;}
