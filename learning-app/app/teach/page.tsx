import { PublicHeader } from "@/app/components/public-header";

export const metadata = { title: "Teach on Growvelt" };

export default function TeachPage() {
  return <div className="public-page">
    <PublicHeader />
    <main className="simple-page teach-page section-shell">
      <div><p className="eyebrow">Teach on Growvelt</p><h1>Practical expertise deserves thoughtful learning design.</h1><p>Growvelt Learning is being shaped for people who can turn real experience into clear, useful learning—not simply upload content.</p><p className="rights-note"><strong>Content rights matter.</strong> Instructors will be expected to own the content they submit or have permission to use it through Growvelt.</p></div>
      <ol className="teach-journey"><li><span>01</span><div><strong>Share your expertise</strong><p>Future Instructors will present their practical teaching approach.</p></div></li><li><span>02</span><div><strong>Build with quality</strong><p>Courses will be structured around outcomes, practice, and authorized content.</p></div></li><li><span>03</span><div><strong>Publish after review</strong><p>Instructor approval and course approval will remain separate decisions.</p></div></li></ol>
      <p className="demo-note">Instructor applications and publishing are not available in Phase 1A.</p>
    </main>
  </div>;
}
