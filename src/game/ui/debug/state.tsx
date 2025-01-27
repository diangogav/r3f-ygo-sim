import JsonView from "@uiw/react-json-view";
import { darkTheme } from "@uiw/react-json-view/dark";
import { useShallow } from "zustand/react/shallow";
import { extractEventGS, useGameStore } from "../../state";

export function DebugState() {
  const store = useGameStore(useShallow((s) => extractEventGS(s)));

  return (
    <div className="flex-1 flex flex-col gap-1 overflow-auto bg-black/50 text-white min-w-96 max-w-[50vw] font-mono text-sm p-2">
      <JsonView value={store} style={darkTheme} collapsed />
    </div>
  );
}
