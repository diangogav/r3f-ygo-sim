import {
  OcgCardLocPos,
  OcgHintType,
  OcgLocation,
  ocgLocationString,
  OcgMessage,
  OcgMessageType,
  ocgMessageTypeStrings,
  ocgPhaseString,
  ocgPositionString,
} from "ocgcore-wasm";
import { Fragment, ReactNode } from "react";
import { omit } from "remeda";
import { parseFieldMask } from "../../../lib/parse-field-mask";
import { getCardName, getHint } from "../../runner";
import { useGameStore } from "../../state";

export function DebugOcgMessages() {
  const ocgMessages = useGameStore((s) => s.debug.ocgMessages);
  return (
    <div className="flex-1 flex flex-col gap-1 overflow-auto bg-black/50 text-white min-w-96 max-w-[50vw] font-mono text-sm">
      {ocgMessages
        .slice()
        .reverse()
        .map((msg, i) => (
          <Message key={ocgMessages.length - i} message={msg} />
        ))}
    </div>
  );
}

interface MessageProps {
  message: OcgMessage;
}

function Message({ message }: MessageProps) {
  const messageType =
    ocgMessageTypeStrings.get(message.type) ?? `${message.type}`;

  return (
    <div className="flex flex-col gap-1">
      <div className="font-bold bg-red-500/50 px-2 self-stretch">
        {messageType}
      </div>
      <div className="flex flex-col gap-1 px-2">{messageContent(message)}</div>
    </div>
  );
}

function messageContent(m: OcgMessage) {
  switch (m.type) {
    case OcgMessageType.START: {
      return <div>Start</div>;
    }
    case OcgMessageType.NEW_TURN: {
      return <div>Player: P{m.player + 1}</div>;
    }
    case OcgMessageType.NEW_PHASE: {
      return <div>{ocgPhaseString.get(m.phase)}</div>;
    }
    case OcgMessageType.HINT: {
      switch (m.hint_type) {
        case OcgHintType.MESSAGE: {
          return (
            <div>
              Message for P{m.player + 1}: "{getHint(m.hint)}" (
              {m.hint.toString()})
            </div>
          );
        }
        case OcgHintType.EVENT: {
          return (
            <div>
              Event for P{m.player + 1}: "{getHint(m.hint)}" (
              {m.hint.toString()})
            </div>
          );
        }
        case OcgHintType.SELECTMSG: {
          return (
            <div>
              Select for P{m.player + 1}: "{getHint(m.hint)}" (
              {m.hint.toString()})
            </div>
          );
        }
        default: {
          const type = Object.entries(OcgHintType).find(
            (c) => c[1] === m.hint_type,
          )?.[0];
          return (
            <div className="text-red-500">
              Unknown hint type: {type ?? m.hint_type}
            </div>
          );
        }
      }
    }
    case OcgMessageType.DRAW: {
      return (
        <div>
          P{m.player + 1} draws {join(m.drawn.map((c) => card(c.code)))}
        </div>
      );
    }
    case OcgMessageType.MOVE: {
      return (
        <>
          <div>
            <span className="bg-white/10 inline-block px-1">
              "{getCardName(m.card)}"
            </span>
          </div>
          <div>From: {cardLocation(m.from)}</div>
          <div>To: {cardLocation(m.to)}</div>
        </>
      );
    }
    case OcgMessageType.SELECT_IDLECMD: {
      return (
        <>
          <div>
            Summon Monster: {join(m.summons.map((s) => card(s.code, s)))}
          </div>
          <div>
            Set Monster: {join(m.monster_sets.map((s) => card(s.code, s)))}
          </div>
          <div>
            Special Summon Monster:{" "}
            {join(m.special_summons.map((s) => card(s.code, s)))}
          </div>
          <div>Set Spell: {join(m.spell_sets.map((s) => card(s.code, s)))}</div>
          <div>
            Change Position: {join(m.pos_changes.map((s) => card(s.code, s)))}
          </div>
          <div>Activate: {join(m.activates.map((s) => card(s.code, s)))}</div>
          <div>To BP: {bool(m.to_bp)}</div>
          <div>To EP: {bool(m.to_ep)}</div>
          <div>Can Shuffle: {bool(m.shuffle)}</div>
        </>
      );
    }
    case OcgMessageType.SELECT_PLACE: {
      const mask = produceMask(m.field_mask);
      return <div className="whitespace-pre">{mask}</div>;
    }
    case OcgMessageType.SUMMONING: {
      return <div>{card(m.code, m)}</div>;
    }
    default: {
      return (
        <div className="text-xs whitespace-pre">
          {jsonStringify(omit(m, ["type"]))}
        </div>
      );
    }
  }
}

const maskContentMap = new Map<number, string>([
  [1, " mm "],
  [2, " st "],
  [3, " fs "],
  [4, " emz"],
  [5, " pl "],
  [6, " pr "],
]);

function produceMask(fieldMask: number) {
  const field = parseFieldMask(fieldMask);
  const h = (c: 0 | 1, m: 0 | 1, s: number, r: number) =>
    field.some(
      (x) =>
        x.controller === c &&
        x.location === (m ? OcgLocation.MZONE : OcgLocation.SZONE) &&
        x.sequence === s,
    )
      ? r
      : -r;

  const a = <T,>(length: number, map: (v: number) => T): T[] => {
    return Array.from({ length }, (_, i) => map(i));
  };
  const r = <T,>(length: number, map: (v: number) => T): T[] => {
    return Array.from({ length }, (_, i) => map(length - 1 - i));
  };

  const result = [
    [h(1, 0, 7, 6), ...r(5, (x) => h(1, 0, x, 2)), h(1, 0, 6, 5)],
    [0, ...r(5, (x) => h(1, 1, x, 1)), h(1, 0, 5, 3)],
    [0, 0, h(1, 1, 6, 4), 0, h(1, 1, 5, 4), 0, 0],
    [0, 0, h(0, 1, 5, 4), 0, h(0, 1, 6, 4), 0, 0],
    [h(0, 0, 5, 3), ...a(5, (x) => h(0, 1, x, 1)), 0],
    [h(0, 0, 6, 5), ...a(5, (x) => h(0, 0, x, 2)), h(0, 0, 7, 6)],
  ];

  const renderCell = (cell: number) => {
    if (cell === 0) {
      return "    ";
    }
    const content = maskContentMap.get(Math.abs(cell));
    return cell > 0 ? (
      <span className="text-white">{content}</span>
    ) : (
      <span className="text-gray-500">{content}</span>
    );
  };

  const renderLine = (line: number[]) => join(line.map(renderCell), null);

  return join(result.map(renderLine), "\n");
}

function join(
  values: ReactNode[],
  sep: ReactNode = ", ",
  empty: ReactNode = "none",
) {
  if (values.length === 0) {
    return <>{empty}</>;
  }
  return (
    <>
      {values.map((v, i) => (
        <Fragment key={i}>
          {i > 0 && sep}
          {v}
        </Fragment>
      ))}
    </>
  );
}

function card(code: number, location?: Partial<OcgCardLocPos>) {
  return (
    <span className="bg-white/10 inline-block px-1">
      "{getCardName(code)}"{location && <> ({cardLocation(location)})</>}
    </span>
  );
}

function bool(value: boolean) {
  return value ? (
    <span className="font-bold">true</span>
  ) : (
    <span className="font-bold">false</span>
  );
}

function cardLocation({
  controller,
  location,
  position,
  sequence,
  overlay_sequence,
}: Partial<OcgCardLocPos>) {
  const parts: string[] = [];
  if (controller !== undefined) {
    parts.push(`p${controller + 1}`);
  }
  if (location !== undefined) {
    parts.push(ocgLocationString.get(location));
  }
  if (sequence !== undefined) {
    parts.push(`#${sequence}`);
  }
  if (position !== undefined) {
    parts.push(ocgPositionString.get(position));
  }
  if (overlay_sequence !== undefined) {
    parts.push(`$${overlay_sequence}`);
  }
  return parts.join(", ");
}

function jsonStringify(data: any) {
  return JSON.stringify(
    data,
    (_key, value) => (typeof value === "bigint" ? value.toString() : value),
    2,
  );
}
