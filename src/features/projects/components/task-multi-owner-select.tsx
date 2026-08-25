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

  const handleToggleOwner = (name: string) => {
    let next: string[];
    const isAlreadySelected = internalSelected.some(
      (o) => o.toLowerCase() === name.toLowerCase()
    );
    if (isAlreadySelected) {
      next = internalSelected.filter((o) => o.toLowerCase() !== name.toLowerCase());
    } else {
      next = [...internalSelected, name];
    }
    setInternalSelected(next);
    onChangeOwners(next);
  };

  const handleRemoveOwner = (name: string) => {
    const next = internalSelected.filter((o) => o.toLowerCase() !== name.toLowerCase());
    setInternalSelected(next);
    onChangeOwners(next);
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label className="font-semibold text-muted-foreground flex items-center justify-between text-xs select-none">
          <span>{label}</span>
          <span className="text-[10px] text-muted-foreground font-normal">Select one or more</span>
        </label>
      )}

      <div className="relative w-full" ref={containerRef}>
        {/* Trigger Box - ONLY this box toggles isOpen */}
        <div
          onClick={() => !disabled && setIsOpen((prev) => !prev)}
          title={disabled ? disabledReason : undefined}
          className={`min-h-[42px] w-full rounded-md border border-input bg-card/60 px-3 py-1.5 flex items-center justify-between gap-2 transition-all focus-within:ring-1 focus-within:ring-primary shadow-2xs ${
            disabled ? "cursor-not-allowed opacity-60" : "hover:bg-card cursor-pointer"
          }`}
        >
          {/* Flex-wrap list of selected owner pills matching user image */}
          <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
            {internalSelected.length === 0 ? (
              <span className="text-xs text-muted-foreground select-none">
                Select Owners...
              </span>
            ) : (
              internalSelected.map((ownerName) => (
                <span
                  key={ownerName}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border/80 bg-muted/80 hover:bg-muted px-2 py-1 text-xs font-semibold text-foreground transition-colors group select-none shadow-2xs"
                >
                  <span
                    className={`h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-extrabold shrink-0 shadow-2xs ${getAvatarColor(
                      ownerName
                    )}`}
                  >
                    {getInitials(ownerName)}
                  </span>
                  <span className="truncate max-w-[150px]">{ownerName}</span>
                  {!disabled && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveOwner(ownerName);
                    }}
                    className="text-muted-foreground hover:text-destructive transition-colors ml-0.5 p-0.5 rounded cursor-pointer"
                    title={`Remove ${ownerName}`}
                  >
                    <X size={13} />
                  </button>
                  )}
                </span>
              ))
            )}
          </div>

          <ChevronDown
            size={16}
            className={`text-muted-foreground shrink-0 transition-transform ${
              isOpen ? "rotate-180 text-primary" : ""
            }`}
          />
        </div>

        {/* Searchable Dropdown Menu Popover (rendered independently below trigger box) */}
        {isOpen && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-lg border border-border bg-popover text-popover-foreground shadow-xl p-2 animate-in fade-in-0 zoom-in-95 duration-150"
          >
            {/* Search Input */}
            <div className="relative mb-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search team member..."
                className="w-full rounded-md border border-input bg-background pl-8 pr-3 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
                autoFocus
              />
              <Search
                size={13}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
              />
            </div>

            {/* Member Options List */}
            <div className="max-h-52 overflow-y-auto space-y-0.5 pr-1">
              {filteredList.length === 0 ? (
                <div className="py-4 text-center text-xs text-muted-foreground italic">
                  No matching members found
                </div>
              ) : (
                filteredList.map((u) => {
                  const isSelected = internalSelected.some(
                    (o) => o.toLowerCase() === u.name.toLowerCase()
                  );
                  return (
                    <div
                      key={u.id}
                      onClick={() => handleToggleOwner(u.name)}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-md cursor-pointer text-xs transition-colors select-none ${
                        isSelected
                          ? "bg-primary/15 font-semibold text-primary"
                          : "hover:bg-accent hover:text-accent-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate pointer-events-none">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          readOnly
                          className="rounded border-input text-primary h-3.5 w-3.5 cursor-pointer"
                        />
                        <span
                          className={`h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-extrabold shrink-0 ${getAvatarColor(
                            u.name
                          )}`}
                        >
                          {getInitials(u.name)}
                        </span>
                        <span className="truncate">{u.name}</span>
                        <span className="text-[10px] text-muted-foreground truncate">
                          ({u.email})
                        </span>
                      </div>

                      {isSelected && <Check size={14} className="text-primary shrink-0" />}
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
