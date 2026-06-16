import { getBadgeFolder, getCloudinary } from "../../lib/cloudinary.js";
import { logger } from "../../lib/logger.js";

export async function uploadBadgeToCloudinary(
  itemId: number | string,
  buffer: Buffer
): Promise<{ url: string; publicId: string }> {
  const cloudinary = getCloudinary();
  const folder = getBadgeFolder();

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: `badge_${itemId}_${Date.now()}`,
        overwrite: false,
        resource_type: "image",
        transformation: [
          { width: 128, height: 128, crop: "limit" },
          { quality: "auto", fetch_format: "auto" },
        ],
      },
      (error: Error | undefined, result: Record<string, any> | undefined) => {
        if (error || !result?.secure_url || !result.public_id) {
          logger.error({ err: error }, "[badge] Upload falhou");
          return reject(error ?? new Error("Upload Cloudinary falhou"));
        }
        logger.info({ publicId: result.public_id }, "badge upload concluído");
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    stream.end(buffer);
  });
}

export async function deleteCloudinaryBadge(publicId: string): Promise<void> {
  const cloudinary = getCloudinary();
  try {
    const result = await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
    logger.info({ publicId, result: result.result }, "badge exclusão cloudinary");
  } catch (err) {
    logger.error({ err, publicId }, "badge exclusão falhou");
    throw err;
  }
}

export async function rollbackBadgeUpload(publicId: string) {
  try {
    await deleteCloudinaryBadge(publicId);
    logger.info({ publicId }, "[badge] Rollback órfão removido");
  } catch {
    logger.info({ publicId }, "[badge] Rollback falhou — marcar para limpeza");
  }
}
