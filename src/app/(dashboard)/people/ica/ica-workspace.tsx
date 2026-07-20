"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import {
  Plus,
  FileText,
  UploadCloud,
  X,
  MessageSquare,
  Brain,
  Layers,
  TrendingUp,
  Compass,
  ClipboardSignature,
  Check
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getIcaProfile,
  saveCoachingNotes,
  uploadIcaFileAction,
  createAttribute,
  updateAttributeStatus,
  deleteAttribute,
  IcaProfileData,
  IcaItem
} from "./actions";

type MatchStatus = "Matched" | "Extra" | "Missing";

function AttributeStatusIcon({ status }: { status: MatchStatus }) {
  if (status === "Matched") {
    return <Check size={11} strokeWidth={3} className="text-emerald-600 shrink-0 animate-in zoom-in-50 duration-200" />;
  }
  return (
    <span className={cn(
      "h-1 w-1 rounded-full shrink-0",
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

export default function IcaWorkspace({ currentUser, dbUsers }: IcaWorkspaceProps) {
  const isManager = currentUser.role === "MANAGER";

  // Active selected user ID state
  const [selectedUserId, setSelectedUserId] = useState(() => {
    if (isManager) {
      return dbUsers[0]?.id ?? "";
    }
    return currentUser.id;
  });

  // DB Profile and loading states
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<IcaProfileData | null>(null);

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

    // Cycle Match Status: Matched -> Extra -> Missing -> Matched
    let nextStatus: MatchStatus = "Matched";
    if (item.status === "Matched") nextStatus = "Extra";
    else if (item.status === "Extra") nextStatus = "Missing";

    // Optimistically update UI state
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
      // Revert in case of backend failure
      const data = await getIcaProfile(selectedUserId);
      setProfile(data);
    }
  };

  // Delete attribute
  const deleteAttributeHandler = async (category: "skills" | "knowledge" | "selfImage" | "traits" | "motives", item: IcaItem) => {
    if (!profile) return;

    // Optimistically update UI state
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
      // Revert in case of failure
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

  // Inline inputs keyboard listeners
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

  // Dynamic stats calculator
  const counts = useMemo(() => {
    if (!profile) return { skills: "0/0", knowledge: "0/0", selfImage: "0/0", traits: "0/0", motives: "0/0", overall: 0 };

    const skillsTotal = profile.skills.length;
    const knowledgeTotal = profile.knowledge.length;
    const selfImageTotal = profile.selfImage.length;
    const traitsTotal = profile.traits.length;
    const motivesTotal = profile.motives.length;

    const skillsMatched = profile.skills.filter((i) => i.status === "Matched").length;
    const knowledgeMatched = profile.knowledge.filter((i) => i.status === "Matched").length;
    const selfImageMatched = profile.selfImage.filter((i) => i.status === "Matched").length;
    const traitsMatched = profile.traits.filter((i) => i.status === "Matched").length;
    const motivesMatched = profile.motives.filter((i) => i.status === "Matched").length;

    return {
      skills: `${skillsMatched}/${skillsTotal}`,
      knowledge: `${knowledgeMatched}/${knowledgeTotal}`,
      selfImage: `${selfImageMatched}/${selfImageTotal}`,
      traits: `${traitsMatched}/${traitsTotal}`,
      motives: `${motivesMatched}/${motivesTotal}`,
      overall: skillsMatched + knowledgeMatched + selfImageMatched + traitsMatched + motivesMatched,
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
      setShowUploadModal(false);
      setNewComment("");
      setUploadedFile(null);
    } catch (err) {
      console.error("[ICA] Failed to upload alignment file", err);
    }
  };

  if (loading || !profile) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-2 select-none">
          <Brain size={32} className="text-primary animate-pulse" />
          <p className="text-xs text-muted-foreground font-semibold">Loading Competency Profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-background p-6">

      {/* ── Main Top Bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-5 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Iceberg Competency Attributes</h1>
          {isManager ? (
            /* Manager User Selector */
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-muted-foreground font-semibold">Select Member:</span>
              <select
                value={selectedUserId}
                onChange={(e) => handleUserChange(e.target.value)}
                className="rounded-lg border bg-background px-3 py-1 text-xs font-bold text-foreground outline-none cursor-pointer hover:bg-accent/40 transition-colors"
              >
                {dbUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.title})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            /* Team Member Sub-Info */
            <p className="text-xs text-muted-foreground mt-1">
              {profile.userName} &bull; {profile.title} &bull; Submitted {profile.submittedDate}
            </p>
          )}
        </div>

        {/* Legend status indicators */}
        <div className="flex items-center gap-3.5 bg-card/60 border rounded-full px-4 py-1.5 text-[10px] font-bold select-none text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Matched
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-neutral-400" />
            Extra
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            Missing
          </span>
        </div>
      </div>

      {/* ── Split Layout Workspace ── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

        {/* Left Side (8 Columns) - Attribute Grid and notes */}
        <div className="xl:col-span-8 flex flex-col gap-6">

          {/* Stats Bar */}
          <div className="bg-card border rounded-2xl p-4 shadow-3xs grid grid-cols-5 gap-2 text-center transition-all duration-300 hover:shadow-2xs">
            <div className="border-r border-border/40 py-1">
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest leading-none">Overall</p>
              <p className="text-lg font-extrabold text-primary mt-1">{counts.overall}</p>
              <p className="text-[8px] text-muted-foreground/60 font-semibold mt-0.5">Attributes</p>
            </div>
            <div className="border-r border-border/40 py-1">
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest leading-none">Skills</p>
              <p className="text-lg font-extrabold text-foreground mt-1">{counts.skills}</p>
              <p className="text-[8px] text-muted-foreground/60 font-semibold mt-0.5">Matched</p>
            </div>
            <div className="border-r border-border/40 py-1">
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest leading-none">Knowledge</p>
              <p className="text-lg font-extrabold text-foreground mt-1">{counts.knowledge}</p>
              <p className="text-[8px] text-muted-foreground/60 font-semibold mt-0.5">Matched</p>
            </div>
            <div className="border-r border-border/40 py-1">
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest leading-none">Self-Image</p>
              <p className="text-lg font-extrabold text-foreground mt-1">{counts.selfImage}</p>
              <p className="text-[8px] text-muted-foreground/60 font-semibold mt-0.5">Matched</p>
            </div>
            <div className="py-1">
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest leading-none">Traits/Motives</p>
              <p className="text-lg font-extrabold text-foreground mt-1">
                {profile.traits.filter(i => i.status === "Matched").length + profile.motives.filter(i => i.status === "Matched").length}
              </p>
              <p className="text-[8px] text-muted-foreground/60 font-semibold mt-0.5">Matched</p>
            </div>
          </div>

          {/* Iceberg Category Cards */}
          <div className="bg-card/40 border rounded-3xl p-5 shadow-3xs flex flex-col gap-6">

            {/* ABOVE THE WATERLINE */}
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-primary flex items-center gap-1.5 mb-3 px-1 select-none">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                Above the Waterline
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Skills Card */}
                <div className="bg-background border rounded-2xl p-4 shadow-3xs border-border/80 hover:border-border hover:shadow-2xs transition-all duration-300">
                  <h3 className="text-xs font-bold text-foreground mb-3 flex items-center justify-between border-b pb-2">
                    <span>Skills</span>
                    <span className="text-[10px] text-muted-foreground">Practical Abilities</span>
                  </h3>
                  <div className="flex flex-wrap gap-1.5 min-h-[60px] content-start">
                    {profile.skills.map((skill) => (
                      <span
                        key={skill.name}
                        onClick={() => toggleAttributeStatus("skills", skill)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold border cursor-pointer select-none transition-all group relative",
                          skill.status === "Matched" && "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/15",
                          skill.status === "Extra" && "bg-neutral-100 text-neutral-600 border-neutral-200 hover:bg-neutral-200/50",
                          skill.status === "Missing" && "bg-rose-500/10 text-rose-600 border-rose-500/20 hover:bg-rose-500/15"
                        )}
                        title="Click to cycle status"
                      >
                        <AttributeStatusIcon status={skill.status} />
                        <span>{skill.name}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteAttributeHandler("skills", skill); }}
                          className="ml-0.5 opacity-40 hover:opacity-100 shrink-0 select-none cursor-pointer"
                        >
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                  {/* Inline Add input */}
                  <div className="mt-4 flex items-center gap-1.5 border-t border-dashed pt-3">
                    <Plus size={12} className="text-muted-foreground/60 shrink-0" />
                    <input
                      type="text"
                      placeholder="Add another skill... (Enter)"
                      value={newSkillInput}
                      onChange={(e) => setNewSkillInput(e.target.value)}
                      onKeyDown={handleAddSkill}
                      className="flex-1 bg-transparent text-[11px] outline-none placeholder:text-muted-foreground/50 text-foreground"
                    />
                  </div>
                </div>

                {/* Knowledge Card */}
                <div className="bg-background border rounded-2xl p-4 shadow-3xs border-border/80 hover:border-border hover:shadow-2xs transition-all duration-300">
                  <h3 className="text-xs font-bold text-foreground mb-3 flex items-center justify-between border-b pb-2">
                    <span>Knowledge</span>
                    <span className="text-[10px] text-muted-foreground">Understanding</span>
                  </h3>
                  <div className="flex flex-wrap gap-1.5 min-h-[60px] content-start">
                    {profile.knowledge.map((item) => (
                      <span
                        key={item.name}
                        onClick={() => toggleAttributeStatus("knowledge", item)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold border cursor-pointer select-none transition-all group relative",
                          item.status === "Matched" && "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/15",
                          item.status === "Extra" && "bg-neutral-100 text-neutral-600 border-neutral-200 hover:bg-neutral-200/50",
                          item.status === "Missing" && "bg-rose-500/10 text-rose-600 border-rose-500/20 hover:bg-rose-500/15"
                        )}
                        title="Click to cycle status"
                      >
                        <AttributeStatusIcon status={item.status} />
                        <span>{item.name}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteAttributeHandler("knowledge", item); }}
                          className="ml-0.5 opacity-40 hover:opacity-100 shrink-0 cursor-pointer"
                        >
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                  {/* Inline Add input */}
                  <div className="mt-4 flex items-center gap-1.5 border-t border-dashed pt-3">
                    <Plus size={12} className="text-muted-foreground/60 shrink-0" />
                    <input
                      type="text"
                      placeholder="Add another knowledge... (Enter)"
                      value={newKnowledgeInput}
                      onChange={(e) => setNewKnowledgeInput(e.target.value)}
                      onKeyDown={handleAddKnowledge}
                      className="flex-1 bg-transparent text-[11px] outline-none placeholder:text-muted-foreground/50 text-foreground"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* WATERLINE DIVIDER */}
            <div className="relative py-2 select-none">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-dashed border-sky-400/40" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-sky-500 text-white rounded-full px-4 py-0.5 text-[8px] font-extrabold uppercase tracking-widest shadow-xs">
                  Waterline
                </span>
              </div>
            </div>

            {/* BELOW THE WATERLINE */}
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-sky-600 flex items-center gap-1.5 mb-3 px-1 select-none">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                Below the Waterline
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                {/* Self-Image Card */}
                <div className="bg-background border rounded-2xl p-4 shadow-3xs border-border/80 hover:border-border hover:shadow-2xs transition-all duration-300">
                  <h3 className="text-xs font-bold text-foreground mb-3 flex items-center justify-between border-b pb-2">
                    <span>Self-Image</span>
                  </h3>
                  <div className="flex flex-wrap gap-1.5 min-h-[50px] content-start">
                    {profile.selfImage.map((item) => (
                      <span
                        key={item.name}
                        onClick={() => toggleAttributeStatus("selfImage", item)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold border cursor-pointer select-none transition-all group relative",
                          item.status === "Matched" && "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/15",
                          item.status === "Extra" && "bg-neutral-100 text-neutral-600 border-neutral-200 hover:bg-neutral-200/50",
                          item.status === "Missing" && "bg-rose-500/10 text-rose-600 border-rose-500/20 hover:bg-rose-500/15"
                        )}
                        title="Click to cycle status"
                      >
                        <AttributeStatusIcon status={item.status} />
                        <span>{item.name}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteAttributeHandler("selfImage", item); }}
                          className="ml-0.5 opacity-40 hover:opacity-100 shrink-0 cursor-pointer"
                        >
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center gap-1.5 border-t border-dashed pt-3">
                    <Plus size={12} className="text-muted-foreground/60 shrink-0" />
                    <input
                      type="text"
                      placeholder="Add self-image... (Enter)"
                      value={newSelfImageInput}
                      onChange={(e) => setNewSelfImageInput(e.target.value)}
                      onKeyDown={handleAddSelfImage}
                      className="flex-1 bg-transparent text-[11px] outline-none placeholder:text-muted-foreground/50 text-foreground"
                    />
                  </div>
                </div>

                {/* Traits Card */}
                <div className="bg-background border rounded-2xl p-4 shadow-3xs border-border/80 hover:border-border hover:shadow-2xs transition-all duration-300">
                  <h3 className="text-xs font-bold text-foreground mb-3 flex items-center justify-between border-b pb-2">
                    <span>Traits</span>
                  </h3>
                  <div className="flex flex-wrap gap-1.5 min-h-[50px] content-start">
                    {profile.traits.map((item) => (
                      <span
                        key={item.name}
                        onClick={() => toggleAttributeStatus("traits", item)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold border cursor-pointer select-none transition-all group relative",
                          item.status === "Matched" && "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/15",
                          item.status === "Extra" && "bg-neutral-100 text-neutral-600 border-neutral-200 hover:bg-neutral-200/50",
                          item.status === "Missing" && "bg-rose-500/10 text-rose-600 border-rose-500/20 hover:bg-rose-500/15"
                        )}
                        title="Click to cycle status"
                      >
                        <AttributeStatusIcon status={item.status} />
                        <span>{item.name}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteAttributeHandler("traits", item); }}
                          className="ml-0.5 opacity-40 hover:opacity-100 shrink-0 cursor-pointer"
                        >
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center gap-1.5 border-t border-dashed pt-3">
                    <Plus size={12} className="text-muted-foreground/60 shrink-0" />
                    <input
                      type="text"
                      placeholder="Add trait... (Enter)"
                      value={newTraitInput}
                      onChange={(e) => setNewTraitInput(e.target.value)}
                      onKeyDown={handleAddTrait}
                      className="flex-1 bg-transparent text-[11px] outline-none placeholder:text-muted-foreground/50 text-foreground"
                    />
                  </div>
                </div>

                {/* Motives Card */}
                <div className="bg-background border rounded-2xl p-4 shadow-3xs border-border/80 hover:border-border hover:shadow-2xs transition-all duration-300">
                  <h3 className="text-xs font-bold text-foreground mb-3 flex items-center justify-between border-b pb-2">
                    <span>Motives</span>
                  </h3>
                  <div className="flex flex-wrap gap-1.5 min-h-[50px] content-start">
                    {profile.motives.map((item) => (
                      <span
                        key={item.name}
                        onClick={() => toggleAttributeStatus("motives", item)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold border cursor-pointer select-none transition-all group relative",
                          item.status === "Matched" && "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/15",
                          item.status === "Extra" && "bg-neutral-100 text-neutral-600 border-neutral-200 hover:bg-neutral-200/50",
                          item.status === "Missing" && "bg-rose-500/10 text-rose-600 border-rose-500/20 hover:bg-rose-500/15"
                        )}
                        title="Click to cycle status"
                      >
                        <AttributeStatusIcon status={item.status} />
                        <span>{item.name}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteAttributeHandler("motives", item); }}
                          className="ml-0.5 opacity-40 hover:opacity-100 shrink-0 cursor-pointer"
                        >
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center gap-1.5 border-t border-dashed pt-3">
                    <Plus size={12} className="text-muted-foreground/60 shrink-0" />
                    <input
                      type="text"
                      placeholder="Add motive... (Enter)"
                      value={newMotiveInput}
                      onChange={(e) => setNewMotiveInput(e.target.value)}
                      onKeyDown={handleAddMotive}
                      className="flex-1 bg-transparent text-[11px] outline-none placeholder:text-muted-foreground/50 text-foreground"
                    />
                  </div>
                </div>

              </div>
            </div>

          </div>

          {/* Manager Notes Card */}
          <div className="bg-card border rounded-2xl p-5 shadow-3xs flex flex-col gap-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-xs font-bold text-foreground uppercase tracking-widest text-muted-foreground/75 flex items-center gap-1.5">
                <ClipboardSignature size={13} />
                Manager notes
              </h3>
              {isManager && (
                <button
                  type="button"
                  onClick={handleSaveNotes}
                  disabled={isSavingNotes || editingNotes === (profile.managerNotes || "")}
                  className="rounded-lg bg-primary px-3 py-1.5 text-[10px] font-bold text-primary-foreground hover:bg-primary/95 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer shadow-3xs"
                >
                  {isSavingNotes ? "Saving..." : "Save note"}
                </button>
              )}
            </div>

            {/* Existing Note Box */}
            <div className="bg-muted/30 border p-3 rounded-xl text-xs text-muted-foreground leading-relaxed">
              {profile.managerNotes ? (
                <div>
                  <p className="font-semibold text-foreground/80 mb-1">Coaching tips & observations:</p>
                  <p>{profile.managerNotes}</p>
                </div>
              ) : (
                <p className="italic">No coaching feedback or notes have been left for this profile yet.</p>
              )}
              <span className="block text-[8px] font-bold uppercase tracking-wider text-muted-foreground/50 text-right mt-1.5">-Reporting Manager</span>
            </div>

            {/* Editable input (Manager only) */}
            {isManager && (
              <div className="flex flex-col gap-1.5 mt-2">
                <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                  Update observations for {profile.userName}
                </label>
                <textarea
                  placeholder="Share coaching tips or observations for next 1-on-1 sessions..."
                  value={editingNotes}
                  onChange={(e) => setEditingNotes(e.target.value)}
                  className="w-full rounded-xl border bg-background px-3 py-2 text-xs outline-none focus:border-primary placeholder:text-muted-foreground/50 h-20 resize-none text-foreground leading-relaxed"
                />
                <span className="text-[9px] text-muted-foreground/60 italic">Writing as Admin</span>
              </div>
            )}
          </div>

        </div>

        {/* Right Side (4 Columns) - Iceberg Illustration and Info panels */}
        <div className="xl:col-span-4 flex flex-col gap-6">

          {/* Visual Iceberg Graphic Card */}
          <div className="bg-card border rounded-2xl overflow-hidden shadow-xs">
            <div className="relative w-full aspect-video md:aspect-[1.5/1] xl:aspect-[1.3/1] bg-sky-950 flex items-center justify-center overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/competency-iceberg.png"
                alt="Iceberg Diagram"
                className="w-full h-full object-cover opacity-80"
              />

              {/* Overlay Waterline divider label */}
              <div className="absolute inset-x-0 top-[35%] border-t border-sky-400/40 select-none pointer-events-none" />

              {/* Absolute coordinates Overlay Markers */}
              {/* Above Waterline */}
              <div className="absolute top-[8%] left-[20%] pointer-events-none">
                <span className="flex items-center gap-1 bg-emerald-500/90 text-white rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest shadow-md">
                  <Layers size={8} /> Skills
                </span>
              </div>
              <div className="absolute top-[12%] right-[15%] pointer-events-none">
                <span className="flex items-center gap-1 bg-emerald-500/90 text-white rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest shadow-md">
                  <Brain size={8} /> Knowledge
                </span>
              </div>

              {/* Below Waterline */}
              <div className="absolute top-[48%] left-[12%] pointer-events-none">
                <span className="flex items-center gap-1 bg-sky-600/90 text-white rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest shadow-md">
                  <Compass size={8} /> Self-Image
                </span>
              </div>
              <div className="absolute top-[68%] right-[14%] pointer-events-none">
                <span className="flex items-center gap-1 bg-sky-600/90 text-white rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest shadow-md">
                  <TrendingUp size={8} /> Motives
                </span>
              </div>
              <div className="absolute top-[80%] left-[22%] pointer-events-none">
                <span className="flex items-center gap-1 bg-sky-600/90 text-white rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest shadow-md">
                  <Layers size={8} /> Traits
                </span>
              </div>
            </div>
          </div>

          {/* Definition explanation panel */}
          <div className="bg-card border rounded-2xl p-5 shadow-3xs">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-widest text-muted-foreground/75 mb-3 flex items-center gap-1.5">
              <Brain size={14} className="text-primary" />
              What is Iceberg Competency Attributes?
            </h3>

            <p className="text-xs text-muted-foreground leading-relaxed mb-4">
              Balanced competencies unlock exceptional career growth. The model segments organizational capacity into visible attributes (above water) and behavioral drivers (below water).
            </p>

            <div className="space-y-3 font-sans text-xs">
              <div className="border-l-2 border-primary/40 pl-3">
                <span className="font-bold text-foreground block">Skills</span>
                <span className="text-muted-foreground text-[11px] leading-relaxed">Practical abilities applied during everyday work (e.g. Visual Design, Prototyping).</span>
              </div>
              <div className="border-l-2 border-primary/40 pl-3">
                <span className="font-bold text-foreground block">Knowledge</span>
                <span className="text-muted-foreground text-[11px] leading-relaxed">Cognitive understanding required to perform effectively (e.g. UX principles, Engineering theory).</span>
              </div>
              <div className="border-l-2 border-sky-500/40 pl-3">
                <span className="font-bold text-foreground block">Self-Image</span>
                <span className="text-muted-foreground text-[11px] leading-relaxed">How individuals perceive their professional identity and values (e.g. Problem solver, Mentor).</span>
              </div>
              <div className="border-l-2 border-sky-500/40 pl-3">
                <span className="font-bold text-foreground block">Traits</span>
                <span className="text-muted-foreground text-[11px] leading-relaxed">Consistent behaviors shaping work performance and teamwork (e.g. Empathetic, Detail-oriented).</span>
              </div>
              <div className="border-l-2 border-sky-500/40 pl-3">
                <span className="font-bold text-foreground block">Motives</span>
                <span className="text-muted-foreground text-[11px] leading-relaxed">Internal drivers and deep motivations influencing decisions (e.g. Craftsmanship, Innovation).</span>
              </div>
            </div>
          </div>

          {/* Submission Summary file details */}
          <div className="bg-card border rounded-2xl p-5 shadow-3xs">
            <div className="flex items-center justify-between border-b pb-2.5 mb-4">
              <h3 className="text-xs font-bold text-foreground uppercase tracking-widest text-muted-foreground/75">
                Submission Summary
              </h3>
              {!profile.fileName && (
                <button
                  type="button"
                  onClick={() => setShowUploadModal(true)}
                  className="text-[10px] font-bold text-primary hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  <UploadCloud size={12} /> Upload file
                </button>
              )}
            </div>

            {profile.fileName ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Task Name</label>
                    <p className="text-xs font-bold text-foreground mt-0.5">ICA Alignment</p>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">Submitted File</label>
                    <a
                      href={profile.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 mt-0.5 bg-accent/20 hover:bg-accent/40 px-2 py-1.5 border rounded-lg max-w-[170px] truncate transition-colors cursor-pointer"
                    >
                      <FileText size={13} className="text-rose-500 shrink-0" />
                      <span className="text-[11px] font-semibold truncate text-foreground" title={profile.fileName}>
                        {profile.fileName}
                      </span>
                    </a>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 border-t border-border/40 pt-3">
                  <div>
                    <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Uploaded On</label>
                    <p className="text-[10px] font-semibold text-foreground mt-0.5">{profile.uploadedOn}</p>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Submitted By</label>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className="flex h-4 w-4 items-center justify-center rounded-full bg-primary/10 text-[8px] font-bold text-primary">
                        {getInitials(profile.userName)}
                      </div>
                      <span className="text-[11px] font-semibold text-foreground truncate">{profile.userName}</span>
                    </div>
                  </div>
                </div>

                {profile.comment && (
                  <div className="border-t border-border/40 pt-3">
                    <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <MessageSquare size={10} /> Submitter Comment
                    </label>
                    <div className="bg-muted/30 p-2.5 rounded-lg border text-[11px] text-muted-foreground mt-1 leading-relaxed italic">
                      &quot;{profile.comment}&quot;
                    </div>
                  </div>
                )}

                {/* File Preview */}
                {profile.fileUrl && (
                  <div className="border-t border-border/40 pt-3">
                    <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">Document Preview</label>
                    {profile.fileName.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? (
                      <div className="relative aspect-video w-full bg-muted/10 border rounded-xl overflow-hidden shadow-2xs flex items-center justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={profile.fileUrl}
                          alt="Submitted Document"
                          className="max-w-full max-h-[140px] object-contain rounded-md"
                        />
                      </div>
                    ) : profile.fileName.toLowerCase().endsWith(".pdf") ? (
                      <div className="relative w-full h-[280px] bg-background border rounded-xl overflow-hidden shadow-2xs">
                        <iframe
                          src={profile.fileUrl}
                          className="w-full h-full border-none animate-in fade-in duration-300"
                        />
                      </div>
                    ) : (
                      <div className="bg-muted/20 border border-neutral-300 shadow-xs rounded-xl p-4 flex flex-col items-center justify-center text-center gap-1.5 min-h-[120px] select-none">
                        <FileText size={24} className="text-rose-500" />
                        <div>
                          <p className="text-[11px] font-bold text-foreground truncate max-w-[200px]">{profile.fileName}</p>
                          <p className="text-[9px] text-muted-foreground uppercase tracking-wider mt-0.5">Uploaded Alignment Sheet</p>
                        </div>
                        <a
                          href={profile.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-flex items-center gap-1 bg-primary/10 px-2.5 py-1 text-[9px] font-bold text-primary rounded-md hover:bg-primary/20 transition-all cursor-pointer"
                        >
                          View Full Document ↗
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="py-6 text-center border-2 border-dashed border-border rounded-xl text-xs text-muted-foreground leading-normal">
                <p>No alignment file has been uploaded for this profile yet.</p>
                <button
                  type="button"
                  onClick={() => setShowUploadModal(true)}
                  className="mt-2.5 inline-flex items-center gap-1 rounded-lg bg-primary/10 px-3 py-1.5 text-[10px] font-bold text-primary hover:bg-primary/20 transition-all cursor-pointer"
                >
                  <UploadCloud size={12} /> Submit RTD File
                </button>
              </div>
            )}
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
                <p className="text-[11px] text-muted-foreground">Upload the supporting document outlining your core competencies</p>
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
                    accept=".pdf,.docx,.xlsx"
                  />
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                    <UploadCloud size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">
                      Drag & drop your file here or <span className="text-primary hover:underline">click to browse</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Supported formats: PDF, DOCX, XLSX (Max size: 10MB)
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
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Comment</label>
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
                  Submit
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}
