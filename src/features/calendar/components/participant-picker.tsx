type InternalUser = { id: string; name: string | null; email: string };

type Props = {
  users: InternalUser[];
  currentUserId: string;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
};

export function ParticipantPicker({ users, currentUserId, selectedIds, onChange }: Props) {
  const others = users.filter((u) => u.id !== currentUserId);

  function toggle(id: string) {
    onChange(
      selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id],
    );
  }

  return (
    <div className="max-h-40 overflow-y-auto rounded-md border">
      {others.length === 0 ? (
        <p className="px-3 py-2 text-xs text-muted-foreground">No other users to invite.</p>
      ) : (
        others.map((u) => (
          <label
            key={u.id}
            className="flex cursor-pointer items-center gap-2 border-b px-3 py-2 text-sm last:border-b-0 hover:bg-accent/50"
          >
            <input
              type="checkbox"
              name="participantIds"
              value={u.id}
              checked={selectedIds.includes(u.id)}
              onChange={() => toggle(u.id)}
              className="accent-primary"
            />
            <span className="truncate">{u.name ?? u.email}</span>
          </label>
        ))
      )}
    </div>
  );
}
