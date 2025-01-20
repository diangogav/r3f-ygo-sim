import {
  OcgCardLocPos,
  ocgHintTimingParse,
  ocgHintTimingString,
  OcgHintType,
  ocgLocationString,
  OcgMessage,
  OcgMessageType,
  ocgMessageTypeStrings,
  ocgPhaseString,
  ocgPositionString,
} from "ocgcore-wasm";
import { Fragment, ReactNode } from "react";
import { omit } from "remeda";
import { fieldMaskMapping } from "../../../lib/parse-field-mask";
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
      // TODO: add information in activates
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
      return (
        <>
          <div>Player: P{m.player + 1}</div>
          <div className="whitespace-pre">{mask}</div>
        </>
      );
    }
    case OcgMessageType.SELECT_CHAIN: {
      // TODO: add information in activates
      return (
        <>
          <div>Player: P{m.player + 1}</div>
          <div>Forced: {bool(m.forced)}</div>
          <div>SPECOUNT: {m.spe_count}</div>
          <div>
            Hint timing:{" "}
            {join(
              ocgHintTimingParse(m.hint_timing).map((h) =>
                ocgHintTimingString.get(h),
              ),
            )}
          </div>
          <div>
            Hint timing other:{" "}
            {join(
              ocgHintTimingParse(m.hint_timing_other).map((h) =>
                ocgHintTimingString.get(h),
              ),
            )}
          </div>
          <div>Activate: {join(m.selects.map((s) => card(s.code, s)))}</div>
        </>
      );
    }
    case OcgMessageType.SUMMONING: {
      return <div>{card(m.code, m)}</div>;
    }
    case OcgMessageType.SET: {
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

function produceMask(m: number) {
  const v = (val: number, content: string) =>
    (m & val) === 0 ? (
      <span className="text-white">{content}</span>
    ) : (
      <span className="text-gray-500">{content}</span>
    );
  const fm = fieldMaskMapping;

  const empt = "    ";
  const v0m0 = v(fm["0m0"], " mm ");
  const v0m1 = v(fm["0m1"], " mm ");
  const v0m2 = v(fm["0m2"], " mm ");
  const v0m3 = v(fm["0m3"], " mm ");
  const v0m4 = v(fm["0m4"], " mm ");
  const v0e0 = v(fm["0e0"], " em ");
  const v0e1 = v(fm["0e1"], " em ");
  const v0s0 = v(fm["0s0"], " st ");
  const v0s1 = v(fm["0s1"], " st ");
  const v0s2 = v(fm["0s2"], " st ");
  const v0s3 = v(fm["0s3"], " st ");
  const v0s4 = v(fm["0s4"], " st ");
  const v0fs = v(fm["0fs"], " fs ");
  const v0p0 = v(fm["0p0"], " pl ");
  const v0p1 = v(fm["0p1"], " pr ");
  const v1m0 = v(fm["1m0"], " mm ");
  const v1m1 = v(fm["1m1"], " mm ");
  const v1m2 = v(fm["1m2"], " mm ");
  const v1m3 = v(fm["1m3"], " mm ");
  const v1m4 = v(fm["1m4"], " mm ");
  const v1e0 = v(fm["1e0"], " em ");
  const v1e1 = v(fm["1e1"], " em ");
  const v1s0 = v(fm["1s0"], " st ");
  const v1s1 = v(fm["1s1"], " st ");
  const v1s2 = v(fm["1s2"], " st ");
  const v1s3 = v(fm["1s3"], " st ");
  const v1s4 = v(fm["1s4"], " st ");
  const v1fs = v(fm["1fs"], " fs ");
  const v1p0 = v(fm["1p0"], " pl ");
  const v1p1 = v(fm["1p1"], " pr ");

  return (
    <>
      {join([v1p1, v1s4, v1s3, v1s2, v1s1, v1s0, v1p0], "")}
      {"\n"}
      {join([empt, v1m4, v1m3, v1m2, v1m1, v1m0, v1fs], "")}
      {"\n"}
      {join([empt, empt, v1e1, empt, v1e0, empt, empt], "")}
      {"\n"}
      {join([empt, empt, v0e1, empt, v0e0, empt, empt], "")}
      {"\n"}
      {join([empt, v0m0, v0m1, v0m2, v0m3, v0m4, v0fs], "")}
      {"\n"}
      {join([v0p1, v0s0, v0s1, v0s2, v0s3, v0s4, v0p0], "")}
      {"\n"}
    </>
  );
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
