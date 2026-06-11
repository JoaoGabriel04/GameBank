"use client";

/**
 * Usuários — Admin
 * Salve em: src/app/admin/usuarios/page.tsx
 * Substitui a versão atual que só tinha CoinAdjust inline.
 */

import { useEffect, useState } from "react";
import {
  Users, Pencil, Download, Search, Shield, Ban, Trash2,
  Check, Coins, MessageSquare, X, AlertTriangle,
} from "lucide-react";
import { useAdminStore } from "@/stores/adminStore";
import { adminApi } from "@/services/api/admin";
import { useToast } from "@/components/Toast";
import type { AdminUser } from "@/services/api/admin";
import {
  Panel, Chip, Toggle, Progress, Segmented,
  Btn, Field, AdminInput, AdminAvatar,
  Drawer, AdminModal,
} from "@/components/admin/AdminUI";
import { xpForLevel } from "@/components/user/UserUI";
import DiamondIcon from "@/components/DiamondIcon";

function exportCsvUsers(rows: AdminUser[]) {
  const header = "id,nome,email,nivel,xp,coins,partidas,vitorias,admin,banido,criado\n";
  const body = rows
    .map((u) =>
      [
        u.id,
        `"${u.nome.replace(/"/g, "")}"`,
        u.email,
        u.level,
        u.xp,
        u.coins,
        u.totalGames,
        u.totalWins,
        u.isAdmin,
        u.banned ?? false,
        new Date(u.createdAt).toLocaleDateString("pt-BR"),
      ].join(",")
    )
    .join("\n");
  const blob = new Blob([header + body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `usuarios-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* -- User Edit Drawer -- */
function DeleteUserDialog({
  user,
  open,
  onClose,
}: {
  user: AdminUser | null;
  open: boolean;
  onClose: () => void;
}) {
  const { deleteUser } = useAdminStore();
  const { success: ok, error: err } = useToast();
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (open) setConfirmation("");
  }, [open]);

  if (!user) return null;

  const canConfirm = confirmation === user.email;
  const isAdminSelf = false;

  async function handleDelete() {
    if (!user) return;
    setDeleting(true);
    try {
      await deleteUser(user.id);
      ok(`Usuário ${user.nome} removido do banco.`);
      onClose();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string; message?: string } } })?.response?.data?.error
        ?? (e as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? "Erro ao excluir usuário.";
      err(msg);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AdminModal open={open} onClose={onClose} width={500}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
        <h2 className="font-jaro text-lg text-white flex items-center gap-2 whitespace-nowrap">
          <AlertTriangle size={18} className="text-rose-400" />
          Excluir usuário permanentemente
        </h2>
        <button type="button" onClick={onClose} className="text-zinc-500 hover:text-white cursor-pointer p-1">
          <X size={18} />
        </button>
      </div>

      <div className="p-5 space-y-4">
        <div className="bg-rose-500/5 border border-rose-500/30 rounded-xl p-4 space-y-2">
          <p className="font-inconsolata text-sm text-rose-200">
            Esta ação é <b>irreversível</b>. O usuário será removido do banco de dados e:
          </p>
          <ul className="font-inconsolata text-xs text-rose-300/80 list-disc pl-5 space-y-0.5">
            <li>Todas as missões, itens comprados e resultados de partidas serão apagados</li>
            <li>Sessões que ele criou ficarão sem dono</li>
            <li>Logs de auditoria serão anonimizados (mantidos sem referência)</li>
            <li>Não é possível recuperar a conta depois</li>
          </ul>
        </div>

        <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl p-3">
          <AdminAvatar user={user} size="md" />
          <div className="min-w-0">
            <p className="font-jaro text-base text-white truncate">{user.nome}</p>
            <p className="font-inconsolata text-xs text-zinc-500 truncate">{user.email}</p>
          </div>
        </div>

        <Field label="Para confirmar, digite o e-mail do usuário">
          <AdminInput
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            placeholder={user.email}
            autoComplete="off"
          />
        </Field>

        <div className="flex gap-2 pt-1">
          <Btn variant="ghost" className="flex-1 justify-center" onClick={onClose}>Cancelar</Btn>
          <Btn
            variant="danger"
            icon={Trash2}
            className="flex-1 justify-center"
            onClick={handleDelete}
            disabled={!canConfirm || deleting}
          >
            {deleting ? "Excluindo…" : "Excluir permanentemente"}
          </Btn>
        </div>
        {isAdminSelf && (
          <p className="text-[10px] text-zinc-500 font-inconsolata text-center">
            Você não pode excluir seu próprio usuário.
          </p>
        )}
      </div>
    </AdminModal>
  );
}

function UserEditDrawer({
  user,
  open,
  onClose,
  onRequestDelete,
}: {
  user: AdminUser | null;
  open: boolean;
  onClose: () => void;
  onRequestDelete: (u: AdminUser) => void;
}) {
  const { adjustCoins, adjustDiamonds, adjustXp, setLevel, setUserAdmin, banUser, unbanUser } = useAdminStore();
  const { success: ok, error: err } = useToast();

  const isDev = process.env.NODE_ENV === "development";
  const [coins, setCoins] = useState(0);
  const [diamonds, setDiamonds] = useState(0);
  const [xp, setXp] = useState(0);
  const [level, setLevelState] = useState(1);
  const [isAdmin, setIsAdmin] = useState(false);
  const [banned, setBanned] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setCoins(user.coins);
      setDiamonds(user.diamonds);
      setXp(user.xp);
      setLevelState(user.level);
      setIsAdmin(user.isAdmin);
      setBanned(!!user.banned);
    }
  }, [user]);

  if (!user) return null;

  const winRate = user.totalGames > 0
    ? Math.round((user.totalWins / user.totalGames) * 100)
    : 0;

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    try {
      const coinsDelta = coins - user.coins;
      if (coinsDelta !== 0) await adjustCoins(user.id, coinsDelta);
      const diamondsDelta = diamonds - user.diamonds;
      if (diamondsDelta !== 0) await adjustDiamonds(user.id, diamondsDelta);
      if (level !== user.level) await setLevel(user.id, level);
      const xpDelta = level !== user.level ? xp : xp - user.xp;
      if (xpDelta !== 0) await adjustXp(user.id, xpDelta);
      if (isAdmin !== user.isAdmin) await setUserAdmin(user.id, isAdmin);
      const wasBanned = !!user.banned;
      if (banned && !wasBanned) await banUser(user.id);
      else if (!banned && wasBanned) await unbanUser(user.id);
      ok("Usuário atualizado!");
      onClose();
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        (e as Error)?.message ??
        "Erro ao salvar.";
      console.error("[handleSave]", e);
      err(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer open={open} onClose={onClose} width={460} title="Editar usuário" icon={Users}>
      <div className="p-5 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <AdminAvatar user={user} size="md" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-jaro text-lg text-white truncate">{user.nome}</h3>
              {user.isAdmin && <Chip tone="violet">admin</Chip>}
            </div>
            <p className="font-inconsolata text-xs text-zinc-500 truncate">{user.email}</p>
            <p className="font-inconsolata text-[10px] text-zinc-600">
              #{user.id} · desde {new Date(user.createdAt).toLocaleDateString("pt-BR")}
            </p>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-4 gap-2">
          {[
            ["Partidas", user.totalGames],
            ["Vitórias", user.totalWins],
            ["Win %",    winRate + "%"],
            ["Nível",    user.level],
          ].map(([l, v]) => (
            <div key={String(l)} className="bg-zinc-900 border border-zinc-800 rounded-xl p-2 text-center">
              <p className="font-jaro text-base text-white leading-none">{v}</p>
              <p className="font-inconsolata text-[9px] text-zinc-500 mt-1">{l}</p>
            </div>
          ))}
        </div>

        {/* Coins */}
        <Field label={`${isDev ? "Coins (dev)" : "Subtrair coins"} — atual: ${user.coins.toLocaleString("pt-BR")}`}>
          {isDev ? (
            <p className="font-inconsolata text-[10px] text-emerald-400/80 mb-1">
              Dev: adição e remoção permitidas.
            </p>
          ) : (
            <p className="font-inconsolata text-[10px] text-amber-400/80 mb-1">
              Somente reduções de saldo são permitidas.
            </p>
          )}
          <div className="flex items-center gap-2 mt-1">
            <input
              type="range"
              min={0}
              max={isDev ? Math.max(user.coins * 2, 10000) : user.coins}
              step={100}
              value={coins}
              onChange={(e) => setCoins(+e.target.value)}
              className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer bg-zinc-800 accent-cyan-400"
            />
            <AdminInput
              type="number"
              value={coins}
              min={0}
              max={isDev ? undefined : user.coins}
              onChange={(e) => {
                const v = +e.target.value;
                setCoins(isDev ? Math.max(0, v) : Math.min(v, user.coins));
              }}
              className="!w-24 !py-1.5 text-right"
            />
          </div>
        </Field>

        {/* Diamonds */}
        <Field label={`${isDev ? "Diamantes (dev)" : "Subtrair diamantes"} — atual: ${user.diamonds.toLocaleString("pt-BR")}`}>
          {isDev ? (
            <p className="font-inconsolata text-[10px] text-emerald-400/80 mb-1">
              Dev: adição e remoção permitidas.
            </p>
          ) : (
            <p className="font-inconsolata text-[10px] text-amber-400/80 mb-1">
              Somente reduções de saldo são permitidas.
            </p>
          )}
          <div className="flex items-center gap-2 mt-1">
            <input
              type="range"
              min={0}
              max={isDev ? Math.max(user.diamonds * 2, 100) : user.diamonds}
              step={1}
              value={diamonds}
              onChange={(e) => setDiamonds(+e.target.value)}
              className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer bg-zinc-800 accent-sky-400"
            />
            <AdminInput
              type="number"
              value={diamonds}
              min={0}
              max={isDev ? undefined : user.diamonds}
              onChange={(e) => {
                const v = +e.target.value;
                setDiamonds(isDev ? Math.max(0, v) : Math.min(v, user.diamonds));
              }}
              className="!w-24 !py-1.5 text-right"
            />
          </div>
        </Field>

        {/* Level slider */}
        <Field label={`Nível — ${level}`}>
          <div className="flex items-center gap-2 mt-1">
            <input
              type="range" min={1} max={100} step={1} value={level}
              onChange={(e) => setLevelState(+e.target.value)}
              className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer bg-zinc-800 accent-cyan-400"
            />
            <AdminInput
              type="number" min={1} max={100} value={level} onChange={(e) => setLevelState(+e.target.value)}
              className="!w-16 !py-1.5 text-right"
            />
          </div>
        </Field>

        {/* XP slider */}
        <Field label={`XP — ${xp.toLocaleString("pt-BR")}`}>
          <div className="flex items-center gap-2 mt-1">
            <input
              type="range" min={0} max={xpForLevel(level)} step={10} value={Math.min(xp, xpForLevel(level))}
              onChange={(e) => setXp(+e.target.value)}
              className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer bg-zinc-800 accent-cyan-400"
            />
            <AdminInput
              type="number" step={1} value={Math.min(xp, xpForLevel(level))}
              onChange={(e) => setXp(Math.min(Math.round(+e.target.value), xpForLevel(level)))}
              className="!w-24 !py-1.5 text-right"
            />
          </div>
        </Field>

        {/* XP progress display */}
        <div>
          <div className="flex justify-between font-inconsolata text-[11px] text-zinc-500 mb-1.5">
            <span>XP para nível {level + 1}</span>
            <span>{Math.min(xp, xpForLevel(level)).toLocaleString("pt-BR")} / {xpForLevel(level).toLocaleString("pt-BR")} XP</span>
          </div>
          <Progress value={Math.min(xp, xpForLevel(level))} max={xpForLevel(level)} tone="cyan" />
        </div>

        {/* Role toggles */}
        <div className="space-y-2">
          <div className={`flex items-center justify-between border rounded-xl px-4 py-3 ${
            isAdmin ? "bg-violet-500/5 border-violet-500/30" : "bg-zinc-900 border-zinc-800"
          }`}>
            <div className="flex items-center gap-2.5">
              <span className="text-violet-400"><Shield size={16} /></span>
              <div>
                <p className="font-inconsolata text-sm text-zinc-200">Administrador</p>
                <p className="font-inconsolata text-[10px] text-zinc-500">Acesso total ao console</p>
              </div>
            </div>
            <Toggle on={isAdmin} onChange={setIsAdmin} />
          </div>

          <div className={`flex items-center justify-between border rounded-xl px-4 py-3 ${
            banned ? "bg-rose-500/5 border-rose-500/30" : "bg-zinc-900 border-zinc-800"
          }`}>
            <div className="flex items-center gap-2.5">
              <span className="text-rose-400"><Ban size={16} /></span>
              <div>
                <p className="font-inconsolata text-sm text-zinc-200">Banir usuário</p>
                <p className="font-inconsolata text-[10px] text-zinc-500">Bloqueia login e partidas</p>
              </div>
            </div>
            <Toggle on={banned} onChange={setBanned} />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Btn variant="ghost" className="flex-1 justify-center" onClick={onClose}>Cancelar</Btn>
          <Btn
            variant="primary" icon={Check} className="flex-1 justify-center"
            onClick={handleSave} disabled={saving}
          >
            {saving ? "Salvando…" : "Salvar"}
          </Btn>
        </div>

        {/* Danger zone */}
        <div className="pt-4 mt-2 border-t border-rose-500/20">
          <p className="font-inconsolata text-[10px] uppercase tracking-wider text-zinc-500 mb-2">
            Zona de perigo
          </p>
          <Btn
            variant="danger" icon={Trash2}
            className="w-full justify-center"
            onClick={() => user && onRequestDelete(user)}
          >
            Excluir usuário do banco
          </Btn>
          <p className="font-inconsolata text-[10px] text-zinc-600 mt-2 leading-snug">
            Remove o usuário permanentemente. Esta ação não pode ser desfeita.
          </p>
        </div>
      </div>
    </Drawer>
  );
}

/* -- Main page -- */
export default function AdminUsuariosPage() {
  const { users, loadingUsers, loadUsers, banUser } = useAdminStore();
  const { success: ok, error: err } = useToast();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("Todos");
  const [selected, setSelected] = useState<number[]>([]);
  const [banning, setBanning] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifTitulo, setNotifTitulo] = useState("");
  const [notifCorpo, setNotifCorpo] = useState("");
  const [sending, setSending] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState<AdminUser | null>(null);

  async function handleNotify() {
    if (!notifTitulo.trim() || !notifCorpo.trim()) return;
    setSending(true);
    try {
      const { sent } = await adminApi.notifyUsers(selected, notifTitulo.trim(), notifCorpo.trim());
      ok(`Notificação enviada para ${sent} usuário(s).`);
      setSelected([]);
      setNotifOpen(false);
      setNotifTitulo("");
      setNotifCorpo("");
    } catch {
      err("Erro ao enviar notificação.");
    } finally {
      setSending(false);
    }
  }

  async function handleBatchBan() {
    if (selected.length === 0) return;
    setBanning(true);
    let count = 0;
    for (const id of selected) {
      try { await banUser(id); count++; } catch { /* individual errors silently skipped */ }
    }
    ok(`${count} usuário(s) banido(s).`);
    setSelected([]);
    setBanning(false);
  }

  function closeDrawer() { setEditing(null); setDeleting(null); }

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const filtered = users.filter((u) => {
    if (filter === "Admins" && !u.isAdmin) return false;
    if (filter === "Banidos" && !u.banned) return false;
    const term = q.toLowerCase();
    return u.nome.toLowerCase().includes(term) || u.email.toLowerCase().includes(term);
  });

  const toggleSel = (id: number) =>
    setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);

  const adminsCount = users.filter((u) => u.isAdmin).length;
  const bannedCount = users.filter((u) => u.banned).length;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: "Todos",   label: `Todos ${users.length}` },
            { value: "Admins",  label: `Admins ${adminsCount}` },
            { value: "Banidos", label: `Banidos ${bannedCount}` },
          ]}
        />
        <div className="flex items-center gap-2 flex-1 justify-end">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
            <AdminInput
              placeholder="Buscar nome ou e-mail"
              value={q} onChange={(e) => setQ(e.target.value)}
              className="!pl-9"
            />
          </div>
          <Btn variant="ghost" icon={Download} size="sm" className="hidden sm:inline-flex" onClick={() => exportCsvUsers(filtered)}>
            Exportar
          </Btn>
        </div>
      </div>

      {/* Batch action bar */}
      {selected.length > 0 && (
        <div className="flex items-center gap-3 bg-cyan-500/5 border border-cyan-500/30 rounded-xl px-4 py-2.5">
          <span className="font-inconsolata text-xs text-cyan-300">
            {selected.length} selecionado(s)
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <Btn variant="subtle" icon={MessageSquare} size="sm" onClick={() => setNotifOpen(true)}>Notificar</Btn>
            <Btn variant="danger" icon={Ban} size="sm" onClick={handleBatchBan} disabled={banning}>
              {banning ? "Banindo…" : "Banir"}
            </Btn>
          </div>
        </div>
      )}

      {/* Table */}
      <Panel flush>
        {loadingUsers ? (
          <p className="py-20 text-center font-inconsolata text-sm text-zinc-500">
            Carregando usuários…
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-zinc-800 text-left">
                  <th className="pl-4 py-2.5 w-8" />
                  {["Usuário", "Nível", "Coins", "Diamantes", "Vitórias", "Win %", "Status", ""].map((h, i) => (
                    <th
                      key={i}
                      className={`px-4 py-2.5 font-inconsolata text-[10px] uppercase tracking-wider text-zinc-500
                        ${[2, 3, 4].includes(i) ? "text-right" : ""}
                        ${i === 3 ? "hidden md:table-cell" : ""}
                        ${i === 4 ? "hidden lg:table-cell" : ""}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => {
                  const wr = u.totalGames > 0
                    ? Math.round((u.totalWins / u.totalGames) * 100)
                    : 0;
                  const isSel = selected.includes(u.id);
                  return (
                    <tr
                      key={u.id}
                      className="border-b border-zinc-800/70 hover:bg-zinc-800/30 transition-colors"
                    >
                      <td className="pl-4 py-3">
                        <button
                          type="button"
                          onClick={() => toggleSel(u.id)}
                          className={`w-4 h-4 rounded border grid place-items-center cursor-pointer transition-colors ${
                            isSel
                              ? "bg-cyan-500 border-cyan-500"
                              : "border-zinc-600 hover:border-zinc-400"
                          }`}
                        >
                          {isSel && <Check size={10} className="text-zinc-950" strokeWidth={3} />}
                        </button>
                      </td>

                      {/* User */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <AdminAvatar user={u} size="sm" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-inconsolata text-sm text-zinc-100 truncate">
                                {u.nome}
                              </span>
                              {u.isAdmin && <Chip tone="violet">admin</Chip>}
                            </div>
                            <span className="font-inconsolata text-[10px] text-zinc-500 truncate block">
                              {u.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Level */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-jaro text-sm text-cyan-300 w-5 shrink-0">
                            {u.level}
                          </span>
                          <Progress value={u.xp} max={xpForLevel(u.level)} tone="cyan" className="w-14" height={4} />
                        </div>
                      </td>

                      {/* Coins */}
                      <td className="px-4 py-3 text-right font-inconsolata text-sm text-amber-300">
                        {u.coins.toLocaleString("pt-BR")}
                      </td>

                      {/* Diamonds */}
                      <td className="px-4 py-3 text-right font-inconsolata text-sm text-sky-300">
                        <span className="inline-flex items-center justify-end gap-1">
                          <DiamondIcon size={11} />
                          {u.diamonds.toLocaleString("pt-BR")}
                        </span>
                      </td>

                      {/* Wins */}
                      <td className="px-4 py-3 text-right font-inconsolata text-sm text-zinc-300 hidden md:table-cell">
                        {u.totalWins}
                      </td>

                      {/* Win % */}
                      <td className="px-4 py-3 text-right font-inconsolata text-sm text-zinc-400 hidden lg:table-cell">
                        {wr}%
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        {u.banned ? (
                          <Chip tone="rose" dot>banido</Chip>
                        ) : (
                          <Chip tone="emerald" dot>ativo</Chip>
                        )}
                      </td>

                      {/* Edit */}
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setEditing(u)}
                          className="p-1.5 rounded-lg text-zinc-500 hover:text-cyan-400 hover:bg-zinc-800 cursor-pointer transition-colors"
                        >
                          <Pencil size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <p className="py-12 text-center font-inconsolata text-sm text-zinc-600">
                Nenhum usuário encontrado.
              </p>
            )}
          </div>
        )}
      </Panel>

      <UserEditDrawer
        user={editing} open={!!editing}
        onClose={closeDrawer}
        onRequestDelete={(u) => { setDeleting(u); }}
      />
      <DeleteUserDialog
        user={deleting} open={!!deleting}
        onClose={() => setDeleting(null)}
      />

      {/* Modal de notificação */}
      <AdminModal open={notifOpen} onClose={() => setNotifOpen(false)} width={480}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h2 className="font-jaro text-lg text-white flex items-center gap-2">
            <MessageSquare size={18} className="text-cyan-400" />
            Notificar {selected.length} usuário(s)
          </h2>
          <button type="button" onClick={() => setNotifOpen(false)} className="text-zinc-500 hover:text-white cursor-pointer p-1">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <Field label="Título">
            <AdminInput
              value={notifTitulo}
              onChange={(e) => setNotifTitulo(e.target.value)}
              placeholder="Ex: Atualização do sistema"
              maxLength={100}
            />
          </Field>
          <Field label="Mensagem">
            <textarea
              value={notifCorpo}
              onChange={(e) => setNotifCorpo(e.target.value)}
              placeholder="Texto da notificação…"
              maxLength={500}
              rows={4}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 font-inconsolata text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-cyan-500/50 resize-none"
            />
            <p className="font-inconsolata text-[10px] text-zinc-600 text-right mt-1">
              {notifCorpo.length}/500
            </p>
          </Field>
          <div className="flex gap-2 pt-1">
            <Btn variant="ghost" className="flex-1 justify-center" onClick={() => setNotifOpen(false)}>
              Cancelar
            </Btn>
            <Btn
              variant="primary"
              icon={MessageSquare}
              className="flex-1 justify-center"
              onClick={handleNotify}
              disabled={sending || !notifTitulo.trim() || !notifCorpo.trim()}
            >
              {sending ? "Enviando…" : "Enviar"}
            </Btn>
          </div>
        </div>
      </AdminModal>
    </div>
  );
}
