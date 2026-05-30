-- Cloudinary: URL + public_id para exclusão segura
ALTER TABLE "users" ADD COLUMN "avatarPublicId" TEXT;
ALTER TABLE "users" ADD COLUMN "avatarUpdatedAt" TIMESTAMP(3);
