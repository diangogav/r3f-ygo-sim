import {
  Html,
  Hud,
  OrthographicCamera,
  PerspectiveCamera,
  Text,
  useTexture,
} from "@react-three/drei";
import { Canvas, extend } from "@react-three/fiber";
import { EffectComposer } from "@react-three/postprocessing";
import {
  AnimatePresence,
  AnimationSequence,
  ValueAnimationTransition,
  animate,
  motion as htmlMotion,
  useMotionValue,
  useTransform,
} from "framer-motion";
import { motion } from "framer-motion-3d";
import { OcgResponseType } from "ocgcore-wasm";
import {
  ComponentProps,
  ReactNode,
  RefObject,
  Suspense,
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { twc } from "react-twc";
import {
  Color,
  Euler,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  PointLight,
  Vector3,
} from "three";
import { MeshTestMaterial } from "../components/three/test-material";
import { cn } from "../lib/cn";
import {
  convertGameLocation,
  gameInstancePromise,
  runSimulatorStep,
  sendResponse,
} from "./runner";
import {
  CardAction,
  CardFieldPos,
  CardInfo,
  CardLocation,
  CardPos,
  DialogConfig,
  PlayerState,
  isPileLocation,
  useGameStore,
} from "./state";
import { DebugMenu } from "./ui/debug";

const degToRad = Math.PI / 180;

const load = gameInstancePromise;

extend({
  Group,
  PointLight,
  MeshStandardMaterial,
  PlaneGeometry,
  Object3D,
  Mesh,
});

export function Game() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const allCards = useAllCards();

  useEffect(() => {
    let cancel = false;
    (async () => {
      await load;
      if (cancel) {
        return;
      }
      // console.log("loaded!");
      useGameStore.getState().queueEvent({ event: { type: "start" } });
      runSimulatorStep();
    })();

    return () => {
      cancel = true;
    };
  }, []);

  const playerField = useGameStore((s) => s.players[0]);
  const setSelectedHandCard = useGameStore((s) => s.setSelectedHandCard);
  const selectField = useGameStore((s) => s.selectField);

  useEffect(() => {
    setSelectedHandCard(null);
  }, [playerField.field.hand.length]);

  return (
    <>
      <GameWrapper ref={wrapperRef}>
        <RenderDialog />
        <Canvas
          shadows
          dpr={[1, 2]}
          resize={{ scroll: false, offsetSize: true }}
        >
          <PerspectiveCamera makeDefault fov={70} position={[0, -2, 16]} />
          <group
            onClick={() => setSelectedHandCard(null)}
            onPointerMissed={() => setSelectedHandCard(null)}
          >
            <mesh position={[0, 0, 0]} rotation={[-20 * degToRad, 0, 0]}>
              <meshStandardMaterial color="#fff" />
              <planeGeometry args={[30, 20, 1]} />
            </mesh>
            <pointLight color="#fff" position={[5, 0, 20]} intensity={500} />
            {allCards.map((card) => (
              <RenderCard wrapperRef={wrapperRef} key={card.id} card={card} />
            ))}
            {selectField && (
              <RenderSelectField
                positions={selectField.positions}
                count={selectField.count}
              />
            )}
          </group>
          <Effects />
          <TurnState />
        </Canvas>
      </GameWrapper>
      <DebugMenu />
    </>
  );
}

function TurnState({}: {}) {
  const width = 10;
  const height = width * (9 / 16);

  const event = useGameStore((s) => s.events.at(0));
  const currentEventRef = useRef<null | string>(null);
  currentEventRef.current = event?.id ?? null;

  return (
    <Hud renderPriority={1}>
      <OrthographicCamera
        makeDefault
        left={-width}
        right={width}
        bottom={-height}
        top={height}
        position={[0, 0, 10]}
      />
      <AnimatePresence>
        {event && event.event.type === "start" && (
          <motion.group
            key={event.id}
            initial={{ x: 20 }}
            animate={{ x: 0 }}
            exit={{ x: -20 }}
            transition={{ duration: 2 }}
            onAnimationComplete={() => {
              if (event.id === currentEventRef.current) {
                useGameStore.getState().nextEvent();
              }
            }}
          >
            <Suspense>
              <Text
                color="black"
                anchorX="center"
                anchorY="middle"
                fontWeight={800}
              >
                DUEL START!
              </Text>
            </Suspense>
          </motion.group>
        )}
      </AnimatePresence>
    </Hud>
  );
}

type RenderSelectFieldProps = {
  positions: CardFieldPos[];
  count: number;
};

function RenderSelectField({ positions, count }: RenderSelectFieldProps) {
  const [selected, setSelected] = useState(() => new Set<number>());

  const onConfirm = (set: Set<number>) => {
    const places = Array.from(set.values(), (index) =>
      convertGameLocation({ ...positions[index], overlay: null })
    );
    sendResponse({
      type: OcgResponseType.SELECT_PLACE,
      places: places.map(({ controller, location, sequence }) => ({
        player: controller,
        location,
        sequence,
      })),
    });
    runSimulatorStep();
  };

  // TODO: implement partial selection and finish

  return (
    <Suspense>
      {positions.map((pos, index) => (
        <RenderSelectFieldSlot
          key={index}
          pos={pos}
          selected={selected.has(index)}
          onSelect={() => {
            const newSelected = new Set(selected.values());
            if (newSelected.has(index)) {
              newSelected.delete(index);
            } else {
              newSelected.add(index);
            }

            if (count === 1 && newSelected.size === 1) {
              onConfirm(newSelected);
            } else {
              setSelected(newSelected);
            }
          }}
        />
      ))}
    </Suspense>
  );
}

type RenderSelectFieldSlotProps = {
  pos: CardFieldPos;
  selected: boolean;
  onSelect: () => void;
};

function RenderSelectFieldSlot({
  pos,
  selected,
  onSelect,
}: RenderSelectFieldSlotProps) {
  const [slotTexture] = useTexture(["/images/slot.png"]);

  const [hover, setHover] = useState(false);

  const [v] = useState(() => new Vector3());
  if (pos.location === "spellZone") {
    v.set((pos.sequence - 2) * 2.5, -6, 0.01);
  } else if (pos.location === "mainMonsterZone") {
    v.set((pos.sequence - 2) * 2.5, -3, 0.01);
  }
  v.applyEuler(fieldEuler[pos.controller]);

  return (
    <motion.mesh
      position={[v.x, v.y, v.z]}
      rotation={[-20 * degToRad, 0, 0]}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      onClick={() => onSelect()}
    >
      <motion.meshStandardMaterial
        map={slotTexture}
        transparent
        animate={{ color: hover ? "#3333ff" : "#aaaaff" }}
        transition={{ type: "spring", bounce: 0, duration: 0.2 }}
      />
      <planeGeometry args={[cardScale, cardScale, 1]} />
    </motion.mesh>
  );
}

function Effects() {
  // const { size } = useThree();
  return null;

  return (
    <EffectComposer stencilBuffer autoClear={false} multisampling={4}>
      <></>
    </EffectComposer>
  );
}

function RenderDialog() {
  const dialog = useGameStore((s) => s.dialog);

  return (
    <AnimatePresence>
      {dialog && (
        <htmlMotion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="bg-gray-500 p-[1cqw] text-[1.5cqw] rounded-[1cqw]">
            <div className="text-center">{dialog.title}</div>
            {dialog.type === "yesno" && (
              <DialogSelectYesNo type={dialog.type} />
            )}
            {dialog.type === "effectyn" && (
              <DialogSelectYesNo type={dialog.type} />
            )}
            {dialog.type === "cards" && (
              <DialogSelectCard
                cards={dialog.cards!}
                min={dialog.min!}
                max={dialog.max!}
                canCancel={dialog.canCancel!}
              />
            )}
          </div>
        </htmlMotion.div>
      )}
    </AnimatePresence>
  );
}

type DialogSelectCardProps = {
  cards: Exclude<DialogConfig["cards"], undefined>;
  min: number;
  max: number;
  canCancel: boolean;
};

function DialogSelectCard({
  cards,
  min,
  max,
  canCancel,
}: DialogSelectCardProps) {
  const [selected, setSelected] = useState(() => new Set<number>());

  const canContinue = min <= selected.size && selected.size <= max;

  return (
    <>
      <div className="max-w-[30cqw] overflow-x-auto">
        <div className="flex items-center gap-[1cqw] py-[1cqw]">
          {cards.map((c, i) => (
            <div
              key={i}
              className="flex-none bg-black"
              onClick={() => {
                if (min === 1 && min === max) {
                  setSelected(new Set([i]));
                } else if (selected.has(i) && min > selected.size) {
                  setSelected((s) => {
                    const s1 = new Set(s);
                    s1.delete(i);
                    return s1;
                  });
                } else if (!selected.has(i) && max < selected.size) {
                  setSelected((s) => new Set(s).add(i));
                }
              }}
            >
              <img
                className={cn(
                  "h-[8cqw] opacity-50",
                  selected.has(i) && "opacity-100"
                )}
                src={getProxiedUrl(
                  `https://images.ygoprodeck.com/images/cards/${c.code}.jpg`
                )}
                alt=""
              />
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-center gap-[2cqw] mt-[1cqw]">
        <Button
          onClick={() => {
            sendResponse({
              type: OcgResponseType.SELECT_CARD,
              indicies: [...selected.values()],
            });
            runSimulatorStep();
          }}
          aria-disabled={!canContinue}
        >
          Continue
        </Button>
        {(canCancel || min === 0) && <Button onClick={() => {}}>Cancel</Button>}
      </div>
    </>
  );
}

const Button = twc.button`py-[0.5cqw] px-[1cqw] rounded-[1cqw] bg-gray-800 text-white hover:bg-gray-700 aria-disabled:bg-gray-600`;

type DialogSelectYesNoProps = {
  type: "yesno" | "effectyn";
};

function DialogSelectYesNo({ type }: DialogSelectYesNoProps) {
  const handleClick = useCallback((yes: boolean) => {
    sendResponse({
      type:
        type === "yesno"
          ? OcgResponseType.SELECT_YESNO
          : OcgResponseType.SELECT_EFFECTYN,
      yes,
    });
    runSimulatorStep();
  }, []);

  return (
    <div className="flex items-center justify-center gap-[2cqw] mt-[1cqw]">
      <Button onClick={() => handleClick(true)}>Yes</Button>
      <Button onClick={() => handleClick(false)}>No</Button>
    </div>
  );
}

const fieldTransitionConfig = {
  type: "spring",
  duration: 0.5,
  bounce: 0,
} as const;

function handPosition(
  { controller, sequence }: CardPos,
  playerField: PlayerState
) {
  const handSize = playerField.field.hand.length;
  let offset = sequence - Math.floor(handSize / 2);
  if (handSize % 2 === 0) offset += 0.5;
  return [
    offset * (controller === 0 ? 1.5 : 1.4),
    controller === 0 ? -8 : 7.5,
    (controller === 0 ? 6 : 1) + sequence * 0.01,
  ] as const;
}

function isSlamAnimation(prevLocation: CardLocation, location: CardLocation) {
  return (
    ["deck", "hand", "grave", "extra", "banish"].includes(prevLocation) &&
    ["extraMonsterZone", "mainMonsterZone"].includes(location)
  );
}

function isFieldLocation(location: CardLocation) {
  return [
    "deck",
    "grave",
    "extra",
    "banish",
    "spellZone",
    "fieldZone",
    "extraMonsterZone",
    "mainMonsterZone",
  ].includes(location);
}

const fieldEuler = [
  new Euler(-20 * degToRad, 0, 0),
  new Euler(-20 * degToRad, 0, 180 * degToRad),
] as const;

const getCardPosition = (() => {
  const vec = new Vector3();
  const vecFinal = new Vector3();
  const rot = new Euler();
  const rotFinal = new Euler();

  return function getCardPosition(
    { pos, position }: CardInfo,
    fieldState: PlayerState
  ) {
    const { controller, location } = pos;

    let faceDown = position === "down_atk" || position === "down_def";
    const defense = position === "down_def" || position === "up_def";

    if (isFieldLocation(location)) {
      const [[posX, posY, posZ], [rotX, rotY, rotZ]] =
        getCardLocalFieldPosition(pos, fieldState)!;
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
      const [posX, posY, posZ] = handPosition(pos, fieldState);
      vec.set(posX, posY, posZ);
      rot.set(0, 0, 0);
      vecFinal.copy(vec);
      rotFinal.copy(rot);

      if (faceDown && controller === 1) {
        rotFinal.y += 180 * degToRad;
      }
    }

    return [
      [vecFinal.x, vecFinal.y, vecFinal.z],
      [rotFinal.x, rotFinal.y, rotFinal.z],
    ] as const;
  };
})();

const getCardLocalFieldPosition = (() => {
  const position = new Vector3();
  const rotation = new Euler();

  return function getCardLocalFieldPosition(
    { sequence, location }: CardPos,
    playerField: PlayerState
  ) {
    switch (location) {
      case "deck": {
        const pileSize = playerField.field.deck.length;
        position.set(7.5, -6, (pileSize - sequence) * 0.01);
        rotation.set(0, 0, 0);
        break;
      }
      case "extra": {
        const pileSize = playerField.field.extra.length;
        position.set(-7.5, -6, (pileSize - sequence) * 0.01);
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
        const pileSize = playerField.field.deck.length;
        position.set(7.5, -3, (pileSize - sequence) * 0.01);
        rotation.set(0, 0, 0);
        break;
      }
      case "banish": {
        const pileSize = playerField.field.deck.length;
        position.set(7.5, 0, (pileSize - sequence) * 0.01);
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

function useComputeCardPosition(card: CardInfo) {
  const {
    pos: { controller, location, overlay, sequence },
    position,
  } = card;

  const fieldState = useGameStore((s) => s.players[controller]);

  const mPosX = useMotionValue(0);
  const mPosY = useMotionValue(0);
  const mPosZ = useMotionValue(0);
  const mRotX = useMotionValue(0);
  const mRotY = useMotionValue(0);
  const mRotZ = useMotionValue(0);

  useEffect(() => {
    const [[posX, posY, posZ], [rotX, rotY, rotZ]] = getCardPosition(
      card,
      fieldState
    );
    mPosX.jump(posX);
    mPosY.jump(posY);
    mPosZ.jump(posZ);
    mRotX.jump(rotX);
    mRotY.jump(rotY);
    mRotZ.jump(rotZ);
  }, [controller, location, overlay, sequence, position]);

  return [
    [mPosX, mPosY, mPosZ],
    [mRotX, mRotY, mRotZ],
  ] as const;
}

function useHandOffset({ pos: { controller, location, sequence } }: CardInfo) {
  const playerField = useGameStore((s) => s.players[controller]);
  const selectedHandCard = useGameStore((s) => s.selectedHandCard);

  const [hover, updateHover] = useState(false);

  const isOwnHand = controller === 0 && location === "hand";
  const selected = isOwnHand && selectedHandCard === sequence;

  let handOffsetY = 0;
  let handOffsetZ = 0;
  let handScale = 1;

  if (location === "hand") {
    const handSize = playerField.field.hand.length;
    handOffsetY = selected ? 0.15 : hover ? 0.15 : 0;
    handScale = selected ? 1.05 : 1;
    handOffsetZ = selected
      ? (handSize + 1) * 0.01
      : hover
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

interface RenderCardProps {
  card: CardInfo;
  wrapperRef: RefObject<HTMLDivElement>;
}

function RenderCard({ card, wrapperRef }: RenderCardProps) {
  let {
    pos: { location, controller, sequence },
  } = card;

  const setSelectedHandCard = useGameStore((s) => s.setSelectedHandCard);

  const isOwnHand = controller === 0 && location === "hand";

  const { mHandOffsetY, mHandOffsetZ, mHandScale, updateHover } =
    useHandOffset(card);

  const [[mPosX, mPosY, mPosZ], [mRotX, mRotY, mRotZ]] =
    useComputeCardPosition(card);

  const currentEvent = useGameStore((s) => s.events.at(0));

  useEffect(() => {
    if (!currentEvent) {
      return;
    }
    // animate drawn card

    if (currentEvent.event.type === "draw" && location === "deck") {
      const draws =
        controller === 0
          ? currentEvent.event.player1
          : currentEvent.event.player2;

      if (sequence < draws.length) {
        const newCard =
          currentEvent.nextState.players[controller].field.hand.find(
            (x) => x.id === card.id
          ) ?? card;

        const [[posX, posY, posZ], [rotX, rotY, rotZ]] = getCardPosition(
          newCard,
          currentEvent.nextState.players[controller]
        );

        const offset = Math.random() * 0.5;
        const speed = 0.3;

        const animation = animate([
          [mPosX, posX, { duration: speed, at: offset }],
          [mPosZ, posZ, { duration: speed, at: offset }],
          [mRotX, rotX, { duration: speed, at: offset }],
          [mRotY, rotY, { duration: speed, at: offset }],
          [mRotZ, rotZ, { duration: speed, at: offset }],
          ...(controller === 0
            ? ([
                [mPosY, posY + 3, { duration: speed, at: offset }],
                [mHandScale, 1.1, { duration: speed, at: offset }],
                [mPosY, posY, { duration: speed, at: offset + speed * 2 }],
                [mHandScale, 1, { duration: speed, at: offset + speed * 2 }],
              ] as AnimationSequence)
            : ([
                [mPosY, posY, { duration: speed, at: offset }],
              ] as AnimationSequence)),
        ]);

        return () => animation.cancel();
      }
    }
    // animate cards in hand
    if (currentEvent.event.type === "draw" && location === "hand") {
      const draws =
        controller === 0
          ? currentEvent.event.player1
          : currentEvent.event.player2;
      if (draws.length > 0) {
        const newCard =
          currentEvent.nextState.players[controller].field.hand.find(
            (x) => x.id === card.id
          ) ?? card;

        const [[posX, posY, posZ], [rotX, rotY, rotZ]] = getCardPosition(
          newCard,
          currentEvent.nextState.players[controller]
        );

        const animation = animate([
          [mPosX, posX, { duration: 0.5 }],
          [mPosY, posY, { duration: 0.5 }],
          [mPosZ, posZ, { duration: 0.5 }],
          [mRotX, rotX, { duration: 0.5 }],
          [mRotY, rotY, { duration: 0.5 }],
          [mRotZ, rotZ, { duration: 0.5 }],
        ]);

        return () => animation.cancel();
      }
    }
  }, [currentEvent?.id]);

  const x = useTransform<number, number>([mPosX], ([x1]) => x1);
  const y = useTransform<number, number>(
    [mPosY, mHandOffsetY],
    ([y1, y2]) => y1 + y2
  );
  const z = useTransform<number, number>(
    [mPosZ, mHandOffsetZ],
    ([z1, z2]) => z1 + z2
  );
  const rotateX = useTransform<number, number>([mRotX], ([x1]) => x1);
  const rotateY = useTransform<number, number>([mRotY], ([y1]) => y1);
  const rotateZ = useTransform<number, number>([mRotZ], ([z1]) => z1);
  const scale = useTransform<number, number>([mHandScale], ([s1]) => s1);

  return (
    <motion.object3D
      position-x={x}
      position-y={y}
      position-z={z}
      rotation-x={rotateX}
      rotation-y={rotateY}
      rotation-z={rotateZ}
      scale-x={scale}
      scale-y={scale}
    >
      <RenderCardFront
        code={card.code}
        onPointerOver={(e) => {
          updateHover(true);
          e.stopPropagation();
        }}
        onPointerOut={() => {
          updateHover(false);
        }}
        onClick={(e) => {
          if (isOwnHand) {
            setSelectedHandCard(sequence);
            e.stopPropagation();
          }
        }}
      />
      <RenderCardActions card={card} wrapperRef={wrapperRef} />
      <Suspense>
        <RenderCardBack />
      </Suspense>
    </motion.object3D>
  );
}

interface RenderCardActionsProps {
  card: CardInfo;
  wrapperRef: RefObject<HTMLDivElement>;
}

function RenderCardActions({ card, wrapperRef }: RenderCardActionsProps) {
  let {
    pos: { location, controller, sequence },
  } = card;

  const actions = useGameStore((s) => s.actions);
  const selectedHandCard = useGameStore((s) => s.selectedHandCard);

  const isOwnHand = controller === 0 && location === "hand";
  const selected = isOwnHand && selectedHandCard === sequence;

  const matchingActions = useMemo(() => {
    return actions.filter(({ pos }) => {
      if (pos.controller !== controller) {
        return false;
      }
      if (
        location === pos.location &&
        pos.location !== "hand" &&
        isPileLocation(pos.location)
      ) {
        return sequence === 0; // only show for the first card of the pile
      }
      return pos.location === location && pos.sequence === sequence;
    });
  }, [actions, location, controller, sequence]);

  return (
    <>
      {selected && matchingActions.length > 0 && (
        <Html
          position={[0, cardScale / 2, 0]}
          portal={wrapperRef as any}
          center
        >
          <div className="select-none -translate-y-1/2 pb-[0.5cqw] text-[1.5cqw]">
            <div className="bg-black text-white rounded-md overflow-hidden">
              {matchingActions.map((c, i) => (
                <div
                  className="px-[1cqw] hover:bg-gray-700 cursor-pointer"
                  key={i}
                  onClick={() => {
                    if (c.response) {
                      sendResponse(c.response);
                      runSimulatorStep();
                    }
                  }}
                >
                  {c.kind}
                </div>
              ))}
            </div>
          </div>
        </Html>
      )}
      <Suspense>
        <RenderCardOverlay actions={matchingActions} />
      </Suspense>
    </>
  );
}

function useAnimatedValue(
  value: number,
  config?: ValueAnimationTransition<number>
) {
  const valueM = useMotionValue(value);
  useEffect(() => {
    const anim = animate(valueM, value, config);
    return () => anim.stop();
  }, [value]);
  return valueM;
}

const cardScale = 2.5;

type RenderCardFrontProps = {
  code: number;
} & ComponentProps<typeof motion.mesh>;

function RenderCardFront({ code, ...props }: RenderCardFrontProps) {
  return (
    <motion.mesh {...props}>
      {code > 0 ? (
        <Suspense fallback={<meshStandardMaterial color={Color.NAMES.grey} />}>
          <CardTextureMaterial code={code} />
        </Suspense>
      ) : (
        <meshStandardMaterial color={Color.NAMES.grey} />
      )}
      <planeGeometry args={[(cardScale * 271) / 395, cardScale, 1]} />
    </motion.mesh>
  );
}

function CardTextureMaterial({ code }: { code: number }) {
  const [frontTexture] = useTexture([
    getProxiedUrl(`https://images.ygoprodeck.com/images/cards/${code}.jpg`),
  ]);
  return <meshStandardMaterial map={frontTexture} />;
}

function RenderCardBack() {
  const [backTexture] = useTexture([
    getProxiedUrl(
      "https://ms.yugipedia.com//thumb/e/e5/Back-EN.png/800px-Back-EN.png"
    ),
  ]);
  return (
    <mesh rotation={[0, 180 * degToRad, 0]}>
      <MeshTestMaterial map={backTexture} />
      <planeGeometry args={[(cardScale * 271) / 395, cardScale, 1]} />
    </mesh>
  );
}

type RenderCardOverlayProps = {
  actions: CardAction[];
};

function RenderCardOverlay({ actions }: RenderCardOverlayProps) {
  const hasActivateOrSS = useMemo(() => {
    return actions.some(
      (a) => a.kind === "activate" || a.kind === "specialSummon"
    );
  }, [actions]);

  const [overlayTexture] = useTexture(["/images/card-highlight.png"]);

  if (actions.length === 0) {
    return null;
  }

  const color = hasActivateOrSS ? 0xfaf148 : 0x79a6d9;

  return (
    <motion.mesh
      position-z={-0.001}
      transition={{
        repeat: Infinity,
        repeatType: "reverse",
        duration: 0.5,
        type: "tween",
        ease: "easeInOut",
      }}
      initial={{ scale: 1, opacity: 0.3 }}
      animate={{ scale: 1.02, opacity: 0.4 }}
    >
      <meshStandardMaterial
        color={color}
        alphaMap={overlayTexture}
        transparent
      />
      <planeGeometry args={[cardScale * 1.35, cardScale * 1.43, 1]} />
    </motion.mesh>
  );
}

type GameWrapperProps = { children?: ReactNode };

const GameWrapper = forwardRef<HTMLDivElement, GameWrapperProps>(
  function GameWrapper({ children }, ref) {
    return (
      <div
        ref={ref}
        className="relative bg-gray-700 aspect-video w-full m-auto horizontal:h-full horizontal:w-auto @container"
      >
        {children}
      </div>
    );
  }
);

function useAllCards() {
  const players = useGameStore((s) => s.players);
  return useMemo(() => {
    const ret: CardInfo[] = [];
    for (const p of players) {
      if (p.field.fieldZone) {
        ret.push(p.field.fieldZone);
      }
      ret.push(...p.field.mainMonsterZone.filter((c): c is CardInfo => !!c));
      ret.push(...p.field.spellZone.filter((c): c is CardInfo => !!c));
      ret.push(...p.field.extraMonsterZone.filter((c): c is CardInfo => !!c));
      ret.push(...p.field.deck);
      ret.push(...p.field.hand);
      ret.push(...p.field.grave);
      ret.push(...p.field.extra);
      ret.push(...p.field.banish);
    }
    return ret;
  }, [players]);
}

function getProxiedUrl(url: string) {
  return `/api/proxy/${encodeURIComponent(url)}`;
}

// type TestMaterialProps = ShaderMaterialProps & {};

// function TestMaterial({ ...props }: TestMaterialProps) {
//   const [uniforms] = useState(() => {
//     return UniformsUtils.merge([
//       ShaderLib.standard.uniforms,
//       { cameraLengthInverse: { value: 0 } },
//     ]);
//   });

//   const camera = useThree((s) => s.camera);

//   const ref = useRef<ShaderMaterial>(null);

//   useFrame(() => {
//     if (!ref.current) {
//       return;
//     }
//     ref.current.uniforms.cameraLengthInverse.value =
//       1 / camera.position.length();
//   });

//   return (
//     <shaderMaterial
//       ref={ref}
//       onBeforeCompile={(shader) => {
//         shader.vertexShader = shader.vertexShader.replace(
//           "void main() {",
//           `
//           uniform float cameraLengthInverse;
//           void main() {
//         `
//         );
//         shader.vertexShader = shader.vertexShader.replace(
//           "#include <project_vertex>",
//           `
// vec4 mvPosition = vec4( transformed, 1.0 );
// #ifdef USE_BATCHING
//   mvPosition = batchingMatrix * mvPosition;
// #endif
// #ifdef USE_INSTANCING
//   mvPosition = instanceMatrix * mvPosition;
// #endif

// mvPosition = modelViewMatrix * mvPosition;

// gl_Position = projectionMatrix * mvPosition;
//         `
//         );
//       }}
//       lights
//       vertexColors
//       uniforms={uniforms}
//       vertexShader={ShaderLib.standard.vertexShader}
//       fragmentShader={ShaderLib.standard.fragmentShader}
//       extensions={
//         {
//           derivatives: true,
//           fragDepth: false,
//           drawBuffers: false,
//           shaderTextureLOD: false,
//         } as any
//       }
//       {...props}
//     />
//   );
// }
