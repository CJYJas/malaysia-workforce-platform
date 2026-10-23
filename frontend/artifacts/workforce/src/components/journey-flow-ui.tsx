import { Check, LockKeyhole, MoveRight } from "lucide-react";
import { Link } from "wouter";
import { useJourneyFlow } from "@/lib/journey-flow";

const stages = [
  { title: "Profile", href: "/profile" },
  { title: "Future Skills Radar", href: "/skills-radar" },
  { title: "Role matches", href: "/role-matches" },
  { title: "Learning pathway", href: "/pathway" },
];

export function JourneyProgress() {
  const flow = useJourneyFlow();

  return (
    <nav className="journey-progress-wrap" aria-label="Career journey progress" data-testid="journey-progress">
      <ol className="journey-progress">
        {stages.map((stage, index) => {
          const number = index + 1;
          const complete = flow.completedSteps[index] === true;
          const allowed = complete || flow.canAccessStep(number);
          const current = !complete && !flow.allComplete && flow.currentStep === number;
          const status = complete ? "complete" : current ? "current" : "locked";
          const content = (
            <>
              <span className="journey-progress-number" aria-hidden="true">
                {complete ? <Check size={16} /> : number}
              </span>
              <span className="journey-progress-label">{stage.title}</span>
            </>
          );
          return (
            <li key={stage.href} data-status={status} data-testid={`journey-step-${number}`}>
              {allowed
                ? <Link href={stage.href} aria-current={current ? "step" : undefined} aria-label={`${number}. ${stage.title}${complete ? ", complete" : current ? ", current step" : ""}`} data-testid={`journey-link-step-${number}`}>{content}</Link>
                : <span className="journey-progress-locked" aria-disabled="true" aria-label={`${number}. ${stage.title}, locked until earlier steps are complete`} title="Complete earlier stages to unlock this step">{content}<LockKeyhole size={13} aria-hidden="true" /></span>}
            </li>
          );
        })}
      </ol>
      {flow.warning && <p className="journey-progress-note" role="status" data-testid="journey-progress-warning">{flow.warning}</p>}
    </nav>
  );
}

export function JourneyGate({ step }: { step: number }) {
  const flow = useJourneyFlow();
  const required = stages[Math.min(Math.max(step - 1, 0), stages.length - 1)];
  const earliestIncompleteIndex = flow.completedSteps.findIndex((completed) => !completed);
  const destinationIndex = earliestIncompleteIndex < 0 ? 0 : earliestIncompleteIndex;
  const destination = stages[destinationIndex];
  const destinationNumber = destinationIndex + 1;

  return (
    <section className="journey-gate rise" aria-labelledby="journey-gate-title" data-testid="journey-gate">
      <span className="journey-gate-index">A guided journey · {String(step).padStart(2, "0")} / 04</span>
      <h2 id="journey-gate-title">One step at a time</h2>
      <p>
        {required?.title ?? "This stage"} opens after the earlier parts of your journey are complete. Your progress stays in this browser, and you can revisit completed stages whenever you like.
      </p>
      {flow.warning && <p role="status" data-testid="journey-gate-warning">{flow.warning}</p>}
      <Link href={destination.href} className="journey-gate-action" data-testid="journey-gate-action">
        <span>{destinationNumber}. {destinationIndex === step - 1 ? `Continue ${destination.title.toLowerCase()}` : `Go to ${destination.title.toLowerCase()}`}</span>
        <MoveRight size={17} aria-hidden="true" />
      </Link>
    </section>
  );
}
