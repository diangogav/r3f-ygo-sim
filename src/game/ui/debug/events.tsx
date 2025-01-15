import { omit } from "remeda";
import { DuelEventEntry, useGameStore } from "../../state";

export function DebugEventQueue() {
  const events = useGameStore((s) => s.events);
  return (
    <div className="flex-1 flex flex-col gap-1 overflow-auto bg-black/50 text-white min-w-96 max-w-[50vw] font-mono text-sm">
      {events.map((e) => (
        <Event key={e.id} event={e} />
      ))}
    </div>
  );
}

interface EventProps {
  event: DuelEventEntry;
}

function Event({ event }: EventProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="font-bold bg-red-500/50 px-2 self-stretch">
        {event.event.type}
      </div>
      <div className="flex flex-col gap-1 px-2">
        <div>{event.id}</div>
        <div className="whitespace-pre">
          {JSON.stringify(omit(event.event, ["type"]), null, 2)}
        </div>
      </div>
    </div>
  );
}
