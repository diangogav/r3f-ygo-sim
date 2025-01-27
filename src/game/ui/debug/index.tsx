import { cn } from "@/lib/cn";
import { ReactNode, useState } from "react";
import { DebugEventQueue } from "./events";
import { DebugOcgMessages } from "./ocg-messages";
import { DebugState } from "./state";

type DebugMenuView = null | "ocgmsg" | "events" | "state";

export function DebugMenu() {
  const [view, setView] = useState<DebugMenuView>(null);

  return (
    <div
      className={cn(
        "absolute top-4 right-4 flex flex-col gap-2 items-end z-50",
        view !== null && "bottom-4",
      )}
    >
      <div className="flex gap-1">
        <DebugMenuButton view={view} setView={setView} target="ocgmsg">
          Core Messages
        </DebugMenuButton>
        <DebugMenuButton view={view} setView={setView} target="events">
          Event Queue
        </DebugMenuButton>
        <DebugMenuButton view={view} setView={setView} target="state">
          State
        </DebugMenuButton>
      </div>
      {view === "ocgmsg" && <DebugOcgMessages />}
      {view === "events" && <DebugEventQueue />}
      {view === "state" && <DebugState />}
    </div>
  );
}

interface DebugMenuButtonProps {
  view: DebugMenuView;
  setView: (view: DebugMenuView) => void;
  target: DebugMenuView;
  children?: ReactNode;
}

function DebugMenuButton({
  view,
  setView,
  target,
  children,
}: DebugMenuButtonProps) {
  return (
    <button
      className={cn(
        "bg-orange-500 hover:bg-orange-400 py-1 px-2 uppercase font-bold text-sm",
        view === target && "bg-orange-700 hover:bg-orange-800",
      )}
      onClick={() => (view === target ? setView(null) : setView(target))}
    >
      {children}
    </button>
  );
}
