import { readFile, readdir } from "fs/promises";

export function createScriptsCache(scriptsDataPath: string) {
  const scriptsCache = new Map<string, string>();
  const promiseBaseScripts = preloadedBaseScripts(scriptsDataPath);

  return {
    async get(path: string) {
      let contents = scriptsCache.get(path);
      if (!contents) {
        try {
          contents = await readFile(`${scriptsDataPath}/${path}`, "utf-8");
        } catch (e) {
          console.warn("missing script", path);
          contents = "";
        }
        scriptsCache.set(path, contents);
      }
      return contents;
    },
    async loadBaseScripts() {
      return await promiseBaseScripts;
    },
  };
}

async function preloadedBaseScripts(scriptsDataPath: string) {
  let files = await readdir(scriptsDataPath);
  files = files.filter((f) => f.endsWith(".lua"));
  const entries = await Promise.all(
    files.map(async (f) => {
      const contents = await readFile(`${scriptsDataPath}/${f}`, "utf-8");
      return [f, contents] as const;
    }),
  );
  return new Map(entries);
}
