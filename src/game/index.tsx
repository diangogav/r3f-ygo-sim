import {
  Html,
  PerspectiveCamera,
  useProgress,
  useTexture,
} from "@react-three/drei";
import { extend, ThreeEvent } from "@react-three/fiber";
import {
  animate,
  AnimatePresence,
  motion as htmlMotion,
  useMotionValue,
  useTransform,
  ValueAnimationTransition,
} from "framer-motion";
import { motion, MotionCanvas } from "framer-motion-3d";
import { OcgResponseType } from "ocgcore-wasm";
import {
  ComponentProps,
  memo,
  ReactNode,
  Ref,
  RefAttributes,
  Suspense,
  use,
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
import { useEventCallback } from "usehooks-ts";
import { cn } from "../lib/cn";
import {
  animateDrawTarget,
  animateHandSizeChange,
  animateMove,
  AnimationCleanup,
} from "./animations";
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
  DialogConfig,
  isCardPosEqual,
  isPileLocation,
  useGameStore,
} from "./state";
import { DebugMenu } from "./ui/debug";
import { useComputeCardPosition } from "./utils/position";

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

  const setSelectedCard = useGameStore((s) => s.setSelectedCard);
  const selectField = useGameStore((s) => s.selectField);
  const idle = useGameStore((s) => s.events.length === 0);
  const actions = useGameStore((s) => s.actions);

  useEffect(() => {
    setSelectedCard(null);
  }, [idle]);

  const onRightClick = useEventCallback(() => {
    if (!idle) {
      return;
    }
    const cancelAction = actions.find((c) => c.kind === "continue");
    if (cancelAction) {
      console.log("continue");
      sendResponse(cancelAction.response);
      runSimulatorStep();
    }
  });

  return (
    <>
      <GameInitializer />
      <GameWrapper ref={wrapperRef}>
        <RenderDialog />
        <HtmlTurnState />
        <MotionCanvas
          shadows
          dpr={[1, 2]}
          resize={{ scroll: false, offsetSize: true }}
        >
          <PerspectiveCamera makeDefault fov={70} position={[0, -2, 16]} />
          <group
            onClick={() => setSelectedCard(null)}
            onPointerMissed={(e) => {
              console.log("pointer miss", e.button);
              setSelectedCard(null);
              e.preventDefault();
              if (e.button === 2) {
                onRightClick();
              }
            }}
            onContextMenu={(e) => {
              e.stopPropagation();
              e.nativeEvent.preventDefault();
              onRightClick();
            }}
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
        </MotionCanvas>
      </GameWrapper>
      <DebugMenu />
    </>
  );
}

function GameInitializer({}: {}) {
  use(load);

  const [initPhase, setInitPhase] = useState<0 | 1 | 2>(0);
  const isLoading = useProgress((p) => p.active);

  useEffect(() => {
    // wait for first isLoading
    if (initPhase === 0 && isLoading) {
      setInitPhase(1);
    }
    // wait for isLoading to finish
    if (initPhase === 1 && !isLoading) {
      setInitPhase(2);
      useGameStore.getState().queueEvent({ event: { type: "start" } });
      runSimulatorStep();
    }
  }, [isLoading, initPhase]);

  return null;
}

function HtmlTurnState({}: {}) {
  const event = useGameStore((s) => s.events.at(0));
  const currentEventRef = useRef<null | string>(null);
  currentEventRef.current = event?.id ?? null;

  return (
    <AnimatePresence mode="wait">
      {event &&
        (event.event.type === "start" || event.event.type === "phase") && (
          <htmlMotion.div
            key={event.id}
            className="absolute z-10 inset-0 flex items-center justify-center"
          >
            <htmlMotion.div
              className="relative text-[10cqh] font-bold"
              initial={{ x: "20cqw", opacity: 0 }}
              animate={{ x: "0", opacity: 1 }}
              exit={{ x: "20cqw", opacity: 0 }}
              transition={{ duration: 0.5 }}
              onAnimationComplete={() => {
                if (event.id === currentEventRef.current) {
                  setTimeout(() => useGameStore.getState().nextEvent(), 500);
                }
              }}
            >
              {event.event.type === "start"
                ? "DUEL START!"
                : event.nextState.phase}
            </htmlMotion.div>
          </htmlMotion.div>
        )}
    </AnimatePresence>
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
      convertGameLocation({ ...positions[index], overlay: null }),
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
  return null;
}

function RenderDialog() {
  const idle = useGameStore((s) => s.events.length === 0);
  const dialog = useGameStore((s) => s.dialog);

  return (
    <AnimatePresence>
      {idle && dialog && (
        <htmlMotion.div
          key="dialog"
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
                  selected.has(i) && "opacity-100",
                )}
                src={getProxiedUrl(
                  `https://images.ygoprodeck.com/images/cards/${c.code}.jpg`,
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

const fieldEuler = [
  new Euler(-20 * degToRad, 0, 0),
  new Euler(-20 * degToRad, 0, 180 * degToRad),
] as const;

function useHandOffset(card: CardInfo) {
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

interface RenderCardProps {
  card: CardInfo;
  wrapperRef: Ref<HTMLDivElement>;
}

function RenderCard({ card, wrapperRef }: RenderCardProps) {
  let {
    pos: { location, controller, sequence, overlay },
  } = card;

  const setSelectedCard = useGameStore((s) => s.setSelectedCard);

  const { mHandOffsetY, mHandOffsetZ, mHandScale, updateHover } =
    useHandOffset(card);

  const [[mPosX, mPosY, mPosZ], [mRotX, mRotY, mRotZ]] =
    useComputeCardPosition(card);

  const currentEvent = useGameStore((s) => s.events.at(0));

  useEffect(() => {
    if (!currentEvent) {
      return;
    }
    const { event, nextState } = currentEvent;
    const ctx = {
      px: mPosX,
      py: mPosY,
      pz: mPosZ,
      rx: mRotX,
      ry: mRotY,
      rz: mRotZ,
      hpy: mHandOffsetY,
      hpz: mHandOffsetZ,
      hs: mHandScale,
    };

    const cleanup: (() => void)[] = [];
    const addCleanup = (c: AnimationCleanup) => c && cleanup.push(c);

    switch (event.type) {
      case "move":
        addCleanup(animateMove(event, nextState, card, ctx));
        addCleanup(animateHandSizeChange(event, nextState, card, ctx));
        break;
      case "draw":
        addCleanup(animateDrawTarget(event, nextState, card, ctx));
        addCleanup(animateHandSizeChange(event, nextState, card, ctx));
        break;
    }

    if (cleanup.length > 0) {
      return () => cleanup.forEach((c) => c());
    }
  }, [currentEvent?.id]);

  const x = useTransform<number, number>([mPosX], ([x1]) => x1);
  const y = useTransform<number, number>(
    [mPosY, mHandOffsetY],
    ([y1, y2]) => y1 + y2,
  );
  const z = useTransform<number, number>(
    [mPosZ, mHandOffsetZ],
    ([z1, z2]) => z1 + z2,
  );
  const rotateX = useTransform<number, number>([mRotX], ([x1]) => x1);
  const rotateY = useTransform<number, number>([mRotY], ([y1]) => y1);
  const rotateZ = useTransform<number, number>([mRotZ], ([z1]) => z1);
  const scale = useTransform<number, number>([mHandScale], ([s1]) => s1);

  const bindClick =
    location === "hand" || !isPileLocation(location) || sequence === 0;
  const bindHover = location === "hand" && controller === 0;

  const onPointerOver = useEventCallback((e: ThreeEvent<PointerEvent>) => {
    updateHover(true);
    e.stopPropagation();
  });
  const onPointerOut = useEventCallback(() => {
    updateHover(false);
  });
  const onClick = useEventCallback((e: ThreeEvent<MouseEvent>) => {
    setSelectedCard(card.pos);
    e.stopPropagation();
  });

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
        onPointerOver={bindHover ? onPointerOver : undefined}
        onPointerOut={bindHover ? onPointerOut : undefined}
        onClick={bindClick ? onClick : undefined}
      />
      <RenderCardBack
        onPointerOver={bindHover ? onPointerOver : undefined}
        onPointerOut={bindHover ? onPointerOut : undefined}
        onClick={bindClick ? onClick : undefined}
      />
      <RenderCardActions card={card} wrapperRef={wrapperRef} />
    </motion.object3D>
  );
}

interface RenderCardActionsProps {
  card: CardInfo;
  wrapperRef: Ref<HTMLDivElement>;
}

function RenderCardActions({ card, wrapperRef }: RenderCardActionsProps) {
  let {
    pos: { location, controller, sequence },
  } = card;

  const actions = useGameStore((s) => s.actions);
  const selectedCard = useGameStore((s) => s.selectedCard);
  const idle = useGameStore((s) => s.events.length === 0);

  const selected =
    idle && selectedCard && isCardPosEqual(card.pos, selectedCard);

  const matchingActions = useMemo(() => {
    return actions.filter(({ pos }) => {
      if (pos?.controller !== controller) {
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
  config?: ValueAnimationTransition<number>,
) {
  const valueM = useMotionValue(value);
  useEffect(() => {
    const anim = animate(valueM, value, config);
    return () => anim.stop();
  }, [value]);
  return valueM;
}

const cardScale = 2.5;

interface RenderCardFrontProps extends ComponentProps<"mesh"> {
  code: number;
}

const RenderCardFront = memo(({ code, ...props }: RenderCardFrontProps) => {
  return (
    <mesh {...props}>
      {code > 0 ? (
        <Suspense fallback={<meshStandardMaterial color={Color.NAMES.grey} />}>
          <CardTextureMaterial code={code} />
        </Suspense>
      ) : (
        <meshStandardMaterial color={Color.NAMES.grey} />
      )}
      <planeGeometry args={[(cardScale * 271) / 395, cardScale, 1]} />
    </mesh>
  );
});

RenderCardFront.displayName = "RenderCardFront";

type CardTextureMaterialProps = {
  code: number;
};

const CardTextureMaterial = memo(({ code }: CardTextureMaterialProps) => {
  const frontTexture = useTexture(
    getProxiedUrl(`https://images.ygoprodeck.com/images/cards/${code}.jpg`),
  );
  return <meshStandardMaterial map={frontTexture} />;
});

CardTextureMaterial.displayName = "CardTextureMaterial";

interface RenderCardBackProps extends ComponentProps<"mesh"> {}

const RenderCardBack = memo(({}: RenderCardBackProps) => {
  return (
    <mesh rotation={[0, 180 * degToRad, 0]}>
      <Suspense fallback={<meshStandardMaterial color={Color.NAMES.brown} />}>
        <CardBackMaterial />
      </Suspense>
      <planeGeometry args={[(cardScale * 271) / 395, cardScale, 1]} />
    </mesh>
  );
});

RenderCardBack.displayName = "RenderCardBack";

const CardBackMaterial = memo(() => {
  const backTexture = useTexture(
    getProxiedUrl(
      "https://ms.yugipedia.com//thumb/e/e5/Back-EN.png/800px-Back-EN.png",
    ),
  );
  return <meshStandardMaterial map={backTexture} />;
});

type RenderCardOverlayProps = {
  actions: CardAction[];
};

function RenderCardOverlay({ actions }: RenderCardOverlayProps) {
  const idle = useGameStore((s) => s.events.length === 0);
  const hasActivateOrSS = useMemo(() => {
    return actions.some(
      (a) => a.kind === "activate" || a.kind === "specialSummon",
    );
  }, [actions]);

  const [overlayTexture] = useTexture(["/images/card-highlight.png"]);

  if (actions.length === 0 || !idle) {
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
      initial={{ scale: 1, opacity: 0.2 }}
      animate={{ scale: 1.02, opacity: 0.3 }}
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

interface GameWrapperProps extends RefAttributes<HTMLDivElement> {
  children?: ReactNode;
}

function GameWrapper({ ref, children }: GameWrapperProps) {
  return (
    <div
      ref={ref}
      className="relative bg-gray-700 aspect-video w-full m-auto horizontal:h-full horizontal:w-auto @container"
    >
      {children}
    </div>
  );
}

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
