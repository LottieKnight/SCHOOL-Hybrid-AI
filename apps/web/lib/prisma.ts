import { PrismaClient } from "@prisma/client";
import { initPastPapersEnv } from "./env";

initPastPapersEnv();

type PrismaClientType = PrismaClient;

declare global {
  var prismaPastPapers: PrismaClientType | undefined;
}

function getPrismaClient(): PrismaClientType {
  if (!global.prismaPastPapers) {
    global.prismaPastPapers = new PrismaClient();
  }
  return global.prismaPastPapers;
}

export const prisma = new Proxy({} as PrismaClientType, {
  get(_target, prop, receiver) {
    const client = getPrismaClient();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
}) as PrismaClientType;
