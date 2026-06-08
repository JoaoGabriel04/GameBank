import { getFrameFolder, getCloudinary } from "../../lib/cloudinary.js";

export async function uploadFrameToCloudinary(
  frameId: number | string,
  buffer: Buffer
): Promise<{ url: string; publicId: string }> {
  const cloudinary = getCloudinary();
  const folder = getFrameFolder();

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: `frame_${frameId}_${Date.now()}`,
        overwrite: false,
        resource_type: "image",
        transformation: [
          { width: 256, height: 256, crop: "fill" },
          { quality: "auto", fetch_format: "auto" },
        ],
      },
      (error: Error | undefined, result: Record<string, any> | undefined) => {
        if (error || !result?.secure_url || !result.public_id) {
          console.error("[frame] Upload falhou:", error);
          return reject(error ?? new Error("Upload Cloudinary falhou"));
        }
        console.log("[frame] Upload concluído:", result.public_id);
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    stream.end(buffer);
  });
}

export async function deleteCloudinaryFrame(publicId: string): Promise<void> {
  const cloudinary = getCloudinary();
  try {
    const result = await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
    console.log("[frame] Exclusão:", publicId, result.result);
  } catch (err) {
    console.error("[frame] Exclusão falhou:", publicId, err);
    throw err;
  }
}

export async function rollbackFrameUpload(publicId: string) {
  try {
    await deleteCloudinaryFrame(publicId);
    console.log("[frame] Rollback órfão removido:", publicId);
  } catch (err) {
    console.error("[frame] Rollback falhou — marcar para limpeza:", publicId, err);
  }
}
