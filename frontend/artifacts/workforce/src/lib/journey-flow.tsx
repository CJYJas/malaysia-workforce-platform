import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { useJourney } from "@/lib/journey";
import {
  type FlowRecord,
  flowFingerprint,
  reviewFlowRadar,
  chooseFlowRole,
  finishFlowPathway,
  flowCompletion,
  firstIncompleteStep,
  canEnterStep,
  readFlowRecord,
} from "@/lib/journey-flow-model";

const FLOW_STORAGE_KEY = "my-next-chapter.flow.v1";

interface JourneyFlowContextType {
  completedSteps: [boolean, boolean, boolean, boolean];
  currentStep: number;
  allComplete: boolean;
  canAccessStep: (step: number) => boolean;
  warning: string | null;
  reviewRadar: () => boolean;
  chooseRole: (roleId: string) => boolean;
  finishPathway: () => boolean;
}

const JourneyFlowContext = createContext<JourneyFlowContextType | null>(null);

export function JourneyFlowProvider({ children }: { children: ReactNode }) {
  const { profile, scenario, selectedRole, setSelectedRole } = useJourney();
  const [record, setRecord] = useState<FlowRecord | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  // Load record from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(FLOW_STORAGE_KEY);
      if (raw) {
        const parsed = readFlowRecord(raw);
        setRecord(parsed);
      }
    } catch {
      setRecord(null);
    }
  }, []);

  const saveRecord = useCallback((updated: FlowRecord | null) => {
    setRecord(updated);
    try {
      if (typeof window !== "undefined") {
        if (updated) {
          window.localStorage.setItem(FLOW_STORAGE_KEY, JSON.stringify(updated));
        } else {
          window.localStorage.removeItem(FLOW_STORAGE_KEY);
        }
      }
    } catch {}
  }, []);

  const fp = flowFingerprint(profile);

  // Check if profile changed relative to record
  useEffect(() => {
    if (record && fp && record.fingerprint !== fp) {
      setWarning("Your profile skills or preferences changed. Please review your Future Skills Radar to refresh matches.");
    } else {
      setWarning(null);
    }
  }, [record, fp]);

  const completedSteps = flowCompletion(profile, scenario, selectedRole, record);
  const currentStep = firstIncompleteStep(completedSteps);
  const allComplete = completedSteps.every(Boolean);

  const canAccessStep = useCallback((step: number) => {
    return canEnterStep(completedSteps, step);
  }, [completedSteps]);

  const reviewRadar = useCallback(() => {
    if (!fp) return false;
    try {
      const updated = reviewFlowRadar(record, fp);
      saveRecord(updated);
      return true;
    } catch {
      return false;
    }
  }, [record, fp, saveRecord]);

  const chooseRole = useCallback((roleId: string) => {
    if (!fp || !roleId) return false;
    try {
      const updated = chooseFlowRole(record, fp, scenario, roleId);
      setSelectedRole(roleId);
      saveRecord(updated);
      return true;
    } catch {
      return false;
    }
  }, [record, fp, scenario, setSelectedRole, saveRecord]);

  const finishPathway = useCallback(() => {
    if (!fp || !selectedRole) return false;
    try {
      const updated = finishFlowPathway(record, fp, scenario, selectedRole);
      if (updated) {
        saveRecord(updated);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [record, fp, scenario, selectedRole, saveRecord]);

  const value: JourneyFlowContextType = {
    completedSteps,
    currentStep,
    allComplete,
    canAccessStep,
    warning,
    reviewRadar,
    chooseRole,
    finishPathway,
  };

  return <JourneyFlowContext.Provider value={value}>{children}</JourneyFlowContext.Provider>;
}

export function useJourneyFlow(): JourneyFlowContextType {
  const ctx = useContext(JourneyFlowContext);
  if (!ctx) {
    throw new Error("useJourneyFlow must be used within a JourneyFlowProvider");
  }
  return ctx;
}
