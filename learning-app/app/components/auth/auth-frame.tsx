import { LearningMark } from "@/app/components/learning-mark";

export function AuthFrame({ children }: { children: React.ReactNode }) {
  return <main className="auth-page"><aside className="auth-story"><LearningMark /><div className="auth-story-copy"><p className="eyebrow">Growvelt Learning</p><h1>Learn. Teach. Build what’s next.</h1><div className="auth-value-list"><p><span>01</span>Learn practical, career-relevant skills</p><p><span>02</span>Share your expertise and reach learners</p><p><span>03</span>Build progress, proof and opportunity</p></div></div><div className="auth-story-motif" aria-hidden="true"><i /><i /><i /></div><p className="auth-story-note">Built for people who want to learn, teach and grow.</p></aside><section className="auth-form-area">{children}</section></main>;
}
