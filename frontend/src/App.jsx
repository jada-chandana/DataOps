
import { useState } from "react";
import "./App.css";

import Sidebar from "./components/Sidebar";
import Topbar from "./components/topbar";

import Overview from "./pages/Overview";
import DataProfiling from "./pages/DataProfiling";
import Reconciliation from "./pages/Reconciliation";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import DataValidation from "./pages/dataValidation";
import Cleaning from "./components/Cleaning";
import DataDrift from "./pages/Datadrift";
const pages = {
  overview: {
    title: "Overview",
    description: "Monitor your data quality workspace.",
  },
  profiling: {
    title: "Data Profiling",
    description: "Inspect CSV datasets and identify quality issues.",
  },
  cleaning: {
    title: "Data Cleaning",
    description: "Clean datasets and improve data quality.",
  },
  reconciliation: {
    title: "Reconciliation",
    description: "Compare source and target records.",
  },
  reports: {
    title: "Reports",
    description: "Download your analysis and reconciliation reports.",
  },
  settings: {
    title: "Settings",
    description: "Manage your workspace preferences.",
  },
  validation: {
  title: "Data Validation",
  description: "Automatically detect data quality issues in CSV datasets.",
},
drift: {
  title: "Data Drift Detection",
  description: "Detect changes in data structure and distribution.",
},
};

export default function App() {
  const [activePage, setActivePage] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [profileResults, setProfileResults] = useState(null);

  const [reconcileResults, setReconcileResults] = useState(null);
  const [etlResults, setEtlResults] = useState(null);
const [etlLoading, setEtlLoading] = useState(false);
const [etlError, setEtlError] = useState("");
  const [sourceFile, setSourceFile] = useState(null);
  const [targetFile, setTargetFile] = useState(null);
  const [keyColumn, setKeyColumn] = useState("");

  function navigate(page) {
    setActivePage(page);
    setSidebarOpen(false);
  }
  async function handleRunETL() {
  try {
    setEtlLoading(true);
    setEtlError("");
    setEtlResults(null);

   const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

const response = await fetch(
  `${API_BASE_URL}/api/etl/run`,
  {
    method: "POST",
  }
);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "ETL pipeline failed");
    }

    setEtlResults(data);

  } catch (error) {
    setEtlError(error.message);
  } finally {
    setEtlLoading(false);
  }
}

  function downloadJSON(report, filename) {
    const blob = new Blob(
      [JSON.stringify(report, null, 2)],
      { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
      


  function handleReportDownload(type) {
    if (!reconcileResults) return;

    if (type === "full") {
      downloadJSON(
        {
          reportName: "DataOps One Record Reconciliation",
          generatedAt: new Date().toISOString(),
          sourceFileName: sourceFile?.name || "",
          targetFileName: targetFile?.name || "",
          ...reconcileResults,
        },
        "reconciliation-report.json"
      );
      return;
    }

    downloadJSON(
      {
        reportName: "DataOps One Mismatch Report",
        generatedAt: new Date().toISOString(),
        keyColumn: reconcileResults.keyColumn,
        mismatchCount: reconcileResults.mismatchedCount,
        mismatchedRecords:
          reconcileResults.mismatchedRecords || [],
      },
      "reconciliation-mismatches.json"
      

    );
    
  }
  

  const page = pages[activePage];

  return (
    <div className="dashboard">
      <Sidebar
        activePage={activePage}
        onNavigate={navigate}
        open={sidebarOpen}
      />

      <main className="main-area">
        <Topbar
          title={page.title}
          description={page.description}
          onMenuClick={() => setSidebarOpen((open) => !open)}
        />

        <div className="page-content">
          {activePage === "overview" && (
            <Overview
results={profileResults}
    reconcileResults={reconcileResults}
    etlResults={etlResults}
    etlLoading={etlLoading}
    etlError={etlError}
    onRunETL={handleRunETL}
    onNavigate={navigate}
/>
          )}

          {activePage === "profiling" && (
            <DataProfiling onResults={setProfileResults} />
          )}
          {activePage === "cleaning" && <Cleaning />}

          {activePage === "reconciliation" && (
            <Reconciliation
              reconcileResults={reconcileResults}
              setReconcileResults={setReconcileResults}
              sourceFile={sourceFile}
              setSourceFile={setSourceFile}
              targetFile={targetFile}
              setTargetFile={setTargetFile}
              keyColumn={keyColumn}
              setKeyColumn={setKeyColumn}
            />
               
          )}
{activePage === "drift" && <DataDrift />}
          

          {activePage === "reports" && (
            <Reports
              reconcileResults={reconcileResults}
              onDownload={handleReportDownload}
            />
          )}

                   {activePage === "reports" && (
            <Reports
              reconcileResults={reconcileResults}
              onDownload={handleReportDownload}
            />
          )}

          {activePage === "settings" && <Settings />}

          {activePage === "validation" && <DataValidation />}
        </div>

        <footer className="footer">
          <span>DataOps One</span>
          <span>Data quality made simpler.</span>
        </footer>
      </main>
    </div>
  );
}
