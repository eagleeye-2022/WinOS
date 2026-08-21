import { GanttTimelineView } from "@/features/projects/components/views/gantt-timeline-view";

export default function TimelinePage() {
  return (
    <div className="flex flex-col h-screen w-full bg-background overflow-hidden">
      <GanttTimelineView />
    </div>
  );
}
