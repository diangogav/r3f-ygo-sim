import { CardPos } from ".";

interface DuelEventStart {
  type: "start";
}

interface DuelEventDraw {
  type: "draw";
  player1: number[];
  player2: number[];
}

interface DuelEventMove {
  type: "move";
  code: number;
  source: CardPos;
  dest: CardPos;
}

interface DuelEventPhase {
  type: "phase";
}

export type DuelEvent =
  | DuelEventStart
  | DuelEventDraw
  | DuelEventMove
  | DuelEventPhase;
