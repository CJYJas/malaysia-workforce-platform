import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useGetWorkforceOverview } from "@workspace/api-client-react";
import {
  Archive, BookOpen, ChevronDown, Compass, GitCompareArrows,
  Goal, LayoutDashboard, Menu, Radar, Route,
  UserRound, X, BriefcaseBusiness, Lightbulb, Check, LockKeyhole, FileText,
} from "lucide-react";
import { fmtDate } from "@/lib/format";
import { useJourney } from "@/lib/journey";
import { useJourneyFlow } from "@/lib/journey-flow";
import { useAccount } from "@/lib/account";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/resume", label: "AI Resume Parser", icon: FileText },
  { href: "/profile", label: "Profile", icon: UserRound, step: 1 },
  { href: "/skills-radar", label: "Future Skills Radar", icon: Radar, step: 2 },
  { href: "/role-matches", label: "Role matches", icon: Compass, step: 3 },
  { href: "/pathway", label: "Learning pathway", icon: Route, step: 4 },
];
const MORE = [
  { href: "/resume", label: "AI Resume Parser", icon: FileText },
  { href: "/courses", label: "Courses", icon: BookOpen },
  { href: "/sdg-alignment", label: "SDG Impact", icon: Goal },
  { href: "/roles", label: "Role Explorer", icon: BriefcaseBusiness },
  { href: "/methodology", label: "Data and sources", icon: Archive },
  { href: "/scenarios", label: "Future scenarios", icon: Lightbulb },
  { href: "/compare", label: "Compare roles", icon: GitCompareArrows },
];
const routeTitles: Record<string, string> = {
  "/": "Overview", "/dashboard": "Overview", "/profile": "My Profile",
  "/resume": "AI Resume Parser", "/parser": "AI Resume Parser",
  "/radar": "Future Skills Radar", "/skills-radar": "Future Skills Radar",
  "/roles": "Role Explorer", "/matches": "Role Matches",
  "/role-matches": "Role Matches", "/pathway": "Learning Pathway",
  "/goals": "SDG Impact", "/sdg-alignment": "SDG Impact",
  "/courses": "Courses", "/scenarios": "Future scenarios",
  "/compare": "Compare roles", "/skills": "Historical skills",
  "/methodology": "Methodology and sources",
};

export function SnapshotStatus() {
  const { data, isLoading, isError } = useGetWorkforceOverview();
  if (isLoading) return <div className="h-9 w-60 rounded-lg bg-secondary animate-pulse" aria-label="Loading dataset status" />;
  return (
    <div className="fieldnotes-top-status" data-testid="status-snapshot" role="note" aria-label="Dataset status">
      <i aria-hidden="true" />
      <Archive size={15} aria-hidden="true" />
      <span>{isError || !data ? "Historical snapshot · coverage unavailable" : `Historical snapshot · ${fmtDate(data.coverage_start)} – ${fmtDate(data.coverage_end)}`}</span>
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const [loc] = useLocation();
  const { profile, profileDetails } = useJourney();
  const account = useAccount();
  const flow = useJourneyFlow();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pageTitle = routeTitles[loc] || (loc.startsWith("/roles/") ? `Role details · ${loc.split("/")[2].replaceAll("-", " ")}` : "FutureReady MY");
  const firstName = profileDetails.display_name.trim();
  const avatar = firstName ? firstName.slice(0, 1).toUpperCase() : <UserRound size={16} />;

  useEffect(() => {
    document.title = `${pageTitle} · FutureReady MY`;
    const description = "Understand the market. Discover your next role. Build your future with evidence-led career intelligence for Malaysia.";
    for (const [attr, name, content] of [
      ["name", "description", description],
      ["property", "og:title", document.title],
      ["property", "og:description", description],
    ]) {
      let element = document.head.querySelector(`meta[${attr}="${name}"]`);
      if (!element) { element = document.createElement("meta"); element.setAttribute(attr, name); document.head.append(element); }
      element.setAttribute("content", content);
    }
  }, [loc, pageTitle]);

  useEffect(() => { setMenuOpen(false); setMobileOpen(false); }, [loc]);
  useEffect(() => {
    if (!menuOpen && !mobileOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") { setMenuOpen(false); setMobileOpen(false); } };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [menuOpen, mobileOpen]);

  const active = (href: string) => loc === href ||
    (href === "/dashboard" && loc === "/") ||
    (href === "/skills-radar" && loc === "/radar") ||
    (href === "/role-matches" && loc === "/matches") ||
    (href === "/sdg-alignment" && loc === "/goals") ||
    (href === "/roles" && (loc === "/skills" || loc.startsWith("/roles/")));

  return (
    <div className="fieldnotes-app">
      <a className="skip-content" href="#main-content">Skip to main content</a>
      <aside className={`fieldnotes-sidebar${mobileOpen ? " is-open" : ""}`} aria-label="Application navigation">
        <Link href="/dashboard" data-testid="link-home" aria-label="FutureReady MY overview" className="fieldnotes-brand">
          <span className="fieldnotes-mark"><Compass size={22} aria-hidden="true" /></span>
          <span className="fieldnotes-brand-name">FutureReady MY<span className="fieldnotes-brand-sub">CAREER INTELLIGENCE</span></span>
        </Link>
        <button type="button" className="fieldnotes-mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close navigation" data-testid="button-close-navigation"><X size={20} /></button>
        <p className="fieldnotes-nav-label">Workspace</p>
        <nav className="fieldnotes-nav" aria-label="Main navigation">
          {NAV.map(({ href, label, icon: Icon, step }) => {
            const isLocked = !!step && !flow.canAccessStep(step);
            const isComplete = !!step && flow.completedSteps[step - 1];
            const contents = <><span className={`fieldnotes-nav-icon${step ? " is-numbered" : ""}`} aria-hidden="true">{step ? (isComplete ? <Check size={15} /> : step) : <Icon size={18} />}</span><span>{label}</span>{isLocked && <LockKeyhole className="fieldnotes-nav-lock" size={14} aria-hidden="true" />}</>;
            return isLocked
              ? <button key={href} type="button" className="is-locked" disabled aria-disabled="true" aria-label={`${label.trim()}, locked. Complete earlier steps first.`} title="Complete earlier steps to unlock this stage" data-testid={`nav-${href.slice(1)}-locked`}>{contents}</button>
              : <Link key={href} href={href} data-testid={`nav-${href.slice(1) || "home"}`} aria-current={active(href) ? "page" : undefined} className={active(href) ? "is-active" : ""}>{contents}</Link>;
          })}
        </nav>
        <div className="fieldnotes-nav-secondary">
          <p className="fieldnotes-nav-label">Supporting tools</p>
          <nav className="fieldnotes-nav" aria-label="More tools">
            {MORE.map(({ href, label, icon: Icon }) => <Link key={href} href={href} data-testid={`nav-${href.slice(1)}`} aria-current={loc === href ? "page" : undefined}><Icon size={18} aria-hidden="true" /><span>{label}</span></Link>)}
          </nav>
        </div>
        <div className="fieldnotes-data-note">
          <strong><Archive size={15} aria-hidden="true" /> Evidence status</strong>
          <p>Historical Malaysian postings; separate global outlook signals for 2025–2030. Not live vacancies.</p>
        </div>
      </aside>
      <div className="fieldnotes-layout">
        {account.guestMode && !account.user && (
          <div className="bg-primary/10 border-b border-primary/20 px-4 py-2 text-xs text-center flex items-center justify-center gap-2">
            <span className="text-muted-foreground">Guest Preview Mode:</span>
            <Link href="/signup" className="font-semibold text-primary underline underline-offset-2">Create an account to permanently sync your resume analyses & learning roadmaps</Link>
          </div>
        )}
        <header className="fieldnotes-top">
          <div className="fieldnotes-top-heading">
            <p>FutureReady MY <span aria-hidden="true">/</span> Malaysia</p>
            <h1>{pageTitle}</h1>
          </div>
          <div className="fieldnotes-top-actions">
            <SnapshotStatus />
            <div className="fieldnotes-profile-menu">
              <button type="button" className="fieldnotes-profile-button" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(value => !value)} data-testid="button-profile-menu">
                <span className="fieldnotes-profile-avatar" aria-hidden="true">{avatar}</span>
                <span className="fieldnotes-profile-name">{account.user ? account.user.email.split("@")[0] : firstName || (account.guestMode ? "Guest" : "Your profile")}</span>
                <ChevronDown size={15} aria-hidden="true" />
              </button>
              {menuOpen && <div className="fieldnotes-profile-dropdown" role="menu">
                <Link href="/profile" role="menuitem" data-testid="menu-profile"><UserRound size={16} /> View or edit profile</Link>
                <Link href="/account" role="menuitem" data-testid="menu-account"><UserRound size={16} /> {account.user ? `Account (${account.user.email})` : "Sign in or create account"}</Link>
                <p role="note">{account.user ? "Learning progress syncs to your account. Profile and pathway calculations remain separate from assessed proficiency." : profile ? "Your answers are saved in this browser. Sign in to sync pathway completion." : "Guest mode. Sign up to save your learning roadmaps."}</p>
                {account.user ? (
                  <button type="button" role="menuitem" onClick={() => { void account.logout(); }} data-testid="menu-signout">Sign out</button>
                ) : (
                  <Link href="/signup" role="menuitem">Sign up now</Link>
                )}
              </div>}
            </div>
            <button type="button" className="fieldnotes-mobile-menu" aria-label={mobileOpen ? "Close navigation" : "Open navigation"} aria-expanded={mobileOpen} onClick={() => setMobileOpen(value => !value)} data-testid="button-mobile-navigation">{mobileOpen ? <X size={19} /> : <Menu size={19} />}</button>
          </div>
        </header>
        <main id="main-content" className="fieldnotes-main" tabIndex={-1}>{children}</main>
        <footer className="fieldnotes-footer"><span>FutureReady MY <span aria-hidden="true">·</span> Malaysia workforce intelligence</span><span>Historical evidence · Global outlook signals · Your own pace</span></footer>
      </div>
    </div>
  );
}

export function PageHeader({ kicker, title, children }: { kicker: string; title: string; children?: ReactNode }) {
  return <header className="page-heading rise mb-7"><p className="page-heading-kicker">{kicker}</p><h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-foreground">{title}</h1>{children && <div className="mt-2 max-w-2xl text-sm text-muted-foreground">{children}</div>}</header>;
}

export function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6" role="alert"><p className="font-semibold text-destructive">{message}</p><button onClick={onRetry} data-testid="button-retry" className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Try again</button></div>;
}

export function Warn({ children }: { children: ReactNode }) {
  return <div className="rounded-xl bg-accent px-4 py-3 text-sm text-accent-foreground" role="note" data-testid="text-warning">{children}</div>;
}
