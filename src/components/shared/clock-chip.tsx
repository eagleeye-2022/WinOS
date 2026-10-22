"use client";

import { useEffect, useState } from "react";
import { Plus, Clock } from "lucide-react";
import { NewTimeLogModal } from "@/features/projects/components/modals/new-time-log-modal";

export function ClockChip() {
  const [time, setTime] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    function tick() {
      setTime(
        new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Fixed width, so the chip (and the module tabs beside it) don't shift as the digits change
            each second; it's also reserved before the first tick instead of popping in. */}
        <div className="flex w-[124px] shrink-0 items-center justify-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-medium tabular-nums shadow-xs">
          <Clock size={13} className="shrink-0 text-sky-400" />
          <span className="whitespace-nowrap">{time || "--:--:-- --"}</span>
        </div>

        {/* <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 rounded-full bg-[#0088ff] px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#0077ee] transition-colors"
          title="Log Effort"
        >
          <Plus size={13} />
          <span>Effort Log</span>
        </button> */}
      </div>

      <NewTimeLogModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
