import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import {
  AccountApiError,
  getCurrentAccount,
  refreshAccount,
  registerAccount,
  signIn,
  signOut,
  type AccountUser,
} from "@/lib/account-api";

interface AccountContextValue {
  user: AccountUser | null;
  loading: boolean;
  error: string | null;
  guestMode: boolean;
  setGuestMode: (val: boolean) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AccountContext = createContext<AccountContextValue | null>(null);

export function AccountProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AccountUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guestMode, setGuestModeState] = useState<boolean>(() => {
    try {
      return typeof window !== "undefined" && window.sessionStorage.getItem("futureready_guest") === "true";
    } catch {
      return false;
    }
  });

  const setGuestMode = useCallback((val: boolean) => {
    try {
      if (val) window.sessionStorage.setItem("futureready_guest", "true");
      else window.sessionStorage.removeItem("futureready_guest");
    } catch {
      // ignore
    }
    setGuestModeState(val);
  }, []);

  const restore = useCallback(async () => {
    try {
      const response = await getCurrentAccount();
      setUser(response.user);
      setError(null);
    } catch (err) {
      if (err instanceof AccountApiError && err.status === 401) {
        try {
          const response = await refreshAccount();
          setUser(response.user);
          setError(null);
          return;
        } catch (refreshError) {
          if (!(refreshError instanceof AccountApiError) || ![401, 403, 404].includes(refreshError.status)) {
            setError(refreshError instanceof Error ? refreshError.message : "Could not restore account session.");
          }
          setUser(null);
          return;
        }
      }
      if (!(err instanceof AccountApiError) || err.status !== 404) {
        setError(err instanceof Error ? err.message : "Could not restore account session.");
      }
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void restore();
  }, [restore]);

  const login = useCallback(async (email: string, password: string) => {
    const account = await signIn(email, password);
    setUser(account);
    setGuestMode(false);
    setError(null);
  }, [setGuestMode]);

  const register = useCallback(async (email: string, password: string) => {
    const account = await registerAccount(email, password);
    setUser(account);
    setGuestMode(false);
    setError(null);
  }, [setGuestMode]);

  const logout = useCallback(async () => {
    await signOut();
    setUser(null);
    setGuestMode(false);
  }, [setGuestMode]);

  return (
    <AccountContext.Provider value={{ user, loading, error, guestMode, setGuestMode, login, register, logout }}>
      {children}
    </AccountContext.Provider>
  );
}

export function useAccount(): AccountContextValue {
  const context = useContext(AccountContext);
  if (!context) throw new Error("useAccount must be used within an AccountProvider.");
  return context;
}
