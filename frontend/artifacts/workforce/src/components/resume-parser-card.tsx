import { useState, useRef, type DragEvent } from "react";
import { useLocation } from "wouter";
import {
  FileText,
  UploadCloud,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Clock,
  GraduationCap,
  Briefcase,
  ChevronRight,
  ExternalLink,
  BookOpen,
  ArrowRight,
  Cpu,
  Layers,
  Search,
  Check,
  RefreshCw,
} from "lucide-react";
import {
  useUploadResumePdf,
  useParseResumeText,
  useMatchResumePdf,
  useSkillGapResumePdf,
  useGenerateRoadmapResumePdf,
  usePyRoles,
  type PyResumeUploadResponse,
  type PyProfileParseResponse,
  type PyRolesMatchResponse,
  type PySkillsGapResponse,
  type PyRoadmapResponse,
} from "@workspace/api-client-react";
import { useJourney } from "@/lib/journey";
import { useJourneyFlow } from "@/lib/journey-flow";

interface ResumeParserCardProps {
  onAppliedToProfile?: (skills: string[], expYears: number, education?: string | null) => void;
  className?: string;
  defaultExpanded?: boolean;
}

const SAMPLE_RESUME_TEXT = `Jasmine Tan
Senior Data Engineer | Kuala Lumpur, Malaysia
Over 4 years of experience building resilient end-to-end data pipelines and real-time streaming architectures.
Education: Bachelor of Computer Science, University of Malaya.

Technical Expertise:
- Languages & Core: Python, SQL, Bash, Scala
- Big Data & Pipelines: Apache Spark, Apache Kafka, Apache Airflow, Databricks
- Databases: PostgreSQL, Snowflake, BigQuery, Redis
- Cloud & DevOps: Docker, Kubernetes, AWS (S3, EMR, Redshift), Terraform, CI/CD
- Data Modeling: Star Schema, dbt, ETL / ELT pipeline design, Data Quality testing`;

export function ResumeParserCard({ onAppliedToProfile, className = "", defaultExpanded = true }: ResumeParserCardProps) {
  const [, navigate] = useLocation();
  const { profile, profileDetails, saveProfile, setSelectedRole } = useJourney();
  const { reviewRadar, confirmRole } = useJourneyFlow();
  const { data: pyRolesData } = usePyRoles();

  // Mode: "pdf" or "text"
  const [tab, setTab] = useState<"pdf" | "text">("pdf");
  const [file, setFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [selectedSkillForEvidence, setSelectedSkillForEvidence] = useState<string | null>(null);
  const [appliedMessage, setAppliedMessage] = useState<string | null>(null);
  const [selectedTargetRole, setSelectedTargetRole] = useState<string>("Data Engineer");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mutations
  const uploadPdfMutation = useUploadResumePdf();
  const parseTextMutation = useParseResumeText();
  const matchPdfMutation = useMatchResumePdf();
  const skillGapMutation = useSkillGapResumePdf();
  const roadmapMutation = useGenerateRoadmapResumePdf();

  // Unified Parsed State
  const [parsedData, setParsedData] = useState<{
    skills: string[];
    evidence: Record<string, string>;
    experienceYears: number;
    education: string | null;
    source: "pdf" | "text";
    filename?: string;
    pageCount?: number;
    method?: string;
    warning?: string | null;
  } | null>(null);

  // Direct Role Match Result
  const [roleMatches, setRoleMatches] = useState<PyRolesMatchResponse | null>(null);
  // Direct Skill Gap Result
  const [gapResult, setGapResult] = useState<PySkillsGapResponse | null>(null);
  // Direct Roadmap Result
  const [roadmapResult, setRoadmapResult] = useState<PyRoadmapResponse | null>(null);

  const isParsing = uploadPdfMutation.isPending || parseTextMutation.isPending;
  const isMatching = matchPdfMutation.isPending;
  const isAnalyzingGap = skillGapMutation.isPending;
  const isGeneratingRoadmap = roadmapMutation.isPending;

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.toLowerCase().endsWith(".pdf")) {
        setFile(droppedFile);
      } else {
        alert("Please drop a valid .pdf resume file.");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = e.target.files[0];
      if (selected.name.toLowerCase().endsWith(".pdf")) {
        setFile(selected);
      } else {
        alert("Please select a valid .pdf resume file.");
      }
    }
  };

  // Trigger parsing
  const handleParse = async () => {
    setAppliedMessage(null);
    setRoleMatches(null);
    setGapResult(null);
    setRoadmapResult(null);

    if (tab === "pdf") {
      if (!file) return;
      try {
        const res: PyResumeUploadResponse = await uploadPdfMutation.mutateAsync(file);
        const rawSkills = res.extracted_skills || (res as any).skills || [];
        const skillsList = rawSkills.map((s: any) => (typeof s === "string" ? s.trim() : (typeof s?.skill === "string" ? s.skill.trim() : String(s || "")))).filter(Boolean);
        const evidenceMap: Record<string, string> = {};
        if (res.skill_evidence) {
          Object.entries(res.skill_evidence).forEach(([k, v]) => {
            evidenceMap[k] = Array.isArray(v) ? v.join(", ") : String(v);
          });
        }
        setParsedData({
          skills: skillsList,
          evidence: evidenceMap,
          experienceYears: res.experience_years ?? 0,
          education: res.detected_education || (res as any).education || null,
          source: "pdf",
          filename: res.filename,
          pageCount: res.page_count,
          method: "PyMuPDF + Canonical Taxonomy",
          warning: res.warning,
        });
        if (skillsList.length > 0) {
          setSelectedSkillForEvidence(skillsList[0]);
        }
      } catch (err: any) {
        console.error("PDF upload failed", err);
      }
    } else {
      if (!rawText.trim()) return;
      try {
        const res: PyProfileParseResponse = await parseTextMutation.mutateAsync({ raw_text: rawText });
        const rawSkills = res.skills || res.extracted_skills || [];
        const skillsList = rawSkills.map((s: any) => (typeof s === "string" ? s.trim() : (typeof s?.skill === "string" ? s.skill.trim() : String(s || "")))).filter(Boolean);
        const evidenceMap: Record<string, string> = {};
        if (res.skill_evidence) {
          Object.entries(res.skill_evidence).forEach(([k, v]) => {
            evidenceMap[k] = Array.isArray(v) ? v.join(", ") : String(v);
          });
        }
        setParsedData({
          skills: skillsList,
          evidence: evidenceMap,
          experienceYears: res.experience_years ?? 0,
          education: res.education || res.detected_education || null,
          source: "text",
          method: res.method === "llm_extraction_verified" ? "RunPod Qwen2.5-7B-Instruct Verified" : res.method,
          warning: res.fallback_reason || res.warning || null,
        });
        if (skillsList.length > 0) {
          setSelectedSkillForEvidence(skillsList[0]);
        }
      } catch (err: any) {
        console.error("Text parsing failed", err);
      }
    }
  };

  // Apply parsed results to Candidate Profile
  const handleApplyToProfile = () => {
    if (!parsedData) return;

    const newSkills = parsedData.skills.map((skillItem: any) => {
      const name = typeof skillItem === "string" ? skillItem.trim() : (typeof skillItem?.skill === "string" ? skillItem.skill.trim() : String(skillItem || "").trim());
      return {
        name,
        level: 2, // Default to Intermediate for parsed skills
      };
    }).filter((s) => s.name);

    // Deduplicate against existing profile skills
    const existingMap = new Map((profile?.skills || []).map((s: any) => {
      const sName = typeof s?.name === "string"
        ? s.name.trim()
        : (typeof s?.name?.skill === "string"
            ? s.name.skill.trim()
            : (typeof s?.skill === "string" ? s.skill.trim() : String(s?.name || "").trim()));
      return [sName.toLowerCase(), { name: sName, level: s?.level ?? 2 }];
    }));

    newSkills.forEach((s) => {
      if (!existingMap.has(s.name.toLowerCase())) {
        existingMap.set(s.name.toLowerCase(), s);
      }
    });

    const updatedProfile = {
      ...(profile || {}),
      interests: (profile?.interests && profile.interests.length > 0) ? profile.interests : ["Working with data"],
      hours_per_week: profile?.hours_per_week || 5,
      skills: Array.from(existingMap.values()).slice(0, 60),
      experience_years: parsedData.experienceYears > 0 ? Math.min(50, Math.round(parsedData.experienceYears)) : (profile?.experience_years ?? 0),
    };

    const updatedDetails = {
      ...profileDetails,
      education_level: (parsedData.education as any) || profileDetails.education_level || "Bachelor's degree",
      experience_summary: parsedData.source === "text" && rawText ? rawText.slice(0, 2000) : profileDetails.experience_summary,
    };

    saveProfile(updatedProfile, updatedDetails);
    reviewRadar(); // unlock radar stage

    setAppliedMessage(`Applied ${parsedData.skills.length} skills & ${parsedData.experienceYears} yrs experience to your profile!`);

    if (onAppliedToProfile) {
      onAppliedToProfile(parsedData.skills, parsedData.experienceYears, parsedData.education);
    }
  };

  // Run Direct Role Matching
  const handleDirectRoleMatch = async () => {
    if (tab === "pdf" && file) {
      try {
        const res = await matchPdfMutation.mutateAsync({ file, top_k: 5 });
        setRoleMatches(res);
        reviewRadar();
      } catch (err: any) {
        console.error("Direct role matching failed", err);
      }
    } else if (parsedData && parsedData.skills.length > 0) {
      handleApplyToProfile();
      navigate("/role-matches");
    }
  };

  // Run Skill Gap Analysis for Target Role
  const handleAnalyzeSkillGap = async () => {
    if (tab === "pdf" && file) {
      try {
        const res = await skillGapMutation.mutateAsync({ file, target_role: selectedTargetRole });
        setGapResult(res);
      } catch (err: any) {
        console.error("Gap analysis failed", err);
      }
    }
  };

  // Run Roadmap Generation
  const handleGenerateRoadmap = async () => {
    if (tab === "pdf" && file) {
      try {
        const res = await roadmapMutation.mutateAsync({ file, target_role: selectedTargetRole, max_courses: 6 });
        setRoadmapResult(res);
      } catch (err: any) {
        console.error("Roadmap generation failed", err);
      }
    }
  };

  const rolesList = pyRolesData?.roles || [
    { role: "Data Engineer" },
    { role: "Data Scientist" },
    { role: "Software Engineer / Developer" },
    { role: "DevOps / Cloud Engineer" },
    { role: "AI / Machine Learning Specialist" },
    { role: "Data Analyst" },
    { role: "Cybersecurity Analyst" },
    { role: "Systems / Network Engineer" },
  ];

  return (
    <div className={`rounded-2xl border border-border/80 bg-gradient-to-b from-card via-card to-secondary/30 p-6 shadow-lg backdrop-blur transition-all ${className}`} data-testid="card-resume-parser">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between border-b border-border/60 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary mb-2">
            <Cpu className="h-3.5 w-3.5" />
            Empirical Parser & RunPod LLM Verification Gate
          </div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FileText className="h-6 w-6 text-teal-600 dark:text-teal-400" />
            Instant Resume & Bio Intelligence
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Upload your PDF resume or paste your profile text. Our backend extracts canonical Malaysian tech skills, verbatim sentence evidence, and detects experience level in milliseconds.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 rounded-xl bg-secondary/80 p-1 border border-border self-start md:self-auto">
          <button
            type="button"
            onClick={() => setTab("pdf")}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition ${
              tab === "pdf" ? "bg-card text-foreground shadow-sm font-semibold" : "text-muted-foreground hover:text-foreground"
            }`}
            data-testid="tab-resume-pdf"
          >
            PDF Upload
          </button>
          <button
            type="button"
            onClick={() => setTab("text")}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition ${
              tab === "text" ? "bg-card text-foreground shadow-sm font-semibold" : "text-muted-foreground hover:text-foreground"
            }`}
            data-testid="tab-resume-text"
          >
            Paste Text / Bio
          </button>
        </div>
      </div>

      {/* Input Area */}
      <div className="mt-6">
        {tab === "pdf" ? (
          <div>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-all ${
                isDragging
                  ? "border-primary bg-primary/5 scale-[0.99]"
                  : file
                  ? "border-teal-500/50 bg-teal-500/5"
                  : "border-border hover:border-primary/50 hover:bg-secondary/40"
              }`}
              data-testid="dropzone-resume-pdf"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={handleFileChange}
                data-testid="input-file-resume-pdf"
              />

              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-3">
                <UploadCloud className="h-7 w-7" />
              </div>

              {file ? (
                <div>
                  <p className="text-base font-semibold text-foreground flex items-center justify-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                    {file.name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {(file.size / 1024).toFixed(1)} KB · Ready for empirical extraction
                  </p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                      setParsedData(null);
                    }}
                    className="mt-3 text-xs text-destructive hover:underline font-medium"
                  >
                    Remove and choose another
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Click to browse or drag and drop your PDF resume
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Direct in-memory PDF extraction (PyMuPDF). PII is never stored or logged.
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label htmlFor="resume-raw-text" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Paste Bio, LinkedIn Profile, or Resume Text
              </label>
              <button
                type="button"
                onClick={() => setRawText(SAMPLE_RESUME_TEXT)}
                className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                data-testid="button-load-sample-resume"
              >
                <Sparkles className="h-3 w-3" />
                Load Sample Data Engineer Bio
              </button>
            </div>
            <textarea
              id="resume-raw-text"
              rows={6}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Paste your skills, experience summary, education, or projects here..."
              className="w-full rounded-xl border border-input bg-background/80 p-4 text-sm font-normal text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring"
              data-testid="textarea-resume-raw-text"
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>PII (emails, phones, ICs) automatically pre-redacted before processing</span>
              <span>{rawText.length} characters</span>
            </div>
          </div>
        )}

        {/* Extraction Button Bar */}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleParse}
            disabled={isParsing || (tab === "pdf" ? !file : !rawText.trim())}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow hover:opacity-90 disabled:opacity-50 transition"
            data-testid="button-parse-resume"
          >
            {isParsing ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Extracting Skills & Evidence…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Extract & Analyze Resume
              </>
            )}
          </button>

          {tab === "pdf" && file && (
            <button
              type="button"
              onClick={handleDirectRoleMatch}
              disabled={isMatching || isParsing}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground shadow-sm hover:bg-secondary disabled:opacity-50 transition"
              data-testid="button-direct-match-resume"
            >
              {isMatching ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Matching Against JobStreet Roles…
                </>
              ) : (
                <>
                  <Briefcase className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                  Direct Role Match (70/30 Empirical)
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Errors / Warnings */}
      {uploadPdfMutation.isError && (
        <div className="mt-4 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive flex items-center gap-2" role="alert">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{uploadPdfMutation.error.message || "Failed to parse PDF resume."}</span>
        </div>
      )}
      {parseTextMutation.isError && (
        <div className="mt-4 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive flex items-center gap-2" role="alert">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{parseTextMutation.error.message || "Failed to parse resume text."}</span>
        </div>
      )}
      {parsedData?.warning && (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-500/10 p-3.5 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{parsedData.warning}</span>
        </div>
      )}

      {/* SUCCESS APPLIED ALERT */}
      {appliedMessage && (
        <div className="mt-5 rounded-xl border border-teal-500/30 bg-teal-500/10 p-4 text-sm font-medium text-teal-800 dark:text-teal-200 flex items-center justify-between" role="status">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-teal-600 dark:text-teal-400 shrink-0" />
            <span>{appliedMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => navigate("/skills-radar")}
            className="inline-flex items-center gap-1 text-xs font-semibold underline underline-offset-4 hover:opacity-80"
          >
            Review Future Skills Radar <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* RESULTS SECTION */}
      {parsedData && (
        <div className="mt-8 border-t border-border/80 pt-6 space-y-6">
          {/* Key Metrics Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl border border-border bg-card/60 p-4">
              <span className="text-xs font-medium text-muted-foreground uppercase flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-primary" /> Verified Skills
              </span>
              <p className="mt-1 text-2xl font-bold text-foreground">{parsedData.skills.length}</p>
              <span className="text-xs text-muted-foreground">Canonical taxonomy terms</span>
            </div>

            <div className="rounded-xl border border-border bg-card/60 p-4">
              <span className="text-xs font-medium text-muted-foreground uppercase flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-primary" /> Experience
              </span>
              <p className="mt-1 text-2xl font-bold text-foreground">
                {parsedData.experienceYears > 0 ? `${parsedData.experienceYears.toFixed(1)} yrs` : "Entry-level"}
              </p>
              <span className="text-xs text-muted-foreground">Detected from timeline</span>
            </div>

            <div className="rounded-xl border border-border bg-card/60 p-4">
              <span className="text-xs font-medium text-muted-foreground uppercase flex items-center gap-1.5">
                <GraduationCap className="h-3.5 w-3.5 text-primary" /> Education
              </span>
              <p className="mt-1 text-base font-bold text-foreground truncate" title={parsedData.education || "Not specified"}>
                {parsedData.education || "Detected in Profile"}
              </p>
              <span className="text-xs text-muted-foreground">Verified credential</span>
            </div>

            <div className="rounded-xl border border-border bg-card/60 p-4">
              <span className="text-xs font-medium text-muted-foreground uppercase flex items-center gap-1.5">
                <Cpu className="h-3.5 w-3.5 text-primary" /> Processing Mode
              </span>
              <p className="mt-1 text-sm font-bold text-foreground truncate" title={parsedData.method || "Deterministic"}>
                {parsedData.method || "Taxonomy match"}
              </p>
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Verified zero-hallucination</span>
            </div>
          </div>

          {/* Extracted Skills & Verbatim Sentence Evidence Explorer */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
              <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                <span>Extracted Canonical Skills ({parsedData.skills.length})</span>
                <span className="text-xs font-normal text-muted-foreground">Click a skill to inspect verbatim text evidence</span>
              </h3>

              <button
                type="button"
                onClick={handleApplyToProfile}
                className="inline-flex items-center gap-2 self-start rounded-lg bg-teal-600 hover:bg-teal-700 px-4 py-2 text-xs font-semibold text-white shadow transition"
                data-testid="button-apply-parsed-to-profile"
              >
                <Check className="h-4 w-4" />
                Apply All to My Profile
              </button>
            </div>

            {/* Skills Pills */}
            <div className="flex flex-wrap gap-2">
              {parsedData.skills.map((skill: any, idx: number) => {
                const skillName = typeof skill === "string" ? skill : (typeof skill?.skill === "string" ? skill.skill : String(skill || ""));
                const isSelected = selectedSkillForEvidence === skillName;
                const hasEvidence = Boolean(parsedData.evidence[skillName]);
                return (
                  <button
                    key={skillName || idx}
                    type="button"
                    onClick={() => setSelectedSkillForEvidence(isSelected ? null : skillName)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition border ${
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground shadow-sm"
                        : "border-border bg-secondary/70 text-foreground hover:bg-secondary"
                    }`}
                    data-testid={`badge-parsed-skill-${skillName.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
                  >
                    <span>{skillName}</span>
                    {hasEvidence && (
                      <span className={`h-1.5 w-1.5 rounded-full ${isSelected ? "bg-white" : "bg-teal-500"}`} />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Verbatim Evidence Drawer */}
            {selectedSkillForEvidence && (
              <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5">
                    <Search className="h-3.5 w-3.5" />
                    Verbatim Text Evidence for “{selectedSkillForEvidence}”
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedSkillForEvidence(null)}
                    className="text-muted-foreground hover:text-foreground text-xs"
                  >
                    Close
                  </button>
                </div>
                <p className="font-mono text-muted-foreground leading-relaxed italic bg-card/80 p-3 rounded-lg border border-border">
                  {parsedData.evidence[selectedSkillForEvidence]
                    ? `“${parsedData.evidence[selectedSkillForEvidence]}”`
                    : "Explicit mention matched directly via canonical lexical aliases."}
                </p>
              </div>
            )}
          </div>

          {/* QUICK TARGET ROLE EXPLORER (SKILL GAP & ROADMAP) */}
          <div className="rounded-xl border border-border bg-secondary/20 p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="font-semibold text-foreground text-sm flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-primary" />
                  Evaluate against a Malaysian Tech Role
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Compare your parsed resume against empirical requirements from JobStreet Malaysia.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={selectedTargetRole}
                  onChange={(e) => setSelectedTargetRole(e.target.value)}
                  className="h-9 rounded-lg border border-input bg-card px-3 text-xs font-semibold text-foreground shadow-sm"
                  data-testid="select-parsed-target-role"
                >
                  {rolesList.map((r) => (
                    <option key={r.role} value={r.role}>
                      {r.role}
                    </option>
                  ))}
                </select>

                {tab === "pdf" && file && (
                  <>
                    <button
                      type="button"
                      onClick={handleAnalyzeSkillGap}
                      disabled={isAnalyzingGap}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-50"
                      data-testid="button-gap-target-role"
                    >
                      {isAnalyzingGap ? "Analyzing…" : "Check Gaps"}
                    </button>

                    <button
                      type="button"
                      onClick={handleGenerateRoadmap}
                      disabled={isGeneratingRoadmap}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                      data-testid="button-roadmap-target-role"
                    >
                      {isGeneratingRoadmap ? "Retrieving Courses…" : "Get Coursera Roadmap"}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Gap Analysis Result Card */}
            {gapResult && (
              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-foreground">
                    Empirical Skill Gap Analysis · {gapResult.target_role}
                  </span>
                  <span className="rounded-full bg-teal-500/10 px-2.5 py-0.5 text-xs font-bold text-teal-700 dark:text-teal-300">
                    {gapResult.coverage_percentage.toFixed(1)}% Core Coverage
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="rounded-lg bg-secondary/40 p-3">
                    <p className="font-semibold text-emerald-600 dark:text-emerald-400 mb-1.5">
                      Matched Skills ({gapResult.matched_skills_count})
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {gapResult.matched_skills.map((item: any, idx: number) => {
                        const name = typeof item === "string" ? item : item?.skill || "";
                        const share = typeof item === "object" && item !== null
                          ? (typeof item.posting_share_percentage === "number"
                              ? item.posting_share_percentage
                              : typeof item.empirical_posting_share === "number"
                              ? Math.round(item.empirical_posting_share * 100)
                              : null)
                          : null;
                        return (
                          <span
                            key={name || idx}
                            className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-emerald-800 dark:text-emerald-300 font-medium"
                          >
                            <span>{name}</span>
                            {share !== null && <span className="opacity-70 text-[10px]">({share}%)</span>}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-lg bg-secondary/40 p-3">
                    <p className="font-semibold text-rose-600 dark:text-rose-400 mb-1.5">
                      Core Skill Gaps (≥25% Demand) ({gapResult.core_gaps_count})
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {gapResult.core_gaps.map((item: any, idx: number) => {
                        const name = typeof item === "string" ? item : item?.skill || "";
                        const share = typeof item === "object" && item !== null
                          ? (typeof item.posting_share_percentage === "number"
                              ? item.posting_share_percentage
                              : typeof item.empirical_posting_share === "number"
                              ? Math.round(item.empirical_posting_share * 100)
                              : null)
                          : null;
                        return (
                          <span
                            key={name || idx}
                            className="inline-flex items-center gap-1 rounded bg-rose-500/10 px-2 py-0.5 text-rose-800 dark:text-rose-300 font-medium"
                          >
                            <span>{name}</span>
                            {share !== null && <span className="opacity-70 text-[10px]">({share}%)</span>}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Roadmap Result Card */}
            {roadmapResult && (
              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                      <BookOpen className="h-4 w-4 text-primary" /> Verified Coursera Pathway · {roadmapResult.target_role}
                    </span>
                    <p className="text-xs text-muted-foreground mt-0.5">{roadmapResult.pathway_ordering_label}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {roadmapResult.ordered_pathway.length} verified courses
                  </span>
                </div>

                <div className="space-y-2">
                  {roadmapResult.ordered_pathway.map((course: any, idx: number) => {
                    const cTitle = course.course_title || course.title || "Course";
                    const cUrl = course.course_url || course.url || "#";
                    const cOrg = course.offered_by || course.organization || "Coursera Partner";
                    const cLevel = course.difficulty_level || course.level || "All levels";
                    const cTarget = course.gap_addressed || (Array.isArray(course.target_skills) ? course.target_skills.join(", ") : "");
                    return (
                      <div key={course.source_record_id || course.course_id || idx} className="flex items-center justify-between gap-3 rounded-lg border border-border/80 bg-background/60 p-2.5 text-xs">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                            {idx + 1}
                          </span>
                          <div className="truncate">
                            <p className="font-semibold text-foreground truncate">{cTitle}</p>
                            <p className="text-muted-foreground text-[11px] truncate">
                              {cOrg} · {cLevel}{cTarget ? ` · Targets: ${cTarget}` : ""}
                            </p>
                          </div>
                        </div>

                        <a
                          href={cUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex shrink-0 items-center gap-1 text-primary hover:underline font-semibold"
                        >
                          Enroll <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ROLE MATCHES OVERVIEW (IF PERFORMED) */}
          {roleMatches && (
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-base text-foreground flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                    Top Empirical Role Matches
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Evaluated against {roleMatches.total_roles_evaluated} Malaysian tech roles (70% skill coverage + 30% TF-IDF similarity).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    handleApplyToProfile();
                    navigate("/role-matches");
                  }}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  View full details <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {roleMatches.ranked_matches.slice(0, 3).map((match) => (
                  <div
                    key={match.role}
                    className="flex flex-col justify-between rounded-xl border border-border bg-secondary/30 p-4 transition hover:border-primary/50"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-muted-foreground">Rank #{match.rank}</span>
                        <span className="rounded-full bg-teal-500/10 px-2.5 py-0.5 text-xs font-bold text-teal-700 dark:text-teal-300">
                          {match.match_score.toFixed(1)}% match
                        </span>
                      </div>
                      <h5 className="font-bold text-foreground text-sm mt-2">{match.role}</h5>
                      <p className="text-xs text-muted-foreground mt-1">
                        {match.matched_skills_count} matched skills · {match.core_gaps_count} core gaps
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRole(match.role);
                        confirmRole(match.role);
                        handleApplyToProfile();
                        navigate(`/pathway?role=${encodeURIComponent(match.role)}`);
                      }}
                      className="mt-4 inline-flex items-center justify-center gap-1 rounded-lg bg-primary/10 hover:bg-primary/20 py-1.5 text-xs font-semibold text-primary transition"
                    >
                      Build Pathway <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {roleMatches.narration && (
                <div className="rounded-lg bg-secondary/50 p-3 text-xs leading-relaxed text-muted-foreground border border-border">
                  <strong className="text-foreground font-semibold">Intelligence Summary: </strong>
                  {roleMatches.narration}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
