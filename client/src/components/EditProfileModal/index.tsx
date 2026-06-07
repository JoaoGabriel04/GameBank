"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { backdrop, modalBox } from "@/lib/animations";
import { X, Camera } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useProfileStore } from "@/stores/profileStore";
import UserAvatar from "@/components/UserAvatar";
import { PROFILE_AVATAR_PRESETS, presetAvatarValue } from "@/constants/avatars";
import { apiErrMsg } from "@/lib/api-error";
import { toast } from "@/lib/toast";

const MAX_NICK = 30;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function EditProfileModal({ isOpen, onClose }: Props) {
  const { user } = useAuthStore();
  const { profile, updateProfile } = useProfileStore();
  const fileRef = useRef<HTMLInputElement>(null);

  const [nome, setNome] = useState("");
  const [avatarPreset, setAvatarPreset] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen || !profile) return;
    setNome(profile.nome);
    setPendingFile(null);
    setPreviewUrl(null);
    const current = profile.avatarUrl;
    setAvatarPreset(current?.startsWith("preset:") ? current.replace("preset:", "") : null);
  }, [isOpen, profile]);

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  if (!isOpen) return null;

  const displayAvatarUrl =
    previewUrl ??
    (avatarPreset ? presetAvatarValue(avatarPreset as "preset-01") : profile?.avatarUrl ?? null);

  function clearBlobPreview() {
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPendingFile(null);
  }

  function handleFile(file: File) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Envie JPG, PNG ou WebP");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error("Imagem muito grande (máx. 5 MB)");
      return;
    }
    clearBlobPreview();
    setPreviewUrl(URL.createObjectURL(file));
    setPendingFile(file);
    setAvatarPreset(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = nome.trim();
    if (trimmed.length === 0) {
      toast.error("Apelido não pode ficar vazio");
      return;
    }

    const formData = new FormData();
    formData.append("nome", trimmed);
    if (pendingFile) {
      formData.append("avatar", pendingFile);
    } else if (avatarPreset) {
      formData.append("avatarPreset", avatarPreset);
    }

    setSubmitting(true);
    try {
      await updateProfile(formData);
      toast.success("Perfil atualizado!");
      onClose();
    } catch (err) {
      toast.error(apiErrMsg(err, "Erro ao salvar perfil"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center px-4"
        >
          <motion.div
            variants={backdrop}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute inset-0 bg-black/70"
            onClick={onClose}
          />
          <motion.div
            variants={modalBox}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h2 className="font-jaro text-zinc-100 text-lg">Editar Perfil</h2>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5 max-h-[80vh] overflow-y-auto">

          <div className="flex flex-col items-center gap-2">
            <div className="relative">
              <UserAvatar
                avatarUrl={displayAvatarUrl}
                avatarUpdatedAt={profile?.avatarUpdatedAt}
                nome={nome || profile?.nome || "?"}
                size="xl"
                ring
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={submitting}
                className="absolute bottom-1 right-1 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-full p-1.5 transition-colors cursor-pointer disabled:opacity-50"
                title="Enviar foto própria"
              >
                <Camera className="w-3.5 h-3.5 text-zinc-300" />
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
            <p className="text-xs font-inconsolata text-zinc-500">
              Clique na câmera para enviar foto própria
            </p>
          </div>

          <div>
            <p className="text-xs font-inconsolata text-zinc-500 uppercase tracking-wide mb-2">
              Ou escolha um avatar
            </p>
            <div className="grid grid-cols-6 gap-2">
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
                    }}
                    className={`aspect-square rounded-lg bg-gradient-to-br ${preset.gradient} flex items-center justify-center text-lg transition-all cursor-pointer disabled:opacity-50 ${
                      selected
                        ? "ring-2 ring-green-400 scale-105 shadow-lg shadow-green-500/20"
                        : "opacity-70 hover:opacity-100 hover:scale-105"
                    }`}
                  >
                    {preset.glyph}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-inconsolata text-zinc-500 uppercase tracking-wide mb-2">
              Apelido
            </label>
            <input
              type="text"
              value={nome}
              maxLength={MAX_NICK}
              onChange={(e) => setNome(e.target.value)}
              disabled={submitting}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-2.5 text-zinc-100 font-inconsolata text-sm focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 disabled:opacity-50"
              autoComplete="off"
            />
            <p className="text-right text-xs text-zinc-600 mt-1">
              {nome.length}/{MAX_NICK}
            </p>
          </div>

          <div>
            <label className="block text-xs font-inconsolata text-zinc-500 uppercase tracking-wide mb-2">
              Email
            </label>
            <input
              type="email"
              value={user?.email ?? ""}
              disabled
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-500 font-inconsolata text-sm cursor-not-allowed"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-jaro py-3 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-green-600 hover:bg-green-500 disabled:bg-zinc-700 text-white font-jaro py-3 rounded-xl transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              {submitting ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
        </motion.div>
      </div>
      )}
    </AnimatePresence>
  );
}
