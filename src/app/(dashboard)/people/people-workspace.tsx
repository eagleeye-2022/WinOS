"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { uploadRtdFileAction, getRtdDocumentsAction, saveRtdManagerNotesAction, type RTDDocument } from "./actions";
import {
  Plus,
  Search,
  FileText,
  UploadCloud,
  CheckCircle,
  X,
  FileCode,
  FileSpreadsheet,
  MessageSquare,
  User,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  ClipboardSignature,
  ExternalLink,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";

// Helper to render file icon based on extension
function FileIcon({ fileName, size = 16 }: { fileName: string; size?: number }) {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "pdf") {
    return <FileText size={size} className="text-rose-500 dark:text-rose-400" />;
  }
  if (ext === "xlsx" || ext === "xls") {
    return <FileSpreadsheet size={size} className="text-emerald-500 dark:text-emerald-400" />;
  }
  if (["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(ext || "")) {
    return <ImageIcon size={size} className="text-violet-500 dark:text-violet-400" />;
  }
  return <FileCode size={size} className="text-blue-500 dark:text-blue-400" />;
}


interface PeopleWorkspaceProps {
  currentUser: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

export default function PeopleWorkspace({ currentUser }: PeopleWorkspaceProps) {
  const isManager = currentUser.role === "MANAGER";

  const [documents, setDocuments] = useState<RTDDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load documents from database on mount or when dependencies change
  useEffect(() => {
    async function loadDocs() {
      try {
        setIsLoading(true);
        const docs = await getRtdDocumentsAction(currentUser.id, isManager);
        setDocuments(docs);
      } catch (e) {
        console.error("Failed to load RTD documents", e);
      } finally {
        setIsLoading(false);
      }
    }
    loadDocs();
  }, [currentUser.id, isManager]);

  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("Newest");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // View States
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [viewingDocId, setViewingDocId] = useState<string | null>(null);

  // Upload Form States
  const [newComment, setNewComment] = useState("");
  const [taskNameInput, setTaskNameInput] = useState("");
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: string; type: string; rawFile?: File } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manager Notes input state (for currently active document)
  const [editingManagerNotes, setEditingManagerNotes] = useState("");
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Active document data helper
  const activeDoc = useMemo(() => {
    return documents.find((doc) => doc.id === viewingDocId) || null;
  }, [documents, viewingDocId]);

  // Sync editing manager notes when viewing changes
  const handleSelectDoc = (docId: string) => {
    const doc = documents.find((d) => d.id === docId);
    if (doc) {
      setEditingManagerNotes(doc.managerNotes || "");
      setViewingDocId(docId);
    }
  };

  // Save Manager Notes function
  const handleSaveManagerNotes = async () => {
    if (!viewingDocId) return;
    setIsSavingNotes(true);
    try {
      await saveRtdManagerNotesAction(viewingDocId, editingManagerNotes);
      setDocuments((prevDocs) =>
        prevDocs.map((doc) =>
          doc.id === viewingDocId ? { ...doc, managerNotes: editingManagerNotes } : doc
        )
      );
    } catch (e) {
      console.error("Failed to save manager notes", e);
    } finally {
      setIsSavingNotes(false);
    }
  };

  // Filter based on roles and search
  const visibleAndFilteredDocs = useMemo(() => {
    return documents
      .filter((doc) => {
        // Role restrictions: Team members can ONLY see their own documents
        if (!isManager && doc.submittedBy.email !== currentUser.email) {
          return false;
        }
        
        // Search filter
        const matchesSearch = 
          doc.taskName.toLowerCase().includes(search.toLowerCase()) ||
          doc.fileName.toLowerCase().includes(search.toLowerCase()) ||
          doc.submittedBy.name.toLowerCase().includes(search.toLowerCase());
        
        return matchesSearch;
      })
      .sort((a, b) => {
        const timeA = new Date(a.uploadedOn).getTime();
        const timeB = new Date(b.uploadedOn).getTime();
        if (sortBy === "Newest") return timeB - timeA;
        return timeA - timeB;
      });
  }, [documents, search, sortBy, isManager, currentUser]);

  // Pagination logic
  const paginatedDocs = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return visibleAndFilteredDocs.slice(startIndex, startIndex + itemsPerPage);
  }, [visibleAndFilteredDocs, currentPage]);

  const totalPages = Math.ceil(visibleAndFilteredDocs.length / itemsPerPage) || 1;

  // Handle local file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const type = file.type.startsWith("image/") ? "image" : "document";
      setUploadedFile({
        name: file.name,
        size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        type,
        rawFile: file
      });
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadedFile || !uploadedFile.rawFile) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", uploadedFile.rawFile);
      formData.append("taskName", taskNameInput || "Untitled Task Document");
      if (newComment) formData.append("comment", newComment);

      // Upload file directly to server public/uploads directory and save to database
      await uploadRtdFileAction(currentUser.id, formData);

      // Reload fresh documents list from database
      const docs = await getRtdDocumentsAction(currentUser.id, isManager);
      setDocuments(docs);

      setShowUploadModal(false);
      setNewComment("");
      setTaskNameInput("");
      setUploadedFile(null);

      // Show success toast
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 4000);
    } catch (err) {
      console.error("[RTD] Upload failed", err);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-background p-6">
      
      {/* ── Main Workspace Switcher (List vs Detail Split-view) ── */}
      {!activeDoc ? (
        <div className="animate-in fade-in duration-200">
          {/* ── Main Header ── */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-5">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Role Task Documents</h1>
              <p className="text-xs text-muted-foreground mt-1">
                {isManager 
                  ? "View and review submitted role task documents from all team members" 
                  : "Track your uploaded role task documents and manager feedback"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/95 transition-all cursor-pointer"
            >
              <Plus size={14} />
              Upload New Document
            </button>
          </div>

          {/* ── Controls Filter Bar ── */}
          <div className="flex flex-wrap items-center justify-between gap-3 mt-6 bg-card/45 p-3 rounded-xl border">
            {/* Search */}
            <div className="flex w-full max-w-xs items-center gap-2 rounded-lg border bg-background px-3 py-1.5">
              <Search size={14} className="text-muted-foreground/75" />
              <input
                type="text"
                placeholder={isManager ? "Search by task, file, or team member..." : "Search by task or file..."}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/50 text-foreground"
              />
              {search && (
                <button onClick={() => setSearch("")} className="text-muted-foreground hover:text-foreground">
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Sorting */}
            <div className="flex items-center gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="rounded-lg border bg-background px-3 py-1.5 text-xs font-medium text-foreground outline-none cursor-pointer"
              >
                <option value="Newest">Sort Newest</option>
                <option value="Oldest">Sort Oldest</option>
              </select>
            </div>
          </div>

          {/* ── Documents Table List ── */}
          <div className="mt-4 overflow-hidden rounded-xl border bg-card shadow-3xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b bg-muted/40 text-xs font-bold uppercase tracking-wider text-muted-foreground/75">
                  <th className="px-6 py-3.5">Task & File</th>
                  <th className="px-6 py-3.5">Uploaded On</th>
                  <th className="px-6 py-3.5">Submitted By</th>
                  <th className="px-6 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y text-xs text-foreground">
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        <span>Loading documents...</span>
                      </div>
                    </td>
                  </tr>
                ) : paginatedDocs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">
                      No documents found matching the criteria.
                    </td>
                  </tr>
                ) : (
                  paginatedDocs.map((doc) => (
                    <tr key={doc.id} className="hover:bg-muted/15 transition-colors">
                      {/* Task & File */}
                      <td className="px-6 py-4">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 rounded-lg border bg-background p-1.5 shadow-3xs">
                            <FileIcon fileName={doc.fileName} size={16} />
                          </div>
                          <div>
                            <p 
                              className="font-bold text-foreground hover:underline cursor-pointer" 
                              onClick={() => handleSelectDoc(doc.id)}
                            >
                              {doc.taskName}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">{doc.fileName}</p>
                          </div>
                        </div>
                      </td>

                      {/* Upload Date */}
                      <td className="px-6 py-4 text-muted-foreground font-medium">
                        {doc.uploadedOn}
                      </td>

                      {/* Submitted By */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                            {doc.submittedBy.initials}
                          </div>
                          <div>
                            <span className="font-medium text-foreground">{doc.submittedBy.name}</span>
                            <span className="block text-xs text-muted-foreground leading-none mt-0.5">{doc.submittedBy.email}</span>
                          </div>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleSelectDoc(doc.id)}
                          className="rounded-lg border px-3 py-1.5 text-xs font-bold hover:bg-accent hover:text-accent-foreground transition-all cursor-pointer"
                        >
                          View Document
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* ── Table Footer Pagination ── */}
          <div className="flex items-center justify-between mt-4 text-xs text-muted-foreground px-1">
            <span>
              Showing {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, visibleAndFilteredDocs.length)} of {visibleAndFilteredDocs.length} documents
            </span>
            
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
                className="p-1.5 rounded-lg border bg-background hover:bg-accent disabled:opacity-50 transition-all cursor-pointer"
              >
                <ChevronLeft size={14} />
              </button>
              
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  className={cn(
                    "h-7 w-7 rounded-lg border text-center font-semibold transition-all cursor-pointer",
                    currentPage === page 
                      ? "bg-primary text-primary-foreground border-primary" 
                      : "bg-background hover:bg-accent text-foreground"
                  )}
                >
                  {page}
                </button>
              ))}

              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(currentPage + 1)}
                className="p-1.5 rounded-lg border bg-background hover:bg-accent disabled:opacity-50 transition-all cursor-pointer"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ── Split-Screen Document Detail View ── */
        <div className="flex flex-col h-full animate-in fade-in duration-200">
          {/* Header & Back Action */}
          <div className="flex items-center justify-between border-b pb-4 mb-5">
            <button
              type="button"
              onClick={() => setViewingDocId(null)}
              className="flex items-center gap-1.5 rounded-lg border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-all cursor-pointer"
            >
              <ChevronLeft size={14} />
              Back to Documents
            </button>
            <h2 className="text-sm font-bold text-foreground uppercase tracking-widest bg-muted/60 px-3 py-1 rounded-md">
              RTD Detail Viewer
            </h2>
          </div>

          {/* Split Panel */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-5 gap-6 min-h-0 overflow-y-auto pr-1">
            {/* Left Column (60% width) - Interactive Preview */}
            <div className="lg:col-span-3 flex flex-col h-full">
              <div className="flex items-center gap-1.5 mb-2 px-1">
                <FileIcon fileName={activeDoc.fileName} size={15} />
                <span className="text-xs font-bold text-muted-foreground">Document Preview</span>
              </div>

              <div className="flex-1 min-h-[480px] bg-card border rounded-2xl flex items-center justify-center p-6 shadow-xs select-none">
                {activeDoc.fileType === "image" && activeDoc.fileUrl ? (
                  /* IMAGE PREVIEW MODE */
                  <div className="relative max-w-full max-h-full aspect-auto flex items-center justify-center bg-muted/20 rounded-lg p-2 border border-border/40 overflow-hidden shadow-xs">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img 
                      src={activeDoc.fileUrl} 
                      alt={activeDoc.fileName} 
                      className="max-w-full max-h-[450px] object-contain rounded-md"
                    />
                  </div>
                ) : activeDoc.fileUrl && activeDoc.fileName.toLowerCase().endsWith(".pdf") ? (
                  /* PDF IFRAME PREVIEW MODE WITH APP THEMED TOOLBAR */
                  <div className="w-full h-full min-h-[520px] rounded-2xl overflow-hidden border border-border/80 shadow-xs bg-card flex flex-col">
                    <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-2 text-xs font-semibold text-foreground select-none">
                      <div className="flex items-center gap-2 truncate max-w-[70%]">
                        <FileIcon fileName={activeDoc.fileName} size={16} />
                        <span className="truncate font-bold text-foreground">{activeDoc.fileName}</span>
                      </div>
                      <a
                        href={activeDoc.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 px-2.5 py-1 rounded-md transition-colors cursor-pointer"
                      >
                        <span>Open / Print</span>
                        <ExternalLink size={12} />
                      </a>
                    </div>
                    <iframe 
                      src={`${activeDoc.fileUrl}#toolbar=0`} 
                      className="w-full flex-1 border-none bg-background animate-in fade-in duration-300"
                    />
                  </div>
                ) : (
                  /* SIMULATED DOCUMENT PREVIEW MODE (matching reference styling) */
                  <div className="w-full max-w-md aspect-[1/1.4] bg-white border border-neutral-300 shadow-lg p-8 text-neutral-800 flex flex-col overflow-y-auto leading-relaxed select-text font-serif">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-neutral-300 pb-3 mb-5">
                      <div className="flex items-center gap-1.5">
                        <div className="h-6 w-6 rounded bg-neutral-800 flex items-center justify-center text-xs font-bold text-white font-sans">
                          W
                        </div>
                        <span className="text-xs font-bold tracking-wider text-neutral-900 font-sans uppercase">WinOS Team</span>
                      </div>
                      <span className="text-xs text-neutral-500 font-sans">{activeDoc.uploadedOn.split(" ")[0]}</span>
                    </div>

                    {/* Content */}
                    <h3 className="text-base font-bold text-neutral-900 leading-snug font-sans tracking-tight mb-2 border-l-2 border-neutral-900 pl-2">
                      {activeDoc.taskName}
                    </h3>
                    <p className="text-xs text-neutral-500 mb-6 font-sans">
                      Document Ref: RTD-{activeDoc.id.toUpperCase()} &bull; Submitted by: {activeDoc.submittedBy.name}
                    </p>

                    <div className="text-xs space-y-3.5 text-neutral-600 flex-1">
                      <p className="font-bold text-neutral-900 font-sans text-xs">Roles & Responsibilities Overview</p>
                      
                      <p>
                        This documentation establishes the operational alignment and metrics mapping associated with the corresponding standup objectives and dashboard delivery.
                      </p>

                      <div className="bg-neutral-50 border-l border-neutral-400 p-2.5 rounded my-2 font-sans text-xs">
                        <p className="font-bold text-neutral-800 mb-0.5">Submitter Comment / Focus Summary:</p>
                        <p className="italic text-neutral-600">
                          &quot;{activeDoc.comment || "No comment was submitted with this file."}&quot;
                        </p>
                      </div>

                      <p className="font-bold text-neutral-900 font-sans text-xs uppercase tracking-wider pt-2 border-t border-neutral-100">
                        Operational Directives:
                      </p>
                      <ul className="list-disc pl-4 space-y-1 text-neutral-600 font-sans text-xs">
                        <li>Coordinate daily standup (DSM) deliverables and align task priority tags.</li>
                        <li>Address customer feedback reports and check-in blockers.</li>
                        <li>Manage engineering resources and optimize local db connectivity.</li>
                      </ul>
                    </div>

                    {/* Signature Block */}
                    <div className="border-t border-neutral-200 pt-5 mt-4 grid grid-cols-2 gap-4 text-xs font-sans">
                      <div>
                        <div className="h-6 flex items-end border-b border-neutral-300 font-sans italic text-neutral-700">
                          {activeDoc.submittedBy.name}
                        </div>
                        <p className="text-xs text-neutral-400 mt-1 uppercase tracking-wider">Submitted By</p>
                      </div>
                      <div>
                        <div className="h-6 flex items-end border-b border-neutral-300 font-sans italic text-neutral-400">
                          {activeDoc.managerNotes ? "Sarah Jenkins (EED)" : "(Awaiting Review)"}
                        </div>
                        <p className="text-xs text-neutral-400 mt-1 uppercase tracking-wider">Reviewing Manager</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column (40% width) - Interactive Summary details & Manager notes */}
            <div className="lg:col-span-2 flex flex-col gap-5">
              
              {/* Submission Summary Card */}
              <div className="bg-card border rounded-2xl p-5 shadow-3xs">
                <h3 className="text-xs font-bold text-foreground uppercase tracking-widest text-muted-foreground/70 mb-4">
                  Submission Summary
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Task Name</label>
                    <p className="text-sm font-bold text-foreground mt-0.5">{activeDoc.taskName}</p>
                  </div>

                  <div className="border-t border-border/40 pt-3">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Uploaded File</label>
                    {activeDoc.fileUrl ? (
                      <a 
                        href={activeDoc.fileUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2.5 bg-accent/20 hover:bg-accent/40 border rounded-xl p-2.5 transition-colors cursor-pointer"
                      >
                        <FileIcon fileName={activeDoc.fileName} size={18} />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold truncate text-foreground">{activeDoc.fileName}</p>
                          <p className="text-xs text-muted-foreground uppercase mt-0.5">
                            {activeDoc.fileType === "image" ? "Image Asset" : "Document File"}
                          </p>
                        </div>
                      </a>
                    ) : (
                      <div className="flex items-center gap-2.5 bg-accent/20 border rounded-xl p-2.5">
                        <FileIcon fileName={activeDoc.fileName} size={18} />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold truncate text-foreground">{activeDoc.fileName}</p>
                          <p className="text-xs text-muted-foreground uppercase mt-0.5">
                            {activeDoc.fileType === "image" ? "Image Asset" : "Document File"}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4 border-t border-border/40 pt-3">
                    <div>
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Uploaded On</label>
                      <p className="text-xs font-semibold mt-0.5 text-foreground">{activeDoc.uploadedOn}</p>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Submitted By</label>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {activeDoc.submittedBy.initials}
                        </div>
                        <span className="text-xs font-semibold text-foreground truncate">{activeDoc.submittedBy.name}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Submitter Comment Card */}
              <div className="bg-card border rounded-2xl p-5 shadow-3xs">
                <h3 className="text-xs font-bold text-foreground uppercase tracking-widest text-muted-foreground/70 mb-3 flex items-center gap-1">
                  <MessageSquare size={13} />
                  Submitter Comment
                </h3>
                <div className="bg-muted/30 border p-3 rounded-xl text-xs text-muted-foreground leading-relaxed">
                  {activeDoc.comment || "No commentary was submitted with this file."}
                </div>
              </div>

              {/* Manager Notes Card */}
              <div className="bg-card border rounded-2xl p-5 shadow-3xs flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-widest text-muted-foreground/70 flex items-center gap-1">
                    <ClipboardSignature size={13} />
                    Manager Notes
                  </h3>
                  {isManager && (
                    <button
                      type="button"
                      onClick={handleSaveManagerNotes}
                      disabled={isSavingNotes || editingManagerNotes === (activeDoc.managerNotes || "")}
                      className="rounded-lg bg-primary px-3 py-1 text-xs font-bold text-primary-foreground hover:bg-primary/95 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer shadow-2xs"
                    >
                      {isSavingNotes ? "Saving..." : "Save Notes"}
                    </button>
                  )}
                </div>

                {isManager ? (
                  /* EDITABLE MODE FOR MANAGER */
                  <div className="flex-1 flex flex-col min-h-[120px]">
                    <textarea
                      placeholder="Add assessment notes, requested changes, or approval remarks..."
                      value={editingManagerNotes}
                      onChange={(e) => setEditingManagerNotes(e.target.value)}
                      className="w-full flex-1 rounded-xl border bg-background px-3 py-2 text-xs outline-none focus:border-primary placeholder:text-muted-foreground/50 resize-none text-foreground leading-relaxed min-h-[100px]"
                    />
                  </div>
                ) : (
                  /* READONLY VIEW FOR TEAM MEMBERS */
                  <div className="flex-1">
                    {activeDoc.managerNotes ? (
                      <div className="bg-primary/5 border border-primary/10 p-3 rounded-xl text-xs text-foreground leading-relaxed font-sans">
                        {activeDoc.managerNotes}
                      </div>
                    ) : (
                      <div className="bg-muted/20 border border-dashed p-4 rounded-xl text-xs text-muted-foreground leading-relaxed text-center italic">
                        No notes or feedback added by manager yet.
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ── UPLOAD MODAL OVERLAY ── */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-overlay backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-card border w-full max-w-xl rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b px-5 py-4 bg-muted/20">
              <div>
                <h2 className="text-sm font-bold text-foreground">Upload Role Task Document</h2>
                <p className="text-xs text-muted-foreground">Submit a required document for task alignment or record reviews</p>
              </div>
              <button 
                onClick={() => { setShowUploadModal(false); setUploadedFile(null); }} 
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="p-5 flex flex-col gap-4">
              
              {/* Task Title Input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Task Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Q4 Market Research Report"
                  value={taskNameInput}
                  onChange={(e) => setTaskNameInput(e.target.value)}
                  className="w-full rounded-xl border bg-background px-3 py-2 text-xs outline-none focus:border-primary text-foreground"
                />
              </div>

              {/* Submitter Auto-Details Card */}
              <div className="flex items-center justify-between p-3 border rounded-xl bg-accent/15">
                <div className="flex items-center gap-2.5">
                  <div className="rounded-lg border bg-background p-1.5 text-primary shadow-3xs">
                    <User size={15} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground leading-none">Submitting As</p>
                    <p className="text-xs font-bold mt-1">{currentUser.name} ({currentUser.role})</p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground font-semibold px-2 py-0.5 bg-muted/65 border rounded">
                  {currentUser.email}
                </span>
              </div>

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
                    accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg,.webp"
                  />
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                    <UploadCloud size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">
                      Drag & drop your file here or <span className="text-primary hover:underline">click to browse</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Supported formats: PDF, DOCX, XLSX, PNG, JPG, WEBP (Max size: 10MB)
                    </p>
                  </div>
                </div>
              ) : (
                /* Selected File Card with simulated progress */
                <div className="border rounded-xl p-3 flex flex-col gap-2.5 bg-background">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <FileIcon fileName={uploadedFile.name} size={18} />
                      <div>
                        <p className="text-xs font-bold">{uploadedFile.name}</p>
                        <p className="text-xs text-muted-foreground">{uploadedFile.size} &bull; {uploadedFile.type === "image" ? "Image" : "Document"}</p>
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
                  {/* Progress simulation */}
                  <div className="w-full bg-muted h-1 rounded-full overflow-hidden">
                    <div className="bg-primary h-full w-[100%] rounded-full animate-all duration-500" />
                  </div>
                </div>
              )}

              {/* Comment text area */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Add a comment (optional)</label>
                <textarea
                  placeholder="Describe details regarding this submission..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="w-full rounded-xl border bg-background px-3 py-2 text-xs outline-none focus:border-primary placeholder:text-muted-foreground/50 h-20 resize-none text-foreground"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 border-t pt-4 mt-1 bg-card">
                <button
                  type="button"
                  onClick={() => { setShowUploadModal(false); setUploadedFile(null); }}
                  className="rounded-lg px-4 py-2 text-xs font-bold hover:bg-accent text-muted-foreground transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!uploadedFile || isUploading}
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/95 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  {isUploading && <Loader2 size={13} className="animate-spin" />}
                  {isUploading ? "Submitting…" : "Submit Document ↗"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── SUCCESS TOAST POPUP ── */}
      {showSuccessToast && (
        <div className="fixed bottom-6 right-6 flex items-center gap-3 bg-card border rounded-2xl p-4 shadow-xl border-success/20 z-50 animate-in slide-in-from-bottom-5 duration-300">
          <div className="h-8 w-8 rounded-full bg-success/15 flex items-center justify-center text-success shrink-0">
            <CheckCircle size={18} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-foreground">Document Submitted Successfully</h4>
            <p className="text-xs text-muted-foreground mt-0.5">Your task document has been added to the register.</p>
          </div>
          <button onClick={() => setShowSuccessToast(false)} className="text-muted-foreground hover:text-foreground ml-2 shrink-0 cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

    </div>
  );
}
