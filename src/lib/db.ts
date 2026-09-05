import { PrismaClient } from "@/generated/prisma";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });

// Em dev o hot reload recria modulos a cada edicao; sem o singleton o pool
// de conexoes cresce ate o Postgres recusar novas conexoes.
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
