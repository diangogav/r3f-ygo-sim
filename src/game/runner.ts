import {
  LoadDeckResponse,
  LoadDeckResponseCard,
} from "@/app/api/loadDeck/route";
import { useTexture } from "@react-three/drei";
import createCore, {
  OcgCardLoc,
  OcgCardLocPos,
  OcgCoreSync,
  OcgDuelHandle,
  OcgDuelMode,
  OcgHintType,
  OcgLocation,
  OcgMessage,
  OcgMessageType,
  OcgNewCardInfo,
  OcgPhase,
  OcgPosition,
  OcgProcessResult,
  OcgResponse,
  OcgResponseType,
  SelectIdleCMDAction,
  ocgLogTypeString,
  ocgMessageTypeStrings,
  ocgPositionParse,
} from "ocgcore-wasm";
import * as R from "remeda";
import { arrayShuffle } from "../lib/array-shuffle";
import { xoshiro256ss } from "../lib/xoshiro256ss";
import {
  CardAction,
  CardFieldPos,
  CardInfo,
  CardPos,
  CardPosition,
  PartialCardInfo,
  appendChain,
  cardPos,
  extractEventGS,
  getCardInPos,
  moveCard,
  popChain,
  reorderHand,
  setCard,
  useGameStore,
} from "./state";
import { textureCardFront } from "./textures";

const coreUrl = new URL("ocgcore-wasm/lib/ocgcore.sync.wasm", import.meta.url);
let ocg: OcgCoreSync | null = null;
const libPromise = initializeCore();

// TODO: expose inside the state maybe?

export let gameInstance: OcgDuelHandle | null = null;
export const loadedData = {
  cards: new Map<number, LoadDeckResponseCard>(),
  scripts: new Map<string, string>(),
  strings: {
    system: new Map<number, string>(),
    counter: new Map<number, string>(),
    setname: new Map<number, string>(),
    victory: new Map<number, string>(),
  },
};

export interface CreateGameOptions {
  player1: {
    deck: string;
  };
  player2: {
    deck: string;
  };
  seed: [string, string, string, string];
}

export async function createGame(
  options: CreateGameOptions,
  signal?: AbortSignal,
) {
  gameInstance = null;

  const [deckData] = await Promise.all([
    fetch(`/api/loadDeck`, {
      method: "post",
      body: JSON.stringify({
        player1: { deck: options.player1.deck },
        player2: { deck: options.player2.deck },
      }),
      headers: { "content-type": "application/json" },
      signal,
    }).then((r) => r.json() as Promise<LoadDeckResponse>),
    libPromise,
  ]);

  if (signal?.aborted || !ocg) {
    return null;
  }

  loadedData.cards = new Map<number, (typeof deckData.cards)[number]>(
    deckData.cards.map((c) => [c.id, c]),
  );
  loadedData.scripts = new Map(deckData.scripts);
  loadedData.strings = {
    system: new Map(deckData.strings.system),
    counter: new Map(deckData.strings.counter),
    setname: new Map(deckData.strings.setname),
    victory: new Map(deckData.strings.victory),
  };

  const seed = R.map(options.seed, BigInt);
  const duel = ocg.createDuel({
    cardReader(card) {
      const data = loadedData.cards.get(card)?.data;
      if (!data) {
        console.log("missing data", card);
        return null;
      }
      return {
        ...data,
        race: BigInt(data.race),
      };
    },
    scriptReader(name) {
      const script = loadedData.scripts.get(name);
      if (!script) {
        console.log("missing script", name);
        return "";
      }
      return script;
    },
    errorHandler(type, text) {
      console.log(ocgLogTypeString.get(type), text);
    },
    flags: OcgDuelMode.MODE_MR5,
    seed,
    team1: { drawCountPerTurn: 1, startingDrawCount: 5, startingLP: 8000 },
    team2: { drawCountPerTurn: 1, startingDrawCount: 5, startingLP: 8000 },
  });
  if (!duel) {
    throw new Error("error creating duel");
  }

  ocg.loadScript(
    duel,
    "constant.lua",
    loadedData.scripts.get("constant.lua") ?? "",
  );
  ocg.loadScript(
    duel,
    "utility.lua",
    loadedData.scripts.get("utility.lua") ?? "",
  );

  const player1Deck = shufflePile(deckData.player1.deck.main, seed);
  loadPile(duel, 0, OcgLocation.DECK, player1Deck);
  loadPile(duel, 0, OcgLocation.EXTRA, deckData.player1.deck.extra);
  const player2Deck = shufflePile(deckData.player2.deck.main, seed);
  loadPile(duel, 1, OcgLocation.DECK, player2Deck);
  loadPile(duel, 1, OcgLocation.EXTRA, deckData.player2.deck.extra);

  useGameStore.setState({
    ...useGameStore.getInitialState(),
    players: [
      {
        lp: 8000,
        field: {
          deck: setupPile(
            0,
            ocg.duelQueryCount(duel, 0, OcgLocation.DECK),
            "deck",
          ),
          extra: setupPile(
            0,
            ocg.duelQueryCount(duel, 0, OcgLocation.EXTRA),
            "extra",
          ).map((c, i) => ({ ...c, code: deckData.player1.deck.extra[i] })),
          banish: [],
          grave: [],
          extraMonsterZone: [null, null],
          fieldZone: null,
          hand: [],
          mainMonsterZone: [null, null, null, null, null],
          spellZone: [null, null, null, null, null],
        },
      },
      {
        lp: 8000,
        field: {
          deck: setupPile(
            1,
            ocg.duelQueryCount(duel, 1, OcgLocation.DECK),
            "deck",
          ),
          extra: setupPile(
            1,
            ocg.duelQueryCount(duel, 1, OcgLocation.EXTRA),
            "extra",
          ),
          banish: [],
          grave: [],
          extraMonsterZone: [null, null],
          fieldZone: null,
          hand: [],
          mainMonsterZone: [null, null, null, null, null],
          spellZone: [null, null, null, null, null],
        },
      },
    ],
  });

  ocg.startDuel(duel);

  gameInstance = duel;
  return duel;
}

function loadPile(
  duel: OcgDuelHandle,
  player: 0 | 1,
  location: OcgLocation,
  cards: number[],
) {
  const base: OcgNewCardInfo = {
    code: 0,
    team: player,
    duelist: 0,
    controller: player,
    location,
    position: OcgPosition.FACEDOWN_ATTACK,
    sequence: 0,
  };
  cards.forEach((c) => {
    base.code = c;
    ocg!.duelNewCard(duel, base);
  });
}

function shufflePile(deck: number[], state: [bigint, bigint, bigint, bigint]) {
  const next = xoshiro256ss(state);
  return arrayShuffle([...deck], next);
}

function convertPosition(o: OcgPosition): CardInfo["position"] | null {
  if (o & OcgPosition.FACEUP_ATTACK) {
    return "up_atk";
  }
  if (o & OcgPosition.FACEDOWN_ATTACK) {
    return "down_atk";
  }
  if (o & OcgPosition.FACEUP_DEFENSE) {
    return "up_def";
  }
  if (o & OcgPosition.FACEDOWN_DEFENSE) {
    return "down_def";
  }
  return null;
}

function convertLocation({
  controller,
  location,
  sequence,
}: Omit<OcgCardLocPos, "position" | "code">): CardPos | null {
  switch (location) {
    case OcgLocation.DECK:
      return {
        controller: controller as 0 | 1,
        location: "deck",
        sequence,
        overlay: null,
      };
    case OcgLocation.HAND:
      return {
        controller: controller as 0 | 1,
        location: "hand",
        sequence,
        overlay: null,
      };
    case OcgLocation.MZONE:
      if (0 <= sequence && sequence < 5) {
        return {
          controller: controller as 0 | 1,
          location: "mainMonsterZone",
          sequence,
          overlay: null,
        };
      }
      if (sequence === 5 || sequence === 6) {
        return {
          controller: controller as 0 | 1,
          location: "extraMonsterZone",
          sequence: sequence - 5,
          overlay: null,
        };
      }
      return null;
    case OcgLocation.SZONE:
      if (0 <= sequence && sequence < 5) {
        return {
          controller: controller as 0 | 1,
          location: "spellZone",
          sequence,
          overlay: null,
        };
      }
      if (sequence === 5) {
        return {
          controller: controller as 0 | 1,
          location: "fieldZone",
          sequence: 0,
          overlay: null,
        };
      }
      return null;
    case OcgLocation.GRAVE:
      return {
        controller: controller as 0 | 1,
        location: "grave",
        sequence,
        overlay: null,
      };
    case OcgLocation.REMOVED:
      return {
        controller: controller as 0 | 1,
        location: "banish",
        sequence,
        overlay: null,
      };
    case OcgLocation.EXTRA:
      return {
        controller: controller as 0 | 1,
        location: "extra",
        sequence,
        overlay: null,
      };
    case OcgLocation.FZONE:
      return {
        controller: controller as 0 | 1,
        location: "fieldZone",
        sequence: 0,
        overlay: null,
      };
    default:
      return null;
  }
}

export function convertGameLocation({
  controller,
  location,
  sequence,
}: CardPos): Omit<OcgCardLoc, "code"> {
  switch (location) {
    case "mainMonsterZone":
      return { controller, location: OcgLocation.MZONE, sequence };
    case "extraMonsterZone":
      return {
        controller,
        location: OcgLocation.MZONE,
        sequence: sequence + 5,
      };
    case "spellZone":
      return { controller, location: OcgLocation.SZONE, sequence: sequence };
    case "fieldZone":
      return { controller, location: OcgLocation.SZONE, sequence: 5 };
    // case "pendulumZone":
    //   return { controller, location: OcgLocation.MZONE, sequence: sequence + 6 };
    case "deck":
      return { controller, location: OcgLocation.DECK, sequence };
    case "extra":
      return { controller, location: OcgLocation.EXTRA, sequence };
    case "grave":
      return { controller, location: OcgLocation.GRAVE, sequence };
    case "hand":
      return { controller, location: OcgLocation.HAND, sequence };
    case "banish":
      return { controller, location: OcgLocation.REMOVED, sequence };
  }
}

export function egs() {
  const event = gs().events.at(-1);
  if (event) {
    return { ...event.nextState };
  }
  return extractEventGS(gs());
}

export function gs() {
  return useGameStore.getState();
}

export function runSimulatorStep() {
  if (!ocg || !gameInstance) {
    return;
  }

  const messages: OcgMessage[] = [];
  while (true) {
    const res = ocg.duelProcess(gameInstance);
    for (const m of ocg.duelGetMessage(gameInstance)) {
      messages.push(m);
    }
    if (res !== OcgProcessResult.CONTINUE) {
      break;
    }
  }

  gs().appendDuelLog(...messages);

  for (const [_index, m] of messages.entries()) {
    switch (m.type) {
      case OcgMessageType.START: {
        break;
      }
      case OcgMessageType.DRAW: {
        const player = m.player as 0 | 1;
        const cardUpdates: PartialCardInfo[] = m.drawn.map((drawn, index) => {
          const card = egs().players[player].field.deck[index];
          preloadTexture(drawn.code);
          return { id: card.id, code: drawn.code };
        });

        gs().updateCards(cardUpdates);

        let nextState = egs();
        for (const drawn of m.drawn) {
          const topCard = nextState.players[player].field.deck[0];
          const position =
            drawn.position === OcgPosition.FACEDOWN ? "down_atk" : "up_atk";
          nextState = moveCard(
            nextState,
            { ...topCard, code: drawn.code, position },
            cardPos(player, "hand", Infinity),
          );
        }

        const lastEvent = gs().events.at(-1);
        if (lastEvent?.event.type === "draw") {
          gs().queueEvent(
            {
              event: {
                type: "draw",
                player1: [
                  ...lastEvent.event.player1,
                  ...(player === 0 ? m.drawn.map((c) => c.code) : []),
                ],
                player2: [
                  ...lastEvent.event.player2,
                  ...(player === 1 ? m.drawn.map((c) => c.code) : []),
                ],
              },
              nextState,
            },
            true,
          );
        } else {
          gs().queueEvent({
            event: {
              type: "draw",
              player1: player === 0 ? m.drawn.map((c) => c.code) : [],
              player2: player === 1 ? m.drawn.map((c) => c.code) : [],
            },
            nextState,
          });
        }
        break;
      }
      case OcgMessageType.NEW_TURN: {
        console.log(`NEW TURN: Player ${m.player + 1}`);
        break;
      }
      case OcgMessageType.NEW_PHASE: {
        const nextState = egs();
        switch (m.phase) {
          case OcgPhase.DRAW:
            nextState.phase = "dp";
            gs().queueEvent({ event: { type: "phase" }, nextState });
            break;
          case OcgPhase.STANDBY:
            nextState.phase = "sp";
            gs().queueEvent({ event: { type: "phase" }, nextState });
            break;
          case OcgPhase.MAIN1:
            nextState.phase = "m1";
            gs().queueEvent({ event: { type: "phase" }, nextState });
            break;
          case OcgPhase.BATTLE_START:
            nextState.phase = "bp1";
            gs().queueEvent({ event: { type: "phase" }, nextState });
            break;
          case OcgPhase.BATTLE_STEP:
            nextState.phase = "bp2";
            gs().queueEvent({ event: { type: "phase" }, nextState });
            break;
          case OcgPhase.DAMAGE:
            nextState.phase = "bp3";
            gs().queueEvent({ event: { type: "phase" }, nextState });
            break;
          case OcgPhase.DAMAGE_CAL:
            nextState.phase = "bp4";
            gs().queueEvent({ event: { type: "phase" }, nextState });
            break;
          case OcgPhase.BATTLE:
            nextState.phase = "bp5";
            gs().queueEvent({ event: { type: "phase" }, nextState });
            break;
          case OcgPhase.MAIN2:
            nextState.phase = "m2";
            gs().queueEvent({ event: { type: "phase" }, nextState });
            break;
          case OcgPhase.END:
            nextState.phase = "ep";
            gs().queueEvent({ event: { type: "phase" }, nextState });
            break;
        }
        break;
      }
      case OcgMessageType.SELECT_OPTION: {
        gs().openDialog({
          type: "option",
          id: crypto.randomUUID(),
          player: m.player as 0 | 1,
          title: "Select an option",
          options: m.options.map((o, i) => ({
            name: getDesc(o) ?? o.toString(),
            response: { type: OcgResponseType.SELECT_OPTION, index: i },
          })),
        });
        break;
      }
      case OcgMessageType.SELECT_IDLECMD: {
        const actions: CardAction[] = [];
        for (const [index, action] of m.activates.entries()) {
          actions.push({
            kind: "activate",
            response: {
              type: OcgResponseType.SELECT_IDLECMD,
              action: SelectIdleCMDAction.SELECT_ACTIVATE,
              index,
            },
            card: {
              ...getCardInPos(egs(), convertLocation(action)!)!,
              code: action.code,
            },
          });
        }
        for (const [index, action] of m.summons.entries()) {
          actions.push({
            kind: "summon",
            response: {
              type: OcgResponseType.SELECT_IDLECMD,
              action: SelectIdleCMDAction.SELECT_SUMMON,
              index,
            },
            card: {
              ...getCardInPos(egs(), convertLocation(action)!)!,
              code: action.code,
            },
          });
        }
        for (const [index, action] of m.special_summons.entries()) {
          actions.push({
            kind: "specialSummon",
            response: {
              type: OcgResponseType.SELECT_IDLECMD,
              action: SelectIdleCMDAction.SELECT_SPECIAL_SUMMON,
              index,
            },
            card: {
              ...getCardInPos(egs(), convertLocation(action)!)!,
              code: action.code,
            },
          });
        }
        for (const [index, action] of m.monster_sets.entries()) {
          actions.push({
            kind: "setMonster",
            response: {
              type: OcgResponseType.SELECT_IDLECMD,
              action: SelectIdleCMDAction.SELECT_MONSTER_SET,
              index,
            },
            card: {
              ...getCardInPos(egs(), convertLocation(action)!)!,
              code: action.code,
            },
          });
        }
        for (const [index, action] of m.spell_sets.entries()) {
          actions.push({
            kind: "setSpell",
            response: {
              type: OcgResponseType.SELECT_IDLECMD,
              action: SelectIdleCMDAction.SELECT_SPELL_SET,
              index,
            },
            card: {
              ...getCardInPos(egs(), convertLocation(action)!)!,
              code: action.code,
            },
          });
        }
        for (const [index, action] of m.pos_changes.entries()) {
          actions.push({
            kind: "changePos",
            response: {
              type: OcgResponseType.SELECT_IDLECMD,
              action: SelectIdleCMDAction.SELECT_POS_CHANGE,
              index,
            },
            card: {
              ...getCardInPos(egs(), convertLocation(action)!)!,
              code: action.code,
            },
          });
        }
        gs().setActions(actions);
        break;
      }
      case OcgMessageType.MOVE: {
        const source = convertLocation(m.from);
        const dest = convertLocation(m.to);
        const position = convertPosition(m.to.position)!;

        const code = dest?.location === "deck" ? 0 : m.card;

        const card = source ? getCardInPos(egs(), source) : null;

        if (!card) {
          if (!dest) {
            // maybe shouldn't happen
            console.warn("werid move: ", m);
            break;
          }

          // new card
          const nextState = setCard(
            egs(),
            { id: crypto.randomUUID(), code, position, pos: dest },
            dest,
          );
          const nextCard = getCardInPos(nextState, dest)!;
          gs().queueEvent({
            event: { type: "newCard", card: nextCard },
            nextState,
          });
          break;
        }

        if (code) {
          preloadTexture(code);
          gs().updateCards([{ id: card.id, code }]);
        }

        if (dest) {
          const nextState = moveCard(egs(), { ...card, code, position }, dest);
          const nextCard = getCardInPos(nextState, dest)!;
          gs().queueEvent({
            event: { type: "move", card, nextCard },
            nextState,
          });
          break;
        }

        if (!card) {
          // maybe shouldn't happen
          console.warn("werid move: ", m);
          break;
        }
        // remove card
        const nextState = setCard(egs(), null, source!);
        gs().queueEvent({
          event: { type: "removeCard", card },
          nextState,
        });
        break;
      }
      case OcgMessageType.POS_CHANGE: {
        const source = convertLocation(m)!;
        const card = getCardInPos(egs(), source)!;
        const position = convertPosition(m.position)!;
        const code =
          position === "up_atk" || position === "up_def" ? m.code : 0;

        if (code) {
          preloadTexture(code);
          gs().updateCards([{ id: card.id, code }]);
        }

        const nextState = setCard(egs(), { ...card, code, position }, card.pos);
        const nextCard = getCardInPos(nextState, card.pos)!;
        gs().queueEvent({
          event: { type: "move", card, nextCard },
          nextState,
        });
        break;
      }
      case OcgMessageType.SET: {
        break;
      }
      case OcgMessageType.SHUFFLE_HAND: {
        if (m.cards.length === 0) {
          break;
        }
        const player = m.player as 0 | 1;
        const nextState = reorderHand(egs(), player, m.cards);
        gs().queueEvent({
          event: { type: "shuffle", player },
          nextState,
        });
        break;
      }
      case OcgMessageType.SHUFFLE_DECK: {
        break;
      }
      case OcgMessageType.SPSUMMONING: {
        // attach event to last move
        const lastEvent = gs().events.at(-1);
        if (lastEvent?.event.type === "move") {
          gs().queueEvent(
            {
              event: { ...lastEvent.event, reason: "spsummon" },
              nextState: lastEvent.nextState,
            },
            true,
          );
        }
        break;
      }
      case OcgMessageType.SUMMONING: {
        // attach event to last move
        const lastEvent = gs().events.at(-1);
        if (lastEvent?.event.type === "move") {
          gs().queueEvent(
            {
              event: { ...lastEvent.event, reason: "summon" },
              nextState: lastEvent.nextState,
            },
            true,
          );
        }
        break;
      }
      case OcgMessageType.SUMMONED: {
        break;
      }
      case OcgMessageType.SPSUMMONED: {
        break;
      }
      case OcgMessageType.CHAINING: {
        const origin = convertLocation(m)!;
        const trigger = convertLocation({
          controller: m.triggering_controller,
          location: m.triggering_location,
          sequence: m.triggering_sequence,
        })!;

        const card = getCardInPos(egs(), origin)!;

        const nextState = appendChain(egs(), {
          card,
          trigger,
          link: m.chain_size,
        });
        gs().queueEvent({
          event: { type: "chain", card, trigger, link: m.chain_size },
          nextState,
        });
        break;
      }
      case OcgMessageType.CHAINED: {
        break;
      }
      case OcgMessageType.CHAIN_SOLVING: {
        break;
      }
      case OcgMessageType.CHAIN_SOLVED: {
        const nextState = popChain(egs());
        gs().queueEvent({
          event: { type: "chainSolved", link: m.chain_size },
          nextState,
        });
        break;
      }
      case OcgMessageType.CHAIN_END: {
        break;
      }
      case OcgMessageType.CHAIN_NEGATED: {
        break;
      }
      case OcgMessageType.CHAIN_DISABLED: {
        break;
      }
      case OcgMessageType.SELECT_CHAIN: {
        if (m.selects.length === 0) {
          // TODO: maybe move somewhere else
          setTimeout(() => {
            sendResponse({ type: OcgResponseType.SELECT_CHAIN, index: null });
            runSimulatorStep();
          }, 1);
          break;
        }

        gs().openDialog({
          id: crypto.randomUUID(),
          title: m.forced ? `Chain an optional effect.` : "Chain an effect.",
          type: "chain",
          player: m.player as 0 | 1,
          forced: m.forced,
          cards: m.selects.map((s) => ({
            code: s.code,
            ...convertLocation(s)!,
            position: convertPosition(s.position)!,
          })),
        });
        break;
      }
      case OcgMessageType.SELECT_YESNO: {
        const title = getDesc(m.description);
        gs().openDialog({
          id: crypto.randomUUID(),
          title: title ?? `${m.description}`,
          player: m.player as 0 | 1,
          type: "yesno",
        });
        break;
      }
      case OcgMessageType.SELECT_EFFECTYN: {
        let text;
        if (m.description === 0n) {
          const event_string = "EVENT"; // set with last event
          const formatted = sprintf(
            getSysString(200) ?? "",
            getCardName(m.code),
            formatLocation(m.location, m.sequence) ?? "?",
          );
          text = `${event_string}\n${formatted}`;
        } else if (m.description === 221n) {
          const event_string = "EVENT"; // set with last event
          const formatted = sprintf(
            getSysString(221) ?? "",
            getCardName(m.code),
            formatLocation(m.location, m.sequence) ?? "?",
          );
          text = `${event_string}\n${formatted}\n${getSysString(223) ?? ""}`;
        } else {
          const formatted = sprintf(
            getDesc(m.description) ?? "",
            getCardName(m.code),
          );
          text = formatted;
        }

        gs().openDialog({
          id: crypto.randomUUID(),
          title: text,
          type: "effectyn",
          player: m.player as 0 | 1,
        });
        break;
      }
      case OcgMessageType.SELECT_CARD: {
        gs().openDialog({
          id: crypto.randomUUID(),
          title: `Select ${m.min} to ${m.max} card(s).`,
          type: "cards",
          player: m.player as 0 | 1,
          min: m.min,
          max: m.max,
          canCancel: m.can_cancel,
          cards: m.selects.map((s) => ({
            code: s.code,
            ...convertLocation(s)!,
            position: convertPosition(s.position)!,
          })),
        });
        break;
      }
      case OcgMessageType.SELECT_PLACE: {
        gs().setFieldSelect({
          positions: parseFieldMask(m.field_mask).map((c) => ({
            ...c,
            controller:
              m.player === 0 ? c.controller : ((1 - c.controller) as 0 | 1),
          })),
          count: m.count,
        });
        break;
      }
      case OcgMessageType.SELECT_POSITION: {
        const positions = ocgPositionParse(m.positions).map(convertPosition);
        gs().openDialog({
          id: crypto.randomUUID(),
          title: `Select position for ${getCardName(m.code)}`,
          type: "position",
          player: m.player as 0 | 1,
          code: m.code,
          positions: positions as CardPosition[],
        });
        break;
      }
      case OcgMessageType.SELECT_UNSELECT_CARD: {
        gs().openDialog({
          id: crypto.randomUUID(),
          title: `Select/unselect cards`,
          type: "selectUnselect",
          player: m.player as 0 | 1,
          min: m.min,
          max: m.max,
          canCancel: m.can_cancel,
          canFinish: m.can_finish,
          selects: m.select_cards.map((s, i) => ({
            code: s.code,
            ...convertLocation(s)!,
            position: convertPosition(s.position)!,
            response: {
              type: OcgResponseType.SELECT_UNSELECT_CARD,
              index: i,
            },
          })),
          unselects: m.unselect_cards.map((s, i) => ({
            code: s.code,
            ...convertLocation(s)!,
            position: convertPosition(s.position)!,
            response: {
              type: OcgResponseType.SELECT_UNSELECT_CARD,
              index: m.select_cards.length + i,
            },
          })),
        });
        break;
      }
      case OcgMessageType.HINT: {
        switch (m.hint_type) {
          case OcgHintType.MESSAGE: {
            const msg = getDesc(m.hint);
            console.log(`Hint message for player ${m.player + 1}: ${msg}`);
            break;
          }
          case OcgHintType.EVENT: {
            const msg = getDesc(m.hint);
            console.log(`Hint event for player ${m.player + 1}: ${msg}`);
            break;
          }
          case OcgHintType.SELECTMSG: {
            const msg = getDesc(m.hint);
            console.log(`Hint select for player ${m.player + 1}: ${msg}`);
            break;
          }
          default: {
            const type = Object.entries(OcgHintType).find(
              (c) => c[1] === m.hint_type,
            )?.[0];
            console.log(`unknown hint type ${type ?? m.hint_type}`, m);
            break;
          }
        }
        break;
      }
      case OcgMessageType.CARD_HINT: {
        const msg = getDesc(m.description);
        console.log(`Hint message for player ${m.controller + 1}: ${msg}`);
        break;
      }
      case OcgMessageType.CONFIRM_CARDS: {
        break;
      }
      case OcgMessageType.DAMAGE: {
        const player = m.player as 0 | 1;
        const nextState = {
          ...egs(),
          players: R.map(egs().players, (p, i) =>
            i === player ? { ...p, lp: Math.max(0, p.lp - m.amount) } : p,
          ),
        };

        gs().queueEvent({
          event: { type: "lpDamage", amount: m.amount, player },
          nextState,
        });
        break;
      }
      case OcgMessageType.RETRY: {
        break;
      }
      default: {
        console.log(`unknown message ${ocgMessageTypeStrings.get(m.type)}`, m);
        break;
      }
    }
  }
}

function preloadTexture(code: number) {
  useTexture.preload(textureCardFront(code));
}

function sprintf(f: string, ...args: string[]): string {
  let index = 0;
  return f.replace(/%(ls)/g, () => args[index++]);
}

function parseFieldMask(mask: number) {
  function parseFieldMaskPlayer(
    m: number,
    controller: 0 | 1,
    places: CardFieldPos[],
  ) {
    for (let i = 0; i < 7; i++) {
      // 5 mm, 2 em
      if ((m & 1) === 0) {
        if (i >= 5) {
          places.push({
            controller,
            location: "extraMonsterZone",
            sequence: i - 5,
          });
        } else {
          places.push({ controller, location: "mainMonsterZone", sequence: i });
        }
      }
      m >>= 1;
    }
    m >>= 1;
    for (let i = 0; i < 8; i++) {
      // 5 st, 1 fs, 2 p
      if ((m & 1) === 0) {
        if (i >= 6) {
          // places.push({ controller, location: "pendulumZone", sequence: i - 6 });
        } else if (i >= 5) {
          places.push({ controller, location: "fieldZone", sequence: 0 });
        } else {
          places.push({ controller, location: "spellZone", sequence: i });
        }
      }
      m >>= 1;
    }
  }

  const places: CardFieldPos[] = [];
  parseFieldMaskPlayer(mask & 0xffff, 0, places);
  parseFieldMaskPlayer(mask >> 16, 0, places);
  return places;
}

export function sendResponse(resp: OcgResponse) {
  if (!ocg || !gameInstance) {
    return;
  }
  useGameStore.getState().setActions([]);
  useGameStore.getState().closeDialog();
  useGameStore.getState().setSelectedCard(null);
  useGameStore.getState().setFieldSelect(null);
  ocg.duelSetResponse(gameInstance, resp);
}

export function getDesc(inCode: bigint | number): string | null {
  const code = Number(
    typeof inCode === "bigint" ? inCode >> 20n : inCode >> 20,
  );
  const stringId = Number(
    typeof inCode === "bigint" ? inCode & 0xfffffn : inCode & 0xfffff,
  );
  if (code == 0) {
    return loadedData.strings.system.get(stringId) ?? null;
  }
  return loadedData.cards.get(code)?.strings.at(stringId) ?? null;
}

export function getSysString(stringId: number): string | null {
  return loadedData.strings.system.get(stringId) ?? null;
}

export function getCardName(code: number): string {
  return loadedData.cards.get(code)?.name ?? `${code}`;
}

export function formatLocation(location: OcgLocation, sequence: number) {
  if (location === OcgLocation.SZONE) {
    if (sequence < 5) return getSysString(1003);
    else if (sequence === 5) return getSysString(1008);
    else return getSysString(1009);
  }
  let filter = 1;
  let i = 1000;
  while (filter !== 0x100 && filter != location) {
    i++;
    filter <<= 1;
  }
  if (filter == location) {
    return getSysString(i);
  } else {
    return null;
  }
}

function setupPile(
  controller: 0 | 1,
  length: number,
  loc: CardPos["location"],
) {
  return Array.from(
    { length },
    (_, i) =>
      ({
        id: crypto.randomUUID(),
        code: 0,
        pos: { controller, location: loc, sequence: i, overlay: null },
        position: "down_atk",
      }) satisfies CardInfo,
  );
}

async function initializeCore() {
  ocg = await createCore({
    locateFile(url, scriptDirectory) {
      if (url.endsWith(".wasm")) {
        return coreUrl.toString();
      }
      return scriptDirectory + url;
    },
    sync: true,
  });
  const [maj, min] = ocg.getVersion();
  console.log(`core initialized (v${maj}.${min})`);
}
