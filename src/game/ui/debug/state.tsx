import { useShallow } from "zustand/react/shallow";
import { extractEventGS, useGameStore } from "../../state";

export function DebugState() {
  const store = useGameStore(useShallow((s) => extractEventGS(s)));

  return (
    <div className="flex-1 flex flex-col gap-1 overflow-auto bg-black/50 text-white min-w-96 max-w-[50vw] font-mono text-sm">
      <div className="whitespace-pre">{JSON.stringify(store, null, 2)}</div>
    </div>
  );
}
