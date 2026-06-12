/* eslint-disable */
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
import type { Badge } from "@/services/api/admin";
import { apiErrMsg } from "@/lib/api-error";

function BadgeBuilder({
  editing, onCancel,
}: {
  editing?: Badge | null;
  onCancel?: () => void;
}) {
  const { createBadge, updateBadge, uploadBadgeImage, loadBadges } = useAdminStore();
  const { success: ok, error: err } = useToast();
  const [nome, setNome] = useState("");
  const [disponibilidade, setDisponibilidade] = useState(true);
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
      setNome("");
      setDisponibilidade(true);
      setLocalPreviewUrl(null);
      setPendingFile(null);
      setSaved(false);
      return;
    }
    setNome(editing.nome);
    setDisponibilidade(editing.disponibilidade);
    setLocalPreviewUrl(null);
    setPendingFile(null);
    setSaved(false);
  }, [editing]);

  function handleFileSelect(file: File) {
    if (localPreviewUrl?.startsWith("blob:")) URL.revokeObjectURL(localPreviewUrl);
    setLocalPreviewUrl(URL.createObjectURL(file));
    setPendingFile(file);
  }

  async function handleSave() {
    if (!nome.trim()) { alert("Nome é obrigatório"); return; }
    if (!pendingFile && !editing?.imageUrl) { alert("Selecione uma imagem"); return; }

    setSaving(true);
    try {
      let recordId: number;

      if (editing) {
        const updated = await updateBadge(editing.id, { nome: nome.trim(), disponibilidade });
        recordId = updated.id;
        ok(`Badge #${recordId} atualizado!`);
      } else {
        const created = await createBadge({ nome: nome.trim(), disponibilidade });
        recordId = created.id;
        ok("Badge criado!");
      }

      if (pendingFile) {
        setUploading(true);
        try {
          await uploadBadgeImage(recordId, pendingFile);
        } finally {
          setUploading(false);
        }
      }

      if (localPreviewUrl?.startsWith("blob:")) URL.revokeObjectURL(localPreviewUrl);
      setLocalPreviewUrl(null);
      setPendingFile(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);

      await loadBadges();
    } catch (e) {
      err(apiErrMsg(e, "Erro ao salvar badge."));
    } finally {
      setSaving(false);
    }
  }

  const previewUrl = localPreviewUrl || editing?.imageUrl;

  return (
    <Panel flush>
      <PanelHead
        title={editing ? "Editar badge" : "Construtor de badge"}
        icon={ImageIcon}
        sub={editing ? `Editando #${editing.id} · ${editing.nome}` : "Crie um novo emblema com nome e imagem PNG"}
        right={<Chip tone={editing ? "amber" : "violet"}>{editing ? "editando" : "editor"}</Chip>}
      />
      <div className="grid lg:grid-cols-[1fr_300px] gap-5 p-5">
        <div className="space-y-4">
          <div>
            <p className="font-inconsolata text-[11px] uppercase tracking-wider text-zinc-500 mb-2">
              Pré-visualização
            </p>
            <div className="rounded-2xl border border-zinc-800 overflow-hidden p-8 bg-zinc-900/50 flex items-center justify-center">
              {previewUrl ? (
                <img src={previewUrl} alt="Preview" className="w-24 h-24 object-contain" />
              ) : (
                <div className="w-24 h-24 rounded-xl bg-zinc-800 grid place-items-center text-zinc-600">
                  <ImageIcon size={32} />
                </div>
              )}
            </div>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
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
            {localPreviewUrl ? (
              <img src={localPreviewUrl} alt="" className="w-full max-h-32 object-contain" />
            ) : (
              <>
                <Upload size={20} className="text-zinc-500 mx-auto" />
                <p className="font-inconsolata text-[11px] text-zinc-500 mt-1.5 leading-snug">
                  {uploading
                    ? "Enviando…"
                    : editing?.imageUrl
                      ? "Trocar imagem"
                      : "Arraste uma imagem ou clique para selecionar"}
                </p>
              </>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <Field label="Nome do badge">
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

          <Btn
            variant={saved ? "subtle" : "primary"}
            icon={saved ? Check : undefined}
            className="w-full justify-center"
            onClick={handleSave}
            disabled={saving || uploading}
          >
            {saving || uploading ? "Salvando…" : saved ? "Badge salvo!" : editing ? "Salvar alterações" : "Salvar badge"}
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

export default function AdminBadgesPage() {
  const { badges, loadingBadges, loadBadges, deleteBadge } = useAdminStore();
  const { success: ok, error: err } = useToast();
  const [confirmDel, setConfirmDel] = useState<number | null>(null);
  const [editing, setEditing] = useState<Badge | null>(null);

  useEffect(() => {
    loadBadges().catch(() => err("Erro ao carregar badges."));
  }, [loadBadges, err]);

  async function removeBadge(id: number) {
    try {
      await deleteBadge(id);
      ok("Badge removido.");
      setConfirmDel(null);
      if (editing?.id === id) setEditing(null);
    } catch {
      err("Erro ao remover badge.");
    }
  }

  return (
    <div className="space-y-4">
      <BadgeBuilder
        editing={editing}
        onCancel={() => setEditing(null)}
      />

      <Panel flush>
        <PanelHead
          title="Badges publicados" icon={Layers}
          sub={loadingBadges ? "carregando…" : `${badges.length} badges disponíveis`}
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4">
          {badges.map((b: Badge) => (
            <div key={b.id} className="group rounded-xl overflow-hidden border border-zinc-800 cursor-pointer hover:border-zinc-700 transition-colors">
              <div className="h-24 bg-zinc-950 flex items-center justify-center relative">
                {b.imageUrl ? (
                  <img src={b.imageUrl} alt={b.nome} className="w-20 h-20 object-contain" />
                ) : (
                  <div className="w-20 h-20 rounded-xl bg-zinc-800 grid place-items-center text-zinc-600">
                    <ImageIcon size={24} />
                  </div>
                )}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 flex items-center justify-center gap-2">
                  <button type="button" onClick={() => setEditing(b)} title="Editar badge" className="p-1.5 rounded-lg bg-white/15 text-white hover:bg-white/25"><Pencil size={13} /></button>
                  {confirmDel === b.id ? (
                    <div className="flex gap-1">
                      <button type="button" onClick={() => removeBadge(b.id)} className="p-1.5 rounded-lg bg-rose-500/60 text-white"><Check size={13} /></button>
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
                </div>
                <span className="font-inconsolata text-[9px] text-zinc-600 shrink-0">#{b.id}</span>
              </div>
            </div>
          ))}
          {!loadingBadges && badges.length === 0 && (
            <p className="col-span-full py-12 text-center font-inconsolata text-xs text-zinc-600">
              Nenhum badge cadastrado.
            </p>
          )}
        </div>
      </Panel>
    </div>
  );
}
