"use client";

import { useState } from "react";

type Props = {
  name: string;
};

function toTitleCase(str: string): string {
  if (!str) return "";
  return str
    .split(/[\s._-]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function DashboardGreeting({ name }: Props) {
  const [greeting] = useState(() => {
    const h = new Date().getHours();
    if (h < 12) return "Good Morning";
    if (h < 17) return "Good Afternoon";
    return "Good Evening";
  });

  const formattedName = toTitleCase(name);

  return (
    <h1 className="text-xl font-semibold">
      {greeting ? `${greeting}, ` : ""}
      {formattedName}
    </h1>
  );
}
