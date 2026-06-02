-- AlterTable: Remove default from banner column to make it truly nullable
ALTER TABLE "users" ALTER COLUMN "banner" DROP DEFAULT;
