import { getBadgeFolder, getCloudinary } from "../../lib/cloudinary.js";

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
          console.error("[badge] Upload falhou:", error);
          return reject(error ?? new Error("Upload Cloudinary falhou"));
        }
        console.log("[badge] Upload concluído:", result.public_id);
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
    console.log("[badge] Exclusão:", publicId, result.result);
  } catch (err) {
    console.error("[badge] Exclusão falhou:", publicId, err);
    throw err;
  }
}

export async function rollbackBadgeUpload(publicId: string) {
  try {
    await deleteCloudinaryBadge(publicId);
    console.log("[badge] Rollback órfão removido:", publicId);
  } catch {
    console.log("[badge] Rollback falhou — marcar para limpeza:", publicId);
  }
}
