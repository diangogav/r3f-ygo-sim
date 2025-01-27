import { gs } from "../runner";
import { useGameStore } from "../state";
import { textureCardBack, textureCardFront } from "../textures";

export function OverlayPileList({}: {}) {
  const selectedPile = useGameStore((s) => s.showPile);
  const cards = useGameStore((s) =>
    selectedPile
      ? s.players[selectedPile.controller].field[selectedPile.location]
      : null,
  );

  return (
    selectedPile && (
      <div className="absolute inset-y-[8cqw] right-[2cqw] w-[8cqw] z-20 bg-gray-800 text-white p-[1cqw] text-[1cqw] overflow-y-auto">
        <div className="w-full flex flex-col gap-[1cqw] ">
          {cards?.map((c) => (
            <img
              onClick={() => gs().setSelectedCard(c)}
              key={c.id}
              className="w-full"
              src={c.code > 0 ? textureCardFront(c.code) : textureCardBack}
            />
          ))}
        </div>
      </div>
    )
  );
}
