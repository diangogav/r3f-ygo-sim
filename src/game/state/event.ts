import { CardPos } from ".";

export interface DuelEventStart {
  type: "start";
}

export interface DuelEventDraw {
  type: "draw";
  player1: number[];
  player2: number[];
}

export interface DuelEventMove {
  type: "move";
  code: number;
  source: CardPos;
  dest: CardPos;
  reason?: "summon" | "spsummon";
}

export interface DuelEventPhase {
  type: "phase";
}

export interface DuelEventShuffle {
  type: "shuffle";
  player: 0 | 1;
}

export type DuelEvent =
  | DuelEventStart
  | DuelEventDraw
  | DuelEventMove
  | DuelEventShuffle
  | DuelEventPhase;
