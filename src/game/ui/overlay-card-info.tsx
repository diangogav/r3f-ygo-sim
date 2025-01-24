import { LoadDeckResponseCardData } from "@/app/api/loadDeck/route";
import { ocgRaceString, OcgType } from "ocgcore-wasm";
import { useMemo } from "react";
import { loadedData } from "../runner";
import { useGameStore } from "../state";
import { textureCardFront } from "../textures";

export function OverlayCardInfo({}: {}) {
  const selectedCardCode = useGameStore((s) => s.selectedCard?.code ?? null);

  const cardInfo = useMemo(() => {
    if (!selectedCardCode || selectedCardCode <= 0) {
      return null;
    }
    return loadedData.cards.get(selectedCardCode) ?? null;
  }, [selectedCardCode]);

  return (
    cardInfo && (
      <div className="absolute top-[2cqw] h-[40cqw] left-[2cqw] w-[20cqw] z-20 bg-gray-800 text-white p-[1cqw] text-[1cqw] flex flex-col gap-[1cqw]">
        <div className="overflow-hidden text-nowrap text-ellipsis flex-none">
          {cardInfo.name}
        </div>
        <div className="flex gap-[1cqw] flex-none">
          <img className="h-[13cqw]" src={textureCardFront(cardInfo.id)} />
          <div className="flex flex-col gap-[0.1cqw]">
            {(cardInfo.data.type & OcgType.MONSTER) !== 0 && (
              <>
                <div>Level {cardInfo.data.level}</div>
                <div>ATK {cardInfo.data.attack}</div>
                <div>DEF {cardInfo.data.defense}</div>
              </>
            )}
          </div>
        </div>
        {(cardInfo.data.type & OcgType.MONSTER) !== 0 && (
          <div className="text-[0.8cqw]">{monsterTypeRow(cardInfo.data)}</div>
        )}
        <div className="text-[0.8cqw] whitespace-pre-wrap overflow-y-auto flex-1">
          {cardInfo.desc}
        </div>
      </div>
    )
  );
}

function monsterTypeRow({ type, race }: LoadDeckResponseCardData) {
  const parts: string[] = [];
  parts.push(raceMap[ocgRaceString.get(BigInt(race) as any)]);
  if ((type & OcgType.TUNER) !== 0) {
    parts.push("Tuner");
  }
  if ((type & OcgType.EFFECT) !== 0) {
    parts.push("Effect");
  }
  return `[ ${parts.join(" / ")} ]`;
}

type OcgRaceString = typeof ocgRaceString extends Map<any, infer V> ? V : never;

const raceMap: Record<OcgRaceString, string> = {
  warrior: "Warrior",
  spellcaster: "Spellcaster",
  fairy: "Fairy",
  fiend: "Fiend",
  zombie: "Zombie",
  machine: "Machine",
  aqua: "Aqua",
  pyro: "Pyro",
  rock: "Rock",
  winged_beast: "Winged Beast",
  plant: "Plant",
  insect: "Insect",
  thunder: "Thunder",
  dragon: "Dragon",
  beast: "Beast",
  beast_warrior: "Beast-Warrior",
  dinosaur: "Dinosaur",
  fish: "Fish",
  sea_serpent: "Sea Serpent",
  reptile: "Reptile",
  psychic: "Psychic",
  divine: "Divine",
  creator_god: "Creator God",
  wyrm: "Wyrm",
  cyberse: "Cyberse",
  illusion: "Illusion",
  cyborg: "Cyborg",
  magical_knight: "Magical Knight",
  high_dragon: "High Dragon",
  omega_psychic: "Omega Psychic",
  celestial_warrior: "Celestial Warrior",
  galaxy: "Galaxy",
};
