"use client";

import React, { useState, useEffect } from "react";
import {
  Upload,
  FileText,
  File,
  Image as ImageIcon,
  FileSpreadsheet,
  FileCode,
  Archive,
  Trash2,
  Download,
  ExternalLink,
  Loader2,
  Search,
  CheckCircle2,
  AlertCircle,
  Paperclip,
} from "lucide-react";
import { ProjectDocument } from "../../types";
import {
  getProjectDocumentsAction,
  saveProjectDocumentAction,
  deleteProjectDocumentAction,
} from "../../actions/project-actions";

interface ProjectDocumentsViewProps {
  projectId: string;
  projectName?: string;
}

export function ProjectDocumentsView({ projectId, projectName }: ProjectDocumentsViewProps) {
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    async function loadDocs() {
      setIsLoading(true);
      try {
        const fetchedDocs = await getProjectDocumentsAction(projectId);
        setDocuments(fetchedDocs);
      } catch (err) {
        console.error("Failed to load project documents:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadDocs();
  }, [projectId]);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        const formData = new FormData();
        formData.append("file", file);

        // Post to /api/upload
        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          throw new Error(`Upload failed with status ${res.status}`);
        }

        const data = await res.json();
        if (!data.success) {
          throw new Error(data.error || "Failed to upload file");
        }

        // Save metadata to project server action
        const savedDoc = await saveProjectDocumentAction({
          projectId,
          name: file.name,
          fileUrl: data.fileUrl,
          sizeBytes: file.size,
          mimeType: file.type || "application/octet-stream",
        });

        setDocuments((prev) => [savedDoc, ...prev]);
      }
    } catch (err: unknown) {
      console.error("Upload error:", err);
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteDoc = async (docId: string) => {
    if (!confirm("Are you sure you want to delete this document attachment?")) return;
    try {
      await deleteProjectDocumentAction(docId, projectId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch (err) {
      console.error("Failed to delete document:", err);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const getFileIcon = (mimeType: string, name: string) => {
    const ext = name.split(".").pop()?.toLowerCase() || "";

    if (mimeType.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) {
      return <ImageIcon size={18} className="text-emerald-500" />;
    }
    if (["xlsx", "xls", "csv"].includes(ext) || mimeType.includes("spreadsheet") || mimeType.includes("csv")) {
      return <FileSpreadsheet size={18} className="text-emerald-600" />;
    }
    if (["pdf", "doc", "docx", "txt", "md"].includes(ext) || mimeType.includes("pdf") || mimeType.includes("document")) {
      return <FileText size={18} className="text-blue-500" />;
    }
    if (["zip", "rar", "tar", "gz", "7z"].includes(ext)) {
      return <Archive size={18} className="text-amber-500" />;
    }
    if (["js", "ts", "tsx", "html", "css", "json", "py"].includes(ext)) {
      return <FileCode size={18} className="text-purple-500" />;
    }
    return <File size={18} className="text-muted-foreground" />;
  };

  const filteredDocs = documents.filter((d) =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-background text-foreground p-6 space-y-6 overflow-y-auto font-sans text-xs">
      {/* Upload Header Zone */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Paperclip size={18} className="text-primary" />
            Project Attachments & Documents
          </h2>
          {/* <p className="text-muted-foreground text-xs mt-0.5">
            Upload files directly to <code className="bg-muted px-1 py-0.5 rounded font-mono text-[11px]">/api/upload</code> for project {projectName || projectId}.
          </p> */}
        </div>

        {/* Search */}
        {/* <div className="relative w-64">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents..."
            className="w-full rounded-md border border-input bg-background pl-8 pr-3 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary font-medium"
          />
        </div> */}
      </div>

      {/* Drag & Drop Upload Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFileUpload(e.dataTransfer.files);
        }}
        className={`relative flex flex-col items-center justify-center p-8 rounded-xl border-2 border-dashed transition-all ${
          dragOver
            ? "border-primary bg-primary/10"
            : "border-border/80 bg-muted/20 hover:border-primary/50 hover:bg-accent/20"
        }`}
      >
        <input
          type="file"
          multiple
          id="project-file-upload-input"
          className="hidden"
          onChange={(e) => handleFileUpload(e.target.files)}
        />

        {isUploading ? (
          <div className="flex flex-col items-center space-y-2">
            <Loader2 size={32} className="animate-spin text-primary" />
            <p className="font-bold text-foreground">Uploading files to /api/upload...</p>
          </div>
        ) : (
          <label htmlFor="project-file-upload-input" className="flex flex-col items-center cursor-pointer space-y-2 text-center">
            <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <Upload size={22} />
            </div>
            <div>
              <span className="font-bold text-foreground text-sm hover:underline">Click to upload files</span>{" "}
              <span className="text-muted-foreground">or drag and drop</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Supports documents, spreadsheets, images, PDFs, code, and zip archives up to 50MB.
            </p>
          </label>
        )}
      </div>

      {uploadError && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs font-semibold">
          <AlertCircle size={16} />
          <span>{uploadError}</span>
        </div>
      )}

      {/* Document List Table */}
      <div className="rounded-xl border border-border bg-card shadow-2xs overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/40 flex items-center justify-between font-bold text-foreground">
          <span>Uploaded Files ({filteredDocs.length})</span>
          <span className="text-muted-foreground font-normal text-[11px]">Direct File Storage</span>
        </div>

        {isLoading ? (
          <div className="p-8 flex items-center justify-center text-muted-foreground space-y-2">
            <Loader2 size={24} className="animate-spin text-primary" />
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground space-y-2">
            <FileText size={36} className="mx-auto opacity-40" />
            <p className="font-semibold text-foreground">No documents uploaded yet.</p>
            <p className="text-[11px]">Upload project attachments to share them with the team.</p>
          </div>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/20 text-muted-foreground font-semibold">
                <th className="py-2.5 px-4">File Name</th>
                <th className="py-2.5 px-4">Size</th>
                <th className="py-2.5 px-4">Uploaded By</th>
                <th className="py-2.5 px-4">Date Added</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-medium">
              {filteredDocs.map((doc) => (
                <tr key={doc.id} className="hover:bg-accent/30 transition-colors">
                  <td className="py-3 px-4 text-foreground font-semibold">
                    <div className="flex items-center gap-2.5">
                      {getFileIcon(doc.mimeType, doc.name)}
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-primary transition-colors truncate max-w-xs font-semibold"
                        title={doc.name}
                      >
                        {doc.name}
                      </a>
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono text-muted-foreground text-[11px]">
                    {formatFileSize(doc.sizeBytes)}
                  </td>
                  <td className="py-3 px-4 text-foreground font-medium">{doc.uploadedBy}</td>
                  <td className="py-3 px-4 text-muted-foreground text-[11px]">
                    {new Date(doc.createdAt).toLocaleDateString()} {new Date(doc.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                        title="View / Open File"
                      >
                        <ExternalLink size={14} />
                      </a>
                      <a
                        href={doc.fileUrl}
                        download={doc.name}
                        className="p-1.5 rounded text-muted-foreground hover:text-primary hover:bg-accent transition-colors"
                        title="Download Attachment"
                      >
                        <Download size={14} />
                      </a>
                      <button
                        type="button"
                        onClick={() => handleDeleteDoc(doc.id)}
                        className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                        title="Delete Attachment"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
