import { type ReactNode } from "react";
import { Link, useLocation } from "./router";
import { useGetWorkforceOverview } from "./api";
import { LayoutGrid, GitCompareArrows, GraduationCap, BookOpenText, Archive } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate } from "./format";

const NAV = [
  { href: "/", label: "Skills overview", icon: LayoutGrid },
  { href: "/compare", label: "Compare roles", icon: GitCompareArrows },
  { href: "/courses", label: "Course finder", icon: GraduationCap },
  { href: "/methodology", label: "Methodology", icon: BookOpenText },
];

function Logo() {
  return (
    <svg viewBox="0 0 32 32" className="h-9 w-9" aria-hidden="true">
      <circle cx="16" cy="16" r="15" fill="#22283B" />
      <path d="M5 13 Q16 7 27 13" stroke="#F7A531" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M4.5 18.5 Q16 12.5 27.5 18.5" stroke="#FBF6EC" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M7 23.5 Q16 18.5 25 23.5" stroke="#F0663A" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function SnapshotStatus() {
  const { data, isLoading, isError } = useGetWorkforceOverview();
  if (isLoading) return <div className="h-9 w-64 rounded-full bg-secondary animate-pulse" />;
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-card soft-shadow px-3.5 py-2 text-xs" data-testid="status-snapshot" role="note">
      <Archive className="h-3.5 w-3.5 text-[#E9692F]" />
      <span className="font-semibold">Historical repository snapshot</span>
      <span className="text-muted-foreground">· not live data</span>
      {!isError && data && <span className="text-muted-foreground hidden sm:inline">· {fmtDate(data.coverage_start)} – {fmtDate(data.coverage_end)}</span>}
      {(isError || !data) && <span className="text-muted-foreground">· coverage unavailable</span>}
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const [loc] = useLocation();
  return (
    <div className="min-h-[100dvh] bg-[hsl(220_12%_90%)] md:p-5 lg:p-7">
      <div className="mx-auto max-w-[1440px] min-h-[100dvh] md:min-h-[calc(100dvh-2.5rem)] lg:min-h-[calc(100dvh-3.5rem)] md:rounded-[28px] bg-background md:soft-shadow md:flex overflow-hidden">
        <aside className="md:w-[84px] shrink-0 bg-card md:border-r flex md:flex-col items-center gap-2 md:gap-6 px-3 py-3 md:py-7 sticky top-0 z-30 md:static border-b md:border-b-0">
          <Link href="/" data-testid="link-home" aria-label="Malaysia tech careers home" className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Logo /></Link>
          <nav className="flex md:flex-col gap-1.5 md:gap-3 ml-auto md:ml-0" aria-label="Primary">
            {NAV.map((n) => {
              const active = n.href === "/" ? loc === "/" : loc.startsWith(n.href);
              return (
                <Link key={n.href} href={n.href} data-testid={`link-nav-${n.href.replace("/", "") || "home"}`}
                  aria-current={active ? "page" : undefined} aria-label={n.label} title={n.label}
                  className={cn("group relative grid place-items-center h-11 w-11 rounded-2xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95",
                    active ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:bg-secondary hover:text-foreground")}>
                  <n.icon className="h-5 w-5" />
                  <span role="tooltip" className="pointer-events-none absolute z-40 whitespace-nowrap rounded-lg bg-primary px-2.5 py-1 text-xs text-primary-foreground opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100 top-full mt-2 md:top-auto md:mt-0 md:left-full md:ml-3">{n.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className="flex-1 min-w-0 px-4 md:px-8 lg:px-10 py-6 md:py-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <SnapshotStatus />
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}

export function PageHeader({ kicker, title, children }: { kicker: string; title: string; children?: ReactNode }) {
  return (
    <header className="rise mb-7">
      <p className="text-sm text-muted-foreground">{kicker}</p>
      <h1 className="text-2xl md:text-[28px] font-semibold tracking-tight mt-0.5 text-foreground">{title}</h1>
      {children && <div className="mt-2 max-w-2xl text-sm text-muted-foreground">{children}</div>}
    </header>
  );
}

export function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6" role="alert">
      <p className="font-semibold text-destructive">{message}</p>
      <button onClick={onRetry} data-testid="button-retry"
        className="mt-3 rounded-xl bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90 active:scale-[.98] transition">Try again</button>
    </div>
  );
}

export function Warn({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl bg-accent px-4 py-3 text-sm text-accent-foreground" role="note" data-testid="text-warning">{children}</div>
  );
}
