import sharp from "sharp";
import { AppError } from "../middleware/error-handler.middleware.js";

const BADGE_MAX_BYTES = 2 * 1024 * 1024; // 2MB
const BADGE_MAX_DIM = 128;
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

export type ProcessedBadge = {
  buffer: Buffer;
  mime: "image/jpeg" | "image/png" | "image/webp";
  width: number;
  height: number;
};

export async function validateAndProcessBadge(
  buffer: Buffer,
  declaredMime?: string
): Promise<ProcessedBadge> {
  if (buffer.length > BADGE_MAX_BYTES) {
    throw new AppError(400, `Imagem muito grande (máx. ${BADGE_MAX_BYTES / 1024 / 1024}MB)`);
  }

  const detected = detectMime(buffer);
  if (!detected || !ALLOWED_MIMES.has(detected)) {
    throw new AppError(400, "Formato não permitido. Use JPG, PNG ou WebP.");
  }

  if (declaredMime && declaredMime !== detected) {
    throw new AppError(400, `Formato declarado (${declaredMime}) não corresponde ao real (${detected}).`);
  }

  const metadata = await sharp(buffer).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  if (width > BADGE_MAX_DIM || height > BADGE_MAX_DIM) {
    throw new AppError(400, `Dimensões máximas: ${BADGE_MAX_DIM}x${BADGE_MAX_DIM}px. Recebido: ${width}x${height}px.`);
  }

  if (width === 0 || height === 0) {
    throw new AppError(400, "Não foi possível ler as dimensões da imagem.");
  }

  const processed = await sharp(buffer)
    .resize(BADGE_MAX_DIM, BADGE_MAX_DIM, { fit: "inside", withoutEnlargement: true })
    .toBuffer();

  return { buffer: processed, mime: detected as "image/jpeg" | "image/png" | "image/webp", width, height };
}
