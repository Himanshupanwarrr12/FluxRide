import "dotenv/config"
import { PrismaClient } from "../generated/prisma/client.js"
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const { Pool } = pg;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
}

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error("Database_URL enviroment is not set");
}

const adapter = new PrismaPg({
  connectionString,
  max:20,
  idleTimeoutMillis:60000,
  connectionTimeoutMillis:30000
})

let prisma : PrismaClient

if (process.env.NODE_ENV === 'production') {
  // Production: create new instance
  prisma = new PrismaClient({ adapter });
} else {
  // Development: reuse instance to prevent too many connections
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({ 
      adapter,
      log: ['query', 'error', 'warn'], // Log queries in development
    });
  }
  prisma = globalForPrisma.prisma;
}

// shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export {prisma}  