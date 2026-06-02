"use client";

import { useEffect, useState } from "react";
import {
  Image as ImageIcon, Layers, Upload, Plus, Pencil, Trash2,
  Sparkles, Check, X,
} from "lucide-react";
import {
  Panel, PanelHead, Chip, Btn, Field, Segmented,
} from "@/components/admin/AdminUI";
import { useAdminStore } from "@/stores/adminStore";
import { useToast } from "@/components/Toast";
import { SPRITE_CATALOG, resolveSprite } from "@/constants/sprites";
import type { Banner as ApiBanner, BannerInput } from "@/services/api/admin";

const SWATCHES = [
  "#0e7490","#22d3ee","#5eead4","#10b981",
  "#a78bfa","#6366f1","#f59e0b","#fde047",
  "#be123c","#fb7185","#ea580c","#1e1b4b",
];

function SpriteIcon({ id, size = 20 }: { id?: string | null; size?: number }) {
  const found = resolveSprite(id);
  if (!found) return <Sparkles size={size} />;
  const I = found.icon;
  return <I size={size} />;
}

function BannerPreview({
  css, sprite, name,
}: {
  css: string; sprite?: string | null; name: string;
}) {
  return (
    <div className="rounded-2xl overflow-hidden border border-zinc-800">
      <div className="h-28 relative" style={{ background: css }}>
        <div className="absolute inset-0" style={{ background: "linear-gradient(0deg,rgba(9,9,11,.7),transparent 60%)" }} />
        {sprite && (
          <div className="absolute top-3 right-3 text-white/90">
            <SpriteIcon id={sprite} size={28} />
          </div>
        )}
      </div>
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
  angle: number; nome: string; sprite: string; disponibilidade: boolean;
} = {
  c1: "#0e7490",
  c2: "#22d3ee",
  c3: "#5eead4",
  angle: 120,
  nome: "Novo banner",
  sprite: "crown",
  disponibilidade: true,
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

function BannerBuilder({
  onSave, onUpdate, onCancel, editing,
}: {
  onSave: (b: BannerInput) => Promise<void>;
  onUpdate?: (id: number, b: BannerInput) => Promise<void>;
  onCancel?: () => void;
  editing?: ApiBanner | null;
}) {
  const [c1, setC1] = useState(DEFAULT_BANNER.c1);
  const [c2, setC2] = useState(DEFAULT_BANNER.c2);
  const [c3, setC3] = useState(DEFAULT_BANNER.c3);
  const [angle, setAngle] = useState(DEFAULT_BANNER.angle);
  const [nome, setNome] = useState(DEFAULT_BANNER.nome);
  const [sprite, setSprite] = useState(DEFAULT_BANNER.sprite);
  const [disponibilidade, setDisponibilidade] = useState(DEFAULT_BANNER.disponibilidade);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!editing) {
      setC1(DEFAULT_BANNER.c1);
      setC2(DEFAULT_BANNER.c2);
      setC3(DEFAULT_BANNER.c3);
      setAngle(DEFAULT_BANNER.angle);
      setNome(DEFAULT_BANNER.nome);
      setSprite(DEFAULT_BANNER.sprite);
      setDisponibilidade(DEFAULT_BANNER.disponibilidade);
      return;
    }
    const p = parseBannerCss(editing.css);
    setC1(p.c1);
    setC2(p.c2);
    setC3(p.c3);
    setAngle(p.angle);
    setNome(editing.nome);
    setSprite(editing.spriteId ?? DEFAULT_BANNER.sprite);
    setDisponibilidade(editing.disponibilidade);
    setSaved(false);
  }, [editing]);

  const css = `linear-gradient(${angle}deg, ${c1}, ${c2} 60%, ${c3})`;

  async function handleSave() {
    setSaving(true);
    try {
      if (editing && onUpdate) {
        await onUpdate(editing.id, { nome, css, spriteId: sprite, disponibilidade });
      } else {
        await onSave({ nome, css, spriteId: sprite, disponibilidade });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel flush>
      <PanelHead
        title={editing ? "Editar banner" : "Construtor de banner"}
        icon={ImageIcon}
        sub={editing ? `Editando #${editing.id} · ${editing.nome}` : "Crie um banner de perfil personalizado"}
        right={<Chip tone={editing ? "amber" : "cyan"}>{editing ? "editando" : "editor"}</Chip>}
      />
      <div className="grid lg:grid-cols-[1fr_300px] gap-5 p-5">
        <div className="space-y-4">
          <div>
            <p className="font-inconsolata text-[11px] uppercase tracking-wider text-zinc-500 mb-2">
              Pré-visualização do perfil
            </p>
            <BannerPreview css={css} sprite={sprite} name={nome} />
          </div>

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
        </div>

        <div className="space-y-4">
          <Field label="Nome do banner">
            <input value={nome} onChange={(e) => setNome(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2.5 font-inconsolata text-sm text-zinc-100 focus:outline-none focus:border-cyan-500" />
          </Field>

          <Field label="Sprite / emblema">
            <div className="grid grid-cols-6 gap-1.5">
              {SPRITE_CATALOG.slice(0, 12).map((sp) => {
                const I = sp.icon;
                return (
                  <button key={sp.id} type="button" onClick={() => setSprite(sp.id)}
                    className={`aspect-square rounded-xl grid place-items-center border cursor-pointer transition-colors ${
                      sprite === sp.id
                        ? "border-cyan-500 bg-cyan-500/15 text-cyan-300"
                        : "border-zinc-800 bg-zinc-900 text-zinc-500 hover:text-zinc-300"
                    }`}
                    style={{ minHeight: 38 }}
                  >
                    <I size={16} />
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Disponibilidade">
            <Segmented
              value={disponibilidade ? "sim" : "nao"} onChange={(v) => setDisponibilidade(v === "sim")}
              options={[{ value: "sim", label: "Disponível" }, { value: "nao", label: "Oculto" }]}
              size="sm"
            />
          </Field>

          <div className="border border-dashed border-zinc-700 rounded-xl p-4 text-center">
            <Upload size={20} className="text-zinc-600 mx-auto" />
            <p className="font-inconsolata text-[11px] text-zinc-500 mt-1.5 leading-snug">
              Arraste uma imagem<br />ou clique para enviar sprite
            </p>
          </div>

          <Btn
            variant={saved ? "subtle" : "primary"}
            icon={saved ? Check : undefined}
            className="w-full justify-center"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Salvando…" : saved ? "Banner salvo!" : editing ? "Salvar alterações" : "Salvar banner"}
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

export default function AdminCosmeticosPage() {
  const { banners, loadingBanners, loadBanners, createBanner, updateBanner, deleteBanner } = useAdminStore();
  const { success: ok, error: err } = useToast();
  const [confirmDel, setConfirmDel] = useState<number | null>(null);
  const [editing, setEditing] = useState<ApiBanner | null>(null);

  useEffect(() => {
    loadBanners().catch(() => err("Erro ao carregar banners."));
  }, [loadBanners, err]);

  async function addBanner(b: BannerInput) {
    try {
      await createBanner(b);
      ok("Banner criado!");
    } catch {
      err("Erro ao criar banner.");
    }
  }

  async function editBanner(id: number, b: BannerInput) {
    try {
      const updated = await updateBanner(id, b);
      ok(`Banner #${updated.id} atualizado!`);
      setEditing(null);
    } catch {
      err("Erro ao atualizar banner.");
    }
  }

  async function removeBanner(id: number) {
    try {
      await deleteBanner(id);
      ok("Banner removido.");
      setConfirmDel(null);
      if (editing?.id === id) setEditing(null);
    } catch {
      err("Erro ao remover banner.");
    }
  }

  return (
    <div className="space-y-4">
      <BannerBuilder
        onSave={addBanner}
        onUpdate={editBanner}
        onCancel={() => setEditing(null)}
        editing={editing}
      />

      <Panel flush>
        <PanelHead
          title="Banners publicados" icon={Layers}
          sub={loadingBanners ? "carregando…" : `${banners.length} presets disponíveis`}
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4">
          {banners.map((b: ApiBanner) => (
            <div key={b.id} className="group rounded-xl overflow-hidden border border-zinc-800 cursor-pointer hover:border-zinc-700 transition-colors">
              <div className="h-20 relative" style={{ background: b.css }}>
                {b.spriteId && (
                  <div className="absolute top-2 right-2 text-white/70">
                    <SpriteIcon id={b.spriteId} size={16} />
                  </div>
                )}
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
                <span className="font-inconsolata text-xs text-zinc-300">{b.nome}</span>
                <span className="font-inconsolata text-[9px] text-zinc-600">#{b.id}</span>
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

      <Panel flush>
        <PanelHead
          title="Biblioteca de sprites" icon={Sparkles}
          sub="Emblemas e ícones para banners e perfis"
          right={<Btn variant="ghost" icon={Upload} size="sm">Enviar</Btn>}
        />
        <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-3 p-4">
          {SPRITE_CATALOG.map((sp) => {
            const I = sp.icon;
            return (
              <div key={sp.id}
                className="aspect-square rounded-xl border border-zinc-800 bg-zinc-900 grid place-items-center text-zinc-400 hover:border-cyan-500/50 hover:text-cyan-300 transition-colors cursor-pointer group relative"
                style={{ minHeight: 56 }}
              >
                <I size={22} />
                <span className="absolute bottom-1 font-inconsolata text-[8px] text-zinc-600 group-hover:text-zinc-400 truncate px-1">
                  {sp.id}
                </span>
              </div>
            );
          })}
          <div className="aspect-square rounded-xl border border-dashed border-zinc-700 grid place-items-center text-zinc-600 hover:text-cyan-400 hover:border-cyan-500/50 cursor-pointer" style={{ minHeight: 56 }}>
            <Plus size={20} />
          </div>
        </div>
      </Panel>
    </div>
  );
}
