"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import {
  FileText,
  UploadCloud,
  X,
  MessageSquare,
  CheckCircle2,
  Eye,
  EyeOff,
  Trash2,
  ExternalLink,
  Sparkles,
  ChevronLeft
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getIcaProfile,
  saveCoachingNotes,
  uploadIcaFileAction,
  deleteIcaFileAction,
  createAttribute,
  updateAttributeStatus,
  deleteAttribute,
  IcaProfileData,
  IcaItem
} from "./actions";

type MatchStatus = "Matched" | "Extra" | "Missing";

function AttributeStatusIcon({ status }: { status: MatchStatus }) {
  if (status === "Matched") {
    return <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />;
  }
  return (
    <span className={cn(
      "h-1.5 w-1.5 rounded-full shrink-0 ml-0.5 mr-0.5",
      status === "Extra" ? "bg-neutral-400" : "bg-rose-500"
    )} />
  );
}

function getInitials(name: string): string {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + (parts[parts.length - 1]?.[0] || "")).toUpperCase();
}

interface DbUser {
  id: string;
  name: string;
  email: string;
  title: string;
  role?: string;
}

interface IcaWorkspaceProps {
  currentUser: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  dbUsers: DbUser[];
}

// ── Iceberg Graphic Illustration ─────────────────────────────────────────────

function IcebergGraphic() {
  return (
    <div className="relative w-full aspect-16/9 rounded-2xl overflow-hidden shadow-sm border border-sky-200/50 bg-gradient-to-b from-sky-400 via-sky-600 to-slate-900 select-none">
      <svg className="w-full h-full" viewBox="0 0 400 200" preserveAspectRatio="none">
        <defs>
          <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#bae6fd" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>
          <linearGradient id="waterGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0284c7" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#0369a1" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>
          <linearGradient id="iceGradAbove" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#e0f2fe" />
          </linearGradient>
          <linearGradient id="iceGradBelow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7dd3fc" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#0284c7" stopOpacity="0.3" />
          </linearGradient>
        </defs>

        {/* Sky Background */}
        <rect x="0" y="0" width="400" height="50" fill="url(#skyGrad)" />

        {/* Water Background */}
        <rect x="0" y="50" width="400" height="150" fill="url(#waterGrad)" />

        {/* Waterline */}
        <line x1="0" y1="50" x2="400" y2="50" stroke="#ffffff" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.7" />

        {/* Underwater Iceberg Body */}
        <polygon points="170,50 120,90 135,160 210,185 275,150 280,85 230,50" fill="url(#iceGradBelow)" stroke="#e0f2fe" strokeWidth="1" strokeOpacity="0.4" />
        <polygon points="170,50 200,100 210,185 240,110 230,50" fill="#38bdf8" opacity="0.2" />

        {/* Above Water Iceberg Peak */}
        <polygon points="170,50 190,20 215,15 230,50" fill="url(#iceGradAbove)" />
        <polygon points="190,20 215,15 205,50" fill="#e0f2fe" opacity="0.8" />

        {/* Callout Lines & Dots */}
        {/* Skills */}
        <line x1="180" y1="30" x2="110" y2="30" stroke="#ffffff" strokeWidth="1" />
        <circle cx="180" cy="30" r="2.5" fill="#ffffff" />
        <text x="70" y="33" fill="#ffffff" fontSize="11" fontWeight="bold" fontFamily="sans-serif">Skills</text>

        {/* Knowledge */}
        <line x1="215" y1="25" x2="285" y2="25" stroke="#ffffff" strokeWidth="1" />
        <circle cx="215" cy="25" r="2.5" fill="#ffffff" />
        <text x="290" y="28" fill="#ffffff" fontSize="11" fontWeight="bold" fontFamily="sans-serif">Knowledge</text>

        {/* Traits */}
        <line x1="145" y1="100" x2="95" y2="100" stroke="#ffffff" strokeWidth="1" />
        <circle cx="145" cy="100" r="2.5" fill="#ffffff" />
        <text x="60" y="103" fill="#ffffff" fontSize="11" fontWeight="bold" fontFamily="sans-serif">Traits</text>

        {/* Motives */}
        <line x1="265" y1="120" x2="315" y2="120" stroke="#ffffff" strokeWidth="1" />
        <circle cx="265" cy="120" r="2.5" fill="#ffffff" />
        <text x="320" y="123" fill="#ffffff" fontSize="11" fontWeight="bold" fontFamily="sans-serif">Motives</text>

        {/* Self-image */}
        <line x1="175" y1="160" x2="115" y2="160" stroke="#ffffff" strokeWidth="1" />
        <circle cx="175" cy="160" r="2.5" fill="#ffffff" />
        <text x="50" y="163" fill="#ffffff" fontSize="11" fontWeight="bold" fontFamily="sans-serif">Self-image</text>
      </svg>
    </div>
  );
}

// ── Main Workspace ────────────────────────────────────────────────────────────

export default function IcaWorkspace({ currentUser, dbUsers }: IcaWorkspaceProps) {
  const isManager = currentUser.role === "MANAGER";

  // Active selected user ID state
  const [selectedUserId, setSelectedUserId] = useState(() => {
    if (isManager) {
      return dbUsers.find((u) => u.id === currentUser.id)?.id || dbUsers[0]?.id || currentUser.id;
    }
    return currentUser.id;
  });

  // DB Profile and loading states
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<IcaProfileData | null>(null);

  // Selected document ID & in-page detail viewer state (matching RTD module)
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [isViewingDoc, setIsViewingDoc] = useState(false);

  // Upload modal states
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: string; rawFile?: File } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manager Notes input state
  const [editingNotes, setEditingNotes] = useState("");
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  // Inline input states for adding attributes
  const [newSkillInput, setNewSkillInput] = useState("");
  const [newKnowledgeInput, setNewKnowledgeInput] = useState("");
  const [newSelfImageInput, setNewSelfImageInput] = useState("");
  const [newTraitInput, setNewTraitInput] = useState("");
  const [newMotiveInput, setNewMotiveInput] = useState("");

  // Load profile from database when selected user changes
  useEffect(() => {
    if (!selectedUserId) return;
    getIcaProfile(selectedUserId)
      .then((data) => {
        setProfile(data);
        setEditingNotes(data.managerNotes || "");
        setSelectedDocId(data.documents[0]?.id || null);
        setLoading(false);
      })
      .catch((err) => {
        console.error("[ICA] Failed to load profile", err);
        setLoading(false);
      });
  }, [selectedUserId]);

  // Handle selected user change (Manager dropdown)
  const handleUserChange = (userId: string) => {
    setLoading(true);
    setSelectedUserId(userId);
  };

  // Active Document calculation
  const activeDoc = useMemo(() => {
    if (!profile?.documents || profile.documents.length === 0) return null;
    if (selectedDocId) {
      return profile.documents.find((d) => d.id === selectedDocId) || profile.documents[0];
    }
    return profile.documents[0];
  }, [profile, selectedDocId]);

  // Save Notes handler
  const handleSaveNotes = async () => {
    if (!selectedUserId) return;
    setIsSavingNotes(true);
    try {
      await saveCoachingNotes(selectedUserId, editingNotes);
      setProfile((prev) => (prev ? { ...prev, managerNotes: editingNotes } : null));
    } catch (err) {
      console.error("[ICA] Failed to save coaching notes", err);
    } finally {
      setIsSavingNotes(false);
    }
  };

  // Map category key to DB enum category
  const getCategoryEnum = (category: string): "SKILL" | "KNOWLEDGE" | "SELF_IMAGE" | "TRAIT" | "MOTIVE" => {
    if (category === "skills") return "SKILL";
    if (category === "knowledge") return "KNOWLEDGE";
    if (category === "selfImage") return "SELF_IMAGE";
    if (category === "traits") return "TRAIT";
    return "MOTIVE";
  };

  // Toggle match status of an attribute
  const toggleAttributeStatus = async (category: "skills" | "knowledge" | "selfImage" | "traits" | "motives", item: IcaItem) => {
    if (!profile) return;

    let nextStatus: MatchStatus = "Matched";
    if (item.status === "Matched") nextStatus = "Extra";
    else if (item.status === "Extra") nextStatus = "Missing";

    setProfile((prev) => {
      if (!prev) return null;
      const updateList = (list: IcaItem[]) =>
        list.map((i) => (i.id === item.id ? { ...i, status: nextStatus } : i));

      return {
        ...prev,
        skills: category === "skills" ? updateList(prev.skills) : prev.skills,
        knowledge: category === "knowledge" ? updateList(prev.knowledge) : prev.knowledge,
        selfImage: category === "selfImage" ? updateList(prev.selfImage) : prev.selfImage,
        traits: category === "traits" ? updateList(prev.traits) : prev.traits,
        motives: category === "motives" ? updateList(prev.motives) : prev.motives,
      };
    });

    try {
      await updateAttributeStatus(item.id, nextStatus);
    } catch (err) {
      console.error("[ICA] Failed to update attribute status", err);
      const data = await getIcaProfile(selectedUserId);
      setProfile(data);
    }
  };

  // Delete attribute
  const deleteAttributeHandler = async (category: "skills" | "knowledge" | "selfImage" | "traits" | "motives", item: IcaItem) => {
    if (!profile) return;

    setProfile((prev) => {
      if (!prev) return null;
      const filterList = (list: IcaItem[]) => list.filter((i) => i.id !== item.id);
      return {
        ...prev,
        skills: category === "skills" ? filterList(prev.skills) : prev.skills,
        knowledge: category === "knowledge" ? filterList(prev.knowledge) : prev.knowledge,
        selfImage: category === "selfImage" ? filterList(prev.selfImage) : prev.selfImage,
        traits: category === "traits" ? filterList(prev.traits) : prev.traits,
        motives: category === "motives" ? filterList(prev.motives) : prev.motives,
      };
    });

    try {
      await deleteAttribute(item.id);
    } catch (err) {
      console.error("[ICA] Failed to delete attribute", err);
      const data = await getIcaProfile(selectedUserId);
      setProfile(data);
    }
  };

  // Add attribute helper
  const addAttributeHandler = async (category: "skills" | "knowledge" | "selfImage" | "traits" | "motives", name: string) => {
    if (!name.trim() || !profile) return;

    const list = profile[category];
    if (list.some((item) => item.name.toLowerCase() === name.toLowerCase())) return;

    try {
      const dbCat = getCategoryEnum(category);
      const newItem = await createAttribute(selectedUserId, dbCat, name.trim(), "Matched");

      setProfile((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          skills: category === "skills" ? [...prev.skills, newItem] : prev.skills,
          knowledge: category === "knowledge" ? [...prev.knowledge, newItem] : prev.knowledge,
          selfImage: category === "selfImage" ? [...prev.selfImage, newItem] : prev.selfImage,
          traits: category === "traits" ? [...prev.traits, newItem] : prev.traits,
          motives: category === "motives" ? [...prev.motives, newItem] : prev.motives,
        };
      });
    } catch (err) {
      console.error("[ICA] Failed to create attribute", err);
    }
  };

  const handleAddSkill = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      addAttributeHandler("skills", newSkillInput);
      setNewSkillInput("");
    }
  };

  const handleAddKnowledge = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      addAttributeHandler("knowledge", newKnowledgeInput);
      setNewKnowledgeInput("");
    }
  };

  const handleAddSelfImage = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      addAttributeHandler("selfImage", newSelfImageInput);
      setNewSelfImageInput("");
    }
  };

  const handleAddTrait = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      addAttributeHandler("traits", newTraitInput);
      setNewTraitInput("");
    }
  };

  const handleAddMotive = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      addAttributeHandler("motives", newMotiveInput);
      setNewMotiveInput("");
    }
  };

  // Dynamic counts
  const counts = useMemo(() => {
    if (!profile) return { skills: 0, knowledge: 0, selfImage: 0, traits: 0, motives: 0, overall: 0 };
    return {
      skills: profile.skills.length,
      knowledge: profile.knowledge.length,
      selfImage: profile.selfImage.length,
      traits: profile.traits.length,
      motives: profile.motives.length,
      overall: profile.skills.length + profile.knowledge.length + profile.selfImage.length + profile.traits.length + profile.motives.length,
    };
  }, [profile]);

  // Handle local file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile({
        name: file.name,
        size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        rawFile: file,
      });
    }
  };

  // File upload submit
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadedFile || !uploadedFile.rawFile || !profile) return;

    try {
      const formData = new FormData();
      formData.append("file", uploadedFile.rawFile);
      if (newComment) {
        formData.append("comment", newComment);
      }

      await uploadIcaFileAction(selectedUserId, formData);

      // Refresh user profile details
      const data = await getIcaProfile(selectedUserId);
      setProfile(data);
      if (data.documents.length > 0) {
        setSelectedDocId(data.documents[0].id);
      }
      setShowUploadModal(false);
      setNewComment("");
      setUploadedFile(null);
    } catch (err) {
      console.error("[ICA] Failed to upload alignment file", err);
    }
  };

  if (loading || !profile) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background min-h-[500px]">
        <div className="flex flex-col items-center gap-2 select-none">
          <Sparkles size={32} className="text-primary animate-pulse" />
          <p className="text-xs text-muted-foreground font-semibold">Loading Competency Profile...</p>
        </div>
      </div>
    );
  }

  // ── IN-PAGE DETAIL VIEWER (EXACT RTD MODULE LAYOUT) ────────────────────────
  if (isViewingDoc && activeDoc) {
    return (
      <div className="flex-1 overflow-y-auto bg-background p-6 animate-in fade-in duration-200">
        {/* Top Control Bar */}
        <div className="flex items-center justify-between border-b pb-5 mb-6 select-none">
          <button
            type="button"
            onClick={() => setIsViewingDoc(false)}
            className="flex items-center gap-1.5 rounded-lg border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-all cursor-pointer"
          >
            <ChevronLeft size={14} />
            Back to Documents
          </button>
          <h2 className="text-sm font-bold text-foreground uppercase tracking-widest bg-muted/60 px-3 py-1 rounded-md">
            ICA DETAIL VIEWER
          </h2>
        </div>

        {/* Main Split Layout */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

          {/* Left Column (8 Cols) - Document Preview */}
          <div className="xl:col-span-8 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
              <FileText size={15} className="text-primary" /> Document Preview
            </div>

            <div className="bg-card border border-border/80 rounded-2xl p-6 shadow-3xs min-h-[550px] flex flex-col items-center justify-center relative overflow-hidden">
              {activeDoc.fileName.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? (
                <div className="w-full h-full min-h-[480px] flex items-center justify-center bg-muted/10 rounded-xl overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={activeDoc.fileUrl}
                    alt={activeDoc.fileName}
                    className="max-w-full max-h-[500px] object-contain rounded-lg shadow-sm"
                  />
                </div>
              ) : activeDoc.fileName.toLowerCase().endsWith(".pdf") ? (
                <div className="w-full h-[580px] rounded-xl overflow-hidden border border-border/80 bg-card shadow-3xs flex flex-col">
                  {/* Custom App Theme Toolbar for PDF */}
                  <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-2 text-xs font-semibold text-foreground select-none">
                    <div className="flex items-center gap-2 truncate max-w-[70%]">
                      <FileText size={15} className="text-rose-500 shrink-0" />
                      <span className="truncate font-bold text-foreground">{activeDoc.fileName}</span>
                    </div>
                    <a
                      href={activeDoc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[11px] font-bold text-primary bg-primary/10 hover:bg-primary/20 px-2.5 py-1 rounded-md transition-colors cursor-pointer"
                    >
                      <span>Open / Print</span>
                      <ExternalLink size={12} />
                    </a>
                  </div>
                  <iframe
                    src={`${activeDoc.fileUrl}#toolbar=0`}
                    className="w-full flex-1 border-none bg-background"
                    title={activeDoc.fileName}
                  />
                </div>
              ) : (
                <div className="p-8 flex flex-col items-center justify-center text-center gap-3 max-w-sm">
                  <FileText size={48} className="text-rose-500 animate-bounce" />
                  <div>
                    <h3 className="text-sm font-bold text-foreground">{activeDoc.fileName}</h3>
                    <p className="text-xs text-muted-foreground mt-1">This document file can be downloaded or opened directly in a new tab.</p>
                  </div>
                  <a
                    href={activeDoc.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-xs hover:bg-primary/95 transition-all cursor-pointer"
                  >
                    Open Document ↗
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Right Column (4 Cols) - Details & Manager Notes */}
          <div className="xl:col-span-4 flex flex-col gap-5">

            {/* Submission Summary Card */}
            <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-3xs flex flex-col gap-4">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest border-b pb-2">
                SUBMISSION SUMMARY
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">TASK NAME</label>
                  <p className="text-sm font-bold text-foreground mt-0.5">ICA Alignment</p>
                </div>

                <div className="border-t border-border/40 pt-3">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">UPLOADED FILE</label>
                  <a
                    href={activeDoc.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 bg-accent/20 hover:bg-accent/40 border rounded-xl p-2.5 transition-colors cursor-pointer"
                  >
                    <FileText size={18} className="text-rose-500 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold truncate text-foreground" title={activeDoc.fileName}>
                        {activeDoc.fileName}
                      </p>
                      <p className="text-[9px] text-muted-foreground uppercase mt-0.5">
                        {activeDoc.fileName.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? "IMAGE ASSET" : "DOCUMENT FILE"}
                      </p>
                    </div>
                  </a>
                </div>

                <div className="grid grid-cols-2 gap-4 border-t border-border/40 pt-3">
                  <div>
                    <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">UPLOADED ON</label>
                    <p className="text-xs font-semibold text-foreground mt-0.5">{activeDoc.uploadedOn}</p>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">SUBMITTED BY</label>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-[9px] font-bold text-primary shrink-0">
                        {getInitials(profile.userName)}
                      </div>
                      <span className="text-xs font-semibold text-foreground truncate">{profile.userName}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Submitter Comment Card */}
            <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-3xs flex flex-col gap-3">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest border-b pb-2 flex items-center gap-1.5">
                <MessageSquare size={13} /> SUBMITTER COMMENT
              </h3>
              <div className="bg-muted/30 border p-3 rounded-xl text-xs text-muted-foreground leading-relaxed italic min-h-[50px]">
                {activeDoc.comment || profile.comment || "No commentary was submitted with this file."}
              </div>
            </div>

            {/* Manager Notes Card */}
            <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-3xs flex flex-col gap-3">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                  <MessageSquare size={13} /> MANAGER NOTES
                </h3>
                {isManager && (
                  <button
                    type="button"
                    onClick={handleSaveNotes}
                    disabled={isSavingNotes}
                    className="rounded-lg bg-primary px-3 py-1 text-[10px] font-bold text-primary-foreground hover:bg-primary/95 disabled:opacity-50 transition-all cursor-pointer shadow-2xs"
                  >
                    {isSavingNotes ? "Saving..." : "Save Notes"}
                  </button>
                )}
              </div>

              {isManager ? (
                <textarea
                  value={editingNotes}
                  onChange={(e) => setEditingNotes(e.target.value)}
                  placeholder="Add assessment notes, requested changes, or approval remarks..."
                  className="w-full rounded-xl border bg-background p-3 text-xs outline-none focus:border-primary placeholder:text-muted-foreground/50 min-h-[100px] resize-none text-foreground leading-relaxed"
                />
              ) : (
                <div className="bg-muted/20 border p-3 rounded-xl text-xs text-muted-foreground italic leading-relaxed">
                  {profile.managerNotes || "No manager notes recorded yet."}
                </div>
              )}
            </div>

          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-background p-6">

      {/* ── Main Top Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4 pb-5 mb-5 border-b border-border/40">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Iceberg Competency Attributes</h1>
          {isManager ? (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-muted-foreground font-semibold">Member Profile:</span>
              <select
                value={selectedUserId}
                onChange={(e) => handleUserChange(e.target.value)}
                className="rounded-lg border bg-card px-3 py-1 text-xs font-bold text-foreground outline-none cursor-pointer hover:bg-accent/40 transition-colors shadow-2xs"
              >
                {dbUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} · {u.title} {u.id === currentUser.id ? " (You)" : ""}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">
              {profile.userName} &bull; {profile.title} &bull; Submitted {profile.submittedDate}
            </p>
          )}
        </div>

        {/* Legend status indicators */}
        <div className="flex items-center gap-4 text-xs font-medium select-none text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Matched
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-neutral-400" />
            Extra
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            Missing
          </span>
        </div>
      </div>

      {/* ── Split Layout Workspace ── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

        {/* Left Main Column (8 Columns) */}
        <div className="xl:col-span-8 flex flex-col gap-6">

          {/* Stats Bar */}
          <div className="bg-card border border-border/80 rounded-2xl p-4 shadow-3xs flex items-center justify-between">
            <div className="border-l-4 border-primary pl-3 py-0.5">
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest leading-none">OVERALL</p>
              <p className="text-xl font-bold text-foreground mt-0.5">Attributes</p>
            </div>
            <div className="text-center px-4">
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest leading-none">SKILLS</p>
              <p className="text-lg font-bold text-foreground mt-1">{counts.skills}</p>
            </div>
            <div className="text-center px-4">
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest leading-none">KNOWLEDGE</p>
              <p className="text-lg font-bold text-foreground mt-1">{counts.knowledge}</p>
            </div>
            <div className="text-center px-4">
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest leading-none">SELF-IMAGE</p>
              <p className="text-lg font-bold text-foreground mt-1">{counts.selfImage}</p>
            </div>
            <div className="text-center px-4">
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest leading-none">TRAITS</p>
              <p className="text-lg font-bold text-foreground mt-1">{counts.traits}</p>
            </div>
            <div className="text-center px-4">
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest leading-none">MOTIVES</p>
              <p className="text-lg font-bold text-foreground mt-1">{counts.motives}</p>
            </div>
          </div>

          {/* ABOVE THE WATERLINE Card */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-primary uppercase tracking-wider">
              <Eye size={15} /> ABOVE THE WATERLINE
            </div>

            <div className="bg-muted/15 border border-border/70 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Skills */}
              <div className="bg-card border border-border/60 rounded-xl p-4 flex flex-col justify-between min-h-[160px] shadow-3xs">
                <div>
                  <h3 className="text-xs font-bold text-foreground text-center border-b pb-2 mb-3">Skills</h3>
                  <div className="flex flex-wrap gap-2">
                    {profile.skills.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => toggleAttributeStatus("skills", item)}
                        className="group inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-3 py-1 text-xs font-medium border border-emerald-500/20 shadow-3xs hover:bg-emerald-500/20 cursor-pointer transition-all select-none"
                      >
                        <AttributeStatusIcon status={item.status} />
                        <span>{item.name}</span>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); deleteAttributeHandler("skills", item); }}
                          className="opacity-0 group-hover:opacity-100 text-emerald-800 dark:text-emerald-300 hover:text-rose-600 transition-opacity ml-1"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-4 pt-2 border-t border-border/40">
                  <input
                    type="text"
                    placeholder="+ Add another skill..."
                    value={newSkillInput}
                    onChange={(e) => setNewSkillInput(e.target.value)}
                    onKeyDown={handleAddSkill}
                    className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground/60 text-foreground italic"
                  />
                </div>
              </div>

              {/* Knowledge */}
              <div className="bg-card border border-border/60 rounded-xl p-4 flex flex-col justify-between min-h-[160px] shadow-3xs">
                <div>
                  <h3 className="text-xs font-bold text-foreground text-center border-b pb-2 mb-3">Knowledge</h3>
                  <div className="flex flex-wrap gap-2">
                    {profile.knowledge.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => toggleAttributeStatus("knowledge", item)}
                        className="group inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-3 py-1 text-xs font-medium border border-emerald-500/20 shadow-3xs hover:bg-emerald-500/20 cursor-pointer transition-all select-none"
                      >
                        <AttributeStatusIcon status={item.status} />
                        <span>{item.name}</span>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); deleteAttributeHandler("knowledge", item); }}
                          className="opacity-0 group-hover:opacity-100 text-emerald-800 dark:text-emerald-300 hover:text-rose-600 transition-opacity ml-1"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-4 pt-2 border-t border-border/40">
                  <input
                    type="text"
                    placeholder="+ Add another knowledge..."
                    value={newKnowledgeInput}
                    onChange={(e) => setNewKnowledgeInput(e.target.value)}
                    onKeyDown={handleAddKnowledge}
                    className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground/60 text-foreground italic"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Waterline Divider */}
          <div className="relative flex items-center justify-center my-1 select-none">
            <div className="w-full border-t-2 border-dashed border-primary/40" />
            <span className="absolute bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest px-4 py-1 rounded-full shadow-xs">
              WATERLINE
            </span>
          </div>

          {/* BELOW THE WATERLINE Card */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">
              <EyeOff size={15} /> BELOW THE WATERLINE
            </div>

            <div className="bg-muted/15 border border-border/70 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Self-image */}
              <div className="bg-card border border-border/60 rounded-xl p-4 flex flex-col justify-between min-h-[160px] shadow-3xs">
                <div>
                  <h3 className="text-xs font-bold text-foreground text-center border-b pb-2 mb-3">Self-image</h3>
                  <div className="flex flex-wrap gap-2">
                    {profile.selfImage.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => toggleAttributeStatus("selfImage", item)}
                        className="group inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-3 py-1 text-xs font-medium border border-emerald-500/20 shadow-3xs hover:bg-emerald-500/20 cursor-pointer transition-all select-none"
                      >
                        <AttributeStatusIcon status={item.status} />
                        <span>{item.name}</span>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); deleteAttributeHandler("selfImage", item); }}
                          className="opacity-0 group-hover:opacity-100 text-emerald-800 dark:text-emerald-300 hover:text-rose-600 transition-opacity ml-1"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-4 pt-2 border-t border-border/40">
                  <input
                    type="text"
                    placeholder="+ Add another self-image..."
                    value={newSelfImageInput}
                    onChange={(e) => setNewSelfImageInput(e.target.value)}
                    onKeyDown={handleAddSelfImage}
                    className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground/60 text-foreground italic"
                  />
                </div>
              </div>

              {/* Traits */}
              <div className="bg-card border border-border/60 rounded-xl p-4 flex flex-col justify-between min-h-[160px] shadow-3xs">
                <div>
                  <h3 className="text-xs font-bold text-foreground text-center border-b pb-2 mb-3">Traits</h3>
                  <div className="flex flex-wrap gap-2">
                    {profile.traits.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => toggleAttributeStatus("traits", item)}
                        className="group inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-3 py-1 text-xs font-medium border border-emerald-500/20 shadow-3xs hover:bg-emerald-500/20 cursor-pointer transition-all select-none"
                      >
                        <AttributeStatusIcon status={item.status} />
                        <span>{item.name}</span>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); deleteAttributeHandler("traits", item); }}
                          className="opacity-0 group-hover:opacity-100 text-emerald-800 dark:text-emerald-300 hover:text-rose-600 transition-opacity ml-1"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-4 pt-2 border-t border-border/40">
                  <input
                    type="text"
                    placeholder="+ Add another trait..."
                    value={newTraitInput}
                    onChange={(e) => setNewTraitInput(e.target.value)}
                    onKeyDown={handleAddTrait}
                    className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground/60 text-foreground italic"
                  />
                </div>
              </div>

              {/* Motives */}
              <div className="bg-card border border-border/60 rounded-xl p-4 flex flex-col justify-between min-h-[160px] shadow-3xs">
                <div>
                  <h3 className="text-xs font-bold text-foreground text-center border-b pb-2 mb-3">Motives</h3>
                  <div className="flex flex-wrap gap-2">
                    {profile.motives.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => toggleAttributeStatus("motives", item)}
                        className="group inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-3 py-1 text-xs font-medium border border-emerald-500/20 shadow-3xs hover:bg-emerald-500/20 cursor-pointer transition-all select-none"
                      >
                        <AttributeStatusIcon status={item.status} />
                        <span>{item.name}</span>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); deleteAttributeHandler("motives", item); }}
                          className="opacity-0 group-hover:opacity-100 text-emerald-800 dark:text-emerald-300 hover:text-rose-600 transition-opacity ml-1"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-4 pt-2 border-t border-border/40">
                  <input
                    type="text"
                    placeholder="+ Add another motive..."
                    value={newMotiveInput}
                    onChange={(e) => setNewMotiveInput(e.target.value)}
                    onKeyDown={handleAddMotive}
                    className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground/60 text-foreground italic"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Manager Notes Card */}
          <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-3xs flex flex-col gap-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <MessageSquare size={16} className="text-primary" /> Manager notes
              </h3>
            </div>

            {profile.managerNotes && (
              <div className="bg-muted/20 border border-border/60 rounded-xl p-4 text-xs text-muted-foreground leading-relaxed italic relative">
                &quot;{profile.managerNotes}&quot;
                <span className="block text-[10px] font-semibold text-right text-muted-foreground/80 mt-2 not-italic">
                  -Reporting Manager
                </span>
              </div>
            )}

            {isManager && (
              <div className="flex flex-col gap-3">
                <textarea
                  value={editingNotes}
                  onChange={(e) => setEditingNotes(e.target.value)}
                  placeholder={`Share coaching tips or observations for ${profile.userName.split(" ")[0]}'s next 1-on-1...`}
                  className="w-full rounded-xl border bg-background p-3.5 text-xs outline-none focus:border-primary placeholder:text-muted-foreground/50 min-h-[90px] text-foreground"
                />
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground italic">Writing as Admin</span>
                  <button
                    type="button"
                    onClick={handleSaveNotes}
                    disabled={isSavingNotes}
                    className="rounded-xl bg-primary px-5 py-2 text-xs font-bold text-primary-foreground shadow-xs hover:bg-primary/95 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    {isSavingNotes ? "Saving..." : "Save note"}
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Right Sidebar Column (4 Columns) */}
        <div className="xl:col-span-4 flex flex-col gap-6">

          {/* Iceberg Graphic Illustration Card */}
          <IcebergGraphic />

          {/* Explanation Card */}
          <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-3xs flex flex-col gap-3">
            <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
              <span className="text-muted-foreground">≡</span> What is Iceberg Competency Attributes?
            </h3>
            <div className="bg-muted/20 border border-border/50 rounded-xl p-4 space-y-3 text-xs text-muted-foreground leading-relaxed">
              <p className="italic font-medium text-muted-foreground/90">
                Balanced competencies unlock exceptional career growth.
              </p>
              <ul className="space-y-2 list-disc pl-4">
                <li><strong className="text-foreground font-semibold">Skills:</strong> Practical abilities applied during everyday work.</li>
                <li><strong className="text-foreground font-semibold">Knowledge:</strong> Understanding required to perform effectively.</li>
                <li><strong className="text-foreground font-semibold">Self-image:</strong> How individuals perceive their professional identity.</li>
                <li><strong className="text-foreground font-semibold">Traits:</strong> Consistent behaviors shaping daily performance.</li>
                <li><strong className="text-foreground font-semibold">Motives:</strong> Internal drivers influencing actions and decisions.</li>
              </ul>
            </div>
          </div>

          {/* Submission Summary Card */}
          <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-3xs flex flex-col gap-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-bold text-foreground">
                Submission Summary
              </h3>
              {activeDoc ? (
                <button
                  type="button"
                  onClick={() => setIsViewingDoc(true)}
                  className="text-xs font-bold text-primary hover:bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/20 flex items-center gap-1.5 cursor-pointer transition-all shadow-3xs"
                >
                  <Eye size={14} /> View Document
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowUploadModal(true)}
                  className="text-xs font-bold text-primary hover:bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/20 flex items-center gap-1.5 cursor-pointer transition-all shadow-3xs"
                >
                  <UploadCloud size={14} /> Upload file
                </button>
              )}
            </div>

            {/* Document Selector if multiple documents exist */}
            {profile.documents && profile.documents.length > 1 && (
              <div className="flex items-center justify-between bg-muted/30 px-3 py-2 rounded-xl border border-border/60">
                <span className="text-[11px] font-semibold text-muted-foreground">Select File ({profile.documents.length}):</span>
                <select
                  value={activeDoc?.id || ""}
                  onChange={(e) => setSelectedDocId(e.target.value)}
                  className="rounded-lg border bg-background px-2.5 py-1 text-xs font-bold text-foreground outline-none cursor-pointer"
                >
                  {profile.documents.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.fileName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Fields Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">TASK NAME</label>
                <p className="text-xs font-bold text-foreground mt-0.5">ICA</p>
              </div>
              <div>
                <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block">FILE</label>
                {activeDoc ? (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <button
                      type="button"
                      onClick={() => setIsViewingDoc(true)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline truncate max-w-[140px] cursor-pointer"
                      title="Click to view detail preview"
                    >
                      <FileText size={14} className="text-rose-500 shrink-0" />
                      <span className="truncate">{activeDoc.fileName}</span>
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (confirm(`Delete "${activeDoc.fileName}"?`)) {
                          await deleteIcaFileAction(activeDoc.id);
                          const data = await getIcaProfile(selectedUserId);
                          setProfile(data);
                        }
                      }}
                      className="text-muted-foreground hover:text-rose-600 transition-colors p-0.5 cursor-pointer"
                      title="Delete document"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowUploadModal(true)}
                    className="flex items-center gap-1.5 mt-0.5 text-xs font-bold text-primary hover:underline cursor-pointer"
                  >
                    <FileText size={14} className="text-rose-500 shrink-0" />
                    <span>Upload file</span>
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-border/40 pt-3">
              <div>
                <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">UPLOADED ON</label>
                <p className="text-xs font-bold text-foreground mt-0.5">
                  {activeDoc ? activeDoc.uploadedOn : profile.uploadedOn || "Not uploaded"}
                </p>
              </div>
              <div>
                <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">SUBMITTED BY</label>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-[9px] font-bold text-primary shrink-0">
                    {getInitials(profile.userName)}
                  </div>
                  <span className="text-xs font-bold text-foreground truncate">{profile.userName}</span>
                </div>
              </div>
            </div>

            {/* Comment Box */}
            {activeDoc?.comment ? (
              <div className="bg-muted/30 border border-border/60 rounded-xl p-3.5 text-xs text-muted-foreground leading-relaxed italic mt-1">
                <span className="font-bold text-foreground/90 uppercase tracking-wider text-[9px] not-italic block mb-1">
                  {profile.userName.split(" ")[0].toUpperCase()}&apos;s comment:
                </span>
                &quot;{activeDoc.comment}&quot;
              </div>
            ) : profile.comment ? (
              <div className="bg-muted/30 border border-border/60 rounded-xl p-3.5 text-xs text-muted-foreground leading-relaxed italic mt-1">
                <span className="font-bold text-foreground/90 uppercase tracking-wider text-[9px] not-italic block mb-1">
                  {profile.userName.split(" ")[0].toUpperCase()}&apos;s comment:
                </span>
                &quot;{profile.comment}&quot;
              </div>
            ) : null}

            {/* Add Document Action button */}
            <button
              type="button"
              onClick={() => setShowUploadModal(true)}
              className="mt-1 w-full flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-primary/40 bg-primary/5 py-2 text-xs font-bold text-primary hover:bg-primary/10 transition-colors cursor-pointer"
            >
              <UploadCloud size={14} /> + Upload Additional Document
            </button>
          </div>

        </div>

      </div>

      {/* ── UPLOAD FILE MODAL ── */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-card border w-full max-w-lg rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">

            <div className="flex items-center justify-between border-b px-5 py-4 bg-muted/20">
              <div>
                <h2 className="text-sm font-bold text-foreground">Submit Competency Alignment File</h2>
                <p className="text-[11px] text-muted-foreground">Upload supporting document for {profile.userName}</p>
              </div>
              <button
                onClick={() => { setShowUploadModal(false); setUploadedFile(null); }}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="p-5 flex flex-col gap-4">

              {/* File Dropzone */}
              {!uploadedFile ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-border hover:border-primary/50 rounded-xl p-8 flex flex-col items-center justify-center gap-2 cursor-pointer bg-background/50 hover:bg-accent/10 transition-all text-center"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg"
                  />
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                    <UploadCloud size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">
                      Drag & drop your file here or <span className="text-primary hover:underline">click to browse</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Supported formats: PDF, DOCX, XLSX, PNG, JPG (Max size: 10MB)
                    </p>
                  </div>
                </div>
              ) : (
                <div className="border rounded-xl p-3 flex flex-col gap-2.5 bg-background">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <FileText size={18} className="text-rose-500" />
                      <div>
                        <p className="text-xs font-bold">{uploadedFile.name}</p>
                        <p className="text-[10px] text-muted-foreground">{uploadedFile.size}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setUploadedFile(null)}
                      className="text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <div className="w-full bg-muted h-1 rounded-full overflow-hidden">
                    <div className="bg-primary h-full w-[100%] rounded-full animate-all duration-500" />
                  </div>
                </div>
              )}

              {/* Comment text area */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Comment / Remarks</label>
                <textarea
                  placeholder="Provide supporting remarks regarding this competency alignment sheet..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="w-full rounded-xl border bg-background px-3 py-2 text-xs outline-none focus:border-primary placeholder:text-muted-foreground/50 h-20 resize-none text-foreground"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 border-t pt-4 bg-card">
                <button
                  type="button"
                  onClick={() => { setShowUploadModal(false); setUploadedFile(null); }}
                  className="rounded-lg px-4 py-2 text-xs font-bold hover:bg-accent text-muted-foreground transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!uploadedFile}
                  className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/95 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  Upload File
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}
