/* eslint-disable */
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, ChevronRight } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import api from "@/services/api/index";
import Loading from "@/components/Loading";
import UserAvatar from "@/components/UserAvatar";
import {
  PROFILE_AVATAR_PRESETS,
  presetAvatarValue,
} from "@/constants/avatars";
import { getPostAuthPath } from "@/utils/authRedirect";
import { apiErrMsg } from "@/lib/api-error";

const MAX_NICK = 30;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export default function OnboardingPage() {
  const router = useRouter();
  const { user, token, loading, loadFromStorage, updateUser } = useAuthStore();
  const fileRef = useRef<HTMLInputElement>(null);

  const [nickname, setNickname] = useState("");
  const [avatarPreset, setAvatarPreset] = useState<string | null>(PROFILE_AVATAR_PRESETS[0]?.id ?? null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  useEffect(() => {
    if (loading) return;
    if (!token) {
      router.replace("/login");
      return;
    }
    if (user?.profileComplete) {
      router.replace("/user/sessions");
    }
  }, [loading, token, user, router]);

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const displayAvatarUrl = previewUrl
    ?? (avatarPreset ? presetAvatarValue(avatarPreset as "preset-01") : null);

  function clearBlobPreview() {
    if (previewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setPendingFile(null);
  }

  function handleFile(file: File) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Envie JPG, PNG ou WebP");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError("Imagem muito grande (máx. 5MB)");
      return;
    }
    clearBlobPreview();
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setPendingFile(file);
    setAvatarPreset(null);
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = nickname.trim();
    if (!trimmed) {
      setError("Escolha um apelido");
      return;
    }
    if (trimmed.length > MAX_NICK) {
      setError("Apelido deve ter no máximo 30 caracteres");
      return;
    }
    if (!pendingFile && !avatarPreset) {
      setError("Escolha um avatar");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const form = new FormData();
      form.append("nome", trimmed);
      if (pendingFile) {
        form.append("avatar", pendingFile);
      } else if (avatarPreset) {
        form.append("avatarPreset", avatarPreset);
      }

      const res = await api.post("/auth/profile", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      updateUser(res.data.user);
      router.replace(getPostAuthPath(res.data.user));
    } catch (err) {
      setError(apiErrMsg(err, "Não foi possível salvar o perfil"));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !token) {
    return <Loading label="Carregando..." />;
  }

  return (
    <main className="min-h-screen bg-zinc-950 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-4xl">
        <p className="text-center text-green-400/80 font-jaro text-sm tracking-widest uppercase mb-2">
          GameBank
        </p>
        <h1 className="text-3xl md:text-4xl font-jaro text-zinc-100 text-center mb-2">
          Crie seu perfil de jogador
        </h1>
        <p className="text-zinc-500 text-center font-inconsolata text-sm mb-10 max-w-lg mx-auto">
          A foto só é enviada quando você clicar em Continuar. O preview é local até lá.
        </p>

        <form
          onSubmit={handleSubmit}
          className="bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl"
        >
          <div className="grid md:grid-cols-[1fr_1.2fr] gap-0">
            <div className="relative flex flex-col items-center justify-center p-8 md:p-10 bg-gradient-to-b from-green-900/20 to-transparent border-b md:border-b-0 md:border-r border-zinc-800">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-green-500/10 via-transparent to-transparent pointer-events-none" />
              <UserAvatar
                avatarUrl={displayAvatarUrl}
                nome={nickname || "?"}
                size="xl"
                ring
              />
              <p className="mt-6 text-xl font-jaro text-zinc-100 truncate max-w-[220px] text-center">
                {nickname.trim() || "Seu apelido"}
              </p>
              <p className="text-xs font-inconsolata text-zinc-500 mt-1">
                {nickname.trim().length}/{MAX_NICK}
              </p>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={submitting}
                className="mt-6 flex items-center gap-2 text-sm font-inconsolata text-zinc-300 hover:text-green-400 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Camera className="w-4 h-4" />
                Enviar foto própria
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = "";
                }}
              />
            </div>

            <div className="p-6 md:p-8">
              <p className="text-xs font-inconsolata text-zinc-500 uppercase tracking-wide mb-4">
                Escolha um avatar
              </p>
              <div className="grid grid-cols-4 gap-2 sm:gap-3 mb-8">
                {PROFILE_AVATAR_PRESETS.map((preset) => {
                  const selected = !pendingFile && avatarPreset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      title={preset.label}
                      disabled={submitting}
                      onClick={() => {
                        clearBlobPreview();
                        setAvatarPreset(preset.id);
                        setError("");
                      }}
                      className={`aspect-square rounded-xl bg-gradient-to-br ${preset.gradient} flex items-center justify-center text-2xl transition-all cursor-pointer disabled:opacity-50 ${
                        selected
                          ? "ring-2 ring-green-400 scale-105 shadow-lg shadow-green-500/20"
                          : "opacity-80 hover:opacity-100 hover:scale-105"
                      }`}
                    >
                      {preset.glyph}
                    </button>
                  );
                })}
              </div>

              <label className="block text-xs font-inconsolata text-zinc-500 uppercase tracking-wide mb-2">
                Apelido no jogo
              </label>
              <input
                type="text"
                value={nickname}
                maxLength={MAX_NICK}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Ex: Magnata99"
                disabled={submitting}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100 font-inconsolata focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 mb-2 disabled:opacity-50"
                autoComplete="off"
              />

              {error && (
                <p className="text-red-400 text-sm font-inconsolata bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-4">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-4 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 disabled:bg-zinc-700 text-white font-jaro py-3.5 rounded-xl transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                {submitting ? "Enviando..." : "Continuar"}
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}
