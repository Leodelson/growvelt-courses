"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "@/app/components/learning-link";
import { MessageCircle, X } from "lucide-react";

type Topic = { label: string; answer: string; href: string; link: string };

const topics: Topic[] = [
  { label: "Find a course", answer: "Browse the course catalog, then open a course to see its content, price, and enrollment options.", href: "/explore", link: "Explore courses" },
  { label: "My learning", answer: "Your enrolled courses and progress are available in My Learning after you sign in.", href: "/dashboard/my-learning", link: "Open My Learning" },
  { label: "Payments", answer: "If a payment has not appeared in your account, please avoid paying again. Contact our team with the payment reference, never your card details.", href: "/dashboard/support", link: "Open a support request" },
  { label: "Subscriptions", answer: "Your subscription status and management options are in your Learning dashboard. If checkout is still confirming, wait for verified confirmation before trying again.", href: "/dashboard/subscriptions", link: "View subscriptions" },
  { label: "Teach", answer: "Start on the teaching page to see how applications and course reviews work.", href: "/teach", link: "Teach on Growvelt" },
  { label: "Organizations", answer: "For team learning or organization access, our Learning team can help. Please leave out passwords and payment details.", href: "/dashboard/support", link: "Open a support request" },
];

export function LearningHelpAssistant() {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState<Topic | null>(null);
  const [question, setQuestion] = useState("");
  const [unmatched, setUnmatched] = useState(false);
  useEffect(() => {
    const listener = () => setOpen(true);
    window.addEventListener("growvelt:open-help-assistant", listener);
    return () => window.removeEventListener("growvelt:open-help-assistant", listener);
  }, []);
  function answer(event: FormEvent) {
    event.preventDefault();
    const value = question.toLowerCase().trim();
    if (!value) return;
    const found = /pay|checkout|refund|charge|card/.test(value) ? topics[2]
      : /subscri|plan|renew|cancel/.test(value) ? topics[3]
      : /teach|instructor|application/.test(value) ? topics[4]
      : /organi|company|team|partnership/.test(value) ? topics[5]
      : /progress|lesson|certificate|enroll/.test(value) ? topics[1]
      : /course|catalog|skill|explore/.test(value) ? topics[0] : null;
    setTopic(found); setUnmatched(!found);
  }
  return <div className="learning-help-assistant">
    {open && <section className="learning-help-panel" role="dialog" aria-modal="false" aria-label="Growvelt Learning help">
      <header><div><small>GROWVELT LEARNING</small><h2>How can we help?</h2></div><button type="button" aria-label="Close help" onClick={() => setOpen(false)}><X size={19} /></button></header>
      <div className="learning-help-content"><p>Ask a Learning question or choose a topic. For account-specific help, contact our support team.</p>
        <form className="learning-help-question" onSubmit={answer}><label className="sr-only" htmlFor="learning-help-question">Learning question</label><input id="learning-help-question" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={180} placeholder="How can I help?" /><button type="submit">Ask</button></form>
        <div className="learning-help-topics">{topics.map((item) => <button type="button" key={item.label} aria-pressed={topic?.label === item.label} onClick={() => { setTopic(item); setUnmatched(false); }}>{item.label}</button>)}</div>
        {topic && <article aria-live="polite"><strong>{topic.label}</strong><p>{topic.answer}</p><Link href={topic.href} onClick={() => setOpen(false)}>{topic.link} →</Link></article>}
        {unmatched && <article aria-live="polite"><strong>Let us help directly</strong><p>I don&rsquo;t have a reliable answer for that question. Send a request to the Learning team and follow the reply from your dashboard.</p><Link href="/dashboard/support" onClick={() => setOpen(false)}>Open a support request →</Link></article>}
      </div>
      <footer><Link href="/dashboard/support" onClick={() => setOpen(false)}>Ask our support team</Link><span>Never share passwords or card details.</span></footer>
    </section>}
    <button className="learning-help-trigger" type="button" aria-expanded={open} aria-label={open ? "Close Learning help" : "Open Learning help"} onClick={() => setOpen((value) => !value)}>{open ? <X size={22} /> : <MessageCircle size={22} />}<span>{open ? "Close" : "Help"}</span></button>
  </div>;
}
