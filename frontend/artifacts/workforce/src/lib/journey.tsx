import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import {
  PROFILE_STORAGE_KEY,
  readSavedProfile,
  writeSavedProfile,
  emptyProfileDetails,
  type ProfileDetails,
} from "@/lib/profile-storage";

export function profileKey(profile: any, scenario: string = "balanced"): string {
  if (!profile) return "";
  const skills = Array.isArray(profile.skills)
    ? profile.skills
        .map((s: any) => `${(s.name || "").trim().toLowerCase()}:${s.level}`)
        .sort()
        .join(",")
    : "";
  const interests = Array.isArray(profile.interests)
    ? profile.interests
        .map((i: any) => (i || "").trim().toLowerCase())
        .sort()
        .join(",")
    : "";
  return `pk|${scenario}|${skills}|${profile.experience_years ?? 0}|${interests}`;
}

const ROLE_STORAGE_KEY = "my-next-chapter.role.v1";
const SCENARIO_STORAGE_KEY = "my-next-chapter.scenario.v1";

interface JourneyContextType {
  profile: any;
  profileDetails: ProfileDetails;
  storageError: string | null;
  selectedRole: string;
  setSelectedRole: (role: string) => void;
  scenario: string;
  setScenario: (scenario: string) => void;
  results: any;
  resultKey: string;
  setResults: (results: any, profileOrKey?: any, scenario?: string) => void;
  saveProfile: (profile: any, details?: ProfileDetails) => void;
  reset: () => void;
}

const JourneyContext = createContext<JourneyContextType | null>(null);

export function JourneyProvider({ children }: { children: ReactNode }) {
  const [profile, setProfileState] = useState<any>(null);
  const [profileDetails, setProfileDetailsState] = useState<ProfileDetails>(emptyProfileDetails());
  const [storageError, setStorageError] = useState<string | null>(null);
  const [selectedRole, setSelectedRoleState] = useState<string>("");
  const [scenario, setScenarioState] = useState<string>("balanced");
  const [results, setResultsState] = useState<any>(null);
  const [resultKey, setResultKeyState] = useState<string>("");

  // Initial load
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const restored = readSavedProfile(window.localStorage);
      if (restored.value) {
        setProfileState(restored.value);
        setProfileDetailsState(restored.details);
      }
      if (restored.error) {
        setStorageError(restored.error);
      }

      const savedRole = window.localStorage.getItem(ROLE_STORAGE_KEY);
      if (savedRole) setSelectedRoleState(savedRole);

      const savedScenario = window.localStorage.getItem(SCENARIO_STORAGE_KEY);
      if (savedScenario) setScenarioState(savedScenario);
    } catch (err: any) {
      setStorageError(err?.message || "Storage unavailable");
    }
  }, []);

  const setSelectedRole = useCallback((role: string) => {
    setSelectedRoleState(role);
    try {
      if (typeof window !== "undefined") {
        if (role) window.localStorage.setItem(ROLE_STORAGE_KEY, role);
        else window.localStorage.removeItem(ROLE_STORAGE_KEY);
      }
    } catch {}
  }, []);

  const setScenario = useCallback((sc: string) => {
    setScenarioState(sc);
    try {
      if (typeof window !== "undefined") {
        if (sc) window.localStorage.setItem(SCENARIO_STORAGE_KEY, sc);
      }
    } catch {}
  }, []);

  const setResults = useCallback((res: any, profileOrKey?: any, sc?: string) => {
    setResultsState(res);
    if (typeof profileOrKey === "string") {
      setResultKeyState(profileOrKey);
    } else if (profileOrKey && typeof profileOrKey === "object") {
      setResultKeyState(profileKey(profileOrKey, sc || scenario || "balanced"));
    } else {
      setResultKeyState("");
    }
  }, [scenario]);

  const saveProfile = useCallback((newProfile: any, newDetails?: ProfileDetails) => {
    const detailsToSave = newDetails || profileDetails;
    const sanitizedProfile = newProfile ? {
      ...newProfile,
      skills: (newProfile.skills || []).map((s: any) => ({
        name: typeof s?.name === "string"
          ? s.name.trim()
          : (typeof s?.name?.skill === "string"
              ? s.name.skill.trim()
              : (typeof s?.skill === "string" ? s.skill.trim() : String(s?.name || ""))),
        level: typeof s?.level === "number" && s.level > 0 ? s.level : 2,
      })).filter((s: any) => s.name),
    } : newProfile;

    try {
      if (typeof window !== "undefined") {
        writeSavedProfile(window.localStorage, sanitizedProfile, detailsToSave);
      }
      setProfileState(sanitizedProfile);
      setProfileDetailsState(detailsToSave);
      setStorageError(null);
    } catch (err: any) {
      setStorageError(err?.message || "Failed to save profile");
      throw err;
    }
  }, [profileDetails]);

  const reset = useCallback(() => {
    setProfileState(null);
    setProfileDetailsState(emptyProfileDetails());
    setSelectedRoleState("");
    setResultsState(null);
    setResultKeyState("");
    try {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(PROFILE_STORAGE_KEY);
        window.localStorage.removeItem(ROLE_STORAGE_KEY);
      }
    } catch {}
  }, []);

  const value: JourneyContextType = {
    profile,
    profileDetails,
    storageError,
    selectedRole,
    setSelectedRole,
    scenario,
    setScenario,
    results,
    resultKey,
    setResults,
    saveProfile,
    reset,
  };

  return <JourneyContext.Provider value={value}>{children}</JourneyContext.Provider>;
}

export function useJourney(): JourneyContextType {
  const ctx = useContext(JourneyContext);
  if (!ctx) {
    throw new Error("useJourney must be used within a JourneyProvider");
  }
  return ctx;
}
