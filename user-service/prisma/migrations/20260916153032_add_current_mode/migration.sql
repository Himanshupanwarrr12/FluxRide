-- CreateEnum
CREATE TYPE "AppMode" AS ENUM ('RIDER', 'DRIVER');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "currentMode" "AppMode" NOT NULL DEFAULT 'RIDER';
