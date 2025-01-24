import { z } from "zod";
import { GameLoader } from "./page-client";

export default async function PagePlay({ searchParams }: NextPageProps) {
  const { d: data } = z
    .object({
      d: schemaJsonString.pipe(
        z.object({
          decks: z.tuple([z.string(), z.string()]),
          seed: z.tuple([z.number(), z.number(), z.number(), z.number()]),
        }),
      ),
    })
    .parse(await searchParams);

  return (
    <GameLoader
      options={{
        player1: { deck: data.decks[0] },
        player2: { deck: data.decks[1] },
        seed: data.seed,
      }}
    />
  );
}

const schemaJsonString = z
  .string()
  .transform((str, ctx): z.infer<ReturnType<any>> => {
    try {
      return JSON.parse(str);
    } catch (e) {
      ctx.addIssue({ code: "custom", message: "Invalid JSON" });
      return z.NEVER;
    }
  });
