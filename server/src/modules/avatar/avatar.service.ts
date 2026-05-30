import { getAvatarFolder, getCloudinary } from "../../lib/cloudinary.js";

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
          console.error("[avatar] Upload falhou:", error);
          return reject(error ?? new Error("Upload Cloudinary falhou"));
        }
        console.log("[avatar] Upload concluído:", result.public_id);
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
    console.log("[avatar] Exclusão:", publicId, result.result);
  } catch (err) {
    console.error("[avatar] Exclusão falhou:", publicId, err);
    throw err;
  }
}

/** Remove uploads órfãos (rollback quando o banco falha após upload). */
export async function rollbackCloudinaryUpload(publicId: string) {
  try {
    await deleteCloudinaryAvatar(publicId);
    console.log("[avatar] Rollback órfão removido:", publicId);
  } catch (err) {
    console.error("[avatar] Rollback falhou — marcar para limpeza:", publicId, err);
  }
}
