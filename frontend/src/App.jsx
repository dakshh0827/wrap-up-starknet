import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { Toaster } from "react-hot-toast";

// Pages
import LandingPage from "./pages/LandingPage";
import ResearchLandingPage from "./pages/ResearchLandingPage";
import ResearchReportPage from "./pages/ResearchReportPage";
import AllResearchPage from "./pages/AllResearchPage";
import LegacyLandingPage from "./pages/LegacyLandingPage";
import CuratedArticlesPage from "./pages/CuratedArticlesPage";
import ArticleDetailPage from "./pages/ArticleDetailsPage";
import ComparatorPage from "./pages/ComparatorPage";

function App() {
  return (
    <Router>
      <Toaster
        position="top-right"
        reverseOrder={false}
        toastOptions={{
          duration: 3000,
          style: {
            background: '#18181b', // zinc-900
            color: '#e5e5e5',      // text-zinc-200
            border: '1px solid #27272a', // zinc-800
            borderRadius: '12px',
            padding: '16px',
          },
          success: { 
            duration: 3000, 
            iconTheme: { primary: '#10b981', secondary: '#000' } // emerald-500
          },
          error: { 
            duration: 4000, 
            iconTheme: { primary: '#ef4444', secondary: '#fff' } // red-500
          },
        }}
      />
      <div className="min-h-screen bg-black">
        <Routes>
          {/* Main Landing Page */}
          <Route path="/" element={<LandingPage />} />

          {/* AI Research Engine */}
          <Route path="/research" element={<ResearchLandingPage />} />
          <Route path="/research/:id" element={<ResearchReportPage />} />
          <Route path="/research-list" element={<AllResearchPage />} />

          {/* Article Comparator */}
          <Route path="/compare" element={<ComparatorPage />} />

          {/* Legacy Link-Based Curation */}
          <Route path="/legacy" element={<LegacyLandingPage />} />
          <Route path="/curated" element={<CuratedArticlesPage />} />
          <Route path="/curated/:id" element={<ArticleDetailPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;