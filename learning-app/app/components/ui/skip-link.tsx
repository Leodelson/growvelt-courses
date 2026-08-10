export function SkipLink({ href = "#main-content" }: { href?: string }) {
  return <a className="skip-link" href={href}>Skip to main content</a>;
}
