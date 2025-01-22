import {
  getCards,
  preloadedBaseScripts,
  preloadedStrings,
} from "@/lib/data-manager";
import { CardData } from "@/lib/data-manager/cards-database";
import { parseYdkeUrl } from "@/lib/ydke";
import { NextRequest, NextResponse } from "next/server";
import { OcgCardData } from "ocgcore-wasm";
import { z } from "zod";

export async function POST(req: NextRequest) {
  const {
    player1: { deck: player1Deck },
    player2: { deck: player2Deck },
  } = z
    .object({
      player1: z.object({
        deck: z.string(),
      }),
      player2: z.object({
        deck: z.string(),
      }),
    })
    .parse(await req.json());

  const deck1 = parseYdkeUrl(player1Deck);
  const deck2 = parseYdkeUrl(player2Deck);
  const cardsSet = new Set([
    ...deck1.main,
    ...deck1.extra,
    ...deck1.side,
    ...deck2.main,
    ...deck2.extra,
    ...deck2.side,
  ]);

  const [[cards, cardScripts], scripts, strings] = await Promise.all([
    getCards([...cardsSet.values()]),
    preloadedBaseScripts,
    preloadedStrings,
  ]);

  return NextResponse.json({
    player1: {
      deck: {
        main: [...deck1.main],
        extra: [...deck1.extra],
        side: [...deck1.side],
      },
    },
    player2: {
      deck: {
        main: [...deck2.main],
        extra: [...deck2.extra],
        side: [...deck2.side],
      },
    },
    cards: cards.map((c) => ({
      ...c,
      data: { ...c.data, race: c.data.race.toString() },
    })),
    scripts: [...cardScripts.entries(), ...scripts.entries()],
    strings: {
      system: [...strings.system.entries()],
      counter: [...strings.counter.entries()],
      setname: [...strings.setname.entries()],
      victory: [...strings.victory.entries()],
    },
  } as LoadDeckResponse);
}

export type LoadDeckResponseCardData = Omit<OcgCardData, "race"> & {
  race: string;
};

export type LoadDeckResponseCard = Omit<CardData, "data"> & {
  data: LoadDeckResponseCardData;
};

export type LoadDeckResponseDeck = {
  main: number[];
  extra: number[];
  side: number[];
};

export type LoadDeckResponse = {
  player1: {
    deck: LoadDeckResponseDeck;
  };
  player2: {
    deck: LoadDeckResponseDeck;
  };
  cards: LoadDeckResponseCard[];
  scripts: [string, string][];
  strings: {
    system: [number, string][];
    counter: [number, string][];
    setname: [number, string][];
    victory: [number, string][];
  };
};
