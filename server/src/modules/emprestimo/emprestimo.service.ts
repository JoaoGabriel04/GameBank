import { EmprestimoRepository } from "./emprestimo.repository.js";
import { PropriedadeRepository } from "../propriedade/propriedade.repository.js";
import { turnoRepository } from "../turno/turno.repository.js";
import { AppError } from "../../middleware/error-handler.middleware.js";
import { withLock } from "../../middleware/lock.middleware.js";
import { EMPRESTIMO_LIMITE_PCT, EMPRESTIMO_JUROS_PCT, RENDA_PASSIVA_PCT } from "../../constants/economia.js";
import { getEvento } from "../../constants/eventos.js";
import { calcularAluguel, calcularPatrimonio } from "../../shared/economia-core.js";

export class EmprestimoService {
  constructor(
    private repo = new EmprestimoRepository(),
    private propRepo = new PropriedadeRepository()
  ) {}

  async calcularLimiteCredito(sessionId: number, playerId: number): Promise<number> {
    const posses = await this.propRepo.findSessionPossesByPlayer(sessionId, playerId);

    // Garantia elegível: só propriedades não hipotecadas contam pro limite.
    const valorTotal = calcularPatrimonio(0, posses.filter(p => !p.hipotecada));

    return Math.floor(valorTotal * EMPRESTIMO_LIMITE_PCT);
  }

  async getLimite(sessionId: number, playerId: number) {
    const limite = await this.calcularLimiteCredito(sessionId, playerId);
    const garantia = await this.escolherGarantia(sessionId, playerId);
    const ativo = await this.repo.findAtivo(sessionId, playerId);

    const projecao: { rodada: number; valor: number }[] = [];
    if (limite > 0) {
      let valor = limite;
      for (let r = 1; r <= 7; r++) {
        valor = Math.round(valor * (1 + EMPRESTIMO_JUROS_PCT));
        projecao.push({ rodada: r, valor });
      }
    }

    return {
      limite,
      garantia: garantia
        ? { propId: garantia.propriedade.id, nome: garantia.propriedade.nome, casas: garantia.casas ?? 0 }
        : null,
      temEmprestimoAtivo: !!ativo,
      emprestimoAtivo: ativo ? { valorDevido: ativo.valorDevido, valorOriginal: ativo.valorOriginal } : null,
      jurosPct: EMPRESTIMO_JUROS_PCT,
      projecao,
    };
  }

  private async escolherGarantia(sessionId: number, playerId: number) {
    const posses = await this.propRepo.findSessionPossesByPlayer(sessionId, playerId);

    let melhor: { posse: typeof posses[number]; renda: number } | null = null;

    for (const posse of posses) {
      const prop = posse.propriedade;
      if (!prop || posse.hipotecada) continue;

      const casas = posse.casas ?? 0;

      let aluguel: number;
      if (prop.tipo === "ação") {
        aluguel = 500 * 7;
      } else {
        aluguel = calcularAluguel(prop, casas);
      }

      const rendaPassiva = Math.round(aluguel * RENDA_PASSIVA_PCT);
      const rendaTotal = aluguel + rendaPassiva;

      if (!melhor || rendaTotal > melhor.renda) {
        melhor = { posse, renda: rendaTotal };
      }
    }

    return melhor?.posse ?? null;
  }

  async pegarEmprestimo(sessionId: number, playerId: number, valor: number) {
    return withLock(`emprestimo:${sessionId}:${playerId}`, async () => {
      const { prisma } = await import("../../lib/prisma.js");

      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        select: { id: true, status: true, tipoJogo: true },
      });
      if (!session) throw new AppError(404, "Sessão não encontrada");
      if (session.tipoJogo !== "tabuleiro") throw new AppError(400, "Empréstimos são exclusivos do Modo Tabuleiro.");
      if (session.status !== "Em Andamento") throw new AppError(400, "Partida não está em andamento.");

      const ativo = await this.repo.findAtivo(sessionId, playerId);
      if (ativo) {
        throw new AppError(400, "Você já tem um empréstimo ativo. Quite-o antes de pegar outro.");
      }

      const limite = await this.calcularLimiteCredito(sessionId, playerId);
      if (limite <= 0) {
        throw new AppError(400, "Você não tem propriedades livres para dar como garantia.");
      }
      if (valor <= 0) throw new AppError(400, "Valor inválido.");
      if (valor > limite) {
        throw new AppError(400, `Seu limite de crédito é R$ ${limite.toLocaleString("pt-BR")}.`);
      }

      const garantia = await this.escolherGarantia(sessionId, playerId);
      if (!garantia) {
        throw new AppError(400, "Você não tem propriedades livres para dar como garantia.");
      }

      await prisma.$transaction(async (tx) => {
        await tx.sessionPlayer.update({
          where: { id: playerId },
          data: { saldo: { increment: valor } },
        });

        await tx.emprestimo.create({
          data: {
            sessionId, playerId,
            valorOriginal: valor,
            valorDevido: valor,
            garantiaPropId: garantia.propriedade.id,
          },
        });
      });

      await turnoRepository.criarHistorico({
        sessionId,
        tipo: "EMPRESTIMO",
        detalhes: `Empréstimo de R$ ${valor} — garantia: ${garantia.propriedade.nome}`,
      });

      const { emitUpdatedSession } = await import("../socket/socket.handler.js");
      await emitUpdatedSession(sessionId);

      return {
        valor,
        garantia: {
          propId: garantia.propriedade.id,
          nome: garantia.propriedade.nome,
        },
        jurosPct: EMPRESTIMO_JUROS_PCT,
      };
    });
  }

  async aplicarJurosEmprestimo(sessionId: number, playerId: number) {
    const emp = await this.repo.findAtivo(sessionId, playerId);
    if (!emp) return null;

    const mods = await this.getModificadores(sessionId);
    const jurosPct = EMPRESTIMO_JUROS_PCT * (mods.jurosMult ?? 1);

    const novoDevido = Math.round(emp.valorDevido * (1 + jurosPct));

    await this.repo.atualizarDevido(emp.id, novoDevido);

    const { emitToRoom } = await import("../../lib/socket.js");
    emitToRoom(sessionId, "emprestimo:juros", {
      playerId,
      valorAnterior: emp.valorDevido,
      valorAtual: novoDevido,
      jurosPct,
    });

    return { valorDevido: novoDevido };
  }

  private async getModificadores(sessionId: number) {
    const session = await turnoRepository.findEventoAtual(sessionId);
    return getEvento(session?.eventoAtual)?.efeito ?? {};
  }

  async quitarEmprestimo(sessionId: number, playerId: number) {
    return withLock(`emprestimo:${sessionId}:${playerId}`, async () => {
      const emp = await this.repo.findAtivo(sessionId, playerId);
      if (!emp) throw new AppError(400, "Você não tem empréstimo ativo.");

      const { prisma } = await import("../../lib/prisma.js");
      const player = await prisma.sessionPlayer.findUnique({
        where: { id: playerId },
        select: { id: true, saldo: true, nome: true },
      });
      if (!player) throw new AppError(404, "Jogador não encontrado.");

      if (player.saldo < emp.valorDevido) {
        throw new AppError(
          400,
          `Saldo insuficiente. Você precisa de R$ ${emp.valorDevido.toLocaleString("pt-BR")}.`
        );
      }

      await prisma.$transaction(async (tx) => {
        await tx.sessionPlayer.update({
          where: { id: playerId },
          data: { saldo: { decrement: emp.valorDevido } },
        });
        await tx.emprestimo.update({
          where: { id: emp.id },
          data: { quitado: true, quitadoEm: new Date() },
        });
      });

      await turnoRepository.criarHistorico({
        sessionId,
        tipo: "EMPRESTIMO_QUITADO",
        detalhes: `Empréstimo quitado por R$ ${emp.valorDevido}`,
      });

      const { emitUpdatedSession } = await import("../socket/socket.handler.js");
      await emitUpdatedSession(sessionId);

      return { quitado: true, valorPago: emp.valorDevido };
    });
  }

  async executarGarantia(sessionId: number, playerId: number) {
    const emp = await this.repo.findAtivo(sessionId, playerId);
    if (!emp) return;

    const { prisma } = await import("../../lib/prisma.js");
    await prisma.$transaction(async (tx) => {
      // Busca a propriedade-garantia para saber o grupo de cor
      const garantia = await tx.sessionPosses.findFirst({
        where: { sessionId, propId: emp.garantiaPropId },
        include: { propriedade: true },
      });

      if (garantia?.propriedade) {
        // Outras propriedades do mesmo grupo que o jogador possui com casas
        const irmaos = await tx.sessionPosses.findMany({
          where: {
            sessionId,
            playerId,
            propriedade: { grupo_cor: garantia.propriedade.grupo_cor },
            casas: { gt: 0 },
          },
          include: { propriedade: true },
        });

        const afetados = irmaos.filter(p => p.propId !== emp.garantiaPropId);
        if (afetados.length > 0) {
          let refundTotal = 0;
          const nomes: string[] = [];
          for (const posse of afetados) {
            refundTotal += posse.casas * posse.propriedade.custo_casa;
            nomes.push(`${posse.casas} casa(s) de ${posse.propriedade.nome}`);
          }

          await tx.sessionPosses.updateMany({
            where: {
              sessionId,
              playerId,
              propId: { in: afetados.map(p => p.propId) },
            },
            data: { casas: 0 },
          });

          await tx.sessionPlayer.update({
            where: { id: playerId },
            data: { saldo: { increment: refundTotal } },
          });

          await tx.historico.create({
            data: {
              sessionId,
              data: new Date(),
              tipo: "VENDA_CASA_GARANTIA",
              detalhes: `Venda automática de ${nomes.join(", ")} — monopólio perdido com a execução da garantia.`,
            },
          });
        }
      }

      await tx.sessionPosses.updateMany({
        where: { sessionId, propId: emp.garantiaPropId, playerId },
        data: { playerId: null, casas: 0, hipotecada: false, negociando: false },
      });

      await tx.emprestimo.update({
        where: { id: emp.id },
        data: { executado: true, quitado: true, quitadoEm: new Date() },
      });
    });

    await turnoRepository.criarHistorico({
      sessionId,
      tipo: "GARANTIA_EXECUTADA",
      detalhes: `Garantia executada: o banco tomou a propriedade do empréstimo não pago.`,
    });

    const { emitToRoom } = await import("../../lib/socket.js");
    emitToRoom(sessionId, "emprestimo:garantia_executada", {
      playerId,
      propId: emp.garantiaPropId,
    });
  }

  async verificarPropriedadeEmGarantia(sessionId: number, playerId: number, propId: number) {
    const emp = await this.repo.findAtivoPorPropriedade(sessionId, playerId, propId);
    if (emp) {
      throw new AppError(400, "Esta propriedade está dada como garantia de um empréstimo.");
    }
  }
}
