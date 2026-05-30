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

export type ProfileAvatarPreset = {
  id: string;
  label: string;
  gradient: string;
  glyph: string;
};

export const PROFILE_AVATAR_PRESETS: ProfileAvatarPreset[] = [
  { id: "preset-01", label: "Dado", gradient: "from-green-500 to-emerald-800", glyph: "🎲" },
  { id: "preset-02", label: "Coroa", gradient: "from-amber-400 to-orange-700", glyph: "👑" },
  { id: "preset-03", label: "Foguete", gradient: "from-sky-400 to-blue-800", glyph: "🚀" },
  { id: "preset-04", label: "Estrela", gradient: "from-violet-500 to-purple-900", glyph: "⭐" },
  { id: "preset-05", label: "Fogo", gradient: "from-red-500 to-rose-900", glyph: "🔥" },
  { id: "preset-06", label: "Gema", gradient: "from-cyan-400 to-teal-800", glyph: "💎" },
  { id: "preset-07", label: "Troféu", gradient: "from-yellow-400 to-amber-800", glyph: "🏆" },
  { id: "preset-08", label: "Alvo", gradient: "from-pink-500 to-fuchsia-900", glyph: "🎯" },
  { id: "preset-09", label: "Raio", gradient: "from-lime-400 to-green-800", glyph: "⚡" },
  { id: "preset-10", label: "Máscara", gradient: "from-zinc-400 to-zinc-800", glyph: "🎭" },
  { id: "preset-11", label: "Carta", gradient: "from-indigo-500 to-indigo-900", glyph: "🃏" },
  { id: "preset-12", label: "Banco", gradient: "from-emerald-400 to-green-900", glyph: "🏦" },
];

export function resolvePreset(id: string) {
  return PROFILE_AVATAR_PRESETS.find((p) => p.id === id);
}
