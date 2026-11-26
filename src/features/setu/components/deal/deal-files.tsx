"use client";

import { useRef, useState } from "react";
import { Download, FileText, FileUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/shared/toast";
import { UPLOAD_ACCEPT, UPLOAD_MAX_BYTES } from "../../constants";
import type { DealFile } from "../../types";
import { formatBytes } from "../../utils";
import { SetuButton } from "../setu-ui";

const ALLOWED_EXT = UPLOAD_ACCEPT.split(",");

/**
 * Uploads a file to /api/setu/upload (stored via lib/upload-storage). The returned file has a
 * temporary "upload-…" id: it is recorded in the database when the proposal / closure is saved.
 */
async function uploadFile(file: File): Promise<DealFile> {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch("/api/setu/upload", { method: "POST", body });
  const json = (await res.json().catch(() => ({}))) as { name?: string; size?: number; url?: string; error?: string };
  if (!res.ok || !json.url) throw new Error(json.error ? `${file.name}: ${json.error}` : `${file.name} couldn’t be uploaded`);
  return { id: `upload-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, name: json.name ?? file.name, size: json.size ?? file.size, url: json.url };
}

function validate(file: File): string | null {
  const ext = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
  if (!ALLOWED_EXT.includes(ext)) return `${file.name}: only PDF or DOCX files`;
  if (file.size > UPLOAD_MAX_BYTES) return `${file.name} is over 25MB`;
  return null;
}

/** Click-or-drop upload area for PDF / DOCX (≤ 25MB). */
export function FileDropzone({
  onFiles,
  multiple,
  title,
  hint,
  compact,
}: {
  onFiles: (files: DealFile[]) => void;
  multiple?: boolean;
  title: React.ReactNode;
  hint: string;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [uploading, setUploading] = useState(0);

  const take = async (list: FileList | null) => {
    if (!list?.length || uploading) return;
    const files = (multiple ? [...list] : [list[0]]).filter((f) => {
      const err = validate(f);
      if (err) toast.error(err);
      return !err;
    });
    if (!files.length) return;
    setUploading(files.length);
    const results = await Promise.allSettled(files.map(uploadFile));
    setUploading(0);
    const ok: DealFile[] = [];
    for (const r of results) {
      if (r.status === "fulfilled") ok.push(r.value);
      else toast.error(r.reason instanceof Error ? r.reason.message : "Upload failed");
    }
    if (ok.length) onFiles(ok);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        void take(e.dataTransfer.files);
      }}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed text-center transition-colors",
        compact ? "px-4 py-5" : "px-6 py-8",
        over ? "border-[var(--setu-accent)] bg-[var(--setu-accent-soft)]" : "border-[var(--setu-line-strong)] hover:border-[var(--setu-accent)]"
      )}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--setu-accent-soft)] text-[var(--setu-accent)]">
        <FileUp size={17} />
      </span>
      <p className="text-sm">{uploading ? `Uploading ${uploading} file${uploading > 1 ? "s" : ""}…` : title}</p>
      <p className="setu-text-3 text-xs">{hint}</p>
      <input
        ref={inputRef}
        type="file"
        accept={UPLOAD_ACCEPT}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          void take(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

/** Downloads a stored file (served by /api/uploads, signed-in users only). */
export function downloadDealFile(file: DealFile) {
  if (!file.url) {
    toast.error("This file isn’t available.");
    return;
  }
  const a = document.createElement("a");
  a.href = file.url;
  a.download = file.name;
  a.click();
}

const FILE_TONES = ["bg-red-50 text-red-600 dark:bg-red-500/10", "bg-blue-50 text-blue-600 dark:bg-blue-500/10", "bg-green-50 text-green-600 dark:bg-green-500/10"];

export function FileRow({ file, index = 0, onRemove }: { file: DealFile; index?: number; onRemove?: () => void }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", FILE_TONES[index % FILE_TONES.length])}>
        <FileText size={17} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold">{file.name}</p>
        <p className="setu-text-3 text-xs">{formatBytes(file.size)}</p>
      </div>
      <SetuButton size="sm" onClick={() => downloadDealFile(file)}>
        <Download /> Download
      </SetuButton>
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={`Remove ${file.name}`} className="setu-text-3 cursor-pointer rounded-md p-1 hover:text-red-600">
          <X size={15} />
        </button>
      )}
    </div>
  );
}
