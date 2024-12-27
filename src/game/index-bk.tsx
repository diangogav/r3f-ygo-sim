import { motion } from "framer-motion";
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { usePrevious } from "../lib/use-previous";
import { processMessageQueue } from "./runner";
import { CardInfo, useGameStore } from "./state";
import { Vector3, Matrix3, Matrix4 } from "three";

export function Game() {
  const allCards = useAllCards();

  return (
    <>
      <GameWrapper>
        <div className="h-full w-full transform-style-3d [&_*]:transform-style-3d [&_*]:backface-hidden perspective-[20cqw] perspective-origin-center flex items-center justify-center pointer-events-none">
          {/* <Field playerId={0} />
            <ShowedCard /> */}
          {allCards.map((c) => (
            <RenderCard key={c.id} card={c} />
          ))}
          <div className="absolute w-[80cqw] h-[80cqw] bg-gray-100 transform rotate-x-[20deg] translate-z-[-10cqw] bg-cover bg-[url('https://previews.123rf.com/images/blankstock/blankstock1510/blankstock151003080/46985835-cell-grid-texture-stripped-geometric-seamless-pattern.jpg')]"></div>
        </div>
        {/* <Hand playerId={0} /> */}
      </GameWrapper>
      <div className="absolute top-4 right-4">
        <button
          className="bg-orange-500 hover:bg-orange-400 p-2 uppercase font-bold"
          onClick={() => {
            while (true) {
              const res = processMessageQueue();
              console.log(res);
              if (res !== "continue") {
                break;
              }
            }
          }}
        >
          Next
        </button>
      </div>
    </>
  );
}

type RenderCardProps = {
  card: CardInfo;
};

function RenderCard({ card }: RenderCardProps) {
  const {
    status,
    pos: { location, controller, sequence, position },
  } = card;

  const prevLocation = usePrevious(location);
  const prevController = usePrevious(controller);
  const prevSequence = usePrevious(sequence);
  const prevStatus = usePrevious(status);

  const [hovered, setHovered] = useState(false);

  const playerField = useGameStore(
    useCallback((s) => s.players[controller], [controller])
  );

  const moveCard = useGameStore(useCallback((s) => s.moveCard, [controller]));

  const setCardStatus = useGameStore(
    useCallback((s) => s.setCardStatus, [controller])
  );

  useEffect(() => {
    if (status === "showing") {
      const cb = setTimeout(() => setCardStatus(card, "placed"), 1 * 1000);
      return () => clearTimeout(cb);
    }
  }, [status]);

  useEffect(() => {}, [prevStatus, status]);

  let x: number | string | undefined = undefined;
  let y: number | string | undefined = undefined;
  let z: number | string | undefined = undefined;
  let scaleX: number | string | undefined = undefined;
  let scaleY: number | string | undefined = undefined;
  let rotateX: number | string | undefined = undefined;
  let rotateZ: number | string | undefined = undefined;
  let rotateY: number | string | undefined = undefined;
  // let transformPerspective: number | string | undefined = undefined;

  if (status === "showing") {
    x = `0cqw`;
    y = `0cqw`;
    z = `55cqw`;
    scaleX = 0.6;
    scaleY = 0.6;
    rotateX = "0deg";
    rotateY = "360deg";
    //     transformPerspective = "80cqw";
  } else if (location === "hand") {
    const handSize = playerField.field.hand.length;
    let offset = sequence - Math.floor(handSize / 2);
    if (handSize % 2 === 0) offset += 0.5;
    x = `${offset * (controller === 0 ? 5.5 : 4)}cqw`;
    y = controller === 0 ? `18.5cqw` : `-21cqw`;
    z = `20cqw`;
    scaleX = controller === 0 ? 0.6 : 0.4;
    scaleY = controller === 0 ? 0.6 : 0.4;
    rotateX = "0deg";
    //     transformPerspective = "100cqw";
  } else if (location === "mainMonsterZone") {
    x = `${(sequence - 2) * 6.5}cqw`;
    y = `0cqw`;
    z = `0cqw`;
    scaleX = 0.6;
    scaleY = 0.6;
    rotateX = "20deg";
    //     transformPerspective = "80cqw";
  } else if (location === "deck") {
    let vec = new Vector3(
      -19.5 + 1,
      controller === 0 ? 18 : -18,
      sequence * 0.1
    );
    let matrixRotate = new Matrix4().makeRotationX((10 * Math.PI) / 180);
    vec = vec.applyMatrix4(matrixRotate);

    x = `${vec.x}cqw`;
    y = `${vec.y}cqw`;
    z = `${vec.z}cqw`;
    scaleX = 1;
    scaleY = 1;
    rotateX = "20deg";
    //     transformPerspective = "100cqw";
  } else if (location === "extra") {
    x = `-${19.5 + 1}cqw`;
    y = controller === 0 ? `18cqw` : `-18cqw`;
    z = `${sequence * 0.1}cqw`;
    scaleX = 0.6;
    scaleY = 0.6;
    rotateX = "20deg";
    //     transformPerspective = "100cqw";
  }

  rotateZ = controller === 0 ? "0deg" : "180deg";
  rotateY =
    position === "down_atk" || position === "down_def" ? "180deg" : "0deg";

  return (
    <motion.div
      className="absolute w-[10cqw] aspect-[271/395]"
      transition={{ type: "spring", duration: 0.8, bounce: 0 }}
      animate={{
        x,
        y,
        z,
        rotateX,
        rotateY,
        rotateZ,
        scaleX,
        scaleY,
        //         transformPerspective,
      }}
    >
      <motion.div
        className="pointer-events-auto w-full h-full"
        whileHover={{
          scale: status === "placed" && location === "hand" ? 1.1 : 1,
        }}
        onClick={() => {
          if (location !== "hand") {
            return;
          }
          const freeIndex = playerField.field.mainMonsterZone.findIndex(
            (c) => c === null
          );
          if (freeIndex < 0) {
            return;
          }
          console.log(freeIndex === 0 ? "up_atk" : "down_def");
          moveCard(
            {
              ...card,
              status: "showing",
              pos: {
                ...card.pos,
                position: freeIndex === 0 ? "up_atk" : "down_def",
              },
            },
            {
              ...card.pos,
              controller: 0,
              location: "mainMonsterZone",
              sequence: freeIndex,
            }
          );
        }}
      >
        <CardGame card={card} />
      </motion.div>
    </motion.div>
  );
}

function useAllCards() {
  const players = useGameStore(useCallback((s) => s.players, []));
  return useMemo(() => {
    const ret: CardInfo[] = [];
    for (const p of players) {
      if (p.field.fieldZone) {
        ret.push(p.field.fieldZone);
      }
      for (const c of p.field.mainMonsterZone) {
        if (c) {
          ret.push(c);
        }
      }
      for (const c of p.field.spellZone) {
        if (c) {
          ret.push(c);
        }
      }
      for (const c of p.field.extraMonsterZone) {
        if (c) {
          ret.push(c);
        }
      }
      ret.push(...p.field.deck);
      ret.push(...p.field.hand);
      ret.push(...p.field.grave);
      ret.push(...p.field.extra);
      ret.push(...p.field.banish);
    }
    return ret;
  }, [players]);
}

// function ShowedCard() {
//   const setCardStatus = useGameStore(useCallback((s) => s.setCardStatus, []));
//   const showedCard = useGameStore(
//     useCallback((s) => {
//       for (const p of s.players) {
//         if (p.field.fieldZone?.status === "showing") {
//           return p.field.fieldZone;
//         }
//         for (const c of p.field.mainMonsterZone) {
//           if (c?.status === "showing") {
//             return c;
//           }
//         }
//         for (const c of p.field.spellZone) {
//           if (c?.status === "showing") {
//             return c;
//           }
//         }
//         for (const c of p.field.extraMonsterZone) {
//           if (c?.status === "showing") {
//             return c;
//           }
//         }
//       }
//     }, [])
//   );

//   return (
//     showedCard && (
//       <div className="absolute top-0 left-0 h-full w-full flex items-center justify-center pointer-events-none">
//         <motion.div
//           layout
//           layoutId={showedCard.id}
//           transition={{ duration: 3 }}
//           className="w-[4.5cqw] aspect-[271/395]"
//           onLayoutAnimationComplete={() => {
//             console.log("completed!");
//             setCardStatus(showedCard, "placed");
//           }}
//         >
//           <CardGame card={showedCard} />
//         </motion.div>
//       </div>
//     )
//   );
// }

// type FieldProps = {
//   playerId: 0 | 1;
// };

// function Field({ playerId }: FieldProps) {
//   const field = useGameStore(
//     useCallback((s) => s.players[playerId].field, [playerId])
//   );

//   return (
//     <div className="flex flex-col h-full w-full justify-center items-center">
//       <div className="p-[0.5cqw] flex flex-row">
//         {field.mainMonsterZone.map((z, i) => (
//           <div
//             key={i}
//             className="relative w-[7.3cqw] h-[7.3cqw] flex justify-center items-center"
//           >
//             {z && z.status === "placed" && <FieldCard card={z} />}
//             <div className="absolute h-full w-full bg-gray-500 -z-10"></div>
//           </div>
//         ))}
//       </div>
//       <div className="p-[0.5cqw] flex flex-row">
//         {field.spellZone.map((z, i) => (
//           <div
//             key={i}
//             className="relative w-[7.3cqw] h-[7.3cqw] flex justify-center items-center"
//           >
//             {z && z.status === "placed" && <FieldCard card={z} />}
//             <div className="absolute h-full w-full bg-gray-500 -z-10"></div>
//           </div>
//         ))}
//       </div>
//     </div>
//   );
// }

// type FieldCardProps = {
//   card: CardInfo;
// };

// function FieldCard({ card }: FieldCardProps) {
//   const moveCard = useGameStore(useCallback((s) => s.moveCard, []));

//   return (
//     <motion.div
//       layout
//       layoutId={card.id}
//       transition={{ duration: 3 }}
//       className="relative w-[4.5cqw] aspect-[271/395] z-10"
//       onClick={() => {
//         // setSelected(!isSelected);
//         moveCard(card, {
//           controller: 0,
//           location: "hand",
//           sequence: -1,
//         });
//       }}
//     >
//       <motion.div
//         transition={{ duration: 3 }}
//         initial={{ rotateX: "-20deg", z: "0.1cqw" }}
//         animate={{ rotateX: "0", z: "0.1cqw" }}
//       >
//         <CardGame card={card} />
//       </motion.div>
//     </motion.div>
//   );
// }

// type HandProps = {
//   playerId: 0 | 1;
// };

// function Hand({ playerId }: HandProps) {
//   const [field] = useGameStore(
//     useCallback((s) => [s.players[playerId].field], [playerId])
//   );

//   return (
//     <div className="absolute w-full bottom-[-1cqw]">
//       <motion.div className="flex h-full w-full justify-center">
//         {field.hand.map((h) => (
//           <HandCard key={h.id} card={h} />
//         ))}
//       </motion.div>
//     </div>
//   );
// }

// type HandCardProps = {
//   card: CardInfo;
// };

// function HandCard({ card }: HandCardProps) {
//   const [handSize, moveCard] = useGameStore(
//     useCallback(
//       (s) =>
//         [s.players[card.pos.controller].field.hand.length, s.moveCard] as const,
//       [card]
//     )
//   );

//   const index = card.pos.sequence;
//   const angle = (() => {
//     const factor = handSize / 4;
//     const angleDelta = 0.02;
//     let x = (index - Math.floor(handSize / 2)) * angleDelta;
//     if (handSize % 2 === 0) x += angleDelta / 2;
//     return x * (Math.PI / factor);
//   })();
//   const flipped = false;
//   const flippedSign = flipped ? -1 : 1;
//   // const hoverPad = 20;
//   // const y = virtualFanHeight * (1 - Math.cos(angle)) * flippedSign; // (isSelected ? -Math.cos(angle) * hoverPad : 0) +
//   // const x = virtualFanWidth * Math.sin(angle); // (isSelected ? Math.sin(angle) * hoverPad : 0) +

//   // y: `${(1 - Math.cos(angle)) * 170}cqw`,
//   // rotate: `${angle * flippedSign}rad`,
//   // originX: "50%",
//   // originY: flipped ? "0%" : "100%",
//   // rotate: `${-angle * flippedSign}rad`,

//   return (
//     <motion.div
//       layout
//       layoutId={card.id}
//       transition={{ duration: 3 }}
//       className="w-[6cqw] aspect-[271/395] pointer-events-none mx-[-0.5cqw]"
//       style={{}}
//     >
//       <motion.div className="pointer-events-auto" animate={{}}>
//         <motion.div
//           className="relative"
//           style={{ zIndex: index + 1 }}
//           whileHover={{
//             scale: 1.1,
//             y: `-0.5cqw`,
//             zIndex: handSize + 1,
//           }}
//           onClick={() => {
//             moveCard(
//               { ...card, status: "showing" },
//               { controller: 0, location: "mainMonsterZone", sequence: 1 }
//             );
//           }}
//         >
//           <CardGame card={card} />
//         </motion.div>
//       </motion.div>
//     </motion.div>
//   );
// }

type CardGameProps = {
  card: CardInfo;
};

function CardGame({ card }: CardGameProps) {
  return (
    <div className="relative w-full h-full">
      <img
        className="absolute w-full h-full"
        src={`https://images.ygoprodeck.com/images/cards/${card.code}.jpg`}
        alt=""
      />
      <img
        className="absolute w-full h-full transform rotate-y-180"
        src={`https://ms.yugipedia.com//thumb/e/e5/Back-EN.png/800px-Back-EN.png`}
        alt=""
      />
    </div>
  );
}

function GameWrapper({ children }: { children?: ReactNode }) {
  return (
    <motion.div
      layout
      className="relative bg-gray-700 aspect-video w-full m-auto horizontal:h-full horizontal:w-auto @container overflow-hidden"
    >
      {children}
    </motion.div>
  );
}
