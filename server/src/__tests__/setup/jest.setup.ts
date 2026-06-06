// Roda antes de CADA arquivo de teste.
import { prisma } from "../../lib/prisma.js";

// GUARDA DE SEGURANÇA: nunca rodar deleteMany contra dev/prod.
if (!/gamebank_test/.test(process.env.DATABASE_URL ?? "")) {
  throw new Error(
    "ABORT: DATABASE_URL não aponta para o banco de teste (gamebank_test). " +
      "Recusando-se a limpar tabelas para proteger dev/prod."
  );
}

// Limpa o banco entre arquivos de teste, respeitando as foreign keys reais.
// Dados globais de jogo (propriedades, posses base, cartas, missões, loja,
// banners) NÃO são apagados — apenas dados de usuário/sessão.
beforeEach(async () => {
  await prisma.negotiationItem.deleteMany();
  await prisma.negotiation.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.message.deleteMany();
  await prisma.debt.deleteMany();
  await prisma.sessionPosses.deleteMany();
  await prisma.historico.deleteMany();
  await prisma.gameResult.deleteMany();
  await prisma.coinTransaction.deleteMany();
  await prisma.diamondTransaction.deleteMany();
  await prisma.userMission.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.userNotification.deleteMany();
  await prisma.sessionPlayer.deleteMany();
  await prisma.sessionTeam.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});
