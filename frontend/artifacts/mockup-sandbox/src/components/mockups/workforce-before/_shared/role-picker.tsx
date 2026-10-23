import type { WorkforceRole } from "./api";
import { cn } from "@/lib/utils";
import { fmtNum } from "./format";

export function RolePicker({ roles, value, onChange, idPrefix = "role" }: { roles: WorkforceRole[]; value: string; onChange: (r: string) => void; idPrefix?: string }) {
  return (
    <div role="radiogroup" aria-label="Role" className="flex flex-wrap gap-2">
      {roles.map((r) => {
        const on = r.name === value;
        return (
          <button key={r.name} role="radio" aria-checked={on} onClick={() => onChange(r.name)} title={r.description}
            data-testid={`button-${idPrefix}-${r.name}`}
            className={cn("rounded-full border px-4 py-2 text-sm transition active:scale-[.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              on ? "bg-primary text-primary-foreground border-primary shadow-sm" : "bg-card hover:border-primary/50")}>
            <span className="font-medium">{r.name}</span>
            <span className={cn("ml-2 font-mono text-xs", on ? "opacity-80" : "text-muted-foreground")}>n={fmtNum(r.postings)}</span>
            {r.sample_warning && <span className="ml-1.5 text-[10px] uppercase tracking-wide text-accent-foreground bg-accent rounded px-1">low n</span>}
          </button>
        );
      })}
    </div>
  );
}
