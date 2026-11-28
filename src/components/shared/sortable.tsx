"use client";

// Smooth drag-to-reorder built on dnd-kit, shared by the project task board (cards between
// phase columns), the task page's sidebar tree and its Subtasks table.
//
// - `SmartPointerSensor` starts a drag only after the pointer moves 6px, and never from a
//   control inside the card (select, input, button, link…) or from a nested sortable item —
//   so clicking, typing and the card's own menus keep working, and grabbing a subtask moves
//   the subtask, not its parent card.
// - `SortableStack` is a self-contained vertical list (own DndContext): wrap each item in a
//   `SortableBlock` (whole block draggable) or render a `SortableHandle` inside it.
// - After a drop, the click the browser fires on pointer-up is swallowed, so dropping a card
//   doesn't also open it.

import {
  createContext,
  useContext,
  useId,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type HTMLAttributes,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  closestCenter,
  defaultDropAnimationSideEffects,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type DraggableSyntheticListeners,
  type DropAnimation,
  type PointerSensorOptions,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";

/** Marks a sortable item's root element, so a press inside a nested item is left to that item. */
export const DND_ITEM_ATTR = "data-dnd-item";

const INTERACTIVE =
  'input, textarea, select, button, a[href], label, [contenteditable="true"], [role="menuitem"], [role="option"], [data-no-dnd]';

/** True when a drag may start from `target` for the item whose root is `node` (or handle `activator`). */
export function canStartDragFrom(target: EventTarget | null, node: HTMLElement | null, activator?: HTMLElement | null): boolean {
  if (!(target instanceof Element) || !node) return false;
  // Events from portals (popovers, modals) bubble through React to the card — ignore them.
  if (!node.contains(target)) return false;
  // A press inside a nested sortable item belongs to that item.
  if (target.closest(`[${DND_ITEM_ATTR}]`) !== node) return false;
  // Controls inside the card keep working (the drag handle itself may be a button-ish element).
  const stop = activator ?? node;
  for (let el: Element | null = target; el && el !== stop; el = el.parentElement) {
    if (el.matches(INTERACTIVE)) return false;
  }
  return true;
}

export class SmartPointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: "onPointerDown" as const,
      handler: (
        { nativeEvent: event }: ReactPointerEvent,
        { onActivation }: PointerSensorOptions,
        context?: { active: { node: { current: HTMLElement | null }; activatorNode?: { current: HTMLElement | null } } }
      ): boolean => {
        if (!event.isPrimary || event.button !== 0) return false;
        const node = context?.active.node.current ?? null;
        const activator = context?.active.activatorNode?.current ?? null;
        if (!canStartDragFrom(event.target, node, activator)) return false;
        onActivation?.({ event });
        return true;
      },
    },
  ];
}

/** Mouse/touch (after a 6px move) + keyboard (focus, Space to pick up, arrows, Space to drop). */
export function useSmoothSensors() {
  return useSensors(
    useSensor(SmartPointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
}

/** Swallows the click the browser fires right after a drop, so the dropped card doesn't open. */
export function suppressNextClick() {
  if (typeof window === "undefined") return;
  const swallow = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
  };
  window.addEventListener("click", swallow, { capture: true, once: true });
  window.setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0);
}

export const smoothDropAnimation: DropAnimation = {
  duration: 220,
  easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
  sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0.35" } } }),
};

const noopSubscribe = () => () => {};

/** True in the browser (after hydration), false on the server. */
export function useIsClient() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

/** dnd-kit's screen-reader text goes to <body>, not inline (inline it would be a <div> inside a
 *  <tbody>, or an extra child that throws off `space-y-*` spacing). Pass to `accessibility`. */
export function useDndAccessibility() {
  const isClient = useIsClient();
  return { container: isClient ? document.body : undefined };
}

/** Re-measure while dragging, so lists that change mid-drag (cards moving columns) stay exact. */
export const alwaysMeasure = { droppable: { strategy: MeasuringStrategy.Always } };

export const sortableTransition = { duration: 200, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" };

// ── Handle support ─────────────────────────────────────────────────────────────────────────────

type HandleCtx = {
  listeners: DraggableSyntheticListeners;
  setActivatorNodeRef: (el: HTMLElement | null) => void;
  disabled: boolean;
};
const SortableHandleContext = createContext<HandleCtx | null>(null);

/** Drag grip for a `SortableBlock handle` / `SortableRow` — only this element starts the drag. */
export function SortableHandle({ className, children, title = "Drag to reorder" }: { className?: string; children: ReactNode; title?: string }) {
  const ctx = useContext(SortableHandleContext);
  const setActivatorNodeRef = ctx?.setActivatorNodeRef;
  const listeners = ctx?.listeners;
  if (!ctx || ctx.disabled) return null;
  return (
    <span
      ref={setActivatorNodeRef}
      {...listeners}
      onClick={(e) => e.stopPropagation()}
      title={title}
      className={cn("cursor-grab touch-none active:cursor-grabbing", className)}
    >
      {children}
    </span>
  );
}

function useSortableItem(id: UniqueIdentifier, disabled: boolean, data?: Record<string, unknown>) {
  const sortable = useSortable({ id, disabled, data, transition: sortableTransition });
  const style: CSSProperties = {
    transform: CSS.Translate.toString(sortable.transform),
    transition: sortable.transition,
    position: "relative",
    zIndex: sortable.isDragging ? 30 : undefined,
  };
  return { ...sortable, style };
}

/** A sortable item: the whole block is draggable, or only its `SortableHandle` when `handle`. */
export function SortableBlock({
  id,
  disabled = false,
  handle = false,
  data,
  className,
  draggingClassName,
  children,
}: {
  id: UniqueIdentifier;
  disabled?: boolean;
  handle?: boolean;
  data?: Record<string, unknown>;
  className?: string;
  /** Extra classes while this item is the one being dragged. */
  draggingClassName?: string;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, style, isDragging } = useSortableItem(id, disabled, data);
  const dragProps = handle || disabled ? {} : { ...attributes, ...listeners };
  return (
    <SortableHandleContext.Provider value={{ listeners, setActivatorNodeRef, disabled }}>
      <div
        ref={setNodeRef}
        {...{ [DND_ITEM_ATTR]: "" }}
        style={style}
        {...dragProps}
        // dnd-kit makes the block focusable for keyboard dragging; no focus ring on mouse clicks.
        className={cn("outline-none", !handle && !disabled && "touch-manipulation", className, isDragging && draggingClassName)}
      >
        {children}
      </div>
    </SortableHandleContext.Provider>
  );
}

/** A sortable `<tr>` (tables can't use a wrapper div); drag it by a `SortableHandle` inside. */
export function SortableRow({
  id,
  disabled = false,
  data,
  className,
  draggingClassName,
  children,
  ...rest
}: Omit<HTMLAttributes<HTMLTableRowElement>, "id"> & {
  id: UniqueIdentifier;
  disabled?: boolean;
  data?: Record<string, unknown>;
  draggingClassName?: string;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, style, isDragging } = useSortableItem(id, disabled, data);
  return (
    <SortableHandleContext.Provider value={{ listeners, setActivatorNodeRef, disabled }}>
      <tr
        ref={setNodeRef}
        {...{ [DND_ITEM_ATTR]: "" }}
        style={style}
        {...rest}
        aria-roledescription={attributes["aria-roledescription"]}
        className={cn(className, isDragging && draggingClassName)}
      >
        {children}
      </tr>
    </SortableHandleContext.Provider>
  );
}

/**
 * A vertical list you can reorder by dragging. Wrap each item in a `SortableBlock`/`SortableRow`
 * with the same ids, in the same order. `onReorder` gets the new order of ids (only on a real move).
 * Without `renderOverlay` the item itself slides with the pointer; with it, a floating copy does.
 */
export function SortableStack({
  ids,
  onReorder,
  onDragStateChange,
  renderOverlay,
  children,
}: {
  ids: UniqueIdentifier[];
  onReorder: (nextIds: UniqueIdentifier[], movedId: UniqueIdentifier) => void;
  /** Called with the dragged id on pick-up and null on drop/cancel. */
  onDragStateChange?: (activeId: UniqueIdentifier | null) => void;
  renderOverlay?: (id: UniqueIdentifier) => ReactNode;
  children: ReactNode;
}) {
  const dndId = useId();
  const sensors = useSmoothSensors();
  const accessibility = useDndAccessibility();
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);

  const finish = (id: UniqueIdentifier | null) => {
    setActiveId(id);
    onDragStateChange?.(id);
  };

  const handleEnd = ({ active, over }: DragEndEvent) => {
    finish(null);
    suppressNextClick();
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(active.id);
    const to = ids.indexOf(over.id);
    if (from === -1 || to === -1) return;
    onReorder(arrayMove(ids, from, to), active.id);
  };

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      accessibility={accessibility}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      measuring={alwaysMeasure}
      onDragStart={({ active }: DragStartEvent) => finish(active.id)}
      onDragEnd={handleEnd}
      onDragCancel={() => finish(null)}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
      {renderOverlay && (
        <DragOverlay dropAnimation={smoothDropAnimation}>{activeId != null ? renderOverlay(activeId) : null}</DragOverlay>
      )}
    </DndContext>
  );
}
