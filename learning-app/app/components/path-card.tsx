import type { MockLearningPath } from "@/app/lib/mock-data";

export function PathCard({ path }: { path: MockLearningPath }) {
  return <article className="path-card"><span className="path-index">{path.index}</span><p className="eyebrow">Learning path</p><h3>{path.title}</h3><p>{path.description}</p><div><span>{path.focus}</span><span>{path.stage}</span></div></article>;
}
