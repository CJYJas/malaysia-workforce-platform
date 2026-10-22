import { useState, type ReactNode } from "react";
import { ChevronDown, ExternalLink, Sparkles } from "lucide-react";
import type { JourneyCatalog, JourneyScenario, SdgLink } from "@workspace/api-client-react";
import { Link } from "wouter";

export function ScenarioPicker({ scenarios, value, onChange }: { scenarios: JourneyCatalog["scenarios"]; value: JourneyScenario; onChange: (v: JourneyScenario) => void }) {
  return <fieldset className="rounded-2xl border border-[#e4e1d6] bg-[#fbfaf5] p-4">
    <legend className="px-1 text-sm font-semibold">Explore a what-if view</legend>
    <p className="mb-3 text-xs text-muted-foreground">These are different assumptions, not probabilities or predictions.</p>
    <div className="grid gap-2 sm:grid-cols-3">{scenarios.map((s) => <button type="button" key={s.id} onClick={() => onChange(s.id)} data-testid={`button-scenario-${s.id}`} aria-pressed={value === s.id} className={`min-h-[76px] rounded-xl border px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${value === s.id ? "border-[#4f8a74] bg-[#e5f1e9] text-[#173a37]" : "border-border bg-card hover:bg-[#f2f1e8]"}`}><span className="block text-sm font-semibold">{s.title}</span><span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{s.description}</span></button>)}</div>
  </fieldset>;
}
export function SdgExplorer({ goals, defaultOpen = false }: { goals: SdgLink[]; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return <section className="rounded-2xl border border-[#e4e1d6] bg-[#fbfaf5] p-4" aria-label="Sustainable Development Goals">
    <button onClick={() => setOpen(!open)} aria-expanded={open} data-testid="button-sdg-explorer" className="flex w-full items-center justify-between gap-3 text-left"><span><span className="block text-sm font-semibold">A wider lens: all 17 Sustainable Development Goals</span><span className="mt-1 block text-[13px] text-muted-foreground">Our skill links are editorial possibilities, not UN endorsement.</span></span><ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} /></button>
    {open && <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{goals.map((g) => <article key={g.id} className="rounded-xl bg-white px-3 py-2 transition hover:bg-[#e8f2eb]">
      <Link href={`/sdg-alignment?goal=${g.id}`} title={g.reason} aria-label={`Open Goal ${g.id}: ${g.title}. ${g.reason}`} data-testid={`link-sdg-${g.id}`} className="block rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="text-[13px]"><b className="text-[#df7559]">Goal {g.id}</b><span className="ml-2 font-semibold">{g.title}</span></span>
        <span className="mt-1 block text-[13px] leading-relaxed text-muted-foreground">{g.reason}</span>
      </Link>
      <a href={g.url} target="_blank" rel="noreferrer noopener" aria-label={`Official United Nations information for Goal ${g.id}: ${g.title}`} data-testid={`link-sdg-official-${g.id}`} className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold text-[#286b73] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Official UN goal <ExternalLink className="h-3.5 w-3.5" /></a>
    </article>)}</div>}
  </section>;
}
export function SourceNote({ children }: { children: ReactNode }) {
  return <details className="group rounded-2xl border border-[#e4e1d6] bg-[#fbfaf5] px-4 py-3"><summary data-testid="button-source-details" className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-[#d57c5e]" />Sources, assumptions & limitations<ChevronDown className="ml-auto h-4 w-4 transition-transform group-open:rotate-180" /></summary><div className="pt-3 text-sm leading-relaxed text-muted-foreground">{children}</div></details>;
}
