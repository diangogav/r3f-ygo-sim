import { useTexture } from "@react-three/drei";
import { motion } from "framer-motion-3d";
import { OcgResponseType } from "ocgcore-wasm";
import { ComponentProps, Suspense, useState } from "react";
import { Color } from "three";
import { convertGameLocation, runSimulatorStep, sendResponse } from "./runner";
import { CardFieldPos, useGameStore } from "./state";
import { textureSlot } from "./textures";
import { degToRad, getFieldSlotPosition } from "./utils/position";

export function GameSelectField({}: {}) {
  const selectField = useGameStore((s) => s.selectField);

  return (
    selectField && (
      <GameSelectFieldInterface
        positions={selectField.positions}
        count={selectField.count}
      />
    )
  );
}

type GameSelectFieldInterfaceProps = {
  positions: CardFieldPos[];
  count: number;
};

function GameSelectFieldInterface({
  positions,
  count,
}: GameSelectFieldInterfaceProps) {
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
    <>
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
    </>
  );
}

const cardScale = 2.5;

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
  const [hover, setHover] = useState(false);
  const [posX, posY, posZ] = getFieldSlotPosition(pos);

  return (
    <mesh
      position={[posX, posY, posZ]}
      rotation={[-15 * degToRad, 0, 0]}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      onClick={() => onSelect()}
    >
      <Suspense
        fallback={
          <meshStandardMaterial
            color={Color.NAMES.grey}
            transparent
            opacity={0.5}
            metalness={0}
            roughness={1}
          />
        }
      >
        <MaterialSelectFieldSlot
          animate={{ color: hover ? "#3333ff" : "#aaaaff" }}
          transition={{ type: "spring", bounce: 0, duration: 0.2 }}
        />
      </Suspense>
      <planeGeometry args={[cardScale, cardScale, 1]} />
    </mesh>
  );
}

function MaterialSelectFieldSlot({
  ...props
}: ComponentProps<typeof motion.meshStandardMaterial>) {
  const slotTexture = useTexture(textureSlot);
  return (
    <motion.meshStandardMaterial
      map={slotTexture}
      transparent
      metalness={0}
      roughness={1}
      {...props}
    />
  );
}
