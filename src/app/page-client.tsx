"use client";

import dynamic from "next/dynamic";

export const Game = dynamic(() => import("../game").then((m) => m.Game), {
  loading() {
    return <>Loading...</>;
  },
  ssr: false,
});
