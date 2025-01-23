import { CardInfo, CardPos } from ".";

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
  card: CardInfo;
  nextCard: CardInfo;
  reason?: "summon" | "spsummon";
}

export interface DuelEventPhase {
  type: "phase";
}

export interface DuelEventShuffle {
  type: "shuffle";
  player: 0 | 1;
}

export interface DuelEventChain {
  type: "chain";
  card: CardInfo;
  trigger: CardPos;
  link: number;
}

export interface DuelEventChainSolved {
  type: "chainSolved";
  link: number;
}

export type DuelEvent =
  | DuelEventStart
  | DuelEventDraw
  | DuelEventMove
  | DuelEventShuffle
  | DuelEventPhase
  | DuelEventChain
  | DuelEventChainSolved;
