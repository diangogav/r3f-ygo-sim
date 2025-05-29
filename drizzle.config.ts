import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  dbCredentials: {
    url: "file:./ignisdata/cdb/cards.cdb",
  },
});
