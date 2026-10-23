"use client";

import { FormEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "@/app/components/learning-link";
import { careersAbsoluteUrl } from "@/app/lib/site-urls.mjs";
import {
  ArrowLeft,
  ArrowUpRight,
  BellRing,
  BookOpen,
  Building2,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  CreditCard,
  GraduationCap,
  MessageCircle,
  Search,
  Send,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import styles from "./learning-help-assistant.module.css";

type AssistantTab = "guide" | "messages" | "updates";
type SupportConversationPreview = {
  id: string;
  subject: string;
  status: "open" | "waiting" | "resolved";
  updated_at: string;
  latest_message: string | null;
  latest_sender_role: "customer" | "support" | null;
  latest_message_at: string | null;
};
type HelpTopic = {
  id: string;
  title: string;
  description: string;
  overview: string;
  keywords: string[];
  steps: string[];
  href: string;
  action: string;
  icon: LucideIcon;
};

const welcomeDismissedKey = "growvelt-help-welcome-dismissed";
const topics: HelpTopic[] = [
  {
    id: "courses", title: "Explore courses", description: "Search, compare, and choose a course.",
    overview: "Find practical courses, review what they cover, and choose the learning option that suits you.",
    keywords: ["catalog", "search", "enroll", "course details"],
    steps: ["Open Explore courses and search by a subject, skill, or tool.", "Use the course page to review the outline, instructor, rating, price, and enrollment options.", "Choose the available enrollment option. Your course will appear in My Courses once access is confirmed."],
    href: "/explore", action: "Explore courses", icon: Search,
  },
  {
    id: "learning", title: "My Courses", description: "Return to enrolled courses and lessons.",
    overview: "Your Growvelt dashboard brings your enrolled courses, lesson progress, and certificates together.",
    keywords: ["lesson", "progress", "continue", "resume"],
    steps: ["Open My Courses from your dashboard navigation.", "Choose a course to see its modules and lessons.", "Your completed lessons and course progress are saved to your Growvelt account."],
    href: "/dashboard/my-learning", action: "Open My Courses", icon: BookOpen,
  },
  {
    id: "payments", title: "Payments and subscriptions", description: "Check checkout or manage a plan.",
    overview: "Payments are confirmed by the provider before course or subscription access changes.",
    keywords: ["paystack", "checkout", "billing", "refund", "renew", "cancel"],
    steps: ["Check My subscriptions for the current plan and payment status.", "If checkout is still confirming, wait for the verified result. Do not pay a second time while the first payment is pending.", "For a charge or access issue, open a private support request and include the payment reference only, not card details."],
    href: "/dashboard/subscriptions", action: "View subscriptions", icon: CreditCard,
  },
  {
    id: "teaching", title: "Become Instructor", description: "Apply to teach and manage your courses.",
    overview: "Teaching applications and course publishing are managed in a separate instructor workspace within your Growvelt account.",
    keywords: ["instructor", "application", "publish", "course creator"],
    steps: ["Read the teaching overview and submit an application.", "Create an account if you are new, then choose the teaching option during sign-up.", "Track the application status from your dashboard. Approved instructors can manage courses from the instructor workspace."],
    href: "/teach", action: "Visit the teaching page", icon: GraduationCap,
  },
  {
    id: "certificates", title: "Certificates", description: "Find and verify completed-course certificates.",
    overview: "Certificates become available after you meet the completion requirements for a course.",
    keywords: ["proof", "completed", "credential", "verify"],
    steps: ["Finish the required course lessons and activities.", "Open Certificates in your Growvelt dashboard to view issued credentials.", "Use the certificate’s verification link when you need to share proof of completion."],
    href: "/dashboard/certificates", action: "View certificates", icon: CheckCircle2,
  },
  {
    id: "organizations", title: "Organization learning", description: "Learn with a company or training provider.",
    overview: "Organization learning keeps team courses and access connected to your own Growvelt account.",
    keywords: ["company", "team", "provider", "workspace"],
    steps: ["Open Team Training to view workspaces connected to your account.", "Use an invitation from your organization to join its learning workspace.", "Contact the Growvelt team if an invitation or course access is not showing."],
    href: "/dashboard/company", action: "Open Team Training", icon: Building2,
  },
  {
    id: "account", title: "Account and sign-in", description: "Update your profile and account preferences.",
    overview: "Your Growvelt profile, security history, and preferences are managed separately from Growvelt Careers.",
    keywords: ["google", "password", "profile", "settings", "security"],
    steps: ["Open Profile to review your Growvelt account details.", "Open Settings to adjust available preferences and check recent sign-ins.", "If a sign-in looks unfamiliar, reset your password and contact Growvelt support."],
    href: "/dashboard/settings", action: "Open settings", icon: UserRound,
  },
];

function AssistantAvatars({ compact = false }: { compact?: boolean }) {
  return <span className={compact ? styles.avatarsCompact : styles.avatars} aria-hidden="true">
    <Image src="/images/learning-help-assistant-female.png" alt="" width={compact ? 34 : 42} height={compact ? 34 : 42} sizes={compact ? "34px" : "42px"} />
    {!compact && <Image src="/images/learning-help-assistant-male.png" alt="" width={42} height={42} sizes="42px" />}
  </span>;
}

function tabSubtitle(tab: AssistantTab, topic: HelpTopic | null) {
  if (topic) return topic.title;
  if (tab === "messages") return "Messages and Growvelt support";
  if (tab === "updates") return "Latest platform updates";
  return "How can we help?";
}

function supportStatusLabel(status: SupportConversationPreview["status"]) {
  return status === "resolved" ? "Resolved" : status === "waiting" ? "Your reply needed" : "Awaiting Growvelt team";
}

function supportDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Recently updated" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

function initialWelcomeDismissed() {
  if (typeof window === "undefined") return true;
  try { return window.sessionStorage.getItem(welcomeDismissedKey) === "1"; } catch { return false; }
}

export function LearningHelpAssistant() {
  const assistantId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<AssistantTab>("guide");
  const [topic, setTopic] = useState<HelpTopic | null>(null);
  const [query, setQuery] = useState("");
  const [welcomeReady, setWelcomeReady] = useState(false);
  const [welcomeDismissed, setWelcomeDismissed] = useState(initialWelcomeDismissed);
  const [conversations, setConversations] = useState<SupportConversationPreview[]>([]);
  const [messageState, setMessageState] = useState<"idle" | "loading" | "ready" | "signed-out" | "error">("idle");

  useEffect(() => {
    const timer = window.setTimeout(() => setWelcomeReady(true), 900);
    const listener = () => { setOpen(true); setTab("guide"); setTopic(null); };
    window.addEventListener("growvelt:open-help-assistant", listener);
    return () => { window.clearTimeout(timer); window.removeEventListener("growvelt:open-help-assistant", listener); };
  }, []);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const launcher = launcherRef.current;
    const previousFocus = document.activeElement;
    panel?.focus();
    return () => {
      // This is non-modal: do not pull focus back if the user moved outside it.
      if (panel?.contains(document.activeElement) || document.activeElement === document.body) {
        const target = previousFocus instanceof HTMLElement && previousFocus.isConnected ? previousFocus : launcher;
        target?.focus();
      }
    };
  }, [open]);

  useEffect(() => {
    if (!open || tab !== "messages") return;
    const controller = new AbortController();
    fetch("/api/learning/support", { credentials: "same-origin", cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401) return { signedOut: true as const, conversations: [] as SupportConversationPreview[] };
        if (!response.ok) throw new Error();
        const payload = await response.json() as { conversations?: SupportConversationPreview[] };
        if (!Array.isArray(payload.conversations)) throw new Error();
        return { signedOut: false as const, conversations: payload.conversations };
      })
      .then((payload) => {
        if (controller.signal.aborted) return;
        setConversations(payload.conversations);
        setMessageState(payload.signedOut ? "signed-out" : "ready");
      })
      .catch(() => { if (!controller.signal.aborted) setMessageState("error"); });
    return () => controller.abort();
  }, [open, tab]);

  const filteredTopics = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return topics;
    return topics.filter((item) => [item.title, item.description, item.overview, ...item.keywords, ...item.steps].join(" ").toLowerCase().includes(normalized));
  }, [query]);

  function dismissWelcome() {
    setWelcomeDismissed(true);
    try { window.sessionStorage.setItem(welcomeDismissedKey, "1"); } catch { /* The bubble remains dismissed for this render. */ }
  }

  function openFromWelcome() {
    dismissWelcome();
    setTab("guide");
    setTopic(null);
    setOpen(true);
  }

  function selectTab(nextTab: AssistantTab) {
    if (nextTab === tab) return;
    if (nextTab === "messages") setMessageState("loading");
    setTab(nextTab);
    if (nextTab !== "guide") setTopic(null);
  }

  function searchTopics(event: FormEvent<HTMLFormElement>) { event.preventDefault(); }

  const showWelcome = welcomeReady && !welcomeDismissed && !open;
  const updatesHref = careersAbsoluteUrl("/updates");

  return <div className={styles.assistant}>
    {open && <section ref={panelRef} id={assistantId} tabIndex={-1} className={styles.panel} role="dialog" aria-modal="false" aria-label="Growvelt assistant" onKeyDown={(event) => {
      if (event.key === "Escape" && !event.defaultPrevented) { event.stopPropagation(); setOpen(false); }
    }}>
      <header className={styles.panelHeader}>
        <div className={styles.headerIdentity}><AssistantAvatars compact /><div><h2>Growvelt Assistant</h2><p>{tabSubtitle(tab, topic)}</p></div></div>
        <button className={styles.closeButton} type="button" aria-label="Close assistant" onClick={() => setOpen(false)}><X size={19} /></button>
      </header>

      <div className={styles.panelBody} key={`${tab}-${topic?.id ?? "index"}`} id={`${assistantId}-content`} role="tabpanel" aria-labelledby={`${assistantId}-${tab}`} tabIndex={0}>
        {tab === "guide" && (topic ? <div className={styles.guideDetail}>
          <button className={styles.backButton} type="button" onClick={() => setTopic(null)}><ArrowLeft size={16} /> Back to topics</button>
          <section className={styles.topicOverview}><span className={styles.topicIcon}><topic.icon size={22} /></span><div><h3>{topic.title}</h3><p>{topic.overview}</p></div></section>
          <div className={styles.stepList}>{topic.steps.map((step, index) => <article className={styles.stepCard} key={step}><span className={styles.stepIcon}><span>{index + 1}</span></span><div><h4>{index + 1}. {index === 0 ? "Get started" : index === topic.steps.length - 1 ? "Need a hand?" : "Next step"}</h4><p>{step}</p></div></article>)}</div>
          <Link className={styles.primaryAction} href={topic.href} onClick={() => setOpen(false)}>{topic.action}<ChevronRight size={18} /></Link>
        </div> : <div className={styles.guideHome}>
          <section className={styles.greetingCard}><AssistantAvatars /><div><h3>Hello, I&rsquo;m the Growvelt Assistant.</h3><p>Choose a topic and I&rsquo;ll walk you through the right Growvelt pages and actions.</p></div></section>
          <form className={styles.searchForm} onSubmit={searchTopics}><Search size={19} aria-hidden="true" /><label className="sr-only" htmlFor="learning-assistant-search">Search help topics</label><input id="learning-assistant-search" value={query} onChange={(event) => setQuery(event.target.value)} maxLength={100} placeholder="Search help topics" /></form>
          {filteredTopics.length ? <div className={styles.topicGrid}>{filteredTopics.map((item) => <button className={styles.topicCard} type="button" key={item.id} onClick={() => setTopic(item)}><span className={styles.topicIcon}><item.icon size={21} /></span><span className={styles.topicCopy}><strong>{item.title}</strong><span>{item.description}</span><span className={styles.openGuide}>Open guide <ChevronRight size={15} /></span></span></button>)}</div> : <div className={styles.emptyState}><CircleHelp size={25} /><p>No guide topics match that search. Try another phrase or contact the Growvelt team in Messages.</p><button type="button" onClick={() => { setQuery(""); selectTab("messages"); }}>Open Messages</button></div>}
        </div>)}

        {tab === "messages" && <div className={styles.messagesView}>
          <section className={styles.supportTeamCard}><AssistantAvatars compact /><div><h3>Growvelt Support</h3><p>Help with courses, payments, teaching, and your Growvelt account.</p></div><span className={styles.supportStatus}>Replies from Growvelt</span></section>
          <section className={styles.messageIntro}><h3>How can we help?</h3><p>Start a private conversation with the Growvelt team. Your request and replies stay in your Growvelt dashboard.</p></section>
          <div className={styles.conversationList} aria-live="polite">
            {messageState === "loading" && <p className={styles.messageHint}>Loading your recent conversations…</p>}
            {messageState === "error" && <p className={styles.messageHint} role="status">We couldn&rsquo;t load messages just now. You can still open a support request below.</p>}
            {messageState === "signed-out" && <p className={styles.messageHint}>Sign in to see your Growvelt support conversations.</p>}
            {messageState === "ready" && conversations.length === 0 && <p className={styles.messageHint}>Your Growvelt conversations and replies will appear here.</p>}
            {messageState === "ready" && conversations.map((item) => <Link className={styles.conversationCard} href={`/dashboard/support/${item.id}`} key={item.id}>
              <span className={`${styles.conversationStatus} ${item.status === "resolved" ? styles.statusResolved : item.status === "waiting" ? styles.statusWaiting : styles.statusOpen}`}>{supportStatusLabel(item.status)}</span>
              <strong>{item.subject}</strong>
              <span className={styles.conversationPreview}>{item.latest_sender_role === "support" ? "Growvelt team: " : item.latest_sender_role === "customer" ? "You: " : ""}{item.latest_message ?? "No messages yet."}</span>
              <small>Updated {supportDate(item.latest_message_at ?? item.updated_at)} <ChevronRight size={14} /></small>
            </Link>)}
            {messageState === "signed-out" && <Link className={styles.signInMessages} href="/sign-in?next=%2Fdashboard%2Fsupport">Sign in to view messages <ArrowUpRight size={15} /></Link>}
          </div>
          <Link className={styles.messageAction} href="/dashboard/support"><Send size={18} />Start a new conversation<ArrowUpRight size={17} /></Link>
          <p className={styles.privacyNote}>Please don&rsquo;t send passwords, card numbers, or security codes.</p>
        </div>}

        {tab === "updates" && <div className={styles.updatesView}>
          <section className={styles.updatesCard}><span className={styles.updatesIcon}><BellRing size={23} /></span><div><h3>Growvelt updates</h3><p>Read announcements, platform changes, tutorials, maintenance notices, and feature guides.</p></div></section>
          <a className={styles.updatesAction} href={updatesHref} target="_blank" rel="noreferrer">Open updates <ChevronRight size={19} /><span className="sr-only"> on Growvelt Careers in a new tab</span></a>
          <p className={styles.updatesNote}>Growvelt announcements are published on the public Growvelt Updates page.</p>
        </div>}
      </div>

      <nav className={styles.tabs} role="tablist" aria-label="Assistant sections" onKeyDown={(event) => {
        const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
        if (!keys.includes(event.key)) return;
        const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
        const index = tabs.findIndex((item) => item === event.target);
        if (index < 0) return;
        event.preventDefault();
        const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
        tabs[next]?.focus();
        tabs[next]?.click();
      }}>
        <button id={`${assistantId}-guide`} type="button" role="tab" aria-controls={`${assistantId}-content`} tabIndex={tab === "guide" ? 0 : -1} aria-selected={tab === "guide"} onClick={() => selectTab("guide")}><BookOpen size={22} /><span>Guide</span></button>
        <button id={`${assistantId}-messages`} type="button" role="tab" aria-controls={`${assistantId}-content`} tabIndex={tab === "messages" ? 0 : -1} aria-selected={tab === "messages"} onClick={() => selectTab("messages")}><MessageCircle size={22} /><span>Messages</span></button>
        <button id={`${assistantId}-updates`} type="button" role="tab" aria-controls={`${assistantId}-content`} tabIndex={tab === "updates" ? 0 : -1} aria-selected={tab === "updates"} onClick={() => selectTab("updates")}><BellRing size={22} /><span>Updates</span></button>
      </nav>
    </section>}

    {showWelcome && <aside className={styles.welcomeBubble} aria-label="Growvelt help">
      <button className={styles.welcomeClose} type="button" aria-label="Dismiss help message" onClick={dismissWelcome}><X size={16} /></button>
      <span className={styles.welcomeMark}><MessageCircle size={22} /></span>
      <div><strong>Hello there!</strong><span>Need some help?</span><button type="button" onClick={openFromWelcome}>Let&rsquo;s chat now</button></div>
    </aside>}

    <button ref={launcherRef} className={styles.launcher} type="button" aria-controls={open ? assistantId : undefined} aria-expanded={open} aria-label={open ? "Close Growvelt assistant" : "Open Growvelt assistant"} onClick={() => {
      if (!open && tab === "messages") setMessageState("loading");
      setOpen((value) => !value);
    }}>
      <span className={styles.launcherIcon}>{open ? <X size={20} /> : <MessageCircle size={20} />}</span><span>Help</span><span className={styles.launcherArrow} aria-hidden="true">{open ? "↑" : "→"}</span>
    </button>
  </div>;
}
