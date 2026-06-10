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
import type { Frame as ApiFrame } from "@/services/api/admin";
import { apiErrMsg } from "@/lib/api-error";

function FramePreview({
  css,
  imageUrl,
  animated,
  frameScale = 125,
}: {
  css?: string | null;
  imageUrl?: string | null;
  animated?: boolean;
  frameScale?: number;
}) {
  return (
    <div style={{ borderRadius: 16, overflow: "hidden", border: "0.5px solid #27272a", maxWidth: 320 }}>
      <div style={{ height: 80, background: "linear-gradient(135deg, #064e3b, #059669, #34d399)", position: "relative" }} />
      <div style={{ background: "#09090b", padding: "32px 16px 16px", position: "relative" }}>
        <div style={{ position: "absolute", top: -24, left: 16, width: 56, height: 56 }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", border: "3px solid #09090b", background: "#3f3f46", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
            👤
          </div>
          {imageUrl ? (
            <img src={imageUrl} alt="" style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: `${frameScale}%`,
              height: `${frameScale}%`,
              maxWidth: "none",
              transform: "translate(-50%, -50%)",
              objectFit: "contain",
              pointerEvents: "none",
            }} />
          ) : css ? (
            <div
              style={{
                position: "absolute", inset: -3, borderRadius: "50%", padding: 3,
                backgroundImage: css, backgroundSize: animated ? "300% 300%" : "100% 100%",
                WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                WebkitMaskComposite: "xor", maskComposite: "exclude",
              }}
            />
          ) : null}
        </div>
        <p style={{ color: "#f4f4f5", fontWeight: 500, fontSize: 15, margin: "0 0 2px" }}>Jogador Exemplo</p>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "#4ecca3", border: "1px solid #4ecca344", borderRadius: 6, padding: "1px 6px", background: "#4ecca310" }}>INVESTIDOR</span>
          <span style={{ fontSize: 11, color: "#71717a" }}>Nível 1</span>
        </div>
      </div>
    </div>
  );
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

const SWATCHES = [
  "#0e7490","#22d3ee","#5eead4","#10b981",
  "#a78bfa","#6366f1","#f59e0b","#fde047",
  "#be123c","#fb7185","#ea580c","#1e1b4b",
];

const DEFAULT_FRAME: {
  c1: string; c2: string; c3: string;
  angle: number; nome: string; disponibilidade: boolean; animated: boolean; frameScale: number;
} = {
  c1: "#0e7490",
  c2: "#22d3ee",
  c3: "#5eead4",
  angle: 120,
  nome: "Nova moldura",
  disponibilidade: true,
  animated: false,
  frameScale: 145,
};

function parseFrameCss(css: string): { angle: number; c1: string; c2: string; c3: string } {
  const m = css.match(/linear-gradient\(\s*(\d+)deg\s*,\s*([^,]+)\s*,\s*([^,]+?)(?:\s+\d+%)?\s*,\s*([^)]+)\s*\)/i);
  if (!m) return { angle: DEFAULT_FRAME.angle, c1: DEFAULT_FRAME.c1, c2: DEFAULT_FRAME.c2, c3: DEFAULT_FRAME.c3 };
  return {
    angle: Number(m[1]) || DEFAULT_FRAME.angle,
    c1: m[2].trim(),
    c2: m[3].trim(),
    c3: m[4].trim(),
  };
}

function isImageUrl(s: string): boolean {
  return s.startsWith("http://") || s.startsWith("https://");
}

function FrameBuilder({
  editing, onCancel,
}: {
  editing?: ApiFrame | null;
  onCancel?: () => void;
}) {
  const { createFrame, updateFrame, uploadFrameImage, loadFrames } = useAdminStore();
  const { success: ok, error: err } = useToast();
  const [c1, setC1] = useState(DEFAULT_FRAME.c1);
  const [c2, setC2] = useState(DEFAULT_FRAME.c2);
  const [c3, setC3] = useState(DEFAULT_FRAME.c3);
  const [angle, setAngle] = useState(DEFAULT_FRAME.angle);
  const [nome, setNome] = useState(DEFAULT_FRAME.nome);
  const [disponibilidade, setDisponibilidade] = useState(DEFAULT_FRAME.disponibilidade);
  const [animated, setAnimated] = useState(DEFAULT_FRAME.animated);
  const [frameScale, setFrameScale] = useState(DEFAULT_FRAME.frameScale);
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

  const debouncedCss = useDebounce(
    localPreviewUrl && pendingFile
      ? localPreviewUrl
      : `linear-gradient(${angle}deg, ${c1}, ${c2} 60%, ${c3})`,
    150,
  );

  useEffect(() => {
    if (!editing) {
      setC1(DEFAULT_FRAME.c1);
      setC2(DEFAULT_FRAME.c2);
      setC3(DEFAULT_FRAME.c3);
      setAngle(DEFAULT_FRAME.angle);
      setNome(DEFAULT_FRAME.nome);
      setDisponibilidade(DEFAULT_FRAME.disponibilidade);
      setAnimated(DEFAULT_FRAME.animated);
      setFrameScale(DEFAULT_FRAME.frameScale);
      setLocalPreviewUrl(null);
      setPendingFile(null);
      setSaved(false);
      return;
    }
    if (editing.imageUrl) {
      setLocalPreviewUrl(editing.imageUrl);
    } else if (editing.css) {
      const p = parseFrameCss(editing.css);
      setC1(p.c1);
      setC2(p.c2);
      setC3(p.c3);
      setAngle(p.angle);
      setLocalPreviewUrl(null);
    }
    setNome(editing.nome);
    setDisponibilidade(editing.disponibilidade);
    setAnimated(editing.animated ?? false);
    setFrameScale((editing as any).frameScale ?? DEFAULT_FRAME.frameScale);
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
            const updated = await uploadFrameImage(editing.id, pendingFile);
            setLocalPreviewUrl(updated.imageUrl ?? null);
          } finally {
            setUploading(false);
          }
        }
        await updateFrame(editing.id, {
          nome: nome.trim(),
          disponibilidade,
          animated,
          frameScale,
        });
        ok("Moldura atualizada!");
      } else {
        const created = await createFrame({ nome: nome.trim(), css: gradientCss, disponibilidade, animated, tipo: "gradient", frameScale });
        if (pendingFile) {
          setUploading(true);
          try {
            await uploadFrameImage(created.id, pendingFile);
          } finally {
            setUploading(false);
          }
        }
        ok("Moldura criada!");
      }

      if (localPreviewUrl?.startsWith("blob:")) URL.revokeObjectURL(localPreviewUrl);
      setLocalPreviewUrl(null);
      setPendingFile(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);

      await loadFrames();
    } catch (e) {
      err(apiErrMsg(e, "Erro ao salvar moldura."));
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
        title={editing ? "Editar moldura" : "Construtor de moldura"}
        icon={ImageIcon}
        sub={editing ? `Editando #${editing.id} · ${editing.nome}` : "Crie uma moldura com gradiente ou imagem"}
        right={<Chip tone={editing ? "amber" : "cyan"}>{editing ? "editando" : "editor"}</Chip>}
      />
      <div className="grid lg:grid-cols-[1fr_300px] gap-5 p-5">
        <div className="space-y-4">
          <div>
            <p className="font-inconsolata text-[11px] uppercase tracking-wider text-zinc-500 mb-2">
              Pré-visualização da moldura
            </p>
            <FramePreview
              css={!hasImage ? debouncedCss : null}
              imageUrl={hasImage ? localPreviewUrl : null}
              animated={animated}
              frameScale={frameScale}
            />
          </div>

          {!hasImage && (
            <>
              <div className="grid grid-cols-3 gap-3">
                {([["Cor externa", c1, setC1], ["Cor do meio", c2, setC2], ["Cor interna", c3, setC3]] as [string, string, (v: string) => void][]).map(([lbl, val, set]) => (
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
          <Field label="Nome da moldura">
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

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-inconsolata text-[11px] uppercase tracking-wider text-zinc-500">
                Escala da moldura
              </span>
              <span className="font-jaro text-base text-cyan-300">{frameScale}%</span>
            </div>
            <input type="range" min={110} max={160} value={frameScale}
              onChange={(e) => setFrameScale(Number(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-zinc-800 accent-cyan-400" />
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/webp"
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
              <img src={localPreviewUrl} alt="" className="w-full max-h-32 object-contain" />
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
            {saving || uploading ? "Salvando…" : saved ? "Moldura salva!" : editing ? "Salvar alterações" : "Salvar moldura"}
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

export default function AdminMoldurasPage() {
  const { frames, loadingFrames, loadFrames, deleteFrame } = useAdminStore();
  const { success: ok, error: err } = useToast();
  const [confirmDel, setConfirmDel] = useState<number | null>(null);
  const [editing, setEditing] = useState<ApiFrame | null>(null);

  useEffect(() => {
    loadFrames().catch(() => err("Erro ao carregar molduras."));
  }, [loadFrames, err]);

  async function removeFrame(id: number) {
    try {
      await deleteFrame(id);
      ok("Moldura removida.");
      setConfirmDel(null);
      if (editing?.id === id) setEditing(null);
    } catch {
      err("Erro ao remover moldura.");
    }
  }

  return (
    <div className="space-y-4">
      <FrameBuilder
        editing={editing}
        onCancel={() => setEditing(null)}
      />

      <Panel flush>
        <PanelHead
          title="Molduras publicadas" icon={Layers}
          sub={loadingFrames ? "carregando…" : `${frames.length} presets disponíveis`}
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4">
          {frames.map((f: ApiFrame) => (
            <div key={f.id} className="group rounded-xl overflow-hidden border border-zinc-800 cursor-pointer hover:border-zinc-700 transition-colors">
              <div className="h-24 bg-zinc-950 flex items-center justify-center relative">
                {f.imageUrl ? (
                  <img src={f.imageUrl} alt={f.nome} className="w-20 h-20 object-contain" />
                ) : f.css ? (
                  <div
                    className="w-20 h-20 rounded-full"
                    style={{
                      background: f.css,
                      mask: "radial-gradient(circle at 50% 50%, transparent 38%, #000 42%)",
                      WebkitMask: "radial-gradient(circle at 50% 50%, transparent 38%, #000 42%)",
                    }}
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-zinc-800 ring-2 ring-zinc-700" />
                )}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 flex items-center justify-center gap-2">
                  <button type="button" onClick={() => setEditing(f)} title="Editar moldura" className="p-1.5 rounded-lg bg-white/15 text-white hover:bg-white/25"><Pencil size={13} /></button>
                  {confirmDel === f.id ? (
                    <div className="flex gap-1">
                      <button type="button" onClick={() => removeFrame(f.id)} className="p-1.5 rounded-lg bg-rose-500/60 text-white"><Check size={13} /></button>
                      <button type="button" onClick={() => setConfirmDel(null)} className="p-1.5 rounded-lg bg-white/15 text-white"><X size={13} /></button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setConfirmDel(f.id)} className="p-1.5 rounded-lg bg-white/15 text-white hover:bg-rose-500/40"><Trash2 size={13} /></button>
                  )}
                </div>
              </div>
              <div className="px-3 py-2 bg-zinc-900 flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-inconsolata text-xs text-zinc-300 truncate">{f.nome}</span>
                  {f.animated && (
                    <span className="shrink-0 font-inconsolata text-[9px] uppercase px-1 py-0.5 rounded bg-violet-500/20 border border-violet-500/30 text-violet-300">✨</span>
                  )}
                </div>
                <span className="font-inconsolata text-[9px] text-zinc-600 shrink-0">#{f.id}</span>
              </div>
            </div>
          ))}
          {!loadingFrames && frames.length === 0 && (
            <p className="col-span-full py-12 text-center font-inconsolata text-xs text-zinc-600">
              Nenhuma moldura cadastrada.
            </p>
          )}
        </div>
      </Panel>
    </div>
  );
}
