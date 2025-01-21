import { animate, AnimationSequence, MotionValue } from "framer-motion";
import { RefObject, useEffect } from "react";
import { gs } from "./runner";
import {
  EventfulGameState,
  isFieldNotPileLocation,
  useGameStore,
} from "./state";
import { DuelEventMove } from "./state/event";
import { getCardPositionObj, getPlayerSizes } from "./utils/position";

export interface CardAnimationsProps {
  cardMotionValuesRef: RefObject<Map<string, CardMotionValues>>;
}

export function CardAnimations({ cardMotionValuesRef }: CardAnimationsProps) {
  const currentEvent = useGameStore((s) => s.events.at(0));

  useEffect(() => {
    if (!currentEvent) {
      return;
    }

    const { event, nextState } = currentEvent;
    console.log("animating", currentEvent.id, event);

    const context: AnimationContext = {
      sequence: [],
      cardMVs: cardMotionValuesRef.current,
      currentState: gs(),
      nextState: nextState,
    };

    switch (event.type) {
      case "move": {
        const from = event.card.pos;
        const to = event.nextCard.pos;
        animateMove(event, context);
        if (from.location === "hand" || to.location === "hand") {
          animateReorderHand(from.controller, context);
        }
        break;
      }
      case "draw": {
        if (event.player1.length > 0) {
          animatePlayerDraws(0, event.player1.length, context);
        }
        if (event.player2.length > 0) {
          animatePlayerDraws(1, event.player2.length, context);
        }
        break;
      }
      case "shuffle": {
        animateReorderHand(event.player, context);
        break;
      }
      default:
        return;
    }

    const animation = animate(context.sequence);
    const onCompleted = () => setTimeout(() => gs().nextEvent(), 200);
    animation.then(onCompleted, onCompleted);
    return () => animation.cancel();
  }, [currentEvent?.id]);

  return <></>;
}

export interface CardMotionValues {
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

interface AnimationContext {
  sequence: AnimationSequence;
  currentState: EventfulGameState;
  nextState: EventfulGameState;
  cardMVs: Map<string, CardMotionValues>;
}

function animatePlayerDraws(
  controller: 0 | 1,
  draws: number,
  c: AnimationContext,
) {
  const currentDeck = c.currentState.players[controller].field.deck;
  const currentHand = c.currentState.players[controller].field.hand;
  const nextHand = c.nextState.players[controller].field.hand;
  const nextSizes = getPlayerSizes(c.nextState.players[controller]);

  for (let i = 0; i < draws; i++) {
    const card = currentDeck[i];
    const nextCard = nextHand.find((c) => c.id === card.id)!;
    const newPos = getCardPositionObj(nextCard, nextSizes);
    const m = c.cardMVs.get(card.id)!;

    const offset = i * 0.2;
    const speed = 0.3;

    if (controller === 0) {
      c.sequence.push(
        [m.hs, 1.1, { duration: speed, at: offset }],
        [m.px, newPos.px, { duration: speed, at: offset }],
        [m.py, newPos.py + 3, { duration: speed, at: offset }],
        [m.pz, newPos.pz, { duration: speed, at: offset }],
        [m.rx, newPos.rx, { duration: speed, at: offset }],
        [m.ry, newPos.ry, { duration: speed, at: offset }],
        [m.rz, newPos.rz, { duration: speed, at: offset }],

        [m.hs, 1, { duration: speed, at: offset + speed * 2 }],
        [m.py, newPos.py, { duration: speed, at: offset + speed * 2 }],
      );
    } else {
      c.sequence.push(
        [m.px, newPos.px, { duration: speed, at: offset }],
        [m.py, newPos.py, { duration: speed, at: offset }],
        [m.pz, newPos.pz, { duration: speed, at: offset }],
        [m.rx, newPos.rx, { duration: speed, at: offset }],
        [m.ry, newPos.ry, { duration: speed, at: offset }],
        [m.rz, newPos.rz, { duration: speed, at: offset }],
      );
    }
  }
  for (let i = 0; i < currentHand.length; i++) {
    const card = currentHand[i];
    const nextCard = nextHand.find((c) => c.id === card.id)!;
    const newPos = getCardPositionObj(nextCard, nextSizes);
    const m = c.cardMVs.get(card.id)!;

    const speed = 0.3;
    c.sequence.push(
      [m.px, newPos.px, { duration: speed, at: 0 }],
      [m.py, newPos.py, { duration: speed, at: 0 }],
      [m.pz, newPos.pz, { duration: speed, at: 0 }],
      [m.rx, newPos.rx, { duration: speed, at: 0 }],
      [m.ry, newPos.ry, { duration: speed, at: 0 }],
      [m.rz, newPos.rz, { duration: speed, at: 0 }],
    );
  }
}

function animateReorderHand(controller: 0 | 1, c: AnimationContext) {
  const nextHand = c.nextState.players[controller].field.hand;
  const nextSizes = getPlayerSizes(c.nextState.players[controller]);

  for (const card of nextHand) {
    const nextCard = nextHand.find((c) => c.id === card.id)!;
    const newPos = getCardPositionObj(nextCard, nextSizes);
    const m = c.cardMVs.get(card.id)!;

    const speed = 0.3;
    c.sequence.push(
      [m.px, newPos.px, { duration: speed, at: 0 }],
      [m.py, newPos.py, { duration: speed, at: 0 }],
      [m.pz, newPos.pz, { duration: speed, at: 0 }],
      [m.rx, newPos.rx, { duration: speed, at: 0 }],
      [m.ry, newPos.ry, { duration: speed, at: 0 }],
      [m.rz, newPos.rz, { duration: speed, at: 0 }],
    );
  }
}

function animateMove(event: DuelEventMove, c: AnimationContext) {
  const m = c.cardMVs.get(event.card.id)!;
  const speed = 0.5;

  const nextSizes = getPlayerSizes(
    c.nextState.players[event.nextCard.pos.controller],
  );
  const newPos = getCardPositionObj(event.nextCard, nextSizes);

  c.sequence.push(
    [m.px, newPos.px, { duration: speed, at: 0 }],
    [m.rx, newPos.rx, { duration: speed, at: 0 }],
    [m.ry, newPos.ry, { duration: speed, at: 0 }],
    [m.rz, newPos.rz, { duration: speed, at: 0 }],
  );

  if (
    !isFieldNotPileLocation(event.card.pos.location) &&
    isFieldNotPileLocation(event.nextCard.pos.location)
  ) {
    c.sequence.push(
      [m.py, newPos.py + 1, { duration: speed, at: 0 }],
      [m.pz, newPos.pz + 1, { duration: speed, at: 0 }],
      [m.py, newPos.py, { duration: speed / 2, at: speed }],
      [m.pz, newPos.pz, { duration: speed / 2, at: speed }],
    );
  } else {
    c.sequence.push(
      [m.py, newPos.py, { duration: speed, at: 0 }],
      [m.pz, newPos.pz, { duration: speed, at: 0 }],
    );
  }
}
