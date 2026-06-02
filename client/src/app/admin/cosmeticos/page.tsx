"use client";

/**
 * Cosméticos — Banners & Sprites — Admin
 * Salve em: src/app/admin/cosmeticos/page.tsx
 *
 * ⚠️  BACKEND NECESSÁRIO:
 *   - Models `Banner` e `Sprite` (ou novo ShopItem.type = "banner") no Prisma
 *   - CRUD: /admin/banners  e  /admin/sprites
 *   - Upload de imagens (seguir padrão do UserAvatar)
 * Por ora, usa estado local.
 */

import { useState, useEffect } from "react";
import {
  Image as ImageIcon, Layers, Upload, Plus, Pencil, Trash2,
  Crown, Trophy, Shield, Target, TrendingUp, Palette,
  Sparkles, Coins, Gamepad2, Building, Home, Check, X,
} from "lucide-react";
import {
  Panel, PanelHead, Chip, Btn, Field, AdminInput, Segmented,
} from "@/components/admin/AdminUI";
import { adminApi } from "@/services/api/admin";
import type { LucideIcon } from "lucide-react";

/* ── Types ── */
interface Banner {
  id: string;
  nome: string;
  css: string;
  spriteId?: string;
}

/* ── Sample data (replace with API) ── */
const SAMPLE_BANNERS: Banner[] = [
  { id: "b1", nome: "Aurora",   css: "linear-gradient(120deg,#0e7490,#22d3ee 60%,#5eead4)", spriteId: "crown" },
  { id: "b2", nome: "Magnata",  css: "linear-gradient(120deg,#7c2d12,#f59e0b 70%,#fde047)", spriteId: "trophy" },
  { id: "b3", nome: "Vinho",    css: "linear-gradient(120deg,#4c0519,#be123c 70%,#fb7185)", spriteId: "shield" },
  { id: "b4", nome: "Floresta", css: "linear-gradient(120deg,#064e3b,#10b981 70%,#a7f3d0)", spriteId: "sparkles" },
  { id: "b5", nome: "Noturno",  css: "linear-gradient(120deg,#1e1b4b,#6366f1 70%,#c4b5fd)", spriteId: "target" },
  { id: "b6", nome: "Brasa",    css: "linear-gradient(120deg,#7f1d1d,#ea580c 70%,#fdba74)", spriteId: "trending" },
];

const SPRITE_LIST: { id: string; icon: LucideIcon }[] = [
  { id: "crown",    icon: Crown    },
  { id: "trophy",   icon: Trophy   },
  { id: "shield",   icon: Shield   },
  { id: "target",   icon: Target   },
  { id: "trending", icon: TrendingUp },
  { id: "palette",  icon: Palette  },
  { id: "sparkles", icon: Sparkles },
  { id: "coins",    icon: Coins    },
  { id: "gamepad",  icon: Gamepad2 },
  { id: "building", icon: Building },
  { id: "home",     icon: Home     },
];

const SWATCHES = [
  "#0e7490","#22d3ee","#5eead4","#10b981",
  "#a78bfa","#6366f1","#f59e0b","#fde047",
  "#be123c","#fb7185","#ea580c","#1e1b4b",
];

/* ── Sprite icon renderer ── */
function SpriteIcon({ id, size = 20 }: { id?: string; size?: number }) {
  const found = SPRITE_LIST.find((s) => s.id === id);
  if (!found) return <Sparkles size={size} />;
  const I = found.icon;
  return <I size={size} />;
}

/* ── Profile mock preview ── */
function BannerPreview({
  css, sprite, name,
}: {
  css: string; sprite?: string; name: string;
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

/* ── Banner builder ── */
function BannerBuilder({ onSave }: { onSave: (b: Omit<Banner, "id">) => void }) {
  const [c1, setC1] = useState("#0e7490");
  const [c2, setC2] = useState("#22d3ee");
  const [c3, setC3] = useState("#5eead4");
  const [angle, setAngle] = useState(120);
  const [nome, setNome] = useState("Novo banner");
  const [sprite, setSprite] = useState("crown");
  const [avail, setAvail] = useState<"loja" | "evento" | "premio">("loja");
  const [saved, setSaved] = useState(false);

  const css = `linear-gradient(${angle}deg, ${c1}, ${c2} 60%, ${c3})`;

  function handleSave() {
    // TODO: adminApi.createBanner({ nome, css, spriteId: sprite, disponibilidade: avail })
    onSave({ nome, css, spriteId: sprite });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <Panel flush>
      <PanelHead title="Construtor de banner" icon={ImageIcon} sub="Crie um banner de perfil personalizado"
        right={<Chip tone="cyan">editor</Chip>} />
      <div className="grid lg:grid-cols-[1fr_300px] gap-5 p-5">
        {/* Preview + color controls */}
        <div className="space-y-4">
          <div>
            <p className="font-inconsolata text-[11px] uppercase tracking-wider text-zinc-500 mb-2">
              Pré-visualização do perfil
            </p>
            <BannerPreview css={css} sprite={sprite} name={nome} />
          </div>

          {/* Color stops */}
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

          {/* Swatches */}
          <div className="flex flex-wrap gap-1.5">
            {SWATCHES.map((s) => (
              <button key={s} type="button"
                onClick={() => setC2(s)}
                className="w-6 h-6 rounded-lg ring-1 ring-white/10 cursor-pointer hover:scale-110 transition-transform"
                style={{ background: s }} title={s} />
            ))}
          </div>

          {/* Angle */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-inconsolata text-[11px] uppercase tracking-wider text-zinc-500">Ângulo</span>
              <span className="font-jaro text-base text-cyan-300">{angle}°</span>
            </div>
            <input type="range" min={0} max={360} value={angle} onChange={(e) => setAngle(+e.target.value)}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-zinc-800 accent-cyan-400" />
          </div>
        </div>

        {/* Right controls */}
        <div className="space-y-4">
          <Field label="Nome do banner">
            <input value={nome} onChange={(e) => setNome(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2.5 font-inconsolata text-sm text-zinc-100 focus:outline-none focus:border-cyan-500" />
          </Field>

          <Field label="Sprite / emblema">
            <div className="grid grid-cols-6 gap-1.5">
              {SPRITE_LIST.slice(0, 12).map((sp) => {
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
              value={avail} onChange={(v) => setAvail(v as typeof avail)}
              options={[{ value: "loja", label: "Vender" }, { value: "evento", label: "Evento" }, { value: "premio", label: "Prêmio" }]}
              size="sm"
            />
          </Field>

          {/* Upload placeholder */}
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
          >
            {saved ? "Banner salvo!" : "Salvar banner"}
          </Btn>
        </div>
      </div>
    </Panel>
  );
}

/* ── Main page ── */
export default function AdminCosmeticosPage() {
  const [banners, setBanners] = useState<Banner[]>(SAMPLE_BANNERS);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBanners();
  }, []);

  async function loadBanners() {
    try {
      setLoading(true);
      const data = await adminApi.listBanners();
      setBanners(data);
    } catch (err) {
      console.error("Erro ao carregar banners:", err);
    } finally {
      setLoading(false);
    }
  }

  async function addBanner(b: Omit<Banner, "id">) {
    try {
      const newBanner = await adminApi.createBanner(b);
      setBanners((p) => [...p, newBanner]);
    } catch (err) {
      console.error("Erro ao salvar banner:", err);
    }
  }

  async function deleteBanner(id: string) {
    try {
      const idNum = parseInt(id.replace("b", ""));
      await adminApi.deleteBanner(idNum);
      setBanners((p) => p.filter((b) => b.id !== id));
      setConfirmDel(null);
    } catch (err) {
      console.error("Erro ao deletar banner:", err);
    }
  }

  return (
    <div className="space-y-4">
      {loading && (
        <div className="bg-blue-500/5 border border-blue-500/30 rounded-xl px-4 py-2.5 font-inconsolata text-xs text-blue-300">
          ℹ️ Carregando banners...
        </div>
      )}

      <BannerBuilder onSave={addBanner} />

      {/* Banner gallery */}
      <Panel flush>
        <PanelHead
          title="Banners publicados" icon={Layers}
          sub={`${banners.length} presets disponíveis`}
          right={<Btn variant="ghost" icon={Plus} size="sm">Novo</Btn>}
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4">
          {banners.map((b) => (
            <div key={b.id} className="group rounded-xl overflow-hidden border border-zinc-800 cursor-pointer hover:border-zinc-700 transition-colors">
              <div className="h-20 relative" style={{ background: b.css }}>
                {b.spriteId && (
                  <div className="absolute top-2 right-2 text-white/70">
                    <SpriteIcon id={b.spriteId} size={16} />
                  </div>
                )}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 flex items-center justify-center gap-2">
                  <button type="button" className="p-1.5 rounded-lg bg-white/15 text-white hover:bg-white/25"><Pencil size={13} /></button>
                  {confirmDel === b.id ? (
                    <div className="flex gap-1">
                      <button type="button" onClick={() => deleteBanner(b.id)} className="p-1.5 rounded-lg bg-rose-500/60 text-white"><Check size={13} /></button>
                      <button type="button" onClick={() => setConfirmDel(null)} className="p-1.5 rounded-lg bg-white/15 text-white"><X size={13} /></button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setConfirmDel(b.id)} className="p-1.5 rounded-lg bg-white/15 text-white hover:bg-rose-500/40"><Trash2 size={13} /></button>
                  )}
                </div>
              </div>
              <div className="px-3 py-2 bg-zinc-900 flex items-center justify-between">
                <span className="font-inconsolata text-xs text-zinc-300">{b.nome}</span>
                <span className="font-inconsolata text-[9px] text-zinc-600">{b.id}</span>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {/* Sprite library */}
      <Panel flush>
        <PanelHead
          title="Biblioteca de sprites" icon={Sparkles}
          sub="Emblemas e ícones para banners e perfis"
          right={<Btn variant="ghost" icon={Upload} size="sm">Enviar</Btn>}
        />
        <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-3 p-4">
          {SPRITE_LIST.map((sp) => {
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
