import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import { PageHeader } from "@/components/shell";
import { useAccount } from "@/lib/account";

export function AccountPage() {
  const { user, loading, error: sessionError, login, register, logout } = useAccount();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "login") await login(email, password);
      else await register(email, password);
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Account request failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader kicker="Your account" title="Keep your learning progress with you">
        Sign in to sync pathway progress and its self-reported learning evidence across sessions.
        Completion remains separate from assessed skill proficiency.
      </PageHeader>
      {loading ? <p role="status">Checking your account…</p> : user ? (
        <section className="rounded-2xl border bg-card p-6">
          <h2 className="text-lg font-semibold">Signed in</h2>
          <p className="mt-2 text-sm text-muted-foreground">{user.email}</p>
          <p className="mt-3 text-sm">Your saved completion is learning evidence only. It does not change role-match scores or assert proficiency.</p>
          {sessionError && <p className="mt-3 text-sm text-destructive" role="alert">{sessionError}</p>}
          <button type="button" disabled={busy} onClick={async () => {
            setBusy(true);
            setError(null);
            try { await logout(); }
            catch (err) { setError(err instanceof Error ? err.message : "Could not sign out."); }
            finally { setBusy(false); }
          }} className="mt-5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
            {busy ? "Signing out…" : "Sign out"}
          </button>
          {error && <p className="mt-3 text-sm text-destructive" role="alert">{error}</p>}
          <Link href="/pathway" className="ml-4 text-sm font-semibold underline">Return to learning pathway</Link>
        </section>
      ) : (
        <form onSubmit={submit} className="max-w-lg rounded-2xl border bg-card p-6">
          <div className="mb-5 flex gap-2">
            <button type="button" onClick={() => setMode("login")} aria-pressed={mode === "login"} className="rounded-full border px-4 py-2 text-sm" data-testid="button-account-login">Sign in</button>
            <button type="button" onClick={() => setMode("register")} aria-pressed={mode === "register"} className="rounded-full border px-4 py-2 text-sm" data-testid="button-account-register">Create account</button>
          </div>
          <label className="mb-4 block text-sm font-medium">Email
            <input type="email" autoComplete="email" required maxLength={320} value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 block min-h-11 w-full rounded-lg border bg-background px-3" data-testid="input-account-email" />
          </label>
          <label className="block text-sm font-medium">Password
            <input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={12} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 block min-h-11 w-full rounded-lg border bg-background px-3" data-testid="input-account-password" />
          </label>
          {mode === "register" && <p className="mt-2 text-xs text-muted-foreground">Use at least 12 characters.</p>}
          {(error || sessionError) && <p className="mt-4 text-sm text-destructive" role="alert">{error || sessionError}</p>}
          <button disabled={busy} className="mt-5 min-h-11 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-60" data-testid="button-account-submit">
            {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>
      )}
    </div>
  );
}
