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
  Paperclip,
  AlertCircle,
} from "lucide-react";
import { ProjectDocument } from "../types";
import {
  getTaskDocumentsAction,
  saveTaskDocumentAction,
  deleteTaskDocumentAction,
} from "../actions/project-actions";

interface TaskDocumentsTabProps {
  taskId: string;
  projectId: string;
  onDocumentUploaded?: () => void;
}

export function TaskDocumentsTab({ taskId, projectId, onDocumentUploaded }: TaskDocumentsTabProps) {
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    async function loadTaskDocs() {
      setIsLoading(true);
      try {
        const fetchedDocs = await getTaskDocumentsAction(taskId);
        setDocuments(fetchedDocs);
      } catch (err) {
        console.error("Failed to load task documents:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadTaskDocs();
  }, [taskId]);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        const formData = new FormData();
        formData.append("file", file);

        // Upload to /api/upload
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

        // Save file metadata linked to this task in DB
        const savedDoc = await saveTaskDocumentAction({
          taskId,
          projectId,
          name: file.name,
          fileUrl: data.fileUrl,
          sizeBytes: file.size,
          mimeType: file.type || "application/octet-stream",
        });

        setDocuments((prev) => [savedDoc, ...prev]);
        if (onDocumentUploaded) onDocumentUploaded();
      }
    } catch (err: unknown) {
      console.error("Task upload error:", err);
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteDoc = async (docId: string) => {
    if (!confirm("Are you sure you want to delete this document attachment?")) return;
    try {
      await deleteTaskDocumentAction(docId, taskId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch (err) {
      console.error("Failed to delete task document:", err);
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
      return <ImageIcon size={16} className="text-emerald-500" />;
    }
    if (["xlsx", "xls", "csv"].includes(ext) || mimeType.includes("spreadsheet") || mimeType.includes("csv")) {
      return <FileSpreadsheet size={16} className="text-emerald-600" />;
    }
    if (["pdf", "doc", "docx", "txt", "md"].includes(ext) || mimeType.includes("pdf") || mimeType.includes("document")) {
      return <FileText size={16} className="text-blue-500" />;
    }
    if (["zip", "rar", "tar", "gz", "7z"].includes(ext)) {
      return <Archive size={16} className="text-amber-500" />;
    }
    if (["js", "ts", "tsx", "html", "css", "json", "py"].includes(ext)) {
      return <FileCode size={16} className="text-purple-500" />;
    }
    return <File size={16} className="text-muted-foreground" />;
  };

  return (
    <div className="space-y-4 text-xs font-sans">
      {/* Upload Zone */}
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
        className={`relative flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed transition-all ${
          dragOver
            ? "border-primary bg-primary/10"
            : "border-border/80 bg-muted/20 hover:border-primary/50 hover:bg-accent/20 dark:border-neutral-800 dark:bg-[#16181d]"
        }`}
      >
        <input
          type="file"
          multiple
          id="task-file-upload-input"
          className="hidden"
          onChange={(e) => handleFileUpload(e.target.files)}
        />

        {isUploading ? (
          <div className="flex flex-col items-center space-y-2">
            <Loader2 size={26} className="animate-spin text-primary" />
            <p className="font-bold text-foreground">Uploading files to /api/upload...</p>
          </div>
        ) : (
          <label htmlFor="task-file-upload-input" className="flex flex-col items-center cursor-pointer space-y-1.5 text-center">
            <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <Upload size={18} />
            </div>
            <div>
              <span className="font-bold text-foreground text-xs hover:underline">Click to upload documents</span>{" "}
              <span className="text-muted-foreground">or drag and drop</span>
            </div>
            {/* <p className="text-[10px] text-muted-foreground">
              Files uploaded to <code className="bg-muted px-1 py-0.5 rounded font-mono">/api/upload</code> remain available permanently for this task.
            </p> */}
          </label>
        )}
      </div>

      {uploadError && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs font-semibold">
          <AlertCircle size={15} />
          <span>{uploadError}</span>
        </div>
      )}

      {/* Task Attachments Table */}
      <div className="rounded-xl border border-border bg-card shadow-2xs overflow-hidden dark:border-neutral-800 dark:bg-[#16181d]">
        <div className="px-4 py-2.5 border-b border-border bg-muted/40 flex items-center justify-between font-bold text-foreground dark:border-neutral-800 dark:bg-[#1c1e24]">
          <span className="flex items-center gap-2">
            <Paperclip size={14} className="text-primary" />
            Task Attachments ({documents.length})
          </span>
          <span className="text-muted-foreground font-normal text-[10px]">Saved in Database</span>
        </div>

        {isLoading ? (
          <div className="p-8 flex items-center justify-center text-muted-foreground">
            <Loader2 size={22} className="animate-spin text-primary" />
          </div>
        ) : documents.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground space-y-1">
            <FileText size={30} className="mx-auto opacity-40" />
            <p className="font-semibold text-foreground text-xs">No documents attached to this task yet.</p>
            <p className="text-[10px]">Upload files above to save them with this task.</p>
          </div>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/20 text-muted-foreground font-semibold dark:border-neutral-800 dark:bg-[#1c1e24]">
                <th className="py-2.5 px-4">File Name</th>
                <th className="py-2.5 px-4">Size</th>
                <th className="py-2.5 px-4">Uploaded By</th>
                <th className="py-2.5 px-4">Uploaded At</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 font-medium dark:divide-neutral-800/60">
              {documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-accent/30 transition-colors">
                  <td className="py-2.5 px-4 text-foreground font-semibold">
                    <div className="flex items-center gap-2">
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
                  <td className="py-2.5 px-4 font-mono text-muted-foreground text-[11px]">
                    {formatFileSize(doc.sizeBytes)}
                  </td>
                  <td className="py-2.5 px-4 text-foreground font-medium">{doc.uploadedBy}</td>
                  <td className="py-2.5 px-4 text-muted-foreground text-[11px]">
                    {new Date(doc.createdAt).toLocaleDateString()} {new Date(doc.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="py-2.5 px-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                        title="View / Open Attachment"
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
