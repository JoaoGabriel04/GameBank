import { getAvatarFolder, getCloudinary } from "../../lib/cloudinary.js";
import { logger } from "../../lib/logger.js";

export async function uploadAvatarToCloudinary(
  userId: number,
  buffer: Buffer
): Promise<{ url: string; publicId: string }> {
  const cloudinary = getCloudinary();
  const folder = getAvatarFolder();

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: `user_${userId}_${Date.now()}`,
        overwrite: false,
        resource_type: "image",
        transformation: [
          { width: 256, height: 256, crop: "fill", gravity: "auto" },
          { quality: "auto", fetch_format: "auto" },
        ],
      },
      (error: Error | undefined, result: Record<string, any> | undefined) => {
        if (error || !result?.secure_url || !result.public_id) {
          logger.error({ err: error }, "[avatar] Upload falhou");
          return reject(error ?? new Error("Upload Cloudinary falhou"));
        }
        logger.info({ publicId: result.public_id }, "avatar upload concluído");
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    stream.end(buffer);
  });
}

export async function deleteCloudinaryAvatar(publicId: string): Promise<void> {
  const cloudinary = getCloudinary();
  try {
    const result = await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
    logger.info({ publicId, result: result.result }, "avatar exclusão cloudinary");
  } catch (err) {
    logger.error({ err, publicId }, "avatar exclusão falhou");
    throw err;
  }
}

/** Remove uploads órfãos (rollback quando o banco falha após upload). */
export async function rollbackCloudinaryUpload(publicId: string) {
  try {
    await deleteCloudinaryAvatar(publicId);
    logger.info({ publicId }, "[avatar] Rollback órfão removido");
  } catch (err) {
    logger.error({ err, publicId }, "avatar rollback falhou — marcar para limpeza");
  }
}
