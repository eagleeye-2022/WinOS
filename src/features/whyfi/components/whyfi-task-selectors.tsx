"use client";

import { useMemo, useState } from "react";
import { SearchableSelect } from "@/components/shared/searchable-select";
import type { WhyfiPickerTask } from "../actions";
import { pickerLists, subtaskOptions, topLevelCard, topLevelCardsOfList } from "../picker-tree";

const selectCls = "text-xs font-medium text-foreground hover:text-primary transition-colors";

function Divider() {
  return <div className="h-3.5 w-px bg-border shrink-0" />;
}

/**
 * Shared Task List → Task → Subtask pickers for a Whyfi School (learning) row — the same flow as
 * the Srijan Project → Task list → Task → Subtask pickers on DSM task rows.
 *
 * `value` is the linked card's id (a task, or a subtask at any depth); `onChange` gets the id of
 * the deepest card picked, or "" when the row is unlinked.
 */
export function WhyfiTaskSelectors({
  tasks,
  loading = false,
  value,
  onChange,
  disabled = false,
}: {
  tasks: WhyfiPickerTask[];
  loading?: boolean;
  value: string;
  onChange: (taskId: string) => void;
  disabled?: boolean;
}) {
  const linked = value ? tasks.find((t) => t.id === value) : undefined;
  const linkedTop = linked ? topLevelCard(tasks, linked) : undefined;

  // Before anything is linked, the picked list / task are kept locally.
  const [localListId, setLocalListId] = useState("");
  const [localTaskId, setLocalTaskId] = useState("");
  const listId = linked?.projectId ?? localListId;
  const taskId = linkedTop?.id ?? localTaskId;

  const lists = useMemo(() => pickerLists(tasks), [tasks]);
  const listTasks = topLevelCardsOfList(tasks, listId);
  const subOptions = useMemo(() => subtaskOptions(tasks, taskId), [tasks, taskId]);
  const subtaskId = linked && linkedTop && linked.id !== linkedTop.id ? linked.id : "";

  return (
    <>
      <SearchableSelect
        value={listId}
        onChange={(v) => {
          setLocalListId(v);
          setLocalTaskId("");
          // Switching list drops a link to a card in another list.
          if (linked && linked.projectId !== v) onChange("");
        }}
        options={lists.map((l) => ({ value: l.id, label: l.name }))}
        placeholder={loading ? "Loading..." : lists.length === 0 ? "No task lists shared" : "Select Task List"}
        searchPlaceholder="Search task lists..."
        className={`${selectCls} max-w-[180px]`}
        disabled={disabled}
      />

      {listId && (
        <>
          <Divider />
          <SearchableSelect
            value={taskId}
            onChange={(v) => {
              setLocalTaskId(v);
              onChange(v);
            }}
            options={listTasks.map((t) => ({ value: t.id, label: `[${t.code}] ${t.name}` }))}
            placeholder={listTasks.length === 0 ? "No open tasks" : "Select Task"}
            searchPlaceholder="Search tasks..."
            className={`${selectCls} max-w-[220px]`}
            disabled={disabled}
          />
        </>
      )}

      {taskId && subOptions.length > 0 && (
        <>
          <Divider />
          <SearchableSelect
            value={subtaskId}
            // Clearing the subtask links the row back to the task itself.
            onChange={(v) => onChange(v || taskId)}
            options={subOptions}
            placeholder="Select Subtask"
            searchPlaceholder="Search subtasks..."
            className={`${selectCls} max-w-[220px]`}
            disabled={disabled}
          />
        </>
      )}
    </>
  );
}
