export function VerifiedProviderBadge({ className = "" }: { className?: string }) {
  return <span className={`verified-provider-badge ${className}`.trim()} title="Verified provider" aria-label="Verified provider"><svg aria-hidden="true" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="9" fill="currentColor" /><path d="m6.25 10.1 2.25 2.25 5.25-5.25" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" /></svg><span className="sr-only">Verified provider</span></span>;
}
