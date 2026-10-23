import { type ReactNode } from "react";
import { Link, useLocation } from "./router";
import { useGetWorkforceOverview } from "./api";
import { BarChart3, GitCompareArrows, GraduationCap, BookOpenText, Database } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate, fmtNum } from "./format";

const NAV = [
  { href: "/", label: "Skills intelligence", icon: BarChart3 },
  { href: "/compare", label: "Compare roles", icon: GitCompareArrows },
  { href: "/courses", label: "Course evidence", icon: GraduationCap },
  { href: "/methodology", label: "Methodology", icon: BookOpenText },
];

function SnapshotStatus() {
  const { data, isLoading, isError } = useGetWorkforceOverview();
  if (isLoading) return <div className="h-16 rounded-lg bg-sidebar-accent animate-pulse" />;
  if (isError || !data)
    return <p className="text-xs text-sidebar-foreground/70" data-testid="status-snapshot">Snapshot metadata unavailable.</p>;
  return (
    <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/60 p-3 text-xs space-y-1.5" data-testid="status-snapshot">
      <div className="flex items-center gap-2 font-semibold text-sidebar-primary">
        <Database className="h-3.5 w-3.5" /> Repository snapshot
      </div>
      <p className="text-sidebar-foreground/80">Not live market data.</p>
      <p className="font-mono text-[11px] text-sidebar-foreground/70">
        {fmtDate(data.coverage_start)} – {fmtDate(data.coverage_end)}
      </p>
      <p className="font-mono text-[11px] text-sidebar-foreground/70">Processed {fmtDate(data.processed_at)}</p>
      <p className="font-mono text-[11px] text-sidebar-foreground/70">{fmtNum(data.target_postings)} target postings</p>
      <p className="font-mono text-[11px] text-sidebar-foreground/50 truncate" title={data.source_commit}>
        commit {data.source_commit.slice(0, 10)}
      </p>
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const [loc] = useLocation();
  return (
    <div className="min-h-[100dvh] md:flex">
      <aside className="md:w-64 md:fixed md:inset-y-0 bg-sidebar text-sidebar-foreground flex flex-col">
        <div className="songket h-1.5" />
        <div className="p-5">
          <Link href="/" className="block" data-testid="link-home">
            <div className="font-serif text-xl leading-tight">Workforce<br /><span className="text-sidebar-primary italic">Intelligence</span></div>
            <div className="mt-1 text-[11px] uppercase tracking-[0.2em] text-sidebar-foreground/60">Malaysia tech</div>
          </Link>
        </div>
        <nav className="px-3 flex md:flex-col gap-1 overflow-x-auto pb-3 md:pb-0" aria-label="Primary">
          {NAV.map((n) => {
            const active = n.href === "/" ? loc === "/" : loc.startsWith(n.href);
            return (
              <Link key={n.href} href={n.href} data-testid={`link-nav-${n.href.replace("/", "") || "home"}`}
                aria-current={active ? "page" : undefined}
                className={cn("flex items-center gap-2.5 whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                  active ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold" : "hover:bg-sidebar-accent text-sidebar-foreground/85")}>
                <n.icon className="h-4 w-4" />{n.label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden md:block mt-auto p-4"><SnapshotStatus /></div>
      </aside>
      <main className="md:ml-64 flex-1 min-w-0">
        <div className="md:hidden px-4 pt-4"><SnapshotStatus /></div>
        <div className="max-w-6xl mx-auto px-4 md:px-10 py-8 md:py-12">{children}</div>
      </main>
    </div>
  );
}

export function PageHeader({ kicker, title, children }: { kicker: string; title: string; children?: ReactNode }) {
  return (
    <header className="rise mb-8">
      <p className="text-xs uppercase tracking-[0.22em] text-primary font-semibold">{kicker}</p>
      <h1 className="font-serif text-3xl md:text-5xl mt-2 leading-[1.05] text-foreground">{title}</h1>
      {children && <div className="mt-3 max-w-2xl text-muted-foreground">{children}</div>}
    </header>
  );
}

export function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6" role="alert">
      <p className="font-semibold text-destructive">{message}</p>
      <button onClick={onRetry} data-testid="button-retry"
        className="mt-3 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90 active:scale-[.98] transition">Retry</button>
    </div>
  );
}

export function Warn({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-accent-foreground/20 bg-accent px-4 py-3 text-sm text-accent-foreground" role="note" data-testid="text-warning">{children}</div>
  );
}
