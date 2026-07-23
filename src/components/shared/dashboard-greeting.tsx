"use client";

import { useEffect, useState } from "react";

type Props = {
  name: string;
};

export function DashboardGreeting({ name }: Props) {
  const [greeting, setGreeting] = useState("");

  useEffect(() => {
    const h = new Date().getHours();
    if (h < 12) {
      setGreeting("Good Morning");
    } else if (h < 17) {
      setGreeting("Good Afternoon");
    } else {
      setGreeting("Good Evening");
    }
  }, []);

  return (
    <h1 className="text-xl font-semibold">
      {greeting ? `${greeting}, ` : ""}
      {name}
    </h1>
  );
}
