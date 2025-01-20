import { useAnimatedValue } from "@/lib/hooks/use-animated-value";
import { useMotionValue } from "framer-motion";
import { useEffect, useState } from "react";
import { Euler, Vector3 } from "three";
import { useShallow } from "zustand/react/shallow";
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
    }
    vec.applyEuler(fieldEuler[pos.controller]);
    return [vec.x, vec.y, vec.z] as const;
  };
})();

export const getCardPosition = (() => {
  const vec = new Vector3();
  const vecFinal = new Vector3();
  const rot = new Euler();
  const rotFinal = new Euler();

  return function getCardPosition(
    { pos, position }: CardInfo,
    sizes: ControllerSizes,
  ) {
    const { controller, location } = pos;

    let faceDown = position === "down_atk" || position === "down_def";
    const defense = position === "down_def" || position === "up_def";

    if (isFieldLocation(location)) {
      const [[posX, posY, posZ], [rotX, rotY, rotZ]] =
        getCardLocalFieldPosition(pos, sizes)!;
      vec.set(posX, posY, posZ);
      rot.set(rotX, rotY, rotZ);

      vecFinal.copy(vec);
      vecFinal.applyEuler(fieldEuler[controller]);
      rotFinal.copy(rot);

      if (faceDown) {
        rotFinal.y += 180 * degToRad;
      }
      if (defense) {
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

    return [
      [vecFinal.x, vecFinal.y, vecFinal.z],
      [rotFinal.x, rotFinal.y, rotFinal.z],
    ] as const;
  };
})();

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
        position.set(-7.5, -6, (sizes.extra - sequence) * 0.01);
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

export interface ControllerSizes {
  deck: number;
  extra: number;
  hand: number;
  grave: number;
  banish: number;
}

export function getPlayerSizes(player: PlayerState) {
  return {
    deck: player.field.deck.length,
    banish: player.field.banish.length,
    extra: player.field.extra.length,
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

  const [initialPosition] = useState(() => {
    const [[posX, posY, posZ], [rotX, rotY, rotZ]] = getCardPosition(
      card,
      sizes,
    );
    return { posX, posY, posZ, rotX, rotY, rotZ };
  });

  const mPosX = useMotionValue(initialPosition.posX);
  const mPosY = useMotionValue(initialPosition.posY);
  const mPosZ = useMotionValue(initialPosition.posZ);
  const mRotX = useMotionValue(initialPosition.rotX);
  const mRotY = useMotionValue(initialPosition.rotY);
  const mRotZ = useMotionValue(initialPosition.rotZ);

  useEffect(() => {
    const [[posX, posY, posZ], [rotX, rotY, rotZ]] = getCardPosition(
      card,
      sizes,
    );
    mPosX.jump(posX);
    mPosY.jump(posY);
    mPosZ.jump(posZ);
    mRotX.jump(rotX);
    mRotY.jump(rotY);
    mRotZ.jump(rotZ);
  }, [controller, location, overlay, sequence, position, sizes]);

  return [
    [mPosX, mPosY, mPosZ],
    [mRotX, mRotY, mRotZ],
  ] as const;
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

  const selected = selectedCard && isCardPosEqual(selectedCard, card.pos);

  let handOffsetY = 0;
  let handOffsetZ = 0;
  let handScale = 1;

  if (location === "hand") {
    const handSize = playerField.field.hand.length;
    const mult = controller === 0 ? 1 : -1;
    handOffsetY = selected ? 0.15 * mult : isHover ? 0.15 * mult : 0;
    handScale = selected ? 1.05 : 1;
    handOffsetZ = selected
      ? (handSize + 1) * 0.01
      : isHover
        ? handSize * 0.01
        : 0;
  }

  const mHandOffsetY = useAnimatedValue(handOffsetY, {
    type: "tween",
    duration: 0.15,
  });
  const mHandOffsetZ = useAnimatedValue(handOffsetZ, {
    type: "tween",
    duration: 0.15,
  });
  const mHandScale = useAnimatedValue(handScale, {
    type: "tween",
    duration: 0.15,
  });

  return {
    mHandOffsetY,
    mHandOffsetZ,
    mHandScale,
    hover,
    updateHover,
  };
}
