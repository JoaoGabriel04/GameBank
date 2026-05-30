import sharp from "sharp";
import { AppError } from "../middleware/error-handler.middleware.js";

const MAX_BYTES = Number(process.env.AVATAR_MAX_BYTES || 5 * 1024 * 1024);
const MIN_DIM = Number(process.env.AVATAR_MIN_DIM || 100);
const MAX_DIM = Number(process.env.AVATAR_MAX_DIM || 4096);
const OUTPUT_SIZE = Number(process.env.AVATAR_OUTPUT_SIZE || 512);

const ALLOWED_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);

function detectMime(buffer: Buffer): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export type ProcessedAvatar = {
  buffer: Buffer;
  mime: "image/jpeg";
  width: number;
  height: number;
};

export async function validateAndProcessAvatar(
  buffer: Buffer,
  declaredMime?: string
): Promise<ProcessedAvatar> {
  if (buffer.length > MAX_BYTES) {
    throw new AppError(400, `Imagem muito grande (máx. ${Math.round(MAX_BYTES / 1024 / 1024)}MB)`);
  }

  const detected = detectMime(buffer);
  if (!detected || !ALLOWED_MIMES.has(detected)) {
    throw new AppError(400, "Formato não permitido. Use JPG, PNG ou WebP.");
  }

  if (declaredMime && declaredMime !== detected) {
    throw new AppError(400, "Tipo de arquivo não corresponde ao conteúdo real.");
  }

  let meta;
  try {
    meta = await sharp(buffer, { failOn: "error" }).rotate().metadata();
  } catch {
    throw new AppError(400, "Arquivo de imagem inválido ou corrompido.");
  }

  const width = meta.width ?? 0;
  const height = meta.height ?? 0;

  if (width < MIN_DIM || height < MIN_DIM) {
    throw new AppError(400, `Imagem muito pequena (mín. ${MIN_DIM}x${MIN_DIM}px).`);
  }

  if (width > MAX_DIM || height > MAX_DIM) {
    throw new AppError(400, `Imagem muito grande (máx. ${MAX_DIM}x${MAX_DIM}px).`);
  }

  const processed = await sharp(buffer)
    .rotate()
    .resize(OUTPUT_SIZE, OUTPUT_SIZE, { fit: "cover", position: "centre" })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();

  return {
    buffer: processed,
    mime: "image/jpeg",
    width: OUTPUT_SIZE,
    height: OUTPUT_SIZE,
  };
}
