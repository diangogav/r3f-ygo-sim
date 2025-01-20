import {
  Html,
  PerspectiveCamera,
  useProgress,
  useTexture,
} from "@react-three/drei";
import { extend, ThreeEvent } from "@react-three/fiber";
import {
  AnimatePresence,
  motion as htmlMotion,
  useTransform,
} from "framer-motion";
import { motion, MotionCanvas } from "framer-motion-3d";
import { OcgPosition, OcgResponseType } from "ocgcore-wasm";
import {
  ComponentProps,
  ComponentPropsWithRef,
  memo,
  Ref,
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
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  PointLight,
} from "three";
import { useEventCallback } from "usehooks-ts";
import { cn } from "../lib/cn";
import {
  animateDrawTarget,
  animateHandSizeChange,
  animateMove,
  animateShuffle,
  AnimationCleanup,
} from "./animations";
import {
  convertGameLocation,
  gameInstancePromise,
  loadedData,
  runSimulatorStep,
  sendResponse,
} from "./runner";
import {
  CardAction,
  CardFieldPos,
  CardInfo,
  CardPosition,
  DialogConfigCards,
  DialogConfigChain,
  DialogConfigEffectYesNo,
  DialogConfigPosition,
  DialogConfigYesNo,
  isCardPosEqual,
  isDirectInteractionLocation,
  isPileLocation,
  useGameStore,
} from "./state";
import {
  textureCardBack,
  textureCardFront,
  textureHighlight,
  textureSlot,
} from "./textures";
import { DebugMenu } from "./ui/debug";
import { SelectableCard } from "./ui/selectable-card";
import {
  degToRad,
  fieldRotation,
  getFieldSlotPosition,
  useComputeCardPosition,
  useHandOffset,
} from "./utils/position";

const load = gameInstancePromise;

extend({
  Group,
  PointLight,
  DirectionalLight,
  HemisphereLight,
  MeshStandardMaterial,
  PlaneGeometry,
  Object3D,
  Mesh,
});

export function Game() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>;
  const allCards = useAllCards();

  const setSelectedCard = useGameStore((s) => s.setSelectedCard);
  const selectField = useGameStore((s) => s.selectField);
  const idle = useGameStore((s) => s.events.length === 0);

  useEffect(() => {
    setSelectedCard(null);
  }, [idle]);

  const onRightClick = useEventCallback(() => {
    if (!idle) {
      return;
    }

    const dialog = useGameStore.getState().dialog;
    if (dialog) {
      switch (dialog.type) {
        case "yesno":
          sendResponse({ type: OcgResponseType.SELECT_YESNO, yes: false });
          runSimulatorStep();
          break;
        case "effectyn":
          sendResponse({ type: OcgResponseType.SELECT_EFFECTYN, yes: false });
          runSimulatorStep();
          break;
        case "cards":
          if (dialog.canCancel || dialog.min === 0) {
            sendResponse({
              type: OcgResponseType.SELECT_CARD,
              indicies: dialog.canCancel ? null : [],
            });
            runSimulatorStep();
          }
          break;
        case "chain":
          if (!dialog.forced) {
            sendResponse({
              type: OcgResponseType.SELECT_CHAIN,
              index: null,
            });
            runSimulatorStep();
          }
      }
    }

    // const cancelAction = actions.find((c) => c.kind === "continue");
    // if (cancelAction) {
    //   console.log("continue");
    //   sendResponse(cancelAction.response);
    //   runSimulatorStep();
    // }
  });

  return (
    <>
      <GameInitializer />
      <GameWrapper
        ref={wrapperRef}
        onContextMenu={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onRightClick();
        }}
      >
        <RenderDialog />
        <HtmlTurnState />
        <MotionCanvas
          shadows
          dpr={[1, 2]}
          resize={{ scroll: true, offsetSize: false }}
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
            <mesh
              position={[0, 0, 0]}
              rotation={[-fieldRotation * degToRad, 0, 0]}
            >
              <meshStandardMaterial color="#fff" />
              <planeGeometry args={[30, 20, 1]} />
            </mesh>
            <hemisphereLight
              // castShadow
              intensity={2}
              color="#fff"
              groundColor="#777"
            />
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
          {/* <EffectComposer multisampling={0} enableNormalPass>
            <N8AO />
            <SMAA />
            <Bloom />
          </EffectComposer> */}
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
    if (initPhase === 0 && !isLoading) {
      useTexture.preload([
        textureSlot,
        textureCardBack,
        textureHighlight,
        ...Array.from(loadedData.cards.values(), (c) =>
          textureCardFront(c.data.code),
        ),
      ]);
      setInitPhase(1);
    }
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

  const [animationPhase, setAnimationPhase] = useState(0);

  return (
    <AnimatePresence mode="wait">
      {event &&
        (event.event.type === "start" || event.event.type === "phase") &&
        animationPhase === 0 && (
          <htmlMotion.div
            key={event.id}
            className="absolute z-10 inset-0 flex items-center justify-center"
          >
            <htmlMotion.div
              className="relative text-[10cqh] font-bold"
              initial="initial"
              animate="enter"
              exit="exit"
              variants={{
                initial: { x: "20cqw", opacity: 0 },
                enter: { x: "0", opacity: 1 },
                exit: { x: "20cqw", opacity: 0 },
              }}
              transition={{ duration: 0.2 }}
              onAnimationComplete={(def) => {
                if (def === "enter") {
                  setTimeout(() => setAnimationPhase(1), 200);
                }
                if (def === "exit") {
                  useGameStore.getState().nextEvent();
                  setAnimationPhase(0);
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
  const slotTexture = useTexture(textureSlot);

  const [hover, setHover] = useState(false);

  const [posX, posY, posZ] = getFieldSlotPosition(pos);

  return (
    <motion.mesh
      position={[posX, posY, posZ]}
      rotation={[-15 * degToRad, 0, 0]}
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
          key={dialog.id}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="bg-gray-500 p-[1cqw] text-[1.5cqw] rounded-[1cqw]">
            <div className="text-center text-xs">
              (for player P{dialog.player + 1})
            </div>
            <div className="text-center">{dialog.title}</div>
            {(dialog.type === "yesno" || dialog.type === "effectyn") && (
              <DialogSelectYesNo dialog={dialog} />
            )}
            {dialog.type === "cards" && <DialogSelectCard dialog={dialog} />}
            {dialog.type === "chain" && <DialogSelectChain dialog={dialog} />}
            {dialog.type === "position" && (
              <DialogSelectPosition dialog={dialog} />
            )}
          </div>
        </htmlMotion.div>
      )}
    </AnimatePresence>
  );
}

type DialogSelectPositionProps = {
  dialog: DialogConfigPosition;
};

function DialogSelectPosition({
  dialog: { positions, code },
}: DialogSelectPositionProps) {
  const [selected, setSelected] = useState<null | CardPosition>(null);
  return (
    <>
      <div className="max-w-[30cqw] overflow-x-auto">
        <div className="flex items-center justify-center gap-[1cqw] py-[1cqw]">
          {positions.map((pos, i) => {
            const faceup = pos === "up_atk" || pos === "up_def";
            const def = pos === "down_def" || pos === "up_def";
            return (
              <div
                key={i}
                className="flex-none bg-gray-600 relative h-[9cqw] w-[9cqw] flex items-center justify-center"
                onClick={() => setSelected(selected === pos ? null : pos)}
              >
                <img
                  className={cn(
                    "h-[8cqw] opacity-75",
                    selected === pos && "opacity-100",
                    def && "rotate-90",
                  )}
                  src={faceup ? textureCardFront(code) : textureCardBack}
                  alt=""
                />
                {selected === pos && (
                  <div className="absolute -top-3 -left-2 w-4 h-4">✅</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex items-center justify-center gap-[2cqw] mt-[1cqw]">
        <Button
          onClick={() => {
            if (selected === null) {
              return;
            }
            sendResponse({
              type: OcgResponseType.SELECT_POSITION,
              position: {
                up_atk: OcgPosition.FACEUP_ATTACK,
                up_def: OcgPosition.FACEUP_DEFENSE,
                down_atk: OcgPosition.FACEDOWN_ATTACK,
                down_def: OcgPosition.FACEDOWN_DEFENSE,
              }[selected],
            });
            runSimulatorStep();
          }}
          aria-disabled={selected === null}
        >
          Confirm
        </Button>
      </div>
    </>
  );
}

type DialogSelectChainProps = {
  dialog: DialogConfigChain;
};

function DialogSelectChain({
  dialog: { cards, forced },
}: DialogSelectChainProps) {
  const [selected, setSelected] = useState<null | number>(null);
  return (
    <>
      {cards.length === 0 ? (
        <div className="text-gray-800">No effect applicable.</div>
      ) : (
        <div className="w-[30cqw] flex overflow-x-auto justify-center">
          <div className="flex items-center justify-start gap-[1cqw] py-[1cqw]">
            {cards.map((c, i) => (
              <SelectableCard
                key={i}
                code={c.code}
                selected={selected === i}
                onSelect={() => setSelected(i)}
                onUnselect={() => setSelected(null)}
              />
            ))}
          </div>
        </div>
      )}
      <div className="flex items-center justify-center gap-[2cqw] mt-[1cqw]">
        {!forced && (
          <Button
            onClick={() => {
              sendResponse({
                type: OcgResponseType.SELECT_CHAIN,
                index: null,
              });
              runSimulatorStep();
            }}
          >
            {cards.length === 0 ? "Continue" : "Cancel"}
          </Button>
        )}
        {cards.length > 0 && (
          <Button
            onClick={() => {
              if (selected === null) {
                return;
              }
              sendResponse({
                type: OcgResponseType.SELECT_CHAIN,
                index: selected,
              });
              runSimulatorStep();
            }}
            aria-disabled={selected === null}
          >
            Select
          </Button>
        )}
      </div>
    </>
  );
}

type DialogSelectCardProps = {
  dialog: DialogConfigCards;
};

function DialogSelectCard({
  dialog: { min, max, cards, canCancel },
}: DialogSelectCardProps) {
  const [selected, setSelected] = useState(() => new Set<number>());

  const canContinue = min <= selected.size && selected.size <= max;

  return (
    <>
      <div className="w-[30cqw] flex overflow-x-auto justify-center">
        <div className="flex items-center justify-start gap-[1cqw] py-[1cqw]">
          {cards.map((c, i) => (
            <SelectableCard
              key={i}
              code={c.code}
              selected={selected.has(i)}
              onSelect={() => {
                if (min === 1 && min === max) {
                  setSelected(new Set([i]));
                } else if (max < selected.size) {
                  setSelected((s) => new Set(s).add(i));
                }
              }}
              onUnselect={() => {
                setSelected((s) => {
                  const s1 = new Set(s);
                  s1.delete(i);
                  return s1;
                });
              }}
            />
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
        {(canCancel || min === 0) && (
          <Button
            onClick={() => {
              sendResponse({
                type: OcgResponseType.SELECT_CARD,
                indicies: canCancel ? null : [],
              });
              runSimulatorStep();
            }}
          >
            Cancel
          </Button>
        )}
      </div>
    </>
  );
}

const Button = twc.button`py-[0.5cqw] px-[1cqw] rounded-[1cqw] bg-gray-800 text-white hover:bg-gray-700 aria-disabled:bg-gray-600 aria-disabled:pointer-events-none`;

type DialogSelectYesNoProps = {
  dialog: DialogConfigYesNo | DialogConfigEffectYesNo;
};

function DialogSelectYesNo({ dialog: { type } }: DialogSelectYesNoProps) {
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

interface RenderCardProps {
  card: CardInfo;
  wrapperRef: Ref<HTMLDivElement>;
}

function RenderCard({ card, wrapperRef }: RenderCardProps) {
  let {
    pos: { location, sequence },
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
      case "shuffle":
        addCleanup(animateShuffle(event, nextState, card, ctx));
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
  const bindHover = location === "hand";

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
      {isDirectInteractionLocation(location) && (
        <RenderCardActions card={card} wrapperRef={wrapperRef} />
      )}
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

const cardScale = 2.5;

interface RenderCardFrontProps extends ComponentProps<"mesh"> {
  code: number;
}

const RenderCardFront = memo(({ code, ...props }: RenderCardFrontProps) => {
  return (
    <mesh {...props}>
      {code > 0 ? (
        <Suspense
          fallback={
            <meshStandardMaterial
              color={Color.NAMES.grey}
              metalness={0}
              roughness={0.5}
            />
          }
        >
          <CardTextureMaterial code={code} />
        </Suspense>
      ) : (
        <meshStandardMaterial
          color={Color.NAMES.grey}
          metalness={0}
          roughness={0.5}
        />
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
  const frontTexture = useTexture(textureCardFront(code));
  return <meshStandardMaterial map={frontTexture} />;
});

CardTextureMaterial.displayName = "CardTextureMaterial";

interface RenderCardBackProps extends ComponentProps<"mesh"> {}

const RenderCardBack = memo(({ ...props }: RenderCardBackProps) => {
  return (
    <mesh rotation={[0, 180 * degToRad, 0]} {...props}>
      <Suspense
        fallback={
          <meshStandardMaterial
            color={Color.NAMES.brown}
            metalness={0}
            roughness={0.5}
          />
        }
      >
        <CardBackMaterial />
      </Suspense>
      <planeGeometry args={[(cardScale * 271) / 395, cardScale, 1]} />
    </mesh>
  );
});

RenderCardBack.displayName = "RenderCardBack";

const CardBackMaterial = memo(() => {
  const backTexture = useTexture(textureCardBack);
  return (
    <meshStandardMaterial map={backTexture} metalness={0} roughness={0.5} />
  );
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

  const overlayTexture = useTexture(textureHighlight);

  if (actions.length === 0 || !idle) {
    return null;
  }

  const color = hasActivateOrSS ? 0xfaf148 : 0x79a6d9;

  return (
    <>
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
      <motion.mesh
        rotation={[0, 180 * degToRad, 0]}
        position-z={0.001}
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
    </>
  );
}

interface GameWrapperProps extends ComponentPropsWithRef<"div"> {}

function GameWrapper({ className, ...props }: GameWrapperProps) {
  return (
    <div
      className={cn(
        "relative bg-gray-700 aspect-video w-full m-auto horizontal:h-full horizontal:w-auto @container",
        className,
      )}
      {...props}
    />
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
