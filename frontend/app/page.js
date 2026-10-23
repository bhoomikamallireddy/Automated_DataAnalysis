"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useJobStatus } from "../hooks/useJobStatus";
import {
  ACCESS_TOKEN_KEY,
  LAST_ACTIVE_JOB_ID_KEY,
  MODE_SWITCH_DELAY_MS,
  STATUS_COMPLETED,
  STATUS_FAILED,
  STATUS_PENDING,
  STATUS_PROCESSING,
} from "../constants/analysis";
import Sidebar from "../components/dashboard/Sidebar";
import DashboardHeader from "../components/dashboard/DashboardHeader";
import KPIRibbon from "../components/dashboard/KPIRibbon";
import AnalysisTabs from "../components/dashboard/AnalysisTabs";
import HistoryView from "../components/dashboard/HistoryView";

function useAuthorization(router) {
  const hasCheckedAuth = globalThis.window !== undefined;
  const isAuthorized =
    hasCheckedAuth && Boolean(localStorage.getItem(ACCESS_TOKEN_KEY));

  useEffect(() => {
    if (hasCheckedAuth && !isAuthorized) {
      router.push("/login");
    }
  }, [hasCheckedAuth, isAuthorized, router]);

  return { isAuthorized, hasCheckedAuth };
}

function usePersistedJob(isAuthorized, setCurrentJobId, setWorkspaceMode) {
  useEffect(() => {
    if (!isAuthorized) {
      return;
    }

    const savedJobId = localStorage.getItem(LAST_ACTIVE_JOB_ID_KEY);
    if (savedJobId) {
      setCurrentJobId(savedJobId);
      setWorkspaceMode("current");
    }
  }, [isAuthorized, setCurrentJobId, setWorkspaceMode]);
}

function useSwitchModeCleanup(switchModeTimeoutRef) {
  useEffect(() => {
    const timeoutRef = switchModeTimeoutRef;
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [switchModeTimeoutRef]);
}

function LoadingScreen() {
  return (
    <div className="h-screen w-screen bg-zinc-50 flex items-center justify-center">
      <div className="h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function EmptyAnalysisState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 md:py-32 text-center border-2 border-dashed border-zinc-200 rounded-3xl bg-white">
      <div className="h-20 w-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-6 text-3xl">
        📁
      </div>
      <h3 className="text-2xl font-black text-zinc-800 tracking-tight">
        Ready for Insights?
      </h3>
      <p className="text-zinc-500 mt-2 max-w-sm px-4">
        Upload a CSV file in the header to trigger the automated EDA and machine
        learning engine.
      </p>
    </div>
  );
}

function AnalysisProgressState() {
  return (
    <div className="animate-pulse bg-blue-600 text-white p-6 md:p-8 rounded-3xl flex justify-between items-center shadow-xl shadow-blue-100">
      <div>
        <p className="text-lg font-black tracking-tight">
          Analyzing patterns...
        </p>
        <p className="text-sm opacity-80 font-medium">
          Calculating PCA coordinates and semantic executive summaries.
        </p>
      </div>
      <div className="h-10 w-10 border-4 border-blue-400 border-t-white rounded-full animate-spin shrink-0 ml-4" />
    </div>
  );
}

function SwitchingAnalysisState() {
  return (
    <div className="py-20 text-center animate-pulse">
      <div className="h-12 w-12 bg-zinc-200 rounded-full mx-auto mb-4" />
      <div className="h-4 w-48 bg-zinc-200 mx-auto rounded" />
    </div>
  );
}

export default function Home() {
  const [activeTab, setActiveTab] = useState("overview");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [workspaceMode, setWorkspaceMode] = useState("current");
  const [currentJobId, setCurrentJobId] = useState(null);
  const [isSwitchingMode, setIsSwitchingMode] = useState(false);
  const switchModeTimeoutRef = useRef(null);
  const router = useRouter();
  const { isAuthorized, hasCheckedAuth } = useAuthorization(router);
  const {
    status: jobStatus,
    results,
    error: jobError,
  } = useJobStatus(currentJobId);

  usePersistedJob(isAuthorized, setCurrentJobId, setWorkspaceMode);
  useSwitchModeCleanup(switchModeTimeoutRef);

  const handleJobCreated = (jobId) => {
    setCurrentJobId(jobId);
    setWorkspaceMode("current");
    setActiveTab("overview");
  };

  const handleStartNew = () => {
    setCurrentJobId(null);
    setActiveTab("overview");
    setWorkspaceMode("current");
    localStorage.removeItem(LAST_ACTIVE_JOB_ID_KEY);
  };

  const handleSelectHistoryJob = (jobId) => {
    setIsSwitchingMode(true);
    setCurrentJobId(jobId);
    setWorkspaceMode("current");
    setActiveTab("overview");
    localStorage.setItem(LAST_ACTIVE_JOB_ID_KEY, jobId);

    if (switchModeTimeoutRef.current) {
      clearTimeout(switchModeTimeoutRef.current);
    }

    switchModeTimeoutRef.current = setTimeout(() => {
      setIsSwitchingMode(false);
    }, MODE_SWITCH_DELAY_MS);
  };

  if (!hasCheckedAuth || !isAuthorized) {
    return <LoadingScreen />;
  }

  const isJobRunning =
    jobStatus === STATUS_PROCESSING || jobStatus === STATUS_PENDING;
  const hasCompletedResults = jobStatus === STATUS_COMPLETED && results;

  return (
    <div className="flex h-screen bg-zinc-50 font-sans text-zinc-900 selection:bg-blue-100 overflow-hidden">
      <Sidebar
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        mode={workspaceMode}
        setMode={setWorkspaceMode}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      <main className="flex-1 overflow-y-auto flex flex-col min-w-0">
        <DashboardHeader
          setSidebarOpen={setIsSidebarOpen}
          onJobCreated={handleJobCreated}
          onStartNew={handleStartNew}
          currentJobId={currentJobId}
          jobStatus={jobStatus}
          workspaceMode={workspaceMode}
          setWorkspaceMode={setWorkspaceMode}
        />

        <div className="p-4 md:p-8 w-full mx-auto space-y-8">
          {workspaceMode === "history" ? (
            <HistoryView onSelectJob={handleSelectHistoryJob} />
          ) : (
            <div className="w-full space-y-8">
              {isSwitchingMode && <SwitchingAnalysisState />}

              {!isSwitchingMode && !currentJobId && <EmptyAnalysisState />}

              {!isSwitchingMode && isJobRunning && <AnalysisProgressState />}

              {!isSwitchingMode && hasCompletedResults && (
                <>
                  <KPIRibbon results={results} jobStatus={jobStatus} />
                  <AnalysisTabs
                    results={results}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                  />
                </>
              )}

              {!isSwitchingMode &&
                (jobError || jobStatus === STATUS_FAILED) && (
                  <div className="p-8 bg-red-50 border border-red-200 rounded-3xl text-red-700 text-center">
                    <p className="font-bold text-lg mb-2">Analysis Failed</p>
                    <p className="text-sm opacity-80">
                      {jobError ||
                        "The analysis job failed. Please try another file."}
                    </p>
                    <button
                      type="button"
                      onClick={handleStartNew}
                      className="mt-4 text-xs font-black uppercase tracking-widest underline"
                    >
                      Try Another File
                    </button>
                  </div>
                )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
