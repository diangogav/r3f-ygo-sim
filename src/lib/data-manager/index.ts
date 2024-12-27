import { join } from "path";
import { CardData, CardsDatabase, loadCardsDatabase } from "./cards-database";
import { createScriptsCache } from "./scripts";
import { readFile } from "fs/promises";

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
  cardCodes: number[]
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
      })
    )
  );
  return [cards, scripts];
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
