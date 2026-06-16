import { getBannerFolder, getCloudinary } from "../../lib/cloudinary.js";
import { logger } from "../../lib/logger.js";

const BANNER_OUTPUT_WIDTH = Number(process.env.BANNER_OUTPUT_WIDTH || 1200);
const BANNER_OUTPUT_HEIGHT = Number(process.env.BANNER_OUTPUT_HEIGHT || 400);

export async function uploadBannerToCloudinary(
  bannerId: number | string,
  buffer: Buffer
): Promise<{ url: string; publicId: string }> {
  const cloudinary = getCloudinary();
  const folder = getBannerFolder();

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: `banner_${bannerId}_${Date.now()}`,
        overwrite: false,
        resource_type: "image",
        transformation: [
          { width: BANNER_OUTPUT_WIDTH, height: BANNER_OUTPUT_HEIGHT, crop: "fill" },
          { quality: "auto", fetch_format: "auto" },
        ],
      },
      (error: Error | undefined, result: Record<string, any> | undefined) => {
        if (error || !result?.secure_url || !result.public_id) {
          logger.error({ err: error }, "[banner] Upload falhou");
          return reject(error ?? new Error("Upload Cloudinary falhou"));
        }
        logger.info({ publicId: result.public_id }, "banner upload concluído");
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    stream.end(buffer);
  });
}

export async function deleteCloudinaryBanner(publicId: string): Promise<void> {
  const cloudinary = getCloudinary();
  try {
    const result = await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
    logger.info({ publicId, result: result.result }, "banner exclusão cloudinary");
  } catch (err) {
    logger.error({ err, publicId }, "banner exclusão falhou");
    throw err;
  }
}

export async function rollbackBannerUpload(publicId: string) {
  try {
    await deleteCloudinaryBanner(publicId);
    logger.info({ publicId }, "[banner] Rollback órfão removido");
  } catch (err) {
    logger.error({ err, publicId }, "banner rollback falhou — marcar para limpeza");
  }
}
