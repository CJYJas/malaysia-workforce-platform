import { useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { useAccount } from "@/lib/account";
import {
  Lock,
  Mail,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Eye,
  EyeOff,
  Compass,
  FileText,
  TrendingUp,
  UserCheck,
  LogOut,
} from "lucide-react";

export function AccountPage({ initialMode }: { initialMode?: "login" | "register" }) {
  const [, setLocation] = useLocation();
  const { user, loading, error: sessionError, guestMode, setGuestMode, login, register, logout } = useAccount();
  const [mode, setMode] = useState<"login" | "register">(initialMode || "register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isPasswordLongEnough = password.length >= 12;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(email, password);
      }
      setPassword("");
      // Redirect to AI resume parser or overview dashboard after successful auth
      setLocation("/resume");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Account request failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleGuestExplore = () => {
    setGuestMode(true);
    setLocation("/resume");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground font-medium">Verifying session...</p>
        </div>
      </div>
    );
  }

  // If user is already authenticated
  if (user) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center p-6 bg-gradient-to-b from-background to-muted/30">
        <div className="w-full max-w-lg rounded-2xl border bg-card p-8 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <UserCheck className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Account Active</h2>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>

          <div className="rounded-xl border bg-muted/40 p-4 mb-6 space-y-2 text-sm">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckCircle2 className="h-4 w-4" />
              <span>Full platform access unlocked</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Your AI resume analyses, learning pathway checkpoints, and empirical skill gap evaluations are synced to your account.
            </p>
          </div>

          {sessionError && (
            <p className="mb-4 text-sm text-destructive" role="alert">{sessionError}</p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            <Link
              href="/resume"
              className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow hover:opacity-90 transition"
            >
              <FileText className="h-4 w-4" />
              AI Resume Parser
            </Link>
            <Link
              href="/dashboard"
              className="flex items-center justify-center gap-2 rounded-xl border bg-background px-4 py-3 text-sm font-semibold hover:bg-muted/50 transition"
            >
              <TrendingUp className="h-4 w-4" />
              Career Dashboard
            </Link>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await logout();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Could not sign out.");
              } finally {
                setBusy(false);
              }
            }}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-destructive/30 px-4 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10 transition disabled:opacity-60"
          >
            <LogOut className="h-4 w-4" />
            {busy ? "Signing out..." : "Sign Out"}
          </button>
          {error && <p className="mt-3 text-sm text-destructive text-center" role="alert">{error}</p>}
        </div>
      </div>
    );
  }

  // Standalone Sign Up / Sign In Page
  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      {/* Brand Hero Side */}
      <div className="flex-1 bg-gradient-to-br from-primary/15 via-background to-accent/10 p-8 lg:p-14 flex flex-col justify-between border-b lg:border-b-0 lg:border-r">
        <div>
          <div className="flex items-center gap-3 mb-8">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold shadow-md">
              <Compass className="h-5 w-5" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight">FutureReady MY</span>
              <span className="block text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                Malaysia Tech Workforce Intelligence
              </span>
            </div>
          </div>

          <div className="max-w-lg space-y-4 my-8">
            <div className="inline-flex items-center gap-2 rounded-full border bg-card/60 px-3 py-1 text-xs font-medium backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Empirical National Talent Benchmarking
            </div>
            <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight">
              Sign up to unlock AI career matching and skill pathways.
            </h1>
            <p className="text-muted-foreground leading-relaxed text-sm lg:text-base">
              Bridge the gap between your resume and high-demand Malaysian tech roles. Analyze real-time employer demand across 3,900+ analyzed postings and track your upskilling journey.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg my-8">
            <div className="rounded-xl border bg-card/80 backdrop-blur p-4 shadow-sm">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-2">
                <FileText className="h-4 w-4" />
              </div>
              <h3 className="font-semibold text-sm">AI Resume Parser</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Extract tech proficiencies, frameworks, and tools directly from your PDF CV.
              </p>
            </div>
            <div className="rounded-xl border bg-card/80 backdrop-blur p-4 shadow-sm">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-2">
                <TrendingUp className="h-4 w-4" />
              </div>
              <h3 className="font-semibold text-sm">Market Skill Gap Radar</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Empirical match scores comparing your stack to verified job market data.
              </p>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t text-xs text-muted-foreground flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <span>Secure authentication with Argon2 password hashing and CSRF protection.</span>
        </div>
      </div>

      {/* Auth Card Side */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          {/* Mode Switcher Tabs */}
          <div className="flex rounded-xl bg-muted p-1 mb-8 shadow-inner" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "register"}
              onClick={() => {
                setMode("register");
                setError(null);
              }}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                mode === "register"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid="button-account-register"
            >
              Create Account
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "login"}
              onClick={() => {
                setMode("login");
                setError(null);
              }}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                mode === "login"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid="button-account-login"
            >
              Sign In
            </button>
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-bold tracking-tight">
              {mode === "register" ? "Create your workforce account" : "Welcome back"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {mode === "register"
                ? "Enter your credentials below to create an account and access all features."
                : "Sign in with your email and password to continue."}
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" htmlFor="auth-email">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
                <input
                  id="auth-email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={320}
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full min-h-11 rounded-xl border bg-background pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  data-testid="input-account-email"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium" htmlFor="auth-password">
                  Password
                </label>
                {mode === "register" && (
                  <span
                    className={`text-xs font-medium ${
                      password.length === 0
                        ? "text-muted-foreground"
                        : isPasswordLongEnough
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-amber-600 dark:text-amber-400"
                    }`}
                  >
                    {password.length === 0
                      ? "Min 12 characters"
                      : isPasswordLongEnough
                      ? "✓ Length valid"
                      : `${12 - password.length} more characters needed`}
                  </span>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
                <input
                  id="auth-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  required
                  minLength={mode === "register" ? 12 : 1}
                  maxLength={128}
                  placeholder={mode === "register" ? "At least 12 characters" : "••••••••••••"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full min-h-11 rounded-xl border bg-background pl-10 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  data-testid="input-account-password"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {(error || sessionError) && (
              <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
                {error || sessionError}
              </div>
            )}

            <button
              type="submit"
              disabled={busy || (mode === "register" && !isPasswordLongEnough)}
              className="w-full min-h-11 flex items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-md hover:opacity-90 transition disabled:opacity-50"
              data-testid="button-account-submit"
            >
              {busy ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <span>{mode === "register" ? "Create Account & Continue" : "Sign In to Platform"}</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Guest explore option */}
          <div className="mt-8 pt-6 border-t text-center space-y-3">
            <p className="text-xs text-muted-foreground">
              Want to test the platform before creating credentials?
            </p>
            <button
              type="button"
              onClick={handleGuestExplore}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground underline underline-offset-4 transition"
            >
              Continue as Guest Preview
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
