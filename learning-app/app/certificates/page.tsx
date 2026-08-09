import { LearningMark } from "@/app/components/learning-mark";
import { PublicHeader } from "@/app/components/public-header";

export const metadata = { title: "Certificates" };

export default function CertificatesPage() {
  return <div className="public-page">
    <PublicHeader />
    <main className="simple-page certificate-page section-shell">
      <div><p className="eyebrow">Certificates</p><h1>Proof should be earned, not assumed.</h1><p>Growvelt Learning&apos;s future certificate experience will be connected to real completion rules and verification—not simply watching a lesson.</p><div className="proof-pillars"><span>Complete the path</span><span>Show practical work</span><span>Verify when earned</span></div><p className="demo-note">This is a visual product concept only. No certificate is being issued or verified in Phase 1A.</p></div>
      <div className="certificate-demo" aria-label="Future certificate design preview"><div className="certificate-demo-top"><LearningMark compact /><span>Growvelt Learning</span></div><p>Future verified proof</p><strong>Course completion</strong><span className="certificate-demo-line" /><small>Issued only when real completion requirements are met.</small><div className="certificate-demo-stamp">G</div></div>
    </main>
  </div>;
}
