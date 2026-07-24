"use client";

import { useState } from "react";

type Props = {
  name: string;
};

export function DashboardGreeting({ name }: Props) {
  const [greeting] = useState(() => {
    const h = new Date().getHours();
    if (h < 12) return "Good Morning";
    if (h < 17) return "Good Afternoon";
    return "Good Evening";
  });

  return (
    <h1 className="text-xl font-semibold">
      {greeting ? `${greeting}, ` : ""}
      {name}
    </h1>
  );
}
