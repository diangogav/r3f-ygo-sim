import { animate, AnimationSequence, MotionValue } from "framer-motion";
import { gs } from "./runner";
import {
  CardInfo,
  EventfulGameState,
  getCardWithId,
  isCardPosEqual,
  isFieldNotPileLocation,
} from "./state";
import {
  DuelEvent,
  DuelEventDraw,
  DuelEventMove,
  DuelEventShuffle,
} from "./state/event";
import { getCardPosition, getPlayerSizes } from "./utils/position";

export type AnimationCleanup = (() => void) | undefined | void;

interface AnimationMotionContext {
  px: MotionValue<number>;
  py: MotionValue<number>;
  pz: MotionValue<number>;
  rx: MotionValue<number>;
  ry: MotionValue<number>;
  rz: MotionValue<number>;
  hpy: MotionValue<number>;
  hpz: MotionValue<number>;
  hs: MotionValue<number>;
}

type Animation<T extends DuelEvent> = (
  event: T,
  nextState: EventfulGameState,
  card: CardInfo,
  m: AnimationMotionContext,
) => AnimationCleanup;

export const animateMove: Animation<DuelEventMove> = (
  event,
  nextState,
  card,
  m,
) => {
  if (!isCardPosEqual(card.pos, event.source)) {
    return;
  }

  const newCard = getCardWithId(nextState, card.id) ?? card;
  const [[posX, posY, posZ], [rotX, rotY, rotZ]] = getCardPosition(
    newCard,
    getPlayerSizes(nextState.players[newCard.pos.controller]),
  );

  const speed = 0.5;
  const seq: AnimationSequence = [];

  seq.push(
    [m.px, posX, { duration: speed, at: 0 }],
    [m.rx, rotX, { duration: speed, at: 0 }],
    [m.ry, rotY, { duration: speed, at: 0 }],
    [m.rz, rotZ, { duration: speed, at: 0 }],
  );

  if (
    !isFieldNotPileLocation(card.pos.location) &&
    isFieldNotPileLocation(newCard.pos.location)
  ) {
    seq.push(
      [m.py, posY + 1, { duration: speed, at: 0 }],
      [m.pz, posZ + 1, { duration: speed, at: 0 }],
      [m.py, posY, { duration: speed / 2, at: speed }],
      [m.pz, posZ, { duration: speed / 2, at: speed }],
    );
  } else {
    seq.push(
      [m.py, posY, { duration: speed, at: 0 }],
      [m.pz, posZ, { duration: speed, at: 0 }],
    );
  }

  const animation = animate(seq);
  const onCompleted = () => gs().nextEvent();
  animation.then(onCompleted, onCompleted);

  return () => animation.cancel();
};

export const animateDrawTarget: Animation<DuelEventDraw> = (
  event,
  nextState,
  card,
  m,
) => {
  if (card.pos.location !== "deck") {
    return;
  }

  const {
    pos: { controller, sequence },
  } = card;
  const draws = controller === 0 ? event.player1 : event.player2;

  if (sequence >= draws.length) {
    return;
  }

  const newCard = getCardWithId(nextState, card.id) ?? card;
  const [[posX, posY, posZ], [rotX, rotY, rotZ]] = getCardPosition(
    newCard,
    getPlayerSizes(nextState.players[newCard.pos.controller]),
  );

  const offset = sequence * 0.2;
  const speed = 0.3;

  const animation = animate([
    [m.px, posX, { duration: speed, at: offset }],
    [m.pz, posZ, { duration: speed, at: offset }],
    [m.rx, rotX, { duration: speed, at: offset }],
    [m.ry, rotY, { duration: speed, at: offset }],
    [m.rz, rotZ, { duration: speed, at: offset }],
    ...(controller === 0
      ? ([
          [m.py, posY + 3, { duration: speed, at: offset }],
          [m.hs, 1.1, { duration: speed, at: offset }],
          [m.py, posY, { duration: speed, at: offset + speed * 2 }],
          [m.hs, 1, { duration: speed, at: offset + speed * 2 }],
        ] as AnimationSequence)
      : ([[m.py, posY, { duration: speed, at: offset }]] as AnimationSequence)),
  ]);

  if (
    sequence === 0 &&
    (controller === 0 || (controller === 1 && event.player1.length === 0))
  ) {
    const onCompleted = () => gs().nextEvent();
    animation.then(onCompleted, onCompleted);
  }

  return () => animation.cancel();
};

const handsizeChangeEvents = ["draw", "move"] as const;
function isHandSizeChangeEvent(
  s: string,
): s is (typeof handsizeChangeEvents)[number] {
  return (handsizeChangeEvents as readonly string[]).includes(s);
}

export const animateHandSizeChange: Animation<DuelEvent> = (
  event,
  nextState,
  card,
  m,
) => {
  if (!isHandSizeChangeEvent(event.type) || card.pos.location !== "hand") {
    return;
  }

  const newCard = getCardWithId(nextState, card.id) ?? card;
  if (
    newCard.pos.location !== "hand" ||
    newCard.pos.controller !== card.pos.controller
  ) {
    return;
  }

  const [[posX, posY, posZ], [rotX, rotY, rotZ]] = getCardPosition(
    newCard,
    getPlayerSizes(nextState.players[newCard.pos.controller]),
  );
  const animation = animate([
    [m.px, posX, { duration: 0.2 }],
    [m.py, posY, { duration: 0.2 }],
    [m.pz, posZ, { duration: 0.2 }],
    [m.rx, rotX, { duration: 0.2 }],
    [m.ry, rotY, { duration: 0.2 }],
    [m.rz, rotZ, { duration: 0.2 }],
  ]);
  return () => animation.cancel();
};

export const animateShuffle: Animation<DuelEventShuffle> = (
  event,
  nextState,
  card,
  m,
) => {
  const {
    pos: { location, controller, sequence },
  } = card;

  if (location !== "hand" && controller !== event.player) {
    return;
  }

  const newCard = getCardWithId(nextState, card.id) ?? card;

  const [[posX, posY, posZ], [rotX, rotY, rotZ]] = getCardPosition(
    newCard,
    getPlayerSizes(nextState.players[newCard.pos.controller]),
  );

  const animation = animate([
    [m.px, posX, { duration: 0.2 }],
    [m.py, posY, { duration: 0.2 }],
    [m.pz, posZ, { duration: 0.2 }],
    [m.rx, rotX, { duration: 0.2 }],
    [m.ry, rotY, { duration: 0.2 }],
    [m.rz, rotZ, { duration: 0.2 }],
  ]);

  // use the old first card to sequence
  if (sequence === 0) {
    const onCompleted = () => gs().nextEvent();
    animation.then(onCompleted, onCompleted);
  }

  return () => animation.cancel();
};
