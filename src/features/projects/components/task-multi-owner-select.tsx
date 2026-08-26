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

  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={`w-full ${className}`}>
      <div className="relative w-full" ref={containerRef}>
        {/* Trigger Box - Horizontal split layout matching user reference image */}
        <div
          onClick={() => {
            if (!disabled) {
              if (!isOpen) {
                setInternalSelected(selectedOwners || []);
              }
              setIsOpen(true);
              inputRef.current?.focus();
            }
          }}
          title={disabled ? disabledReason : undefined}
          className={`min-h-[42px] w-full rounded border border-border/80 dark:border-[#2b2f38] bg-[#16181d] flex items-stretch transition-all focus-within:ring-1 focus-within:ring-primary shadow-2xs ${
            disabled ? "cursor-not-allowed opacity-60" : "hover:border-border/90 cursor-pointer"
          }`}
        >
          {/* Left Label Section (Owner label) */}
          {label && (
            <div className="flex items-center justify-between min-w-[120px] md:min-w-[140px] px-3.5 py-2 bg-[#1c1f26] dark:bg-[#191c22] border-r border-border/70 dark:border-[#2b2f38] shrink-0 select-none">
              <span className="text-xs font-semibold text-foreground/80 dark:text-neutral-300">
                {label}
              </span>
            </div>
          )}

          {/* Right Input & Pills Section matching reference image */}
          <div className="flex flex-wrap items-center gap-1.5 flex-1 px-3 py-1.5 bg-[#121318] dark:bg-[#131419] min-w-0">
            {internalSelected.map((key) => {
              const matched = findUserByKey(key);
              const displayName = matched ? matched.name : key;
              return (
                <span
                  key={key}
                  className="inline-flex items-center gap-1.5 rounded border border-sky-500/35 dark:border-[#27384d] bg-sky-500/10 dark:bg-[#182333] px-2 py-0.5 text-xs font-medium text-foreground dark:text-neutral-200 transition-colors group select-none shadow-2xs"
                >
                  <span
                    className={`h-4.5 w-4.5 rounded-full flex items-center justify-center text-[9px] font-extrabold shrink-0 shadow-2xs ${getAvatarColor(
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
                      className="text-muted-foreground/70 hover:text-destructive text-[12px] leading-none font-bold transition-colors ml-0.5 p-0.5 rounded cursor-pointer"
                      title={`Remove ${displayName}`}
                    >
                      ×
                    </button>
                  )}
                </span>
              );
            })}

            {!disabled && (
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (!isOpen) setIsOpen(true);
                }}
                onFocus={() => {
                  if (!isOpen) setIsOpen(true);
                }}
                placeholder={internalSelected.length === 0 ? "Select Owners..." : ""}
                className="bg-transparent text-xs text-foreground dark:text-neutral-200 outline-none min-w-[90px] flex-1 py-1"
              />
            )}

            <ChevronDown
              size={14}
              className={`text-muted-foreground/70 shrink-0 ml-auto transition-transform duration-150 ${
                isOpen ? "rotate-180 text-primary" : ""
              }`}
            />
          </div>
        </div>

        {/* Searchable Dropdown Menu Popover matching user reference screenshot */}
        {isOpen && (
          <div
            onClick={(e) => e.stopPropagation()}
            className={`absolute left-0 right-0 ${
              label ? "md:left-[140px]" : ""
            } ${
              dropUp ? "bottom-full mb-1" : "top-full mt-1"
            } z-[100] rounded-lg border border-border/80 dark:border-[#2f333e] bg-[#22242a] dark:bg-[#1e2026] text-popover-foreground shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150`}
          >
            {/* Header: Project Users */}
            <div className="px-3.5 py-2 text-[11px] font-bold text-muted-foreground/70 dark:text-neutral-400 border-b border-border/40 dark:border-[#2a2d37] select-none">
              Project Users
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
                          ? "bg-sky-500/20 text-sky-400 font-semibold dark:bg-[#18283a] dark:text-[#38bdf8]"
                          : "hover:bg-white/5 text-foreground/90 dark:text-neutral-200"
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

                      {selected && <Check size={14} className="text-sky-400 shrink-0" />}
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
