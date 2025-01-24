"use client";

import dynamic from "next/dynamic";

export const GameLoader = dynamic(
  () => import("../../game").then((m) => m.GameLoader),
  {
    loading() {
      return <>Loading...</>;
    },
    ssr: false,
  },
);
