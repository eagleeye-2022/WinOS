"use client";

import React, { useState, useRef, useEffect } from "react";
import { X, ChevronDown, Search, Check } from "lucide-react";

export interface OwnerUserOption {
  id: string;
  name: string;
  email: string;
  avatarColor?: string;
}

interface TaskMultiOwnerSelectProps {
  selectedOwners: string[];
  onChangeOwners: (owners: string[]) => void;
  ownersList: OwnerUserOption[];
  label?: string;
  className?: string;
  /** Only the current task owner may reassign ownership — disables the picker for everyone else. */
  disabled?: boolean;
  disabledReason?: string;
}

const DEFAULT_TEAM_MEMBERS: OwnerUserOption[] = [
  { id: "u-1", name: "Dhruv Patidar", email: "dhruv@example.com" },
  { id: "u-2", name: "Vanshika Warke", email: "vanshika@example.com" },
  { id: "u-3", name: "Yogesh Kumar", email: "yogesh@example.com" },
  { id: "u-4", name: "Rudraram Vamshivardhan Reddy", email: "rudraram@example.com" },
  { id: "u-5", name: "Ujjawal Mandloi", email: "ujjawal@example.com" },
  { id: "u-6", name: "Shadab Khan", email: "shadab@example.com" },
  { id: "u-7", name: "Rahil Ali", email: "rahil@example.com" },
  { id: "u-8", name: "Muskan Prajapat", email: "muskan@example.com" },
  { id: "u-9", name: "Priyanka Gour", email: "priyanka@example.com" },
  { id: "u-10", name: "M Thakre", email: "thakre@example.com" },
  { id: "u-11", name: "Rohan Gour", email: "rohan@example.com" },
  { id: "u-12", name: "Mansi Jain", email: "mansi@example.com" },
  { id: "u-13", name: "Vaishnavi Shivhare", email: "vaishnavi@example.com" },
  { id: "u-14", name: "Rahul Sharma", email: "rahul@example.com" },
  { id: "u-15", name: "Ananya Verma", email: "ananya@example.com" },
];

export function TaskMultiOwnerSelect({
  selectedOwners,
  onChangeOwners,
  ownersList,
  label,
  className = "",
  disabled = false,
  disabledReason = "Only the task owner can change the owner",
}: TaskMultiOwnerSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Internal state for immediate responsive UI feedback
  const [internalSelected, setInternalSelected] = useState<string[]>(selectedOwners || []);
  const [prevSelectedOwners, setPrevSelectedOwners] = useState(selectedOwners);

  if (selectedOwners !== prevSelectedOwners) {
    setPrevSelectedOwners(selectedOwners);
    setInternalSelected(selectedOwners || []);
  }

  const [dropUp, setDropUp] = useState(false);

  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      if (spaceBelow < 280 && rect.top > 280) {
        setDropUp(true);
      } else {
        setDropUp(false);
      }
    }
  }, [isOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Use provided DB list if available, otherwise fall back to default team members
  const effectiveOwnersList = React.useMemo(() => {
    if (ownersList && ownersList.length > 0) {
      return ownersList;
    }
    return DEFAULT_TEAM_MEMBERS;
  }, [ownersList]);

  // Generate consistent vibrant background color per user name
  const getAvatarColor = (name: string) => {
    const colors = [
      "bg-amber-500 text-white",
      "bg-emerald-500 text-white",
      "bg-sky-500 text-white",
      "bg-purple-500 text-white",
      "bg-rose-500 text-white",
      "bg-indigo-500 text-white",
      "bg-teal-500 text-white",
      "bg-orange-500 text-white",
      "bg-cyan-500 text-white",
      "bg-pink-500 text-white",
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const filteredList = effectiveOwnersList.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const findUserByKey = (key: string) => {
    return effectiveOwnersList.find(
      (u) =>
        u.id === key ||
        u.name.toLowerCase() === key.toLowerCase() ||
        u.email.toLowerCase() === key.toLowerCase()
    );
  };

  const isUserSelected = (u: OwnerUserOption) => {
    return internalSelected.some(
      (o) =>
        o === u.id ||
        o.toLowerCase() === u.name.toLowerCase() ||
        o.toLowerCase() === u.email.toLowerCase()
    );
  };

  const handleToggleOwner = (u: OwnerUserOption) => {
    const valueToUse = u.id && !u.id.startsWith("u-") ? u.id : u.name;
    let next: string[];
    const isAlreadySelected = internalSelected.some(
      (o) =>
        o === u.id ||
        o.toLowerCase() === u.name.toLowerCase() ||
        o.toLowerCase() === u.email.toLowerCase()
    );
    if (isAlreadySelected) {
      next = internalSelected.filter(
        (o) =>
          o !== u.id &&
          o.toLowerCase() !== u.name.toLowerCase() &&
          o.toLowerCase() !== u.email.toLowerCase()
      );
    } else {
      next = [...internalSelected, valueToUse];
    }
    setInternalSelected(next);
    onChangeOwners(next);
  };

  const handleRemoveOwner = (ownerKey: string) => {
    const matched = findUserByKey(ownerKey);
    const next = (selectedOwners || []).filter((o) => {
      if (matched) {
        return (
          o !== matched.id &&
          o.toLowerCase() !== matched.name.toLowerCase() &&
          o.toLowerCase() !== matched.email.toLowerCase()
        );
      }
      return o.toLowerCase() !== ownerKey.toLowerCase();
    });
    setInternalSelected(next);
    onChangeOwners(next);
  };

  return (
    <div className={`w-full ${className}`}>
      {/* Label as a caption above the field — keeps the pill row full-width instead of
          squeezing it into a side column, which wraps badly in narrow popovers. */}
      {label && (
        <div className="mb-1.5 flex items-center justify-between select-none">
          <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground dark:text-neutral-400">
            {label}
          </span>
          {internalSelected.length > 0 && (
            <span className="text-[10px] font-semibold text-muted-foreground/70">
              {internalSelected.length} assigned
            </span>
          )}
        </div>
      )}

      <div className="relative w-full" ref={containerRef}>
        {/* Trigger Box */}
        <div
          onClick={() => {
            if (!disabled) {
              if (!isOpen) {
                setInternalSelected(selectedOwners || []);
              }
              setIsOpen(true);
            }
          }}
          title={disabled ? disabledReason : undefined}
          className={`min-h-[42px] w-full rounded-lg border border-border/80 dark:border-[#2b2f38] bg-card dark:bg-[#131419] flex items-stretch transition-all focus-within:ring-1 focus-within:ring-primary shadow-2xs ${
            disabled ? "cursor-not-allowed opacity-60" : "hover:border-border/90 cursor-pointer"
          }`}
        >
          {/* Selected member pills */}
          <div className="flex flex-wrap items-center gap-1.5 flex-1 px-3 py-1.5 min-w-0">
            {internalSelected.length === 0 && (
              <span className="text-xs text-muted-foreground/70 py-1">Select members...</span>
            )}
            {internalSelected.map((key) => {
              const matched = findUserByKey(key);
              const displayName = matched ? matched.name : key;
              return (
                <span
                  key={key}
                  className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 dark:border-[#27384d] bg-sky-50 dark:bg-[#182333] pl-0.5 pr-2 py-0.5 text-xs font-medium text-sky-900 dark:text-neutral-200 transition-colors group select-none shadow-2xs"
                >
                  <span
                    className={`h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-extrabold shrink-0 shadow-2xs ${getAvatarColor(
                      displayName
                    )}`}
                  >
                    {getInitials(displayName)}
                  </span>
                  <span className="truncate max-w-[170px] leading-none">{displayName}</span>
                  {!disabled && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveOwner(key);
                      }}
                      className="text-muted-foreground/70 hover:text-destructive text-[12px] leading-none font-bold transition-colors ml-0.5 p-0.5 rounded-full cursor-pointer"
                      title={`Remove ${displayName}`}
                    >
                      ×
                    </button>
                  )}
                </span>
              );
            })}
          </div>

          {!disabled && (
            <button
              type="button"
              tabIndex={-1}
              className="flex items-center justify-center px-2.5 shrink-0 text-muted-foreground/70 hover:text-foreground border-l border-border/60 dark:border-[#2b2f38] transition-colors"
              title="Add members"
            >
              <ChevronDown
                size={14}
                className={`transition-transform duration-150 ${isOpen ? "rotate-180 text-primary" : ""}`}
              />
            </button>
          )}
        </div>

        {/* Searchable Dropdown Menu Popover */}
        {isOpen && (
          <div
            onClick={(e) => e.stopPropagation()}
            className={`absolute left-0 right-0 ${
              dropUp ? "bottom-full mb-1" : "top-full mt-1"
            } z-[100] rounded-lg border border-border dark:border-[#2f333e] bg-popover dark:bg-[#1e2026] text-popover-foreground shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150`}
          >
            {/* Search field */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border/60 dark:border-[#2a2d37]">
              <Search size={13} className="text-muted-foreground/70 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search members..."
                autoFocus
                className="bg-transparent text-xs text-foreground dark:text-neutral-200 outline-none flex-1 min-w-0"
              />
            </div>

            {/* Member Options List */}
            <div className="max-h-56 overflow-y-auto py-1 space-y-0.5">
              {filteredList.length === 0 ? (
                <div className="py-4 text-center text-xs text-muted-foreground/70 italic">
                  No matching members found
                </div>
              ) : (
                filteredList.map((u) => {
                  const selected = isUserSelected(u);
                  return (
                    <div
                      key={u.id}
                      onClick={() => handleToggleOwner(u)}
                      className={`px-3 py-2 text-xs flex items-center justify-between cursor-pointer select-none transition-colors ${
                        selected
                          ? "bg-sky-100/90 text-sky-800 font-semibold dark:bg-[#18283a] dark:text-[#38bdf8]"
                          : "hover:bg-accent text-foreground dark:hover:bg-white/5 dark:text-neutral-200"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <span
                          className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 shadow-2xs ${getAvatarColor(
                            u.name
                          )}`}
                        >
                          {getInitials(u.name)}
                        </span>
                        <span className="truncate">{u.name}</span>
                      </div>

                      {selected && <Check size={14} className="text-sky-600 dark:text-sky-400 shrink-0" />}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
