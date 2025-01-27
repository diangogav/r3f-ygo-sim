import { createClient } from "@libsql/client";
import { eq, inArray, sql } from "drizzle-orm";
import { drizzle, LibSQLDatabase } from "drizzle-orm/libsql";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { OcgCardData, OcgType } from "ocgcore-wasm";

const $ = {
  text: sqliteTable("texts", {
    id: integer("id").$type<bigint>().primaryKey().notNull(),
    name: text("name").notNull(),
    desc: text("desc").notNull(),
    str1: text("str1").notNull(),
    str2: text("str2").notNull(),
    str3: text("str3").notNull(),
    str4: text("str4").notNull(),
    str5: text("str5").notNull(),
    str6: text("str6").notNull(),
    str7: text("str7").notNull(),
    str8: text("str8").notNull(),
    str9: text("str9").notNull(),
    str10: text("str10").notNull(),
    str11: text("str11").notNull(),
    str12: text("str12").notNull(),
    str13: text("str13").notNull(),
    str14: text("str14").notNull(),
    str15: text("str15").notNull(),
    str16: text("str16").notNull(),
  }),
  data: sqliteTable("datas", {
    id: integer("id").$type<bigint>().primaryKey().notNull(),
    ot: integer("ot").$type<bigint>().notNull(),
    alias: integer("alias").$type<bigint>().notNull(),
    setcode: integer("setcode").$type<bigint>().notNull(),
    type: integer("type").$type<bigint>().notNull(),
    atk: integer("atk").$type<bigint>().notNull(),
    def: integer("def").$type<bigint>().notNull(),
    level: integer("level").$type<bigint>().notNull(),
    race: integer("race").$type<bigint>().notNull(),
    attribute: integer("attribute").$type<bigint>().notNull(),
    category: integer("category").$type<bigint>().notNull(),
  }),
} as const;

export type CardsDatabase = {
  db: LibSQLDatabase<typeof $>;
  getCard: (code: number) => Promise<CardData | null>;
  getCards: (codes: number[]) => Promise<CardData[]>;
};

export async function loadCardsDatabase(path: string): Promise<CardsDatabase> {
  const db = drizzle(createClient({ url: `file:${path}`, intMode: "bigint" }), {
    schema: $,
  });
  await db.run(sql`select 1`);
  return {
    db,
    getCard: (code) => loadCardsData(db, [code]).then((l) => l.at(0) ?? null),
    getCards: (codes) => loadCardsData(db, codes),
  };
}

export type CardData = {
  id: number;
  data: OcgCardData;
  name: string;
  desc: string;
  strings: string[];
};

export async function loadCardsData(
  db: LibSQLDatabase<typeof $>,
  cardCodes: number[],
) {
  const values = await db
    .select({ data: $.data, text: $.text })
    .from($.data)
    .innerJoin($.text, eq($.text.id, $.data.id))
    .where(
      inArray(
        $.data.id,
        cardCodes.map((c) => BigInt(c)),
      ),
    );
  const ret: CardData[] = [];

  type Indexes = keyof {
    [K in keyof typeof $.text.$inferSelect as K extends `str${number}`
      ? K
      : never]: 1;
  };

  for (const value of values) {
    const setcodes = [
      ...new Int16Array(BigInt64Array.from([value.data.setcode]).buffer),
    ];
    const type = Number(value.data.type);
    ret.push({
      id: Number(value.data.id),
      data: {
        code: Number(value.data.id),
        alias: Number(value.data.alias),
        setcodes,
        type,
        attack: Number(value.data.atk),
        defense: type & OcgType.LINK ? 0 : Number(value.data.def),
        link_marker: type & OcgType.LINK ? Number(value.data.def) : 0,
        level: Number(value.data.level) & 0xff,
        lscale: (Number(value.data.level) >> 24) & 0xff,
        rscale: (Number(value.data.level) >> 16) & 0xff,
        race: value.data.race,
        attribute: Number(value.data.attribute),
      },
      name: value.text.name,
      desc: value.text.desc,
      strings: Array.from(
        { length: 16 },
        (_, i) => value.text[`str${i + 1}` as Indexes],
      ).filter((v, i, a) => v || a.slice(i + 1).some((x) => !!x)),
    });
  }

  return ret;
}
