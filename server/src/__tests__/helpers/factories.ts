// Factories de dados de teste — adaptadas ao schema REAL do GameBank.
// Diferenças vs. exemplos genéricos: campo `passwordHash` (não `password`),
// `bcryptjs` (não `bcrypt`), Session usa `ownerId` (não `hostId`) e status
// "Em Andamento". A "moeda de jogo" fica em SessionPlayer.saldo; `coins` é a
// moeda de perfil (loja/recompensas).
import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma.js";
import { signToken } from "../../lib/jwt.js";

let emailSeq = 0;

export async function criarUsuario(
  overrides: Partial<{
    nome: string;
    email: string;
    coins: number;
    xp: number;
    level: number;
    isAdmin: boolean;
  }> = {}
) {
  const passwordHash = await bcrypt.hash("senha123", 10);
  emailSeq += 1;
  return prisma.user.create({
    data: {
      nome: overrides.nome ?? "Jogador Teste",
      email: overrides.email ?? `teste_${Date.now()}_${emailSeq}@gamebank.com`,
      passwordHash,
      coins: overrides.coins ?? 1000,
      xp: overrides.xp ?? 0,
      level: overrides.level ?? 1,
      isAdmin: overrides.isAdmin ?? false,
    },
  });
}

export async function criarSessao(
  ownerId: number,
  overrides: Partial<{
    status: string;
    startedAt: Date;
    modo: string;
    saldoInicial: number;
    maxJogadores: number;
    rewardGranted: boolean;
  }> = {}
) {
  return prisma.session.create({
    data: {
      ownerId,
      status: overrides.status ?? "Em Andamento",
      startedAt: overrides.startedAt ?? new Date(),
      rewardGranted: overrides.rewardGranted ?? false,
      modo: overrides.modo ?? "individual",
      saldoInicial: overrides.saldoInicial ?? 25000,
      maxJogadores: overrides.maxJogadores ?? 6,
    },
  });
}

export async function criarPlayer(
  sessionId: number,
  userId: number | null,
  overrides: Partial<{ nome: string; cor: string; saldo: number }> = {}
) {
  return prisma.sessionPlayer.create({
    data: {
      sessionId,
      userId: userId ?? undefined,
      nome: overrides.nome ?? "Player",
      cor: overrides.cor ?? "Azul",
      saldo: overrides.saldo ?? 25000,
    },
  });
}

// JWT de teste — payload idêntico ao de produção ({ userId, email, isAdmin }).
export function gerarToken(user: { id: number; email: string; isAdmin?: boolean }) {
  return signToken({ userId: user.id, email: user.email, isAdmin: user.isAdmin ?? false });
}
