import { OcgResponse } from "ocgcore-wasm";
import { create } from "zustand";
import { combine } from "zustand/middleware";
import { sortBy } from "remeda";

export type GameState = {
  players: [PlayerState, PlayerState];
  selectedHandCard: number | null;
  selectField: { positions: CardFieldPos[]; count: number } | null;
  actions: CardAction[];
  dialog: DialogConfig | null;
};

export type CardAction = {
  kind:
    | "activate"
    | "summon"
    | "specialSummon"
    | "setMonster"
    | "setSpell"
    | "changePos";
  pos: CardPos;
  response: OcgResponse;
};

export type CardInfo = {
  id: string;
  code: number;
  pos: CardPos;
  status: "showing" | "placed";
  position: CardPosition;
};

export type CardPosition = "up_atk" | "up_def" | "down_atk" | "down_def";

export type CardLocation = keyof PlayerState["field"];

export type CardPos = {
  controller: 0 | 1;
  location: CardLocation;
  sequence: number;
  overlay: number | null;
};

export type CardFieldPos = {
  controller: 0 | 1;
  location: Extract<
    CardLocation,
    "extraMonsterZone" | "mainMonsterZone" | "spellZone" | "fieldZone"
  >;
  sequence: number;
};

export type DialogConfig = {
  title: string;
  type: "yesno" | "effectyn" | "cards";
  min?: number;
  max?: number;
  canCancel?: boolean;
  cards?: {
    code: number;
    controller: 0 | 1;
    location: CardLocation;
    position: CardPosition;
    sequence: number;
  }[];
};

export type PlayerState = {
  field: {
    deck: CardInfo[];
    hand: CardInfo[];
    grave: CardInfo[];
    extra: CardInfo[];
    banish: CardInfo[];
    extraMonsterZone: [CardInfo | null, CardInfo | null];
    mainMonsterZone: [
      CardInfo | null,
      CardInfo | null,
      CardInfo | null,
      CardInfo | null,
      CardInfo | null
    ];
    spellZone: [
      CardInfo | null,
      CardInfo | null,
      CardInfo | null,
      CardInfo | null,
      CardInfo | null
    ];
    fieldZone: CardInfo | null;
  };
};

export const useGameStore = create(
  combine(
    {
      selectedHandCard: null,
      actions: [],
      selectField: null,
      players: [
        {
          field: {
            hand: [],
            deck: [],
            grave: [],
            extra: [],
            banish: [],
            fieldZone: null,
            extraMonsterZone: [null, null],
            mainMonsterZone: [null, null, null, null, null],
            spellZone: [null, null, null, null, null],
          },
        },
        {
          field: {
            hand: [],
            deck: [],
            grave: [],
            extra: [],
            banish: [],
            fieldZone: null,
            extraMonsterZone: [null, null],
            mainMonsterZone: [null, null, null, null, null],
            spellZone: [null, null, null, null, null],
          },
        },
      ],
      dialog: null,
    } as GameState,
    (set) => ({
      moveCard(card: CardInfo, dest: CardPos) {
        set((state) => setCard(setCard(state, null, card.pos), card, dest));
      },
      reorderHand(controller: 0 | 1, cards: number[]) {
        set((state) => ({
          players: state.players.map((player, i) =>
            i !== controller
              ? player
              : ({
                  field: {
                    ...player.field,
                    hand: sortBy(player.field.hand, (c) =>
                      cards.indexOf(c.code)
                    ).map((c, i) => ({ ...c, pos: { ...c.pos, sequence: i } })),
                  },
                } as PlayerState)
          ) as [PlayerState, PlayerState],
        }));
      },
      setCardStatus(card: CardInfo, status: CardInfo["status"]) {
        set((state) => setCard(state, { ...card, status }, card.pos));
      },
      setActions(actions: CardAction[]) {
        set(() => ({ actions }));
      },
      setSelectedHandCard(index: number | null) {
        set(() => ({ selectedHandCard: index }));
      },
      setFieldSelect(
        options: { positions: CardFieldPos[]; count: number } | null
      ) {
        set(() => ({ selectField: options }));
      },
      openDialog(dialog: DialogConfig) {
        set(() => ({ dialog }));
      },
      closeDialog() {
        set(() => ({ dialog: null }));
      },
    })
  )
);

const pileLocations = ["hand", "deck", "grave", "extra", "banish"] as const;

export function isPileLocation(
  location: CardLocation
): location is (typeof pileLocations)[number] {
  return (pileLocations as readonly CardLocation[]).includes(location);
}

// function cardWithPos<C extends CardInfo | null>(
//   card: C,
//   controller: 0 | 1,
//   location: CardLocation,
//   sequence: number
// ): C {
//   return card ? { ...card, pos: { controller, location, sequence } } : null!;
// }

export function getCardInPos(
  state: GameState,
  { controller, location, sequence }: CardPos
) {
  const { field } = state.players[controller];
  if (location === "fieldZone") {
    return field.fieldZone;
  }
  return field[location][sequence] ?? null;
}

function setCard(
  state: Pick<GameState, "players">,
  card: CardInfo | null,
  { controller, location, sequence }: CardPos
): Pick<GameState, "players"> {
  const newCard: CardInfo | null = card
    ? { ...card, pos: { ...card.pos, controller, location, sequence } }
    : null;

  return {
    players: state.players.map((player, i) =>
      i !== controller
        ? player
        : ({
            field: {
              ...player.field,
              [location]: isPileLocation(location)
                ? updatePile(player.field[location], newCard, sequence)
                : location === "fieldZone"
                ? newCard
                : updateSlots(player.field[location], newCard, sequence),
            },
          } as PlayerState)
    ) as [PlayerState, PlayerState],
  };
}

function updateSlots<Slots extends (CardInfo | null)[]>(
  slots: Slots,
  card: CardInfo | null,
  index: number
): Slots {
  return slots.map((c, i) => (i === index ? card : c)) as Slots;
}

function updatePile(pile: CardInfo[], card: CardInfo | null, index: number) {
  return recalculateSequence(
    0 <= index && index < pile.length
      ? replaceOrRemove(pile, card, index)
      : card
      ? index < 0
        ? [card, ...pile]
        : [...pile, card]
      : pile
  );
}

function replaceOrRemove(
  arr: CardInfo[],
  value: CardInfo | null,
  index: number
): CardInfo[] {
  return value
    ? arr.map((c, i) => (i === index ? value : c))
    : arr.filter((_, i) => i !== index);
}

function recalculateSequence(cards: CardInfo[]): CardInfo[] {
  return cards.map((c, i) => ({ ...c, pos: { ...c.pos, sequence: i } }));
}

// if (isPileLocation(location)) {
//   const store = state.players[controller].field[location];
//   if (sequence < 0) {
//     if (card) {
//       store.unshift(card);
//     }
//   } else if (sequence >= store.length) {
//     if (card) {
//       store.push(card);
//     }
//   } else if (card) {
//     store.splice(sequence, 1, cardWithPos(card, controller, location, 0));
//   } else {
//     store.splice(sequence, 1);
//   }
//   for (let i = 0; i < store.length; i++) {
//     store[i].pos.location = location;
//     store[i].pos.sequence = i;
//   }
// } else if (location === "fieldZone") {
//   state.players[controller].field[location] = cardWithPos(
//     card,
//     controller,
//     location,
//     0
//   );
// } else {
//   const store = state.players[controller].field[location];
//   store[sequence] = cardWithPos(card, controller, location, sequence);
// }
