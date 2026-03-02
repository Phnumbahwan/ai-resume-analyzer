"use client";

import Footer from "@/components/Footer";
import { useState, useCallback, useRef, useEffect } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Improvement {
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
}

interface SuggestedRewrite {
  section: string;
  original: string;
  improved: string;
  reason: string;
}

interface Analysis {
  score: number;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  improvements: Improvement[];
  suggestedRewrites: SuggestedRewrite[];
  missingSections: string[];
  atsKeywords: string[];
  formattingTips: string[];
}

// ─── Small components ─────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? "#16a34a" : score >= 60 ? "#d97706" : "#dc2626";

  return (
    <div className="relative w-36 h-36 flex-shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="10" />
        <circle
          cx="60" cy="60" r={radius}
          fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-slate-900">{score}</span>
        <span className="text-xs text-slate-500 font-medium">/ 100</span>
      </div>
    </div>
  );
}

function SectionIcon({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className={`w-7 h-7 ${color} rounded-lg flex items-center justify-center flex-shrink-0`}>
      {children}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const styles: Record<string, string> = {
    high: "bg-red-100 text-red-700 border-red-200",
    medium: "bg-amber-100 text-amber-700 border-amber-200",
    low: "bg-blue-100 text-blue-700 border-blue-200",
  };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${styles[priority] ?? styles.low}`}>
      {priority.toUpperCase()}
    </span>
  );
}

// ─── Preview panel ────────────────────────────────────────────────────────────

function ResumePreview({ file, previewUrl, previewText }: {
  file: File;
  previewUrl: string | null;
  previewText: string | null;
}) {
  const isPdf = file.type === "application/pdf";
  const isTxt = file.type === "text/plain";

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-100 bg-slate-50">
        <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <span className="text-sm font-medium text-slate-600 truncate">{file.name}</span>
        <span className="ml-auto text-xs text-slate-400 flex-shrink-0">
          {(file.size / 1024).toFixed(1)} KB
        </span>
      </div>

      {/* Content */}
      {isPdf && previewUrl ? (
        <iframe
          src={previewUrl}
          className="w-full"
          style={{ height: "520px" }}
          title="Resume preview"
        />
      ) : isTxt && previewText ? (
        <div className="p-5 max-h-[520px] overflow-y-auto">
          <pre className="text-xs text-slate-700 font-mono leading-relaxed whitespace-pre-wrap break-words">
            {previewText}
          </pre>
        </div>
      ) : (
        /* DOCX or loading state */
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400">
          <svg className="w-12 h-12 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm">Preview not available for DOCX files</p>
          <p className="text-xs">Your file is ready — click Analyze Resume</p>
        </div>
      )}
    </div>
  );
}

// ─── Rewrite card ─────────────────────────────────────────────────────────────

function RewriteCard({ rewrite }: { rewrite: SuggestedRewrite }) {
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      {/* Section badge */}
      <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          {rewrite.section}
        </span>
      </div>

      <div className="p-4 space-y-3">
        {/* Before */}
        <div>
          <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest mb-1.5">Before</p>
          <p className="text-sm text-slate-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 leading-relaxed">
            {rewrite.original}
          </p>
        </div>

        {/* Arrow */}
        <div className="flex justify-center">
          <svg className="w-5 h-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        {/* After */}
        <div>
          <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest mb-1.5">After</p>
          <p className="text-sm text-slate-800 bg-green-50 border border-green-200 rounded-lg px-3 py-2 leading-relaxed font-medium">
            {rewrite.improved}
          </p>
        </div>

        {/* Reason */}
        <p className="text-xs text-slate-500 italic border-t border-slate-100 pt-2">
          {rewrite.reason}
        </p>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Preview state
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // PDF object URL — create/revoke with file lifecycle
  useEffect(() => {
    if (!file || file.type !== "application/pdf") {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // TXT file — read into state
  useEffect(() => {
    if (!file || file.type !== "text/plain") {
      setPreviewText(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => setPreviewText((e.target?.result as string) ?? "");
    reader.readAsText(file);
  }, [file]);

  const validateAndSetFile = (selected: File) => {
    const valid = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ];
    if (!valid.includes(selected.type)) {
      setError("Please upload a PDF, DOCX, or TXT file.");
      return;
    }
    if (selected.size > 10 * 1024 * 1024) {
      setError("File size must be less than 10 MB.");
      return;
    }
    setFile(selected);
    setError(null);
    setAnalysis(null);
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragging(false), []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) validateAndSetFile(dropped);
  }, []);

  const analyzeResume = async () => {
    if (!file) return;
    setIsAnalyzing(true);
    setError(null);

    const form = new FormData();
    form.append("resume", file);

    try {
      const res = await fetch("/api/analyze", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed.");
      setAnalysis(data);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const reset = () => {
    setFile(null);
    setAnalysis(null);
    setError(null);
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="max-w-3xl mx-auto px-4 py-14">

          {/* ── Header ── */}
          <div className="text-center mb-12">
            <span className="inline-flex items-center gap-2 bg-blue-600 text-white text-xs font-semibold px-4 py-1.5 rounded-full mb-6 tracking-wide uppercase">
              AI-Powered Resume Analyzer
            </span>
            <h1 className="text-5xl font-extrabold text-slate-900 leading-tight mb-4">
              Land Your{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                Dream Job
              </span>
            </h1>
            <p className="text-lg text-slate-500 max-w-xl mx-auto">
              Upload your resume and get instant AI feedback — score, line-by-line
              rewrites, and everything you need to stand out.
            </p>
          </div>

          {/* ── Upload card ── */}
          <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-8 mb-6">
            {/* Drop zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-200 ${isDragging
                ? "border-blue-500 bg-blue-50 scale-[1.01]"
                : file
                  ? "border-green-400 bg-green-50"
                  : "border-slate-300 hover:border-blue-400 hover:bg-blue-50"
                }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && validateAndSetFile(e.target.files[0])}
              />

              {file ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center">
                    <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">{file.name}</p>
                    <p className="text-sm text-slate-400">
                      {(file.size / 1024).toFixed(1)} KB &mdash; Click to change
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center">
                    <svg className="w-7 h-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-700">
                      {isDragging ? "Drop it!" : "Drop your resume here"}
                    </p>
                    <p className="text-sm text-slate-400">
                      or click to browse &mdash; PDF, DOCX, TXT &mdash; max 10 MB
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="mt-4 flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                {error}
              </div>
            )}

            {/* Analyze button */}
            {file && (
              <button
                onClick={analyzeResume}
                disabled={isAnalyzing}
                className="w-full mt-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60 text-white font-semibold py-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
              >
                {isAnalyzing ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Analyzing your resume&hellip;
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    Analyze Resume
                  </>
                )}
              </button>
            )}
          </div>

          {/* ── Resume preview (shows as soon as file is selected) ── */}
          {file && (
            <div className="mb-6">
              <ResumePreview file={file} previewUrl={previewUrl} previewText={previewText} />
            </div>
          )}

          {/* ── Analysis results ── */}
          {analysis && (
            <div ref={resultsRef} className="space-y-6">

              {/* Score + Summary */}
              <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-8 flex items-center gap-8">
                <ScoreRing score={analysis.score} />
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">
                    Resume Score
                  </p>
                  <h2 className="text-xl font-bold text-slate-900 mb-2">
                    {analysis.score >= 80 ? "Strong Resume"
                      : analysis.score >= 60 ? "Decent Resume"
                        : "Needs Work"}
                  </h2>
                  <p className="text-slate-600 text-sm leading-relaxed">{analysis.summary}</p>
                </div>
              </div>

              {/* Strengths + Weaknesses */}
              <div className="grid sm:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                  <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <SectionIcon color="bg-green-100">
                      <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </SectionIcon>
                    Strengths
                  </h3>
                  <ul className="space-y-2.5">
                    {analysis.strengths.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                        <span className="text-green-500 font-bold mt-0.5">+</span>
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                  <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <SectionIcon color="bg-orange-100">
                      <svg className="w-4 h-4 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </SectionIcon>
                    Areas to Improve
                  </h3>
                  <ul className="space-y-2.5">
                    {analysis.weaknesses.map((w, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                        <span className="text-orange-500 font-bold mt-0.5">!</span>
                        {w}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Missing sections */}
              {analysis.missingSections?.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                  <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <SectionIcon color="bg-rose-100">
                      <svg className="w-4 h-4 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                    </SectionIcon>
                    Missing Sections
                  </h3>
                  <p className="text-sm text-slate-500 mb-3">
                    These sections are absent or critically underdeveloped in your resume:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {analysis.missingSections.map((sec, i) => (
                      <span
                        key={i}
                        className="flex items-center gap-1.5 bg-rose-50 text-rose-700 border border-rose-200 text-sm font-medium px-3 py-1.5 rounded-full"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                        </svg>
                        {sec}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Actionable improvements */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                <h3 className="font-bold text-slate-900 mb-5 flex items-center gap-2">
                  <SectionIcon color="bg-blue-100">
                    <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </SectionIcon>
                  Actionable Improvements
                </h3>
                <div className="space-y-3">
                  {analysis.improvements.map((imp, i) => (
                    <div key={i} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-2 mb-1.5">
                        <PriorityBadge priority={imp.priority} />
                        <h4 className="font-semibold text-slate-800 text-sm">{imp.title}</h4>
                      </div>
                      <p className="text-sm text-slate-600 leading-relaxed">{imp.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Suggested rewrites */}
              {analysis.suggestedRewrites?.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                  <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
                    <SectionIcon color="bg-violet-100">
                      <svg className="w-4 h-4 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </SectionIcon>
                    Suggested Rewrites
                  </h3>
                  <p className="text-sm text-slate-500 mb-5">
                    Drop-in replacements for the weakest lines in your resume.
                  </p>
                  <div className="space-y-4">
                    {analysis.suggestedRewrites.map((rw, i) => (
                      <RewriteCard key={i} rewrite={rw} />
                    ))}
                  </div>
                </div>
              )}

              {/* ATS Keywords + Formatting */}
              <div className="grid sm:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                  <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <SectionIcon color="bg-purple-100">
                      <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                    </SectionIcon>
                    ATS Keywords to Add
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {analysis.atsKeywords.map((kw, i) => (
                      <span key={i} className="bg-purple-50 text-purple-700 border border-purple-200 text-xs font-medium px-3 py-1 rounded-full">
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                  <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <SectionIcon color="bg-teal-100">
                      <svg className="w-4 h-4 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                      </svg>
                    </SectionIcon>
                    Formatting Tips
                  </h3>
                  <ul className="space-y-2.5">
                    {analysis.formattingTips.map((tip, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                        <span className="text-teal-500 mt-0.5">&rsaquo;</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Reset */}
              <button
                onClick={reset}
                className="w-full py-3.5 border-2 border-slate-200 text-slate-500 font-semibold rounded-xl hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-all"
              >
                Analyze Another Resume
              </button>
            </div>
          )}
        </div>
      </div>
      {/* ── Footer ── */}
      <Footer />
    </>
  );
}
