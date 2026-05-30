/** IDs de avatares preset permitidos (sem upload Cloudinary). */
export const ALLOWED_AVATAR_PRESET_IDS = [
  "preset-01",
  "preset-02",
  "preset-03",
  "preset-04",
  "preset-05",
  "preset-06",
  "preset-07",
  "preset-08",
  "preset-09",
  "preset-10",
  "preset-11",
  "preset-12",
] as const;

export type AvatarPresetId = (typeof ALLOWED_AVATAR_PRESET_IDS)[number];

export function isAllowedAvatarPreset(id: string): id is AvatarPresetId {
  return (ALLOWED_AVATAR_PRESET_IDS as readonly string[]).includes(id);
}

export function presetAvatarValue(id: AvatarPresetId) {
  return `preset:${id}`;
}
