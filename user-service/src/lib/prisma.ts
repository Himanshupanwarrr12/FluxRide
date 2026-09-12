import { PrismaClient } from "../generated/prisma/client.js"
import { PrismaPg } from "@prisma/adapter-pg";
import { databaseUrl, poolConfig } from "../config/db.config.js";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
}

const adapter = new PrismaPg({
  connectionString: databaseUrl,
  ...poolConfig,
})

let prisma: PrismaClient;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient({ adapter });
} else {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({ 
      adapter,
      log: ['query', 'error', 'warn'],
    });
  }
  prisma = globalForPrisma.prisma;
}

export const connectDatabase = async (): Promise<void> => {
  try {
    await prisma.$connect();
    console.log("[Database] Connected to PostgreSQL");
  } catch (error) {
    console.error("[Database] Failed to connect to PostgreSQL:", error);
    throw error;
  }
};

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export { prisma };

