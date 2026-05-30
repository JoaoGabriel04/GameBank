export type ProfileBannerPreset = {
  id: string;
  label: string;
  gradient: string;
};

export const PROFILE_BANNER_PRESETS: ProfileBannerPreset[] = [
  { id: "banner-01", label: "Floresta",   gradient: "from-green-600 via-emerald-700 to-green-900" },
  { id: "banner-02", label: "Oceano",     gradient: "from-blue-500 via-cyan-600 to-blue-900" },
  { id: "banner-03", label: "Crepúsculo", gradient: "from-orange-500 via-rose-600 to-purple-900" },
];

export const ALLOWED_BANNER_PRESET_IDS = PROFILE_BANNER_PRESETS.map((b) => b.id);

export type BannerPresetId = (typeof ALLOWED_BANNER_PRESET_IDS)[number];

export function isAllowedBannerPreset(id: string): id is BannerPresetId {
  return ALLOWED_BANNER_PRESET_IDS.includes(id);
}

export function presetBannerValue(id: BannerPresetId) {
  return `preset:${id}`;
}

export function resolveBanner(value?: string | null): ProfileBannerPreset | null {
  if (!value?.startsWith("preset:")) return null;
  return PROFILE_BANNER_PRESETS.find((b) => b.id === value.replace("preset:", "")) ?? null;
}
