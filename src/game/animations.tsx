import { delay } from "@/lib/delay";
import {
  AsyncResult,
  Controller,
  ControllerUpdate,
  easings,
} from "@react-spring/core";
import { RefObject, useEffect } from "react";
import { gs } from "./runner";
import {
  CardInfo,
  EventGameState,
  extractEventGS,
  isCardPosEqual,
  isFaceup,
  isFieldNotPileLocation,
  useGameStore,
} from "./state";
import { getCardPositionObj, getPlayerSizes } from "./utils/position";

export interface CardAnimationsProps {
  cardMotionValuesRef: RefObject<Map<string, CardAnimationRef>>;
}

export function CardAnimations({ cardMotionValuesRef }: CardAnimationsProps) {
  const currentEvent = useGameStore((s) => s.events.at(0));

  useEffect(() => {
    if (!currentEvent) {
      return;
    }

    const { event, nextState } = currentEvent;
    console.log(
      "animating",
      currentEvent.id,
      event,
      extractEventGS(gs()),
      nextState,
    );

    const context: AnimationContext = {
      promises: [],
      toCancel: [],
      cardApis: cardMotionValuesRef.current,
      currentState: gs(),
      nextState: nextState,
      runAnimation(ref, g, o) {
        this.toCancel.push(ref);
        g && this.promises.push(ref.g.start([g]));
        o && this.promises.push(ref.o.start([o]));
      },
    };

    switch (event.type) {
      case "move": {
        const from = event.card.pos;
        const to = event.nextCard.pos;
        animateMove(event.card, event.nextCard, context);
        for (const [index, card] of event.card.materials.entries()) {
          animateMove(card, event.nextCard.materials[index], context);
        }
        if (from.location === "hand") {
          animateReorderHand(from.controller, context);
        }
        if (to.location === "hand") {
          animateReorderHand(to.controller, context);
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
        animateShuffleHand(event.player, context);
        break;
      }
      default:
        return;
    }

    let complete = false;
    Promise.allSettled(context.promises)
      .then((results) => {
        const cancelled = results.filter(
          (r) => r.status === "fulfilled" && r.value.cancelled,
        );
        if (cancelled.length > 0) {
          console.log("CANCELLED!?!", cancelled);
        }
        return delay(50);
      })
      .then(() => {
        if (complete) return;

        complete = true;
        // console.log("COMPLETE", currentEvent.id);
        gs().nextEvent();
      });

    return () => {
      if (complete) return;

      complete = true;
      for (const api of context.toCancel) {
        api.g.stop(true);
        api.o.stop(true);
      }
    };
  }, [currentEvent?.id]);

  return <></>;
}

export interface ControllerStateGlobal {
  px: number;
  py: number;
  pz: number;
  rx: number;
  ry: number;
  rz: number;
}

export interface ControllerStateOffset {
  py: number;
}

export interface CardAnimationRef {
  g: Controller<ControllerStateGlobal>;
  o: Controller<ControllerStateOffset>;
}

interface AnimationContext {
  runAnimation: (
    ref: CardAnimationRef,
    g?: ControllerUpdate<ControllerStateGlobal>,
    o?: ControllerUpdate<ControllerStateOffset>,
  ) => void;
  promises: AsyncResult<Controller<any>>[];
  toCancel: CardAnimationRef[];
  currentState: EventGameState;
  nextState: EventGameState;
  cardApis: Map<string, CardAnimationRef>;
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
    const api = c.cardApis.get(card.id)!;

    const offset = i * 100;
    const speed = 300;

    if (controller === 0) {
      c.runAnimation(api, {
        to: [{ ...newPos, py: newPos.py + 3 }, { py: newPos.py }],
        config: { duration: speed, easing: easings.easeInOutQuad },
        delay: offset,
      });
    } else {
      c.runAnimation(api, {
        ...newPos,
        config: { duration: speed, easing: easings.easeInOutQuad },
        delay: offset,
      });
    }
  }
  for (let i = 0; i < currentHand.length; i++) {
    const card = currentHand[i];
    const nextCard = nextHand.find((c) => c.id === card.id)!;
    const newPos = getCardPositionObj(nextCard, nextSizes);
    const api = c.cardApis.get(card.id)!;

    const speed = 300;

    c.runAnimation(api, {
      to: newPos,
      config: { duration: speed, easing: easings.easeInOutQuad },
      delay: 0,
    });
  }
}

function animateReorderHand(controller: 0 | 1, c: AnimationContext) {
  const hand = c.currentState.players[controller].field.hand;
  const nextHand = c.nextState.players[controller].field.hand;
  const nextSizes = getPlayerSizes(c.nextState.players[controller]);

  for (const card of hand) {
    const nextCard = nextHand.find((c) => c.id === card.id);
    if (!nextCard) {
      // card removed
      continue;
    }
    const newPos = getCardPositionObj(nextCard, nextSizes);
    const api = c.cardApis.get(nextCard.id)!;

    const speed = 300;
    c.runAnimation(api, {
      to: newPos,
      config: { duration: speed, easing: easings.easeInOutQuad },
      delay: 0,
    });
  }
}
function animateShuffleHand(controller: 0 | 1, c: AnimationContext) {
  const hand = c.currentState.players[controller].field.hand;
  const sizes = getPlayerSizes(c.currentState.players[controller]);
  const nextHand = c.nextState.players[controller].field.hand;
  const nextSizes = getPlayerSizes(c.nextState.players[controller]);

  const centerPos = getCardPositionObj(
    { ...nextHand[0], pos: { ...nextHand[0].pos, sequence: 0 } },
    { ...nextSizes, hand: 1 },
  );

  for (const nextCard of nextHand) {
    const sequence = nextCard.pos.sequence;
    const card = hand.find((c) => c.id === nextCard.id);
    const pos = getCardPositionObj(card!, sizes);
    const newPos = getCardPositionObj(nextCard, nextSizes);
    const api = c.cardApis.get(nextCard.id)!;

    const speed = 300;

    c.runAnimation(api, {
      from: pos,
      to: [{ ...centerPos, pz: centerPos.pz + sequence * 0.01 }, newPos],
      config: { duration: speed, easing: easings.easeInOutQuad },
      delay: 0,
    });
  }
}

function animateMove(card: CardInfo, nextCard: CardInfo, c: AnimationContext) {
  const controller = nextCard.pos.controller;
  const nextSizes = getPlayerSizes(c.nextState.players[controller]);
  const newPos = getCardPositionObj(nextCard, nextSizes);
  const api = c.cardApis.get(card.id)!;

  const speed = 300;

  c.runAnimation(api, {
    ...newPos,
    config: { duration: speed, easing: easings.easeInOutQuad },
    delay: 0,
  });
  return;

  let oanim: ControllerUpdate<ControllerStateOffset> | undefined = undefined;
  if (
    isCardPosEqual(card.pos, nextCard.pos) &&
    isFaceup(card.position) !== isFaceup(nextCard.position)
  ) {
    oanim = {
      to: [
        {
          py: 1,
          config: { duration: speed / 2, easing: easings.easeOutQuad },
          delay: 0,
        },
        {
          py: 0,
          config: { duration: speed / 2, easing: easings.easeInQuad },
          delay: speed / 2,
        },
      ],
      delay: 0,
    };
  }

  if (
    !isFieldNotPileLocation(card.pos.location) &&
    isFieldNotPileLocation(nextCard.pos.location)
  ) {
    c.runAnimation(
      api,
      {
        to: [
          { ...newPos, py: newPos.py + 1, pz: newPos.pz + 1 },
          { py: newPos.py, pz: newPos.pz },
        ],
        config: { duration: speed, easing: easings.easeInOutQuad },
        delay: 0,
      },
      oanim,
    );
  } else {
    c.runAnimation(
      api,
      {
        ...newPos,
        config: { duration: speed, easing: easings.easeInOutQuad },
        delay: 0,
      },
      oanim,
    );
  }
}
