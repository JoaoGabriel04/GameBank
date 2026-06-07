"use client";

import { useEffect, useState } from "react";
import { Check, DollarSign, Zap, Settings, Store, Trophy, Lock } from "lucide-react";
import CoinIcon from "@/components/CoinIcon";
import {
  Panel, PanelHead, Chip, Toggle, Btn,
} from "@/components/admin/AdminUI";
import { useAdminStore } from "@/stores/adminStore";
import { useToast } from "@/components/Toast";

function AreaChart({ data }: { data: number[]; tone?: string }) {
  if (!data.length) return null;
  const w = 600; const h = 120; const pad = 8;
  const max = Math.max(...data); const min = Math.min(...data); const range = max - min || 1;
  const step = (w - pad * 2) / (data.length - 1);
  const pts = data.map((v, i) => {
    const x = pad + i * step;
    const y = pad + (h - pad * 2) * (1 - (v - min) / range);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const line = "M" + pts.join(" L");
  const area = `${line} L${w - pad},${h - pad} L${pad},${h - pad} Z`;
  const color = "#fbbf24";
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: h }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="ecoGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((g) => (
        <line key={g} x1={pad} x2={w - pad} y1={pad + (h - pad * 2) * g} y2={pad + (h - pad * 2) * g}
          stroke="#27272a" strokeWidth={1} strokeDasharray="3 4" />
      ))}
      <path d={area} fill="url(#ecoGrad)" />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

function SliderRow({
  label, value, display, onChange, min, max, step, hint,
}: {
  label: string; value: number; display: string;
  onChange: (v: number) => void;
  min: number; max: number; step: number; hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="font-inconsolata text-[11px] uppercase tracking-wider text-zinc-500">{label}</span>
        <span className="font-jaro text-base text-cyan-300">{display}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(+e.target.value)}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-zinc-800 accent-cyan-400"
      />
      {hint && <p className="font-inconsolata text-[10px] text-zinc-600">{hint}</p>}
    </div>
  );
}

function FlagRow({ icon: Icon, title, desc, value, onChange }: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string; desc: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <span className="w-8 h-8 rounded-lg grid place-items-center bg-zinc-800 text-zinc-400 shrink-0">
          <Icon size={15} />
        </span>
        <div className="min-w-0">
          <p className="font-inconsolata text-sm text-zinc-200 whitespace-nowrap">{title}</p>
          <p className="font-inconsolata text-[10px] text-zinc-500 truncate">{desc}</p>
        </div>
      </div>
      <Toggle on={value} onChange={onChange} />
    </div>
  );
}

function rewardSim(winBonus: number, xpMult: number, coinMult: number) {
  return [
    { pos: "🥇 1º lugar",    xp: Math.round(600 * xpMult),  coins: Math.round(winBonus * coinMult) },
    { pos: "🥈 2º lugar",    xp: Math.round(350 * xpMult),  coins: Math.round(300 * coinMult) },
    { pos: "🥉 3º lugar",    xp: Math.round(200 * xpMult),  coins: Math.round(180 * coinMult) },
    { pos: "Participação",   xp: Math.round(80 * xpMult),   coins: Math.round(60 * coinMult) },
  ];
}

const BASE_SERIES = [120,135,128,142,160,155,148,170,182,176,190,205,198,210,225,218,232,240,255,248,262,270,285,278,292,305,298,312,320,335];

interface Settings {
  saldoInicial: number;
  passBonus: number;
  winBonus: number;
  xpMult: number;
  coinMult: number;
  shopOpen: boolean;
  rewardsOn: boolean;
  maintenance: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  saldoInicial: 25000,
  passBonus: 2000,
  winBonus: 500,
  xpMult: 1.25,
  coinMult: 1.0,
  shopOpen: true,
  rewardsOn: true,
  maintenance: false,
};

export default function AdminEconomiaPage() {
  const { settings, loadingSettings, loadSettings, saveSettings } = useAdminStore();
  const { success: ok, error: err } = useToast();

  const [form, setForm] = useState<Settings>(DEFAULT_SETTINGS);
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadSettings().catch(() => err("Erro ao carregar configurações."));
  }, [loadSettings, err]);

  useEffect(() => {
    if (!hydrated && Object.keys(settings).length > 0) {
      setForm({ ...DEFAULT_SETTINGS, ...(settings as Partial<Settings>) });
      setHydrated(true);
    }
  }, [settings, hydrated]);

  const sim = rewardSim(form.winBonus, form.xpMult, form.coinMult);
  const projected = BASE_SERIES.map((v) => Math.round(v * (1 + (form.coinMult - 1) * 0.6)));

  function set<K extends keyof Settings>(k: K, v: Settings[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function handleApply() {
    setSaving(true);
    try {
      await saveSettings(form as Record<string, unknown>);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      ok("Configurações salvas!");
    } catch {
      err("Erro ao salvar configurações.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
      <div className="space-y-4">
        <Panel flush>
          <PanelHead title="Banco & partidas" icon={DollarSign} sub="Valores padrão de novas sessões" />
          <div className="p-4 space-y-5">
            <SliderRow
              label="Saldo inicial" display={`R$ ${form.saldoInicial.toLocaleString("pt-BR")}`}
              value={form.saldoInicial} onChange={(v) => set("saldoInicial", v)} min={5000} max={50000} step={1000}
              hint="Quanto cada jogador começa. Afeta apenas novas sessões."
            />
            <div className="grid grid-cols-2 gap-4">
              <SliderRow
                label="Bônus ao passar pelo início" display={`R$ ${form.passBonus.toLocaleString("pt-BR")}`}
                value={form.passBonus} onChange={(v) => set("passBonus", v)} min={500} max={5000} step={100}
              />
              <SliderRow
                label="Bônus por vitória" display={`R$ ${form.winBonus.toLocaleString("pt-BR")}`}
                value={form.winBonus} onChange={(v) => set("winBonus", v)} min={0} max={2000} step={50}
              />
            </div>
          </div>
        </Panel>

        <Panel flush>
          <PanelHead
            title="Multiplicadores de recompensa" icon={Zap}
            sub="Afeta XP e coins ganhos nas partidas"
            right={<Chip tone="amber" dot>impacta economia</Chip>}
          />
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-5">
            <SliderRow
              label="Multiplicador de XP" display={`${form.xpMult.toFixed(2)}×`}
              value={form.xpMult} onChange={(v) => set("xpMult", v)} min={0.5} max={3} step={0.05}
              hint="Velocidade de subida de nível."
            />
            <SliderRow
              label="Multiplicador de coins" display={`${form.coinMult.toFixed(2)}×`}
              value={form.coinMult} onChange={(v) => set("coinMult", v)} min={0.5} max={3} step={0.05}
              hint="Geração de moeda no jogo."
            />
          </div>
        </Panel>

        <Panel flush>
          <PanelHead title="Sistema & flags" icon={Settings} />
          <div className="divide-y divide-zinc-800">
            <FlagRow icon={Store}  title="Loja aberta"              desc="Permite compras com coins"          value={form.shopOpen}    onChange={(v) => set("shopOpen", v)} />
            <FlagRow icon={Trophy} title="Resgate de recompensas"   desc="Jogadores podem resgatar missões"   value={form.rewardsOn}   onChange={(v) => set("rewardsOn", v)} />
            <FlagRow icon={Lock}   title="Modo manutenção"          desc="Bloqueia novas sessões"             value={form.maintenance} onChange={(v) => set("maintenance", v)} />
          </div>
        </Panel>
      </div>

      <div className="space-y-4 lg:sticky lg:top-4 self-start">
        <Panel flush>
          <PanelHead title="Simulação de recompensas" icon={Zap} sub="Com os multiplicadores atuais" />
          <div className="divide-y divide-zinc-800">
            {sim.map((s) => (
              <div key={s.pos} className="flex items-center justify-between px-4 py-3">
                <span className="font-inconsolata text-sm text-zinc-200">{s.pos}</span>
                <div className="flex items-center gap-3">
                  <span className="font-inconsolata text-xs text-cyan-300">+{s.xp.toLocaleString("pt-BR")} XP</span>
                  <span className="inline-flex items-center gap-1 font-inconsolata text-xs text-amber-300">
                    <CoinIcon size={11} />+{s.coins.toLocaleString("pt-BR")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel flush>
          <PanelHead title="Projeção de circulação" sub="Coins em circulação · 30 dias" icon={DollarSign} />
          <div className="p-4">
            <AreaChart data={projected} />
            <div className="flex items-center justify-between mt-3">
              <span className="font-inconsolata text-[10px] text-zinc-500">Pico projetado</span>
              <span className="font-jaro text-lg text-amber-300">
                {(Math.max(...projected) * 1000).toLocaleString("pt-BR")}
              </span>
            </div>
          </div>
        </Panel>

        <Btn
          variant={saved ? "subtle" : "primary"}
          icon={saved ? Check : undefined}
          className="w-full justify-center"
          onClick={handleApply}
          disabled={saving || loadingSettings}
        >
          {saving ? "Salvando…" : saved ? "Configurações salvas!" : "Aplicar configurações"}
        </Btn>
        <p className="font-inconsolata text-[10px] text-zinc-600 text-center -mt-2">
          As mudanças afetam todas as partidas futuras.
        </p>
      </div>
    </div>
  );
}
