import { readFile } from "fs/promises";
import { join } from "path";
import { CardData, CardsDatabase, loadCardsDatabase } from "./cards-database";
import { createScriptsCache } from "./scripts";

const scriptsDataPath = `./ignisdata/scripts`;
const cdbDataPath = `./ignisdata/cdb`;
const distDataPath = `./ignisdata/dist`;
const deltaDataPath = `./ignisdata/delta`;

const dbCache = new Map<string, Promise<CardsDatabase>>();
async function getCardsDatabaseCached(db: string) {
  let promise = dbCache.get(db);
  if (!promise) {
    promise = loadCardsDatabase(`${cdbDataPath}/${db}.cdb`);
    dbCache.set(db, promise);
  }
  return await promise;
}

const scriptsCache = createScriptsCache(scriptsDataPath);

const cardsCache = new Map<number, CardData>();

export async function getCards(
  cardCodes: number[],
): Promise<[CardData[], Map<string, string>]> {
  const cards = await (async () => {
    const cards: CardData[] = [];
    const toRequest: number[] = [];
    for (const code of cardCodes) {
      const cachedCard = cardsCache.get(code);
      if (cachedCard) {
        cards.push(cachedCard);
      } else {
        toRequest.push(code);
      }
    }

    if (toRequest.length === 0) {
      return cards;
    }

    const db = await getCardsDatabaseCached("cards");
    cards.push(...(await db.getCards(toRequest)));
    return cards;
  })();

  const scripts = new Map(
    await Promise.all(
      cards.map(async (card) => {
        const path = `c${card.data.alias || card.id}.lua`;
        const script = await scriptsCache.get(`official/${path}`);
        return [path, script] as const;
      }),
    ),
  );
  return [cards, scripts];
}

const promiseScriptConstants = (async () => {
  return {
    ...parseScriptAssignments(
      await scriptsCache.get(`card_counter_constants.lua`),
    ),
    ...parseScriptAssignments(
      await scriptsCache.get(`archetype_setcode_constants.lua`),
    ),
  };
})();

export async function getAllReferencedCards(context: {
  cards: Map<number, CardData>;
  scripts: Map<string, string>;
}) {
  const db = await getCardsDatabaseCached("cards");

  const set = new Set<number>();

  const addToSet = async (id: number) => {
    for (const card of await getReferencedCards(id)) {
      if (typeof card === "number" && !context.cards.has(card)) {
        const dbCard = await db.getCard(card);
        if (dbCard) {
          context.cards.set(card, dbCard);
          set.add(card);
        }
        const scriptPath = `official/c${card}.lua`;
        if (context.scripts.has(scriptPath)) {
          const script = await scriptsCache.get(scriptPath);
          if (script) {
            context.scripts.set(scriptPath, script);
          }
        }
      }
    }
  };

  for (const [id] of context.cards.entries()) {
    await addToSet(id);
  }

  while (set.size > 0) {
    const setCopy = [...set.keys()];
    set.clear();
    for (const k of setCopy) {
      await addToSet(k);
    }
  }
}

async function getReferencedCards(code: number) {
  const script = await scriptsCache.get(`official/c${code}.lua`);
  if (!script) {
    return [];
  }

  let constants = {
    ...(await promiseScriptConstants),
    id: code,
  };
  constants = {
    ...constants,
    ...parseScriptAssignments(script, constants),
  };

  const referencedCards = [
    ...(script
      .match(/\.listed_names=\{(.*?)\}/)
      ?.at(1)
      ?.split(/\,/g) ?? []),
    ...(script
      .match(/\.fit_monster=\{(.*?)\}/)
      ?.at(1)
      ?.split(/\,/g) ?? []),
  ];

  return referencedCards.map((c) => resolveConstant(c, constants));
}

function resolveConstant(text: string, context: Record<string, any>) {
  try {
    text = text.replace(/\{/g, "[").replace(/\}/g, "]");
    const entries = Object.entries(context);
    return new Function(...entries.map((e) => e[0]), `return ${text}`).apply(
      null,
      entries.map((e) => e[1]),
    );
  } catch (e) {
    console.log("failed to parse ", text);
    return text;
  }
}

function parseScriptAssignments(
  script: string,
  context: Record<string, any> = {},
) {
  return Object.fromEntries(
    [...script.matchAll(/^(\w+)\s*=\s*(.*?)\s*(--.*)?$/gm)].map((c) => [
      c[1],
      resolveConstant(c[2], context),
    ]),
  );
}

export const preloadedBaseScripts = scriptsCache.loadBaseScripts();

export const preloadedStrings = (async () => {
  const distStringsPath = join(distDataPath, "config/strings.conf");
  const deltaStringsPath = join(deltaDataPath, "strings.conf");

  const [distStrings, deltaStrings] = await Promise.all([
    readFile(distStringsPath, "utf-8"),
    readFile(deltaStringsPath, "utf-8"),
  ]);

  const ret = {
    system: new Map<number, string>(),
    counter: new Map<number, string>(),
    setname: new Map<number, string>(),
    victory: new Map<number, string>(),
  };

  for (const line of `${distStrings}\n${deltaStrings}`.split(/[\n\r]+/g)) {
    const match = line.match(/^!(\w+)\s+(\d+)\s*(.*?)$/);
    if (!match) {
      continue;
    }
    const [_, kind, idString, value] = match;
    const id = parseInt(idString);
    if (kind === "system") {
      ret.system.set(id, value);
    } else if (kind === "counter") {
      ret.counter.set(id, value);
    } else if (kind === "setname") {
      ret.setname.set(id, value);
    } else if (kind === "victory") {
      ret.victory.set(id, value);
    } else {
      throw new Error(`unknown kind ${kind}`);
    }
  }
  return ret;
})();
