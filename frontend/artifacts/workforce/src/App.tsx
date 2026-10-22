import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Shell } from '@/components/shell';
import Dashboard from '@/pages/dashboard';
import Compare from '@/pages/compare';
import Courses from '@/pages/courses';
import { RadarPage, PathwayPage } from '@/pages/journey';
import { MatchesPage } from '@/pages/matches';
import { RoleExplorerPage, RoleDetailPage } from '@/pages/roles';
import { MethodologyPage } from '@/pages/methodology';
import { HomePage } from '@/pages/home';
import { ProfilePage } from '@/pages/profile';
import { JourneyProvider, useJourney } from '@/lib/journey';
import { JourneyFlowProvider, useJourneyFlow } from '@/lib/journey-flow';
import { JourneyProgress, JourneyGate } from '@/components/journey-flow-ui';
import { GoalsPage, ScenariosPage } from '@/pages/journey-lenses';
import {
  Route,
  Switch,
  Link,
  useLocation,
  useSearch,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

function Router() {
  const [location] = useLocation();
  const showProgress = ["/profile", "/radar", "/skills-radar", "/matches", "/role-matches", "/pathway"].includes(location);
  return (
    // The application shell persists across the connected career journey.
    <JourneyProvider><JourneyFlowProvider><Shell>
    {showProgress && <JourneyProgress />}
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={HomePage} />
        <Route path="/dashboard" component={HomePage} />
        <Route path="/profile" component={ProfilePage} />
        <Route path="/radar"><JourneyStage step={2}><RadarPage /></JourneyStage></Route>
        <Route path="/skills-radar"><JourneyStage step={2}><RadarPage /></JourneyStage></Route>
        <Route path="/matches"><JourneyStage step={3}><MatchesPage /></JourneyStage></Route>
        <Route path="/role-matches"><JourneyStage step={3}><MatchesPage /></JourneyStage></Route>
        <Route path="/pathway"><JourneyStage step={4}><PathwayPage /></JourneyStage></Route>
        <Route path="/goals" component={GoalsPage} />
        <Route path="/sdg-alignment" component={GoalsPage} />
        <Route path="/roles/:roleId" component={RoleDetailPage} />
        <Route path="/roles" component={RoleExplorerPage} />
        <Route path="/scenarios" component={ScenariosPage} />
        <Route path="/skills" component={Dashboard} />
        <Route path="/compare" component={Compare} />
        <Route path="/courses" component={Courses} />
        <Route path="/methodology" component={MethodologyPage} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
    </Shell></JourneyFlowProvider></JourneyProvider>
  );
}

function JourneyStage({ step, children }: { step: number; children: ReactNode }) {
  const { canAccessStep } = useJourneyFlow();
  const { selectedRole } = useJourney();
  const search = useSearch();
  const requestedRole = new URLSearchParams(search).get("role");
  if (!canAccessStep(step)) return <JourneyGate step={step} />;
  if (step === 4 && requestedRole && requestedRole !== selectedRole) return (
    <section className="journey-gate" role="note" data-testid="journey-role-gate">
      <h2>Choose this role from your matches first</h2>
      <p>This link is for a different role from the one you confirmed. Review its match score and skills gaps before building its pathway. Your existing plan progress is unchanged.</p>
      <Link href={`/role-matches?role=${encodeURIComponent(requestedRole)}`} className="journey-gate-action">Review this role’s match</Link>
    </section>
  );
  return children;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
