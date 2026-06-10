/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState } from "react";
import {
  Image as ImageIcon, Layers, Upload, Pencil, Trash2,
  Check, X,
} from "lucide-react";
import {
  Panel, PanelHead, Chip, Btn, Field, Segmented,
} from "@/components/admin/AdminUI";
import { useAdminStore } from "@/stores/adminStore";
import { useToast } from "@/components/Toast";
import UserBanner from "@/components/UserBanner";
import type { Banner as ApiBanner } from "@/services/api/admin";
import { apiErrMsg } from "@/lib/api-error";

const SWATCHES = [
  "#0e7490","#22d3ee","#5eead4","#10b981",
  "#a78bfa","#6366f1","#f59e0b","#fde047",
  "#be123c","#fb7185","#ea580c","#1e1b4b",
];

function BannerPreview({
  css, name, animated, previewImage,
}: {
  css: string; name: string; animated?: boolean; previewImage?: string | null;
}) {
  return (
    <div className="rounded-2xl overflow-hidden border border-zinc-800">
      {previewImage ? (
        <img src={previewImage} alt="" className="h-28 w-full object-cover" />
      ) : (
        <UserBanner banner={css} animated={animated} className="h-28 w-full" />
      )}
      <div className="bg-zinc-900 px-4 pb-4 -mt-7 relative">
        <div className="w-14 h-14 rounded-full ring-4 ring-zinc-900 grid place-items-center font-jaro text-xl text-white"
          style={{ background: "linear-gradient(135deg,hsl(150 65% 45%),hsl(190 70% 35%))" }}>
          M
        </div>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="font-jaro text-lg text-white">{name || "Jogador"}</span>
          <Chip tone="emerald">Investidora</Chip>
        </div>
        <p className="font-inconsolata text-xs text-zinc-500">Nível 22 · #2 no ranking</p>
      </div>
    </div>
  );
}

const DEFAULT_BANNER: {
  c1: string; c2: string; c3: string;
  angle: number; nome: string; disponibilidade: boolean; animated: boolean;
} = {
  c1: "#0e7490",
  c2: "#22d3ee",
  c3: "#5eead4",
  angle: 120,
  nome: "Novo banner",
  disponibilidade: true,
  animated: false,
};

function parseBannerCss(css: string): { angle: number; c1: string; c2: string; c3: string } {
  const m = css.match(/linear-gradient\(\s*(\d+)deg\s*,\s*([^,]+)\s*,\s*([^,]+?)(?:\s+\d+%)?\s*,\s*([^)]+)\s*\)/i);
  if (!m) return { angle: DEFAULT_BANNER.angle, c1: DEFAULT_BANNER.c1, c2: DEFAULT_BANNER.c2, c3: DEFAULT_BANNER.c3 };
  return {
    angle: Number(m[1]) || DEFAULT_BANNER.angle,
    c1: m[2].trim(),
    c2: m[3].trim(),
    c3: m[4].trim(),
  };
}

function isImageUrl(s: string): boolean {
  return s.startsWith("http://") || s.startsWith("https://");
}

function BannerBuilder({
  editing, onCancel,
}: {
  editing?: ApiBanner | null;
  onCancel?: () => void;
}) {
  const { createBanner, updateBanner, uploadBannerImage, loadBanners } = useAdminStore();
  const { success: ok, error: err } = useToast();
  const [c1, setC1] = useState(DEFAULT_BANNER.c1);
  const [c2, setC2] = useState(DEFAULT_BANNER.c2);
  const [c3, setC3] = useState(DEFAULT_BANNER.c3);
  const [angle, setAngle] = useState(DEFAULT_BANNER.angle);
  const [nome, setNome] = useState(DEFAULT_BANNER.nome);
  const [disponibilidade, setDisponibilidade] = useState(DEFAULT_BANNER.disponibilidade);
  const [animated, setAnimated] = useState(DEFAULT_BANNER.animated);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (localPreviewUrl?.startsWith("blob:")) URL.revokeObjectURL(localPreviewUrl);
    };
  }, [localPreviewUrl]);

  useEffect(() => {
    if (!editing) {
      setC1(DEFAULT_BANNER.c1);
      setC2(DEFAULT_BANNER.c2);
      setC3(DEFAULT_BANNER.c3);
      setAngle(DEFAULT_BANNER.angle);
      setNome(DEFAULT_BANNER.nome);
      setDisponibilidade(DEFAULT_BANNER.disponibilidade);
      setAnimated(DEFAULT_BANNER.animated);
      setLocalPreviewUrl(null);
      setPendingFile(null);
      setSaved(false);
      return;
    }
    if (isImageUrl(editing.css)) {
      setLocalPreviewUrl(editing.css);
    } else {
      const p = parseBannerCss(editing.css);
      setC1(p.c1);
      setC2(p.c2);
      setC3(p.c3);
      setAngle(p.angle);
      setLocalPreviewUrl(null);
    }
    setNome(editing.nome);
    setDisponibilidade(editing.disponibilidade);
    setAnimated(editing.animated ?? false);
    setPendingFile(null);
    setSaved(false);
  }, [editing]);

  const gradientCss = `linear-gradient(${angle}deg, ${c1}, ${c2} 60%, ${c3})`;
  const hasImage = !!localPreviewUrl;

  function handleFileSelect(file: File) {
    if (localPreviewUrl?.startsWith("blob:")) URL.revokeObjectURL(localPreviewUrl);
    setLocalPreviewUrl(URL.createObjectURL(file));
    setPendingFile(file);
  }

  async function handleSave() {
    if (!nome.trim()) { alert("Nome é obrigatório"); return; }

    setSaving(true);
    try {
      if (editing) {
        if (pendingFile) {
          setUploading(true);
          try {
            await uploadBannerImage(editing.id, pendingFile);
          } finally {
            setUploading(false);
          }
        }
        await updateBanner(editing.id, {
          nome: nome.trim(),
          css: localPreviewUrl ?? gradientCss,
          disponibilidade,
          animated,
        });
        ok("Banner atualizado!");
      } else {
        const created = await createBanner({ nome: nome.trim(), css: gradientCss, disponibilidade, animated });
        if (pendingFile) {
          setUploading(true);
          try {
            await uploadBannerImage(created.id, pendingFile);
          } finally {
            setUploading(false);
          }
        }
        ok("Banner criado!");
      }

      if (localPreviewUrl?.startsWith("blob:")) URL.revokeObjectURL(localPreviewUrl);
      setLocalPreviewUrl(null);
      setPendingFile(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);

      await loadBanners();
    } catch (e) {
      err(apiErrMsg(e, "Erro ao salvar banner."));
    } finally {
      setSaving(false);
    }
  }

  function switchToGradient() {
    if (localPreviewUrl?.startsWith("blob:")) URL.revokeObjectURL(localPreviewUrl);
    setLocalPreviewUrl(null);
    setPendingFile(null);
  }

  return (
    <Panel flush>
      <PanelHead
        title={editing ? "Editar banner" : "Construtor de banner"}
        icon={ImageIcon}
        sub={editing ? `Editando #${editing.id} · ${editing.nome}` : "Crie um banner com gradiente ou imagem"}
        right={<Chip tone={editing ? "amber" : "cyan"}>{editing ? "editando" : "editor"}</Chip>}
      />
      <div className="grid lg:grid-cols-[1fr_300px] gap-5 p-5">
        <div className="space-y-4">
          <div>
            <p className="font-inconsolata text-[11px] uppercase tracking-wider text-zinc-500 mb-2">
              Pré-visualização do perfil
            </p>
            <BannerPreview
              css={gradientCss}
              name={nome}
              animated={animated}
              previewImage={localPreviewUrl?.startsWith("blob:") ? localPreviewUrl : null}
            />
          </div>

          {!hasImage && (
            <>
              <div className="grid grid-cols-3 gap-3">
                {([["Cor inicial", c1, setC1], ["Cor central", c2, setC2], ["Cor final", c3, setC3]] as [string, string, (v: string) => void][]).map(([lbl, val, set]) => (
                  <div key={lbl}>
                    <p className="font-inconsolata text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">{lbl}</p>
                    <div className="flex items-center gap-2">
                      <input type="color" value={val} onChange={(e) => set(e.target.value)}
                        className="w-8 h-8 rounded-lg bg-transparent border border-zinc-700 cursor-pointer shrink-0" />
                      <input value={val} onChange={(e) => set(e.target.value)}
                        className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-2 py-1.5 font-inconsolata text-xs text-zinc-100 focus:outline-none focus:border-cyan-500" />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {SWATCHES.map((s) => (
                  <button key={s} type="button"
                    onClick={() => setC2(s)}
                    className="w-6 h-6 rounded-lg ring-1 ring-white/10 cursor-pointer hover:scale-110 transition-transform"
                    style={{ background: s }} title={s} />
                ))}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-inconsolata text-[11px] uppercase tracking-wider text-zinc-500">Ângulo</span>
                  <span className="font-jaro text-base text-cyan-300">{angle}°</span>
                </div>
                <input type="range" min={0} max={360} value={angle} onChange={(e) => setAngle(+e.target.value)}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-zinc-800 accent-cyan-400" />
              </div>
            </>
          )}

          {hasImage && editing && (
            <button type="button" onClick={switchToGradient}
              className="font-inconsolata text-[11px] text-cyan-400 hover:text-cyan-300">
              voltar para gradiente
            </button>
          )}
        </div>

        <div className="space-y-4">
          <Field label="Nome do banner">
            <input value={nome} onChange={(e) => setNome(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2.5 font-inconsolata text-sm text-zinc-100 focus:outline-none focus:border-cyan-500" />
          </Field>

          <Field label="Disponibilidade">
            <Segmented
              value={disponibilidade ? "sim" : "nao"} onChange={(v) => setDisponibilidade(v === "sim")}
              options={[{ value: "sim", label: "Disponível" }, { value: "nao", label: "Oculto" }]}
              size="sm"
            />
          </Field>

          <Field label="Animação">
            <Segmented
              value={animated ? "sim" : "nao"} onChange={(v) => setAnimated(v === "sim")}
              options={[{ value: "sim", label: "✨ Animado" }, { value: "nao", label: "Estático" }]}
              size="sm"
            />
          </Field>

          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFileSelect(f);
              if (fileRef.current) fileRef.current.value = "";
            }}
          />
          <div
            role="button"
            tabIndex={0}
            onClick={() => !uploading && fileRef.current?.click()}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileRef.current?.click(); }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (uploading) return;
              const f = e.dataTransfer.files?.[0];
              if (f) handleFileSelect(f);
            }}
            className={`border border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
              dragOver ? "border-cyan-500 bg-cyan-500/5" : "border-zinc-700 hover:border-zinc-600"
            } ${uploading ? "pointer-events-none opacity-60" : ""}`}
          >
            {localPreviewUrl && pendingFile ? (
              <img src={localPreviewUrl} alt="" className="w-full h-32 object-cover rounded-lg" />
            ) : (
              <>
                <Upload size={20} className="text-zinc-500 mx-auto" />
                <p className="font-inconsolata text-[11px] text-zinc-500 mt-1.5 leading-snug">
                  {uploading
                    ? "Enviando…"
                    : hasImage
                      ? "Trocar imagem"
                      : "Arraste uma imagem\nou clique para enviar"}
                </p>
              </>
            )}
          </div>

          <Btn
            variant={saved ? "subtle" : "primary"}
            icon={saved ? Check : undefined}
            className="w-full justify-center"
            onClick={handleSave}
            disabled={saving || uploading}
          >
            {saving || uploading ? "Salvando…" : saved ? "Banner salvo!" : editing ? "Salvar alterações" : "Salvar banner"}
          </Btn>
          {editing && onCancel && (
            <Btn variant="ghost" className="w-full justify-center" onClick={onCancel}>
              Cancelar
            </Btn>
          )}
        </div>
      </div>
    </Panel>
  );
}

export default function AdminBannersPage() {
  const { banners, loadingBanners, loadBanners, deleteBanner } = useAdminStore();
  const { success: ok, error: err } = useToast();
  const [confirmDel, setConfirmDel] = useState<number | null>(null);
  const [editing, setEditing] = useState<ApiBanner | null>(null);

  useEffect(() => {
    loadBanners().catch(() => err("Erro ao carregar banners."));
  }, [loadBanners, err]);

  async function removeBanner(id: number) {
    try {
      await deleteBanner(id);
      ok("Banner removido (imagem do Cloudinary também).");
      setConfirmDel(null);
      if (editing?.id === id) setEditing(null);
    } catch {
      err("Erro ao remover banner.");
    }
  }

  return (
    <div className="space-y-4">
      <BannerBuilder
        editing={editing}
        onCancel={() => setEditing(null)}
      />

      <Panel flush>
        <PanelHead
          title="Banners publicados" icon={Layers}
          sub={loadingBanners ? "carregando…" : `${banners.length} presets disponíveis`}
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4">
          {banners.map((b: ApiBanner) => (
            <div key={b.id} className="group rounded-xl overflow-hidden border border-zinc-800 cursor-pointer hover:border-zinc-700 transition-colors">
              <div className="h-20 relative">
                <UserBanner banner={b.css} animated={b.animated} className="w-full h-full rounded-t-lg" />
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 flex items-center justify-center gap-2">
                  <button type="button" onClick={() => setEditing(b)} title="Editar banner" className="p-1.5 rounded-lg bg-white/15 text-white hover:bg-white/25"><Pencil size={13} /></button>
                  {confirmDel === b.id ? (
                    <div className="flex gap-1">
                      <button type="button" onClick={() => removeBanner(b.id)} className="p-1.5 rounded-lg bg-rose-500/60 text-white"><Check size={13} /></button>
                      <button type="button" onClick={() => setConfirmDel(null)} className="p-1.5 rounded-lg bg-white/15 text-white"><X size={13} /></button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setConfirmDel(b.id)} className="p-1.5 rounded-lg bg-white/15 text-white hover:bg-rose-500/40"><Trash2 size={13} /></button>
                  )}
                </div>
              </div>
              <div className="px-3 py-2 bg-zinc-900 flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-inconsolata text-xs text-zinc-300 truncate">{b.nome}</span>
                  {b.animated && (
                    <span className="shrink-0 font-inconsolata text-[9px] uppercase px-1 py-0.5 rounded bg-violet-500/20 border border-violet-500/30 text-violet-300">✨</span>
                  )}
                </div>
                <span className="font-inconsolata text-[9px] text-zinc-600 shrink-0">#{b.id}</span>
              </div>
            </div>
          ))}
          {!loadingBanners && banners.length === 0 && (
            <p className="col-span-full py-12 text-center font-inconsolata text-xs text-zinc-600">
              Nenhum banner cadastrado.
            </p>
          )}
        </div>
      </Panel>
    </div>
  );
}
