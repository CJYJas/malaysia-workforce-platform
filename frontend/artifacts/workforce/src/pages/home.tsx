import { ArrowRight, BookOpen, BriefcaseBusiness, Check, Compass, GitCompareArrows, Lightbulb, LockKeyhole } from "lucide-react";
import { Link } from "wouter";
import { useJourneyFlow } from "@/lib/journey-flow";
import { CareerSummary } from "@/components/career-summary";
import { useJourney } from "@/lib/journey";

const stages = [
  {
    title: "Build your profile",
    shortTitle: "Profile",
    href: "/profile",
    description: "Set a starting point with your skills, interests and the time you can spend learning.",
    action: "Create your profile",
  },
  {
    title: "Read your Future Skills Radar",
    shortTitle: "Future Skills Radar",
    href: "/skills-radar",
    description: "See the skills outlook and the signals behind it before exploring possible roles.",
    action: "Explore the radar",
  },
  {
    title: "Explore role matches",
    shortTitle: "Role matches",
    href: "/role-matches",
    description: "Compare role families against your profile, with strengths and gaps made visible.",
    action: "Review role matches",
  },
  {
    title: "Create a learning pathway",
    shortTitle: "Learning pathway",
    href: "/pathway",
    description: "Choose a role direction and turn it into a practical plan at your own pace.",
    action: "Build your pathway",
  },
];

const supportingTools = [
  { href: "/courses", label: "Courses", icon: BookOpen },
  { href: "/sdg-alignment", label: "SDG Impact", icon: Compass },
  { href: "/roles", label: "Malaysian workforce evidence", icon: BriefcaseBusiness },
  { href: "/compare", label: "Compare roles", icon: GitCompareArrows },
  { href: "/scenarios", label: "Future scenarios", icon: Lightbulb },
];

export function HomePage() {
  const flow = useJourneyFlow();
  const { profile, profileDetails, storageError } = useJourney();
  const nextIndex = flow.allComplete ? -1 : Math.max(0, flow.completedSteps.findIndex((complete) => !complete));
  const current = nextIndex >= 0 ? stages[nextIndex] : null;
  const currentStep = nextIndex + 1;
  const completedCount = flow.completedSteps.filter(Boolean).length;
  const displayName = profileDetails.display_name.trim();
  const welcome = displayName ? `Welcome back, ${displayName}.` : "Your next step starts here.";

  return (
    <div className="mx-auto max-w-5xl rise" data-testid="home-journey">
      <header className="mb-7">
        <p className="page-heading-kicker">YOUR CAREER JOURNEY / MALAYSIA</p>
        <h1 className="mt-1">{welcome}</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          A clear route from your starting point to a learning plan. Take each stage in order; the tools below are optional.
        </p>
      </header>

      {storageError && <p className="mb-5 rounded-xl border border-[#d99070]/30 bg-[#fbede5] p-4 text-sm text-[#8b4932]" role="alert" data-testid="status-storage-error">{storageError}</p>}
      {flow.warning && <p className="mb-5 rounded-xl border border-[#d6c49c] bg-[#f8f4e8] p-4 text-sm text-[#6f603b]" role="status" data-testid="home-progress-warning">{flow.warning}</p>}

      {flow.allComplete ? (
        <section className="home-plan-ready" role="status" data-testid="home-plan-ready">
          <Check size={20} aria-hidden="true" />
          <div>
            <strong>Your learning plan is ready.</strong>
            <p>The journey is complete when your plan is generated — you do not need to finish courses to complete it. Revisit any stage to adjust your direction.</p>
          </div>
        </section>
      ) : current ? (
        <section className="home-next-action" aria-labelledby="home-next-title" data-testid="home-next-action">
          <div>
            <p className="fieldnotes-eyebrow">NEXT UP / {String(currentStep).padStart(2, "0")} OF 04</p>
            <h2 id="home-next-title">{current.action}</h2>
            <p>{current.description}</p>
            <Link href={current.href} className="journey-gate-action" data-testid="home-continue">
              <span>{flow.completedSteps[currentStep - 1] ? `Revisit ${current.shortTitle}` : current.action}</span>
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
          <aside>
            <LockKeyhole size={17} aria-hidden="true" />
            <span>Stages open in sequence. Completed stages remain available to revisit.</span>
          </aside>
        </section>
      ) : null}

      <section aria-labelledby="home-stages-title">
        <div className="dashboard-section-heading">
          <div>
            <p className="fieldnotes-eyebrow">THE ROUTE</p>
            <h2 id="home-stages-title">Four steps, one direction</h2>
          </div>
          <p>{flow.allComplete ? "All four stages complete." : `${completedCount} of 4 stages complete. Your next stage is ready when you are.`}</p>
        </div>
        <ol className="home-step-list">
          {stages.map((stage, index) => {
            const complete = flow.completedSteps[index] === true;
            const active = !flow.allComplete && index + 1 === flow.currentStep && !complete;
            const allowed = complete || flow.canAccessStep(index + 1);
            const status = complete ? "complete" : active ? "current" : "locked";
            const row = (
              <>
                <span className="home-step-marker" aria-hidden="true">{complete ? <Check size={16} /> : index + 1}</span>
                <span className="home-step-copy">
                  <strong>{stage.title}</strong>
                  <span>{complete ? (index === 3 ? "Plan generated; your journey is complete." : "Complete — available to revisit.") : stage.description}</span>
                </span>
                <span className="home-step-state">{complete ? "Complete" : active ? "Current step" : "Locked"}</span>
              </>
            );
            return (
              <li key={stage.href} className="home-step-row" data-status={status} data-testid={`home-stage-${index + 1}`}>
                {allowed
                  ? <Link href={stage.href} className="contents" aria-label={`${index + 1}. ${stage.title}${complete ? ", complete" : active ? ", current step" : ""}`} data-testid={`home-stage-link-${index + 1}`}>{row}</Link>
                  : row}
              </li>
            );
          })}
        </ol>
      </section>

      <CareerSummary />
      <section className="home-tools" aria-labelledby="home-tools-heading">
        <h2 id="home-tools-heading">Optional tools</h2>
        <p className="mt-1 text-sm text-muted-foreground">Explore these whenever useful; they do not replace or unlock a journey stage.</p>
        <div className="home-tools-list">
          {supportingTools.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} data-testid={`home-tool-${href.slice(1)}`}>
              <Icon size={16} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          ))}
        </div>
        {profile && <p className="dashboard-footnote">Your profile and progress are stored in this browser. A learning plan is a planning aid, not a guarantee of employment or a promise of course duration.</p>}
      </section>
    </div>
  );
}

export default HomePage;
