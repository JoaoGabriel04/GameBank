import { AppError } from "../../middleware/error-handler.middleware.js";
import { emitToRoom } from "../../lib/socket.js";
import { mapa2dRepository } from "./mapa2d.repository.js";
import { economiaMapa2DService } from "./services/economia.service.js";
import { timerMapa2DService } from "./services/timer.service.js";
import { SALDO_INICIAL_MAPA2D } from "../../constants/economiaMapa2D.js";

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

class Mapa2DService {
  /** Cria os SessionTerreno para os 76 terrenos e sorteia 1 terreno grátis (categoria comum) por jogador. */
  async iniciarPartida(sessionId: number, playerIds: number[]) {
    const todosOsTerrenos = await mapa2dRepository.findTodosTerrenos();
    await mapa2dRepository.criarSessionTerrenos(
      todosOsTerrenos.map((t) => ({ sessionId, terrenoId: t.id }))
    );

    const terrenosComuns = await mapa2dRepository.findTerrenosPorCategoria("comum");
    const sorteados = shuffle(terrenosComuns).slice(0, playerIds.length);

    const { prisma } = await import("../../lib/prisma.js");
    for (let i = 0; i < playerIds.length; i++) {
      await prisma.sessionTerreno.updateMany({
        where: { sessionId, terrenoId: sorteados[i].id },
        data: { donoId: playerIds[i], precoPago: 0, adquiridoEm: new Date() },
      });
      await prisma.sessionPlayer.update({
        where: { id: playerIds[i] },
        data: { saldo: SALDO_INICIAL_MAPA2D },
      });
    }

    await mapa2dRepository.updateSession(sessionId, { rodadaAtual: 1 });
    await mapa2dRepository.criarHistorico(sessionId, "MAPA2D_INICIO", "Partida do Mapa 2D iniciada.");
    await timerMapa2DService.agendarFechamento(sessionId);
  }

  /** Fim de partida: vitória por patrimônio líquido apenas (sem Reputação — entra na Fatia 2). */
  async encerrarPartida(sessionId: number) {
    const { cancelFechamentoTimer } = await import("./services/timer.service.js");
    cancelFechamentoTimer(sessionId);

    const players = await mapa2dRepository.findPlayersAtivos(sessionId);
    const ranking = await Promise.all(
      players.map(async (p) => ({
        playerId: p.id,
        nome: p.nome,
        patrimonio: await economiaMapa2DService.calcularPatrimonioLiquido(sessionId, p.id),
      }))
    );
    ranking.sort((a, b) => b.patrimonio - a.patrimonio);

    await mapa2dRepository.updateSession(sessionId, { status: "Finalizada" });
    await mapa2dRepository.criarHistorico(
      sessionId,
      "MAPA2D_FIM_PARTIDA",
      ranking.length > 0 ? `Partida encerrada — vencedor: ${ranking[0].nome}` : "Partida encerrada sem jogadores ativos."
    );

    emitToRoom(sessionId, "mapa2d:partida_encerrada", { ranking });
    return { ranking };
  }

  /** Snapshot completo — usado em reconexão/F5. */
  async getEstado(sessionId: number, playerId: number) {
    const session = await mapa2dRepository.findSessionAtiva(sessionId);
    if (!session) throw new AppError(404, "Partida do Mapa 2D não encontrada ou não está em andamento.");

    await timerMapa2DService.garantirTimerAtivo(sessionId);

    const { prisma } = await import("../../lib/prisma.js");
    const [terrenos, jogadores] = await Promise.all([
      prisma.sessionTerreno.findMany({
        where: { sessionId },
        include: { terreno: true, construcao: true },
      }),
      mapa2dRepository.findPlayers(sessionId),
    ]);

    return {
      mesAtual: session.rodadaAtual,
      fecharMesEm: session.fecharMesEm,
      terrenos,
      jogadores,
      voceEId: playerId,
    };
  }
}

export const mapa2dService = new Mapa2DService();
