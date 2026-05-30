export const ALLOWED_BANNER_PRESET_IDS = [
  "banner-01",
  "banner-02",
  "banner-03",
] as const;

export type BannerPresetId = (typeof ALLOWED_BANNER_PRESET_IDS)[number];

export function isAllowedBannerPreset(id: string): id is BannerPresetId {
  return (ALLOWED_BANNER_PRESET_IDS as readonly string[]).includes(id);
}

export function presetBannerValue(id: BannerPresetId) {
  return `preset:${id}`;
}
