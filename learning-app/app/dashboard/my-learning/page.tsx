import Link from "next/link";

export const metadata = { title: "My Learning" };

export default function MyLearningPage() {
  return <section className="certificate-space" aria-labelledby="my-learning-title"><p className="eyebrow">My Learning</p><h1 id="my-learning-title">Your enrolled courses will appear here.</h1><p>Enrollment, the course player, and real learning progress are separate upcoming product phases. This account does not yet load course data into My Learning.</p><div className="certificate-space-actions"><Link className="button button-primary" href="/dashboard/explore">Explore catalog preview</Link><Link className="text-link" href="/dashboard">Back to dashboard <span aria-hidden="true">→</span></Link></div></section>;
}
