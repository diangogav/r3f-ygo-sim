import clsx from "clsx";
import { ReactNode, useState } from "react";
import { DebugOcgMessages } from "./ocg-messages";
import { DebugEventQueue } from "./events";

type DebugMenuView = null | "ocgmsg" | "events";

export function DebugMenu() {
  const [view, setView] = useState<DebugMenuView>(null);

  return (
    <div
      className={clsx(
        "absolute top-4 right-4 flex flex-col gap-2 items-end",
        view !== null && "bottom-4"
      )}
    >
      <div className="flex gap-1">
        <DebugMenuButton view={view} setView={setView} target="ocgmsg">
          Core Messages
        </DebugMenuButton>
        <DebugMenuButton view={view} setView={setView} target="events">
          Event Queue
        </DebugMenuButton>
      </div>
      {view === "ocgmsg" && <DebugOcgMessages />}
      {view === "events" && <DebugEventQueue />}
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
      className={clsx(
        "bg-orange-500 hover:bg-orange-400 py-2 px-4 uppercase font-bold",
        view === target && "bg-orange-700 hover:bg-orange-800"
      )}
      onClick={() => (view === target ? setView(null) : setView(target))}
    >
      {children}
    </button>
  );
}
