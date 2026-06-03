import multer from "multer";

const MAX_BYTES = Number(process.env.AVATAR_MAX_BYTES || 5 * 1024 * 1024);
const BANNER_MAX_BYTES = Number(process.env.BANNER_MAX_BYTES || 8 * 1024 * 1024);

const ALLOWED_MIMES = ["image/jpeg", "image/png", "image/webp"];

export const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIMES.includes(file.mimetype)) {
      cb(new Error("Formato não permitido. Use JPG, PNG ou WebP."));
      return;
    }
    cb(null, true);
  },
});

export const bannerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: BANNER_MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIMES.includes(file.mimetype)) {
      cb(new Error("Formato não permitido. Use JPG, PNG ou WebP."));
      return;
    }
    cb(null, true);
  },
});
