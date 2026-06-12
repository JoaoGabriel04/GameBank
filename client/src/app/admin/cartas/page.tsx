/* eslint-disable */
"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Check, X, Sparkles, Flame } from "lucide-react";
import {
  Panel, Chip, Toggle, Segmented, Btn, Field,
  AdminInput, AdminTextarea, AdminSelect, AdminModal,
} from "@/components/admin/AdminUI";
import { useAdminStore } from "@/stores/adminStore";
import { useToast } from "@/components/Toast";
import type { Card as ApiCard, CardInput } from "@/services/api/admin";

type Efeito = "ganhar" | "pagar" | "pagarPct" | "pagarPorCasa" | "prisao" | "sairPrisao";
type CardTipo = "sorte" | "revés";

const EFEITO_META: Record<Efeito, { label: string; showVal: boolean; unit: string }> = {
  ganhar:       { label: "Ganhar dinheiro",    showVal: true,  unit: "R$" },
  pagar:        { label: "Pagar dinheiro",     showVal: true,  unit: "R$" },
  pagarPct:     { label: "Pagar % patrimônio", showVal: true,  unit: "%" },
  pagarPorCasa: { label: "Pagar por casa",     showVal: true,  unit: "R$/casa" },
  prisao:       { label: "Ir para a prisão",   showVal: false, unit: "" },
  sairPrisao:   { label: "Sair da prisão",     showVal: false, unit: "" },
};

const TIPO_META: Record<CardTipo, { tone: "emerald" | "rose"; label: string; accent: string }> = {
  sorte: { tone: "emerald", label: "Sorte", accent: "#34d399" },
  revés: { tone: "rose",    label: "Revés", accent: "#fb7185" },
};

function asCard(c: ApiCard) {
  return {
    id: c.id,
    tipo: (c.tipo === "sorte" || c.tipo === "revés" ? c.tipo : "sorte") as CardTipo,
    texto: c.texto,
    efeito: (Object.prototype.hasOwnProperty.call(EFEITO_META, c.efeito) ? c.efeito : "ganhar") as Efeito,
    valor: c.valor,
    ativo: c.ativo,
  };
}

const EMPTY_CARD: CardInput = {
  tipo: "sorte", texto: "", efeito: "ganhar", valor: 1000, ativo: true,
};

function CardFace({ card }: { card: Partial<ApiCard> }) {
  const tipo = (card.tipo === "revés" ? "revés" : "sorte") as CardTipo;
  const meta = TIPO_META[tipo];
  const accent = meta.accent;
  const bg = tipo === "sorte"
    ? "linear-gradient(150deg,#052e2b,#0b3d2e)"
    : "linear-gradient(150deg,#3b0a14,#4c0519)";
  const ef = card.efeito ? EFEITO_META[card.efeito as Efeito] : null;

  return (
    <div
      className="rounded-2xl border p-5 relative overflow-hidden flex flex-col min-h-[180px]"
      style={{ borderColor: accent + "55", background: bg, boxShadow: `0 0 50px -22px ${accent}` }}
    >
      <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-20 pointer-events-none" style={{ background: accent }} />
      <div className="flex items-center gap-2 relative">
        <span className="w-9 h-9 rounded-lg grid place-items-center" style={{ background: accent + "22", color: accent }}>
          {tipo === "sorte" ? <Sparkles size={18} /> : <Flame size={18} />}
        </span>
        <span className="font-jaro text-lg" style={{ color: accent }}>
          {tipo === "sorte" ? "SORTE" : "REVÉS"}
        </span>
      </div>
      <p className="font-inconsolata text-sm text-zinc-100 leading-snug mt-4 flex-1 relative">
        {card.texto || "Texto da carta…"}
      </p>
      {ef?.showVal && (
        <p className="font-jaro text-xl mt-3 relative" style={{ color: accent }}>
          {ef.unit === "R$" ? `R$ ${(card.valor ?? 0).toLocaleString("pt-BR")}` :
           ef.unit === "%" ? `${card.valor}%` :
           `${(card.valor ?? 0).toLocaleString("pt-BR")} ${ef.unit}`}
        </p>
      )}
    </div>
  );
}

function CardModal({
  card,
  onClose,
  onSave,
}: {
  card: ApiCard | "new" | null;
  onClose: () => void;
  onSave: (data: CardInput, id?: number) => Promise<void>;
}) {
  const isNew = card === "new";
  const initial: CardInput = isNew || !card
    ? EMPTY_CARD
    : { tipo: card.tipo, texto: card.texto, efeito: card.efeito, valor: card.valor, ativo: card.ativo };
  const [form, setForm] = useState<CardInput>(initial);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (card && card !== "new") {
      setForm({ tipo: card.tipo, texto: card.texto, efeito: card.efeito, valor: card.valor, ativo: card.ativo });
    } else if (isNew) {
      setForm(EMPTY_CARD);
    }
  }, [card, isNew]);

  if (!card) return null;
  const set = (k: keyof CardInput, v: unknown) => setForm((p) => ({ ...p, [k]: v }));
  const noVal = form.efeito === "prisao" || form.efeito === "sairPrisao";

  async function handleSubmit() {
    setSaving(true);
    try {
      await onSave(form, isNew ? undefined : (card as ApiCard).id);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminModal open={!!card} onClose={onClose} width={760}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
        <h2 className="font-jaro text-lg text-white flex items-center gap-2 whitespace-nowrap">
          <Sparkles size={18} className="text-cyan-400" />
          {isNew ? "Nova carta" : "Editar carta"}
        </h2>
        <button type="button" onClick={onClose} className="text-zinc-500 hover:text-white cursor-pointer p-1"><X size={18} /></button>
      </div>

      <div className="grid md:grid-cols-[1fr_260px] gap-5 p-5">
        <div className="space-y-4">
          <Field label="Tipo">
            <div className="flex gap-2 mt-1">
              {(["sorte","revés"] as CardTipo[]).map((t) => (
                <button
                  key={t} type="button" onClick={() => set("tipo", t)}
                  className={`flex-1 py-2 rounded-xl font-inconsolata text-sm border cursor-pointer transition-colors capitalize ${
                    form.tipo === t
                      ? t === "sorte"
                        ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                        : "border-rose-500/50 bg-rose-500/10 text-rose-300"
                      : "border-zinc-700 text-zinc-500 hover:border-zinc-500"
                  }`}
                >
                  {t === "sorte" ? "✨ Sorte" : "🔥 Revés"}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Texto da carta">
            <AdminTextarea
              rows={3} value={form.texto}
              onChange={(e) => set("texto", e.target.value)}
              placeholder="ex: Avance até o início e receba R$ 2.000."
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Efeito">
              <AdminSelect value={form.efeito} onChange={(e) => set("efeito", e.target.value as Efeito)}>
                {Object.entries(EFEITO_META).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </AdminSelect>
            </Field>
            <Field label="Valor" hint={noVal ? "não aplicável" : "quantia ou %"}>
              <AdminInput
                type="number" value={form.valor}
                disabled={noVal} onChange={(e) => set("valor", +e.target.value)}
                className={noVal ? "opacity-40" : ""}
              />
            </Field>
          </div>

          <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
            <span className="font-inconsolata text-sm text-zinc-200">Carta ativa no baralho</span>
            <Toggle on={form.ativo} onChange={(v) => set("ativo", v)} />
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <p className="font-inconsolata text-[11px] uppercase tracking-wider text-zinc-500 mb-2">Pré-visualização</p>
            <CardFace card={form} />
          </div>
          <Btn variant="primary" icon={Check} className="justify-center w-full" onClick={handleSubmit} disabled={saving}>
            {saving ? "Salvando…" : isNew ? "Criar carta" : "Salvar"}
          </Btn>
          <Btn variant="ghost" className="justify-center w-full" onClick={onClose}>Cancelar</Btn>
        </div>
      </div>
    </AdminModal>
  );
}

export default function AdminCartasPage() {
  const { cards, loadingCards, loadCards, createCard, updateCard, deleteCard } = useAdminStore();
  const { success: ok, error: err } = useToast();
  const [filter, setFilter] = useState("Todas");
  const [editing, setEditing] = useState<ApiCard | "new" | null>(null);

  useEffect(() => {
    loadCards().catch(() => err("Erro ao carregar cartas."));
  }, [loadCards, err]);

  async function handleSave(data: CardInput, id?: number) {
    try {
      if (id === undefined) {
        await createCard(data);
        ok("Carta criada!");
      } else {
        await updateCard(id, data);
        ok("Carta atualizada!");
      }
    } catch {
      err("Erro ao salvar carta.");
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteCard(id);
      ok("Carta removida.");
    } catch {
      err("Erro ao remover carta.");
    }
  }

  const list = cards.filter((c) =>
    filter === "Todas" ||
    (filter === "Sorte" && c.tipo === "sorte") ||
    (filter === "Revés" && c.tipo === "revés") ||
    (filter === "Inativas" && !c.ativo)
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <Segmented value={filter} onChange={setFilter}
          options={[
            { value: "Todas",    label: `Todas ${cards.length}` },
            { value: "Sorte",    label: `Sorte ${cards.filter(c => c.tipo === "sorte").length}` },
            { value: "Revés",    label: `Revés ${cards.filter(c => c.tipo === "revés").length}` },
            { value: "Inativas", label: `Inativas ${cards.filter(c => !c.ativo).length}` },
          ]}
        />
        <Btn variant="primary" icon={Plus} onClick={() => setEditing("new")}>Nova carta</Btn>
      </div>

      {loadingCards ? (
        <p className="py-20 text-center font-inconsolata text-sm text-zinc-500">Carregando cartas…</p>
      ) : list.length === 0 ? (
        <p className="py-20 text-center font-inconsolata text-sm text-zinc-600">Nenhuma carta nesta categoria.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {list.map((raw) => {
            const c = asCard(raw);
            const meta = TIPO_META[c.tipo];
            const ef = EFEITO_META[c.efeito];
            return (
              <Panel key={c.id} className={`group ${c.ativo ? "" : "opacity-55"}`}>
                <div className="flex items-start gap-3">
                  <span className="w-9 h-9 rounded-lg grid place-items-center shrink-0" style={{ background: meta.accent + "1f", color: meta.accent }}>
                    {c.tipo === "sorte" ? <Sparkles size={16} /> : <Flame size={16} />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Chip tone={meta.tone}>{meta.label}</Chip>
                      <span className="font-inconsolata text-[10px] text-zinc-600">#{c.id}</span>
                      {!c.ativo && <Chip tone="zinc">inativa</Chip>}
                    </div>
                    <p className="font-inconsolata text-xs text-zinc-300 leading-snug">{c.texto}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-800">
                  <span className="font-inconsolata text-[11px] text-zinc-500">
                    {ef.label}{ef.showVal ? ` · ${ef.unit === "%" ? c.valor + "%" : "R$ " + c.valor.toLocaleString("pt-BR")}` : ""}
                  </span>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => setEditing(raw)} className="p-1.5 rounded-lg text-zinc-500 hover:text-cyan-400 hover:bg-zinc-800 cursor-pointer"><Pencil size={13} /></button>
                    <button type="button" onClick={() => handleDelete(c.id)} className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 cursor-pointer"><Trash2 size={13} /></button>
                  </div>
                </div>
              </Panel>
            );
          })}
        </div>
      )}

      {editing !== null && (
        <CardModal card={editing} onClose={() => setEditing(null)} onSave={handleSave} />
      )}
    </div>
  );
}
