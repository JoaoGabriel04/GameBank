import { getBannerFolder, getCloudinary } from "../../lib/cloudinary.js";

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
          console.error("[banner] Upload falhou:", error);
          return reject(error ?? new Error("Upload Cloudinary falhou"));
        }
        console.log("[banner] Upload concluído:", result.public_id);
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
    console.log("[banner] Exclusão:", publicId, result.result);
  } catch (err) {
    console.error("[banner] Exclusão falhou:", publicId, err);
    throw err;
  }
}

export async function rollbackBannerUpload(publicId: string) {
  try {
    await deleteCloudinaryBanner(publicId);
    console.log("[banner] Rollback órfão removido:", publicId);
  } catch (err) {
    console.error("[banner] Rollback falhou — marcar para limpeza:", publicId, err);
  }
}
