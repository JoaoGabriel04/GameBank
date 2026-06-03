export type ProfileBannerPreset = {
  id: string;
  label: string;
  gradient: string;
};

export const PROFILE_BANNER_PRESETS: ProfileBannerPreset[] = [
  { id: "banner-01", label: "Floresta",   gradient: "linear-gradient(135deg, #15803d 0%, #047857 50%, #064e3b 100%)" },
  { id: "banner-02", label: "Oceano",     gradient: "linear-gradient(135deg, #3b82f6 0%, #0891b2 50%, #1e3a8a 100%)" },
  { id: "banner-03", label: "Crepúsculo", gradient: "linear-gradient(135deg, #f97316 0%, #e11d48 50%, #581c87 100%)" },
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

/**
 * Converte o valor bruto do banner (preset:X, linear-gradient(...), https://...)
 * num par { className, style } pronto para aplicar num div. Garante cobertura
 * consistente em UserBanner, admin/loja ItemCard, admin/loja ItemPreview.
 *
 * O className retornado é sempre vazio — a renderização é 100% via style inline,
 * evitando problemas com Tailwind tree-shaking de classes dinâmicas.
 *
 * Fallback: gradiente neutro cinza, idêntico ao do UserBanner.
 */
export type BannerBackground = {
  className: string;
  style: React.CSSProperties;
};

const FALLBACK_BG: BannerBackground = {
  className: "",
  style: { background: "linear-gradient(135deg, #52525b, #27272a)" },
};

export function resolveBannerBackground(value?: string | null): BannerBackground {
  if (!value) return FALLBACK_BG;

  if (value.startsWith("preset:")) {
    const preset = resolveBanner(value);
    if (preset) return { className: "", style: { background: preset.gradient } };
    return FALLBACK_BG;
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return {
      className: "",
      style: {
        backgroundImage: `url(${value})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      },
    };
  }

  if (
    value.startsWith("linear-gradient") ||
    value.startsWith("radial-gradient") ||
    value.startsWith("conic-gradient")
  ) {
    return { className: "", style: { background: value } };
  }

  if (value.startsWith("#") || value.startsWith("rgb") || value.startsWith("hsl")) {
    return { className: "", style: { background: value } };
  }

  return FALLBACK_BG;
}
