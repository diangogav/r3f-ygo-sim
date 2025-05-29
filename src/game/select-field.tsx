import { animated3 } from "@/lib/spring";
import { useSpring } from "@react-spring/core";
import { useTexture } from "@react-three/drei";
import { OcgResponseType } from "ocgcore-wasm";
import { ComponentProps, Suspense, useState } from "react";
import { Color } from "three";
import { convertGameLocation, runSimulatorStep, sendResponse } from "./runner";
import { CardFieldPos, useGameStore } from "./state";
import { textureSlot } from "./textures";
import { degToRad, getFieldSlotPosition } from "./utils/position";

export function GameSelectField({}: {}) {
  const selectField = useGameStore((s) => s.selectField);
  const idle = useGameStore((s) => s.events.length === 0);

  return (
    idle &&
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

  const springs = useSpring({ color: hover ? "#faf148" : "#79a6d9" });

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
        <MaterialSelectFieldSlot color={springs.color} />
      </Suspense>
      <planeGeometry args={[cardScale, cardScale, 1]} />
    </mesh>
  );
}

const AnimatedMeshStandardMaterial = animated3("meshStandardMaterial");

function MaterialSelectFieldSlot(
  props: ComponentProps<typeof AnimatedMeshStandardMaterial>,
) {
  const slotTexture = useTexture(textureSlot);
  return (
    <AnimatedMeshStandardMaterial
      map={slotTexture}
      transparent
      metalness={0}
      roughness={1}
      {...props}
    />
  );
}
