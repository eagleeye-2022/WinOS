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

  if (!time) return null;

  return (
    <>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-medium tabular-nums shadow-xs">
          <Clock size={13} className="text-sky-400" />
          <span>{time}</span>
        </div>

        {/* <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 rounded-full bg-[#0088ff] px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#0077ee] transition-colors"
          title="Log Time"
        >
          <Plus size={13} />
          <span>Time Log</span>
        </button> */}
      </div>

      <NewTimeLogModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
