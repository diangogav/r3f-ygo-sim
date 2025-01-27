import { Controller, easings, useSpring } from "@react-spring/three";
import { useEffect, useState } from "react";
import * as R from "remeda";
import { Euler, Vector3 } from "three";
import { useShallow } from "zustand/react/shallow";
import { ControllerStateGlobal, ControllerStateOffset } from "../animations";
import { gs } from "../runner";
import {
  CardFieldPos,
  CardInfo,
  CardPos,
  GameState,
  isCardPosEqual,
  isFieldLocation,
  PlayerState,
  useGameStore,
} from "../state";

export const degToRad = Math.PI / 180;

export const fieldRotation = 15;

const cardScale = 2.5;
const cardRatio = 271 / 395;

const fieldEuler = [
  new Euler(-fieldRotation * degToRad, 0, 0),
  new Euler(-fieldRotation * degToRad, 0, 180 * degToRad),
] as const;

export const getFieldSlotPosition = (() => {
  const vec = new Vector3();

  return function getFieldSlotPosition(pos: CardFieldPos) {
    if (pos.location === "spellZone") {
      vec.set((pos.sequence - 2) * 2.5, -6, 0.01);
    } else if (pos.location === "mainMonsterZone") {
      vec.set((pos.sequence - 2) * 2.5, -3, 0.01);
    } else if (pos.location === "extraMonsterZone") {
      vec.set((pos.sequence * 2 - 1) * 2.5, 0, 0.01);
    }
    vec.applyEuler(fieldEuler[pos.controller]);
    return [vec.x, vec.y, vec.z] as const;
  };
})();

export const getCardPositionObj = (() => {
  const vec = new Vector3();
  const vecFinal = new Vector3();
  const rot = new Euler();
  const rotFinal = new Euler();

  return function getCardPositionObj(
    { pos, position, overlaySize, materials }: CardInfo,
    sizes: ControllerSizes,
  ) {
    const { controller, location, overlay } = pos;

    let faceDown = position === "down_atk" || position === "down_def";
    const defense = position === "down_def" || position === "up_def";

    if (isFieldLocation(location)) {
      let [[posX, posY, posZ], [rotX, rotY, rotZ]] = getCardLocalFieldPosition(
        pos,
        sizes,
      )!;

      posZ += materials.length * 0.05;
      if (overlay !== null) {
        posZ += overlay * 0.05;
        const posXFrom = posX - (cardScale - cardScale * cardRatio) / 2;
        const posXTo = posX + (cardScale - cardScale * cardRatio) / 2;
        posX += posXFrom + (posXTo - posXFrom) * (overlay / (overlaySize - 1));
      }

      vec.set(posX, posY, posZ);
      rot.set(rotX, rotY, rotZ);

      vecFinal.copy(vec);
      vecFinal.applyEuler(fieldEuler[controller]);
      rotFinal.copy(rot);

      if (overlay === null && faceDown) {
        rotFinal.y += 180 * degToRad;
      }
      if (overlay === null && defense && location !== "extra") {
        rotFinal.z += 90 * degToRad;
      }

      rotFinal.x += fieldEuler[controller].x;
      rotFinal.y += fieldEuler[controller].y;
      rotFinal.z += fieldEuler[controller].z;
    } else if (location === "hand") {
      const [posX, posY, posZ] = handPosition(pos, sizes);
      vec.set(posX, posY, posZ);
      rot.set(0, 0, controller === 1 ? 180 * degToRad : 0);
      vecFinal.copy(vec);
      rotFinal.copy(rot);
    }

    return {
      px: vecFinal.x,
      py: vecFinal.y,
      pz: vecFinal.z,
      rx: rotFinal.x,
      ry: rotFinal.y,
      rz: rotFinal.z,
    };
  };
})();

export function getCardPosition(info: CardInfo, sizes: ControllerSizes) {
  const res = getCardPositionObj(info, sizes);
  return [
    [res.px, res.py, res.pz],
    [res.rx, res.ry, res.rz],
  ] as const;
}

function handPosition(
  { controller, sequence }: CardPos,
  sizes: ControllerSizes,
) {
  let offset = sequence - Math.floor(sizes.hand / 2);
  if (sizes.hand % 2 === 0) offset += 0.5;
  return [
    offset * (controller === 0 ? 1.5 : 1.4),
    controller === 0 ? -8 : 7.5,
    (controller === 0 ? 6 : 1) + sequence * 0.01,
  ] as const;
}

const getCardLocalFieldPosition = (() => {
  const position = new Vector3();
  const rotation = new Euler();

  return function getCardLocalFieldPosition(
    { sequence, location }: CardPos,
    sizes: ControllerSizes,
  ) {
    switch (location) {
      case "deck": {
        position.set(7.5, -6, (sizes.deck - sequence) * 0.01);
        rotation.set(0, 0, 0);
        break;
      }
      case "extra": {
        const extraDown = sizes.extra - sizes.extraUp;
        const fup = sequence >= extraDown;
        const offset = fup ? extraDown + sequence : sizes.extra - sequence;
        position.set(-7.5, -6, offset * 0.01);
        rotation.set(0, 0, 0);
        break;
      }
      case "spellZone": {
        position.set((sequence - 2) * 2.5, -6, 0.01);
        rotation.set(0, 0, 0);
        break;
      }
      case "mainMonsterZone": {
        position.set((sequence - 2) * 2.5, -3, 0.01);
        rotation.set(0, 0, 0);
        break;
      }
      case "extraMonsterZone": {
        position.set((sequence * 2 - 1) * 2.5, 0, 0.01);
        rotation.set(0, 0, 0);
        break;
      }
      case "fieldZone": {
        position.set(-7.5, -3, 0.01);
        rotation.set(0, 0, 0);
        break;
      }
      case "grave": {
        position.set(7.5, -3, (sequence + 1) * 0.01);
        rotation.set(0, 0, 0);
        break;
      }
      case "banish": {
        position.set(7.5, 0, (sequence + 1) * 0.01);
        rotation.set(0, 0, 90 * degToRad);
        break;
      }
      default: {
        return null;
      }
    }
    return [
      [position.x, position.y, position.z],
      [rotation.x, rotation.y, rotation.z],
    ] as const;
  };
})();

function isFaceUp(c: CardInfo) {
  return c.position === "up_atk" || c.position === "up_def";
}

export interface ControllerSizes {
  deck: number;
  extra: number;
  extraUp: number;
  hand: number;
  grave: number;
  banish: number;
}

export function getPlayerSizes(player: PlayerState) {
  return {
    deck: player.field.deck.length,
    banish: player.field.banish.length,
    extra: player.field.extra.length,
    extraUp: R.sumBy(player.field.extra, (c) => (isFaceUp(c) ? 1 : 0)),
    grave: player.field.grave.length,
    hand: player.field.hand.length,
  } as ControllerSizes;
}

export function useControllerSizes(controller: 0 | 1) {
  return useGameStore(
    useShallow((s: GameState) => getPlayerSizes(s.players[controller])),
  );
}

export function useComputeCardPosition(card: CardInfo) {
  const {
    pos: { controller, location, overlay, sequence },
    position,
  } = card;

  const sizes = useControllerSizes(controller);
  const [initialPosition] = useState(() => getCardPositionObj(card, sizes));

  const [global] = useState(() => {
    return new Controller<ControllerStateGlobal>({
      px: initialPosition.px,
      py: initialPosition.py,
      pz: initialPosition.pz,
      rx: initialPosition.rx,
      ry: initialPosition.ry,
      rz: initialPosition.rz,
    });
  });

  const [offset] = useState(() => {
    return new Controller<ControllerStateOffset>({
      py: 0,
    });
  });

  useEffect(() => {
    if (gs().events.length > 0) {
      return;
    }
    global.stop(true);
    global.set(getCardPositionObj(card, sizes));
    offset.stop(true);
    offset.set({ py: 0 });
  });
  // }, [controller, location, overlay, sequence, position, sizes]);

  return { g: global, o: offset };
}

export function useHandOffset(card: CardInfo) {
  const {
    pos: { controller, location },
  } = card;
  const playerField = useGameStore((s) => s.players[controller]);
  const selectedCard = useGameStore((s) => s.selectedCard);
  const idle = useGameStore((s) => s.events.length === 0);

  const [hover, updateHover] = useState(false);
  const isHover = idle && hover;

  const selected =
    selectedCard?.pos && isCardPosEqual(selectedCard.pos, card.pos);

  let hy = 0;
  let hz = 0;
  let hs = 1;

  if (location === "hand") {
    const handSize = playerField.field.hand.length;
    const mult = controller === 0 ? 1 : -1;
    hy = selected ? 0.15 * mult : isHover ? 0.15 * mult : 0;
    hs = selected ? 1.05 : 1;
    hz = selected ? (handSize + 1) * 0.01 : isHover ? handSize * 0.01 : 0;
  }

  const springs = useSpring({
    hy,
    hz,
    hs,
    config: {
      ease: easings.easeInOutQuad,
      duration: 150,
    },
  });

  return {
    springs,
    hover,
    updateHover,
  };
}
