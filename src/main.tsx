import { StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { GameLoader } from "./game";

import "./style.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Suspense fallback="Loading...">
      <GameLoader />
    </Suspense>
  </StrictMode>,
);
