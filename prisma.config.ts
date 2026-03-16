import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url:
      process.env.STORAGE_URL_NON_POOLING ||
      process.env.STORAGE_URL ||
      process.env.DATABASE_URL ||
      "",
  },
});
