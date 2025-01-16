import { Game } from "./game";
import "./style.css";
import { StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Suspense fallback={"Loading..."}>
      <Game />
    </Suspense>
  </StrictMode>,
);
