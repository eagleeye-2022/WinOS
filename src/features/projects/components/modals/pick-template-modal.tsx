"use client";

import React, { useState } from "react";
import { X, Search } from "lucide-react";

interface TemplateOption {
  id: string;
  title: string;
  description: string;
}

const TEMPLATES: TemplateOption[] = [
  {
    id: "tpl-1",
    title: "Wordpress Website Initialisation",
    description: "Standard setup for new WP projects",
  },
  {
    id: "tpl-2",
    title: "Tangible Product Design SOP",
    description: "Industrial design workflow stages",
  },
  {
    id: "tpl-3",
    title: "SOP for monthly Blog Content Writing",
    description: "Recurring editorial checklist",
  },
  {
    id: "tpl-4",
    title: "UX Research Phase Protocol",
    description: "Discovery and user testing steps",
  },
];

interface PickTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTemplates: (selectedTitles: string[]) => void;
}

export function PickTemplateModal({
  isOpen,
  onClose,
  onAddTemplates,
}: PickTemplateModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  if (!isOpen) return null;

  const filteredTemplates = TEMPLATES.filter(
    (t) =>
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleAdd = () => {
    const titles = TEMPLATES.filter((t) => selectedIds.includes(t.id)).map(
      (t) => t.title
    );
    onAddTemplates(titles);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay backdrop-blur-xs p-4">
      <div className="w-full max-w-md rounded-xl border bg-background shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h3 className="text-base font-bold text-foreground">Pick from Template</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Search & List Body */}
        <div className="p-6 space-y-4 text-xs">
          {/* Search input */}
          <div className="relative">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
            <input
              type="text"
              placeholder="Search for templates"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md border border-input bg-muted/20 pl-9 pr-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="space-y-2">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
              TEMPLATES
            </span>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {filteredTemplates.map((template) => (
                <label
                  key={template.id}
                  onClick={() => toggleSelect(template.id)}
                  className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-all ${
                    selectedIds.includes(template.id)
                      ? "border-info bg-info/10 shadow-2xs"
                      : "border-border bg-background hover:bg-accent/40"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(template.id)}
                    onChange={() => {}}
                    className="mt-0.5 rounded border-input text-primary h-4 w-4"
                  />
                  <div className="space-y-0.5">
                    <h4 className="font-bold text-foreground leading-tight">
                      {template.title}
                    </h4>
                    <p className="text-[11px] text-muted-foreground">
                      {template.description}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-2 border-t bg-muted/20 px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-input bg-background px-4 py-1.5 text-xs font-semibold text-foreground hover:bg-accent transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleAdd}
            disabled={selectedIds.length === 0}
            className="rounded-md bg-primary px-5 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-2xs"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
