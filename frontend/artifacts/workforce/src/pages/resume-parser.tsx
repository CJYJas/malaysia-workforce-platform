import { PageHeader } from "@/components/shell";
import { ResumeParserCard } from "@/components/resume-parser-card";
import { ShieldCheck, Cpu, Database, CheckCircle2, ArrowRight } from "lucide-react";
import { Link } from "wouter";

export function ResumeParserPage() {
  return (
    <div className="mx-auto max-w-5xl py-2 space-y-8" data-testid="page-resume-parser">
      <PageHeader
        kicker="Empirical Intelligence Gate"
        title="AI Resume & Profile Parser"
      >
        <span>
          Accelerate your career journey. Upload your PDF resume or paste profile text to extract verified
          Malaysian technology skills, inspect verbatim text evidence, and instantly match against empirical JobStreet role profiles.
        </span>
      </PageHeader>

      {/* Main Parser Card */}
      <ResumeParserCard />

      {/* Feature Highlights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-4">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h3 className="font-bold text-foreground text-sm">Privacy Guaranteed</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Resumes are parsed entirely in-memory using PyMuPDF. Names, emails, phone numbers, and ICs are strictly redacted. Nothing is stored on disks or shared with third parties.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Cpu className="h-5 w-5" />
          </div>
          <h3 className="font-bold text-foreground text-sm">RunPod LLM Verification Gate</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Powered by our live RunPod Serverless worker (<code className="text-xs font-mono">Qwen2.5-7B-Instruct</code>). Hallucinated or non-canonical skills are rejected at the verification boundary.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <Database className="h-5 w-5" />
          </div>
          <h3 className="font-bold text-foreground text-sm">70/30 Empirical Matching</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Every match score is computed using 70% direct skill coverage + 30% TF-IDF requirement similarity calibrated across 63,852 real Malaysian job advertisements.
          </p>
        </div>
      </div>

      {/* Navigation Footer */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-secondary/30 p-5 mt-6">
        <div>
          <p className="font-semibold text-sm text-foreground">Need to customize your profile details manually?</p>
          <p className="text-xs text-muted-foreground">You can also fine-tune your self-reported proficiency and target role in the profile editor.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/profile"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-secondary transition"
          >
            Edit Profile Manually
          </Link>
          <Link
            href="/skills-radar"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 transition"
          >
            Go to Future Skills Radar <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
