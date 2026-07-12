import { AppError } from "../../middleware/error-handler.middleware.js";
import { withLock } from "../../middleware/lock.middleware.js";
import { turnoRepository } from "./turno.repository.js";
import { sessionLogger } from "../../lib/logger.js";
import { TOTAL_CASAS, POS_PRISAO, CREDITO_INICIO, MULTA_PRISAO, getCasa, type Casa } from "../tabuleiro/tabuleiro.data.js";
import { PropriedadeRepository } from "../propriedade/propriedade.repository.js";
import { PropriedadeService } from "../propriedade/propriedade.service.js";
import { CartaService } from "../carta/carta.service.js";
import { IPTU_PCT, MANUTENCAO_PCT, RENDA_PASSIVA_PCT, HOTEL_EQUIVALE_CASAS, LEILAO_LANCE_MINIMO_PCT, LEILAO_TIMEOUT_MS } from "../../constants/economia.js";
import { getEvento, sortearEvento, EVENTO_DURACAO_RODADAS, type EventoEfeito } from "../../constants/eventos.js";
import { leilaoRepository } from "../leilao/leilao.repository.js";

export type ExtratoInicio = {
  creditoInicio: number;
  rendaPassiva: number;
  iptu: number;
  manutencao: number;
  liquido: number;
  detalhes: Array<{
    propId: number;
    nome: string;
    casas: number;
    iptu: number;
    manutencao: number;
    rendaPassiva: number;
  }>;
};

const propriedadeRepository = new PropriedadeRepository();
const propriedadeService = new PropriedadeService();
const cartaService = new CartaService();

const TURNO_TIMEOUT_MS = 60_000;

// Timers de turno em memória por sessionId. Como o dado é transitório
// (só importa "há um timer pendente agora") e a app roda como instância
// única no Render, não precisa de Redis — mesmo padrão de fallback em
// memória já usado em socket.ts (activeSockets).
const turnoTimers = new Map<number, NodeJS.Timeout>();

// Duplos consecutivos do jogador na vez atual — reseta a cada troca de
// turno. Em memória (mesmo racional dos timers): só importa "agora".
const duplosConsecutivos = new Map<number, number>();

function cancelTurnoTimer(sessionId: number) {
  const timer = turnoTimers.get(sessionId);
  if (timer) {
    clearTimeout(timer);
    turnoTimers.delete(sessionId);
  }
}

// Timer do leilão — mesmo racional/limitação do turnoTimers (em memória,
// por isso a varredura periódica de varrerLeiloesExpirados é obrigatória:
// sem ela, um leilão perdido por hibernação/restart trava a partida
// inteira, já que o turno não avança enquanto emLeilao for true).
const leilaoTimers = new Map<number, NodeJS.Timeout>();

function cancelLeilaoTimer(sessionId: number) {
  const timer = leilaoTimers.get(sessionId);
  if (timer) {
    clearTimeout(timer);
    leilaoTimers.delete(sessionId);
  }
}

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function parseOrdem(ordemTurnos: string | null): number[] {
  if (!ordemTurnos) return [];
  try {
    const parsed = JSON.parse(ordemTurnos);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

class TurnoService {
  // Chamado pelo SessionService.startSession quando tipoJogo === "tabuleiro".
  async iniciarTurnos(sessionId: number, jogadorIds: number[]) {
    const ordem = shuffle(jogadorIds);
    const primeiro = ordem[0] ?? null;

    await turnoRepository.updateTurno(sessionId, {
      ordemTurnos: JSON.stringify(ordem),
      turnoAtualPlayerId: primeiro,
      turnoIniciadoEm: primeiro ? new Date() : null,
      aguardandoAcao: false,
    });

    // Semeia o anúncio do primeiro evento — a rodada 1 já nasce como
    // "rodada de aviso" (sem evento ativo, anunciando o que vem na
    // rodada 2). Sem isso, a primeira virada de rodada não teria nada
    // pra promover a eventoAtual (ver processarViradaDeRodada).
    await turnoRepository.updateEvento(sessionId, { eventoProximo: sortearEvento().codigo });

    if (primeiro) await this.agendarTimeout(sessionId);
    return { ordem, turnoAtualPlayerId: primeiro };
  }

  async passarVez(sessionId: number, playerIdAtual: number) {
    return withLock(`turno:${sessionId}`, async () => {
      const session = await this.validarESessaoAtiva(sessionId);

      if (session.turnoAtualPlayerId !== playerIdAtual) {
        throw new AppError(403, "Não é sua vez de jogar.");
      }

      return this.avancarTurno(sessionId, session);
    });
  }

  async rolarDados(sessionId: number, playerId: number) {
    return withLock(`turno:${sessionId}`, async () => {
      const session = await this.validarESessaoAtiva(sessionId);

      if (session.turnoAtualPlayerId !== playerId) {
        throw new AppError(403, "Não é sua vez de jogar.");
      }
      if (session.aguardandoAcao) {
        throw new AppError(400, "Resolva a ação pendente antes de rolar os dados.");
      }
      // Não pode rolar de novo se já rolou e ainda não escolheu o movimento.
      if (session.aguardandoEscolha) {
        throw new AppError(400, "Escolha o movimento antes de rolar novamente.");
      }

      const player = await turnoRepository.findPlayerParaJogada(playerId);
      if (!player || player.sessionId !== sessionId) throw new AppError(404, "Jogador não encontrado");
      // Defesa em profundidade: turnoAtualPlayerId pode ficar apontando
      // (temporariamente) pra um jogador que acabou de desistir/ser
      // expulso na própria vez — bloqueia a rolagem mesmo que isso aconteça.
      if (player.desistiu) {
        throw new AppError(403, "Você já saiu desta partida.");
      }

      await this.aplicarJurosEmprestimo(sessionId, player.id);

      const falencia = await this.verificarFalencia(sessionId, session, player);
      if (falencia) return falencia;

      // PRISÃO: fluxo inalterado — não há escolha de movimento na prisão,
      // sempre vale a soma.
      if (player.emPrisao) {
        return this.rolarDadosEmPrisao(sessionId, session, player);
      }

      const dado1 = Math.floor(Math.random() * 6) + 1;
      const dado2 = Math.floor(Math.random() * 6) + 1;
      const duplo = dado1 === dado2;

      const contagemAnterior = duplosConsecutivos.get(playerId) ?? 0;
      const contagemAtual = duplo ? contagemAnterior + 1 : 0;
      duplosConsecutivos.set(playerId, contagemAtual);

      // 3 duplos seguidos → prisão direta, sem oferecer escolha de
      // movimento e sem jogar de novo.
      if (contagemAtual >= 3) {
        duplosConsecutivos.set(playerId, 0);
        await turnoRepository.moverPlayer(playerId, { posicao: POS_PRISAO, emPrisao: true, turnosPrisao: 3 });
        await turnoRepository.registrarDados(sessionId, {
          ultimoDado1: dado1, ultimoDado2: dado2,
          aguardandoAcao: false, aguardandoEscolha: false,
        });

        const avanco = await this.avancarTurno(sessionId, session);
        return { dado1, dado2, duplo: true, foiPreso: true, novaPosicao: POS_PRISAO, passouInicio: false, ...avanco };
      }

      // Guarda os dados e entra em estado de escolha — NÃO move ainda.
      await turnoRepository.registrarDados(sessionId, {
        ultimoDado1: dado1, ultimoDado2: dado2,
        aguardandoAcao: false, aguardandoEscolha: true,
      });

      // Reset do timer: o jogador tem os 60s para escolher o movimento.
      await this.agendarTimeout(sessionId);

      const { emitUpdatedSession } = await import("../socket/socket.handler.js");
      await emitUpdatedSession(sessionId);

      return {
        dado1, dado2, duplo,
        aguardandoEscolha: true,
        opcoes: this.calcularOpcoesMovimento(player.posicao, dado1, dado2),
      };
    });
  }

  /** Retorna as 3 opções de movimento com o destino de cada uma. */
  private calcularOpcoesMovimento(posAtual: number, dado1: number, dado2: number) {
    const montar = (passos: number, tipo: "dado1" | "dado2" | "soma") => {
      const destino = (posAtual + passos) % TOTAL_CASAS;
      const casa = getCasa(destino);
      return {
        tipo,
        passos,
        destino,
        nomeCasa: casa.nome,
        tipoCasa: casa.tipo,
        passaInicio: (posAtual + passos) >= TOTAL_CASAS,
      };
    };

    return [
      montar(dado1, "dado1"),
      montar(dado2, "dado2"),
      montar(dado1 + dado2, "soma"),
    ];
  }

  // Público, com lock — chamado pelo jogador via API.
  async escolherMovimento(
    sessionId: number,
    playerId: number,
    escolha: "dado1" | "dado2" | "soma"
  ) {
    return withLock(`turno:${sessionId}`, async () => {
      const session = await this.validarESessaoAtiva(sessionId);

      if (session.turnoAtualPlayerId !== playerId) {
        throw new AppError(403, "Não é sua vez de jogar.");
      }

      return this.escolherMovimentoInterno(sessionId, session, escolha);
    });
  }

  // Privado, SEM lock — chamado tanto por escolherMovimento (com lock
  // próprio) quanto por avancarPorTimeout (que já está dentro de um
  // withLock). Chamar escolherMovimento a partir de avancarPorTimeout
  // causaria deadlock (mesmo mutex de sessão, sem reentrância).
  private async escolherMovimentoInterno(
    sessionId: number,
    session: NonNullable<Awaited<ReturnType<typeof turnoRepository.findSessionComJogadores>>>,
    escolha: "dado1" | "dado2" | "soma",
    porTimeout = false
  ) {
    if (!session.aguardandoEscolha) {
      throw new AppError(400, "Não há escolha de movimento pendente.");
    }

    const playerId = session.turnoAtualPlayerId;
    if (!playerId) throw new AppError(400, "Nenhum jogador na vez.");

    const dado1 = session.ultimoDado1 ?? 0;
    const dado2 = session.ultimoDado2 ?? 0;
    if (!dado1 || !dado2) throw new AppError(400, "Dados não encontrados.");

    const player = await turnoRepository.findPlayerParaJogada(playerId);
    if (!player || player.sessionId !== sessionId) throw new AppError(404, "Jogador não encontrado");

    // Quantos passos, conforme a escolha
    const passos = escolha === "dado1" ? dado1
                 : escolha === "dado2" ? dado2
                 : dado1 + dado2;

    const duplo = dado1 === dado2;

    // ── REGRA CRÍTICA: duplo só concede nova jogada se escolher a SOMA ──
    // Senão seria abuso: escolher o dado menor E ainda jogar de novo.
    const duploValido = duplo && escolha === "soma";

    // Se o duplo NÃO for válido (escolheu dado avulso), zera a contagem
    // — não acumula para os 3 duplos.
    if (duplo && !duploValido) {
      duplosConsecutivos.set(playerId, 0);
    }

    // Sai do estado de escolha e entra em resolução
    await turnoRepository.registrarDados(sessionId, {
      aguardandoEscolha: false,
      aguardandoAcao: true,
    });

    const { novaPosicao, passouInicio, resolucao, extratoInicio } =
      await this.moverEResolver(sessionId, player, passos);

    // Avanço do turno: mesma lógica de antes, mas usando duploValido
    // e respeitando encerraVez (feriado/prisão encerram mesmo com duplo)
    const deveEncerrar = (!duploValido || resolucao.encerraVez) && !resolucao.aguardandoAcao;

    if (deveEncerrar) {
      const avanco = await this.avancarTurno(sessionId, session, porTimeout);
      return {
        dado1, dado2, duplo, duploValido, escolha, passos,
        foiPreso: false, novaPosicao, passouInicio,
        ...resolucao, ...avanco, extratoInicio,
      };
    }

    // Duplo válido ou ação pendente: não avança, reseta o timer
    await this.agendarTimeout(sessionId);
    const { emitUpdatedSession } = await import("../socket/socket.handler.js");
    await emitUpdatedSession(sessionId);

    return {
      dado1, dado2, duplo, duploValido, escolha, passos,
      foiPreso: false, novaPosicao, passouInicio,
      ...resolucao, extratoInicio,
    };
  }

  // Move o jogador `total` casas (com crédito de início + extrato de
  // IPTU/manutenção/renda passiva se aplicável) e dispara resolverCasa —
  // compartilhado entre a rolagem normal e a saída (com sucesso ou
  // forçada) da prisão.
  private async moverEResolver(
    sessionId: number,
    player: { id: number; nome: string; posicao: number; saldo: number; userId?: number | null },
    total: number,
    opts?: { creditarInicio?: boolean } // permite suprimir (ex: Vá para Prisão)
  ) {
    const novaPosicao = (player.posicao + total) % TOTAL_CASAS;
    const passouInicio = (player.posicao + total) >= TOTAL_CASAS;
    const deveCreditar = passouInicio && (opts?.creditarInicio ?? true);

    let saldoAtualizado = player.saldo;
    let extrato: ExtratoInicio | null = null;

    // Mover primeiro (posição sempre atualiza)
    await turnoRepository.moverPlayer(player.id, { posicao: novaPosicao });

    if (deveCreditar) {
      extrato = await this.calcularExtratoInicio(sessionId, player.id);

      if (extrato.liquido >= 0) {
        // Saldo positivo: credita direto
        saldoAtualizado = player.saldo + extrato.liquido;
        await turnoRepository.moverPlayer(player.id, { saldo: saldoAtualizado });

        await turnoRepository.criarHistorico({
          sessionId,
          tipo: "PASSAGEM_INICIO",
          detalhes: `${player.nome} passou pelo Início: +R$ ${extrato.creditoInicio} (crédito) ` +
                    `+R$ ${extrato.rendaPassiva} (renda passiva) ` +
                    `−R$ ${extrato.iptu} (IPTU) −R$ ${extrato.manutencao} (manutenção) ` +
                    `= R$ ${extrato.liquido >= 0 ? "+" : ""}${extrato.liquido}`,
        });
      } else {
        // Líquido negativo: credita o que recebe, cobra o que deve.
        // Usa cobrarComFallbackDivida (gera dívida se não tiver saldo, e
        // já integra com a regra de falência em 3 rodadas).
        const aReceber = extrato.creditoInicio + extrato.rendaPassiva;
        const aPagar = extrato.iptu + extrato.manutencao;

        // Credita primeiro
        const saldoComReceita = player.saldo + aReceber;
        await turnoRepository.moverPlayer(player.id, { saldo: saldoComReceita });

        // Depois cobra (pode gerar dívida)
        await this.cobrarComFallbackDivida(
          sessionId,
          { ...player, saldo: saldoComReceita },
          aPagar,
          null, // credor = banco
          `IPTU e manutenção (passagem pelo Início)`
        );

        // Recarrega saldo real após a cobrança
        const atualizado = await turnoRepository.findPlayer(player.id);
        saldoAtualizado = atualizado?.saldo ?? saldoComReceita;
      }

      // Notifica a sala com o extrato — o próprio jogador já recebe o
      // extrato completo na resposta HTTP da rolagem; este evento serve
      // pro toast curto dos demais jogadores.
      const { emitToRoom } = await import("../../lib/socket.js");
      emitToRoom(sessionId, "inicio:extrato", {
        playerId: player.id,
        playerUserId: player.userId ?? null,
        playerNome: player.nome,
        extrato,
      });
    }

    const resolucao = await this.resolverCasa(
      sessionId,
      { ...player, posicao: novaPosicao, saldo: saldoAtualizado },
      total
    );

    const { emitUpdatedSession } = await import("../socket/socket.handler.js");
    await emitUpdatedSession(sessionId);

    return { novaPosicao, passouInicio: deveCreditar, resolucao, extratoInicio: extrato };
  }

  // Rodadas 1-2 presas: 1 tentativa de duplo (falhou → turnosPrisao--,
  // permanece preso, turno acaba). Rodada 3 (turnosPrisao===1): até 3
  // tentativas na mesma vez; se as 3 falharem, paga a multa e sai.
  private async rolarDadosEmPrisao(
    sessionId: number,
    session: NonNullable<Awaited<ReturnType<typeof turnoRepository.findSessionComJogadores>>>,
    player: { id: number; nome: string; posicao: number; saldo: number; turnosPrisao: number; tentativasPrisao: number }
  ) {
    const dado1 = Math.floor(Math.random() * 6) + 1;
    const dado2 = Math.floor(Math.random() * 6) + 1;
    const duplo = dado1 === dado2;
    await turnoRepository.registrarDados(sessionId, { ultimoDado1: dado1, ultimoDado2: dado2, aguardandoAcao: false });

    if (duplo) {
      await turnoRepository.moverPlayer(player.id, { emPrisao: false, turnosPrisao: 0, tentativasPrisao: 0 });
      await turnoRepository.setAguardandoAcao(sessionId, false);
      await this.agendarTimeout(sessionId);
      const { emitUpdatedSession } = await import("../socket/socket.handler.js");
      await emitUpdatedSession(sessionId);
      // Sai da prisão mas permanece na casa Prisão (pos 10) — ganha outra
      // jogada (duplo=true → rolarDados não avança o turno).
      return { dado1, dado2, duplo: true, escapouPrisao: true, novaPosicao: player.posicao, passouInicio: false, aguardandoAcao: false };
    }

    const ultimaRodada = player.turnosPrisao <= 1;

    if (!ultimaRodada) {
      await turnoRepository.moverPlayer(player.id, { turnosPrisao: player.turnosPrisao - 1 });
      const avanco = await this.avancarTurno(sessionId, session);
      return { dado1, dado2, duplo: false, escapouPrisao: false, aindaPreso: true, ...avanco };
    }

    const tentativas = player.tentativasPrisao + 1;
    if (tentativas < 3) {
      await turnoRepository.moverPlayer(player.id, { tentativasPrisao: tentativas });
      await this.agendarTimeout(sessionId);
      const { emitUpdatedSession } = await import("../socket/socket.handler.js");
      await emitUpdatedSession(sessionId);
      return { dado1, dado2, duplo: false, escapouPrisao: false, aindaPreso: true, tentativasPrisao: tentativas };
    }

    // 3ª tentativa falhou — paga a multa e sai sem andar, encerra a vez
    await this.cobrarComFallbackDivida(
      sessionId, player, MULTA_PRISAO, null, `Multa de R$ ${MULTA_PRISAO} — não conseguiu sair da prisão`
    );
    await turnoRepository.moverPlayer(player.id, { emPrisao: false, turnosPrisao: 0, tentativasPrisao: 0 });

    const avanco = await this.avancarTurno(sessionId, session);
    return {
      dado1, dado2, duplo: false, escapouPrisao: true, pagouMulta: true,
      novaPosicao: player.posicao, passouInicio: false, ...avanco,
    };
  }

  private async aplicarJurosEmprestimo(sessionId: number, playerId: number) {
    const { EmprestimoService } = await import("../emprestimo/emprestimo.service.js");
    const emprestimoService = new EmprestimoService();
    return emprestimoService.aplicarJurosEmprestimo(sessionId, playerId);
  }

  private async verificarFalencia(
    sessionId: number,
    session: NonNullable<Awaited<ReturnType<typeof turnoRepository.findSessionComJogadores>>>,
    player: { id: number; nome: string }
  ) {
    const { prisma } = await import("../../lib/prisma.js");
    const dividaAtiva = await prisma.debt.findFirst({ where: { sessionId, playerId: player.id, pago: false } });
    if (!dividaAtiva) return null;

    const atual = await prisma.sessionPlayer.findUnique({ where: { id: player.id }, select: { rodadasDevendo: true, saldo: true } });
    const rodadas = (atual?.rodadasDevendo ?? 0) + 1;

    if (rodadas < 3) {
      await prisma.sessionPlayer.update({ where: { id: player.id }, data: { rodadasDevendo: rodadas } });
      return null;
    }

    // Calcula patrimônio antes de limpar (para ranking)
    const posses = await prisma.sessionPosses.findMany({
      where: { sessionId, playerId: player.id },
      include: { propriedade: true },
    });
    let patrimony = atual?.saldo ?? 0;
    for (const sp of posses) {
      if (sp.propriedade) {
        patrimony += sp.propriedade.custo_compra;
        patrimony += sp.casas * sp.propriedade.custo_casa;
      }
    }

    // ── ANTES da falência limpar as propriedades, executar a garantia ──
    const { EmprestimoService } = await import("../emprestimo/emprestimo.service.js");
    const emprestimoService = new EmprestimoService();
    await emprestimoService.executarGarantia(sessionId, player.id);

    // Falência: propriedades voltam ao banco (sem dono, sem leilão),
    // jogador marcado como falido e removido dos turnos.
    await prisma.$transaction(async (tx) => {
      await tx.sessionPlayer.update({
        where: { id: player.id },
        data: { patrimonyAtDesistir: patrimony },
      });
      // Devolve ao banco tanto as propriedades que o jogador possuía quanto
      // as que ele tinha hipotecado (essas ficam com playerId nulo desde a
      // hipoteca — só rastreadas por lastOwnerId — por isso precisam entrar
      // na busca separadamente, senão continuam hipotecadas indefinidamente
      // presas a um jogador que já saiu da partida).
      await tx.sessionPosses.updateMany({
        where: { sessionId, OR: [{ playerId: player.id }, { lastOwnerId: player.id }] },
        data: { playerId: null, lastOwnerId: null, casas: 0, hipotecada: false, negociando: false },
      });
      await tx.sessionPlayer.update({
        where: { id: player.id },
        data: { saldo: 0, desistiu: true, motivoDesistencia: "FALENCIA", desistiuEm: new Date(), rodadasDevendo: 0 },
      });
      await tx.historico.create({
        data: { sessionId, data: new Date(), tipo: "FALENCIA", detalhes: `${player.nome} faliu — 3 rodadas sem quitar dívidas.` },
      });
    });

    const avanco = await this.avancarTurno(sessionId, session);

    return {
      falido: true,
      mensagem: `${player.nome} faliu após 3 rodadas sem quitar as dívidas — propriedades voltaram ao banco.`,
      ...avanco,
    };
  }

  // Dispara automaticamente após o movimento (Fase 6). Resolve o que
  // acontece ao parar na casa; casas que exigem decisão do jogador
  // (comprar propriedade sem dono) deixam aguardandoAcao=true.
  private async resolverCasa(
    sessionId: number,
    player: { id: number; nome: string; posicao: number; saldo: number },
    numDados: number
  ) {
    const casa = getCasa(player.posicao);
    const mods = await this.getModificadores(sessionId);
    let aguardandoAcao = false;
    let compraDisponivel: { propId: number; sessionPossesId: number; nome: string; preco: number } | undefined;
    let mensagem = "";
    // BUG 4 (TABULEIRO_FIXES): casas que encerram a vez mesmo com duplo —
    // Feriado (pula a próxima rodada) e qualquer evento que prenda o
    // jogador nesta jogada (Vá para a Detenção, carta de Sorte/Revés de
    // prisão). Preso ou de folga não joga de novo só porque tirou duplo.
    let encerraVez = false;

    switch (casa.tipo) {
      case "propriedade":
      case "acao": {
        if (casa.propId == null) break;
        const posse = await propriedadeRepository.findSessionPosses(sessionId, casa.propId);
        if (!posse || !posse.propriedade) break;

        if (!posse.playerId) {
          aguardandoAcao = true;
          compraDisponivel = {
            propId: casa.propId,
            sessionPossesId: posse.id,
            nome: posse.propriedade.nome,
            preco: posse.propriedade.custo_compra,
          };
        } else if (posse.playerId !== player.id && !posse.hipotecada && posse.player) {
          const valor = casa.tipo === "acao"
            ? Math.round(500 * numDados * (mods.acoesMult ?? 1))
            : Math.round(this.calcularAluguel(posse.propriedade, posse.casas) * (mods.aluguelMult ?? 1));
          // Preso não recebe aluguel — o pagador não paga nada
          if (posse.player.emPrisao) {
            mensagem = `${posse.player.nome} está na prisão e não pode receber aluguel — ${player.nome} não pagou.`;
          } else {
            const r = await this.cobrarComFallbackDivida(
              sessionId, player, valor, posse.player,
              `Aluguel de R$ ${valor} em ${posse.propriedade.nome}`
            );
            mensagem = r.debtCriada
              ? `${player.nome} pagou R$ ${r.pago} e ficou devendo R$ ${r.debtValor} de aluguel em ${posse.propriedade.nome}.`
              : `${player.nome} pagou R$ ${valor} de aluguel em ${posse.propriedade.nome}.`;
            const { emitToRoom } = await import("../../lib/socket.js");
            emitToRoom(sessionId, "aluguel:toast", {
              fromPlayerNome: player.nome,
              toPlayerId: posse.player.id,
              toUserId: posse.player.userId,
              valor,
              propriedadeNome: posse.propriedade.nome,
            });
          }
        }
        break;
      }

      case "noticias": {
        const sorteio = await cartaService.sortearCarta(sessionId, player.id);
        mensagem = sorteio.effectDescription;
        if (sorteio.carta.tipo === "prisao") {
          await turnoRepository.moverPlayer(player.id, { posicao: POS_PRISAO, emPrisao: true, turnosPrisao: 3 });
          encerraVez = true;
        }
        // Broadcast pra todo mundo ver a carta sorteada — mesmo evento que
        // o botão manual "Sortear" do Modo Banca já emite (carta.controller).
        const { emitToRoom } = await import("../../lib/socket.js");
        emitToRoom(sessionId, "card:drawn", {
          playerNome: player.nome,
          playerId: player.id,
          tipoBaralho: sorteio.tipoBaralho,
          carta: sorteio.carta,
          effectDescription: sorteio.effectDescription,
          ...(sorteio.debtCreated ? { debtCreated: true, debtValor: sorteio.debtValor } : {}),
        });
        break;
      }

      case "restituicao": {
        const valor = casa.valor ?? 2000;
        await turnoRepository.moverPlayer(player.id, { saldo: player.saldo + valor });
        await turnoRepository.criarHistorico({ sessionId, tipo: "RESTITUICAO", detalhes: `${player.nome} recebeu R$ ${valor} de restituição do IR.` });
        mensagem = `${player.nome} recebeu R$ ${valor} de restituição.`;
        break;
      }

      case "imposto": {
        const valor = casa.valor ?? 2000;
        const r = await this.cobrarComFallbackDivida(sessionId, player, valor, null, `Imposto de R$ ${valor} (Receita Federal)`);
        mensagem = r.debtCriada
          ? `${player.nome} pagou R$ ${r.pago} de imposto e ficou devendo R$ ${r.debtValor}.`
          : `${player.nome} pagou R$ ${valor} de imposto.`;
        break;
      }

      case "feriado": {
        await turnoRepository.moverPlayer(player.id, { pularProximaRodada: true });
        mensagem = `${player.nome} caiu no Feriado e vai pular a próxima rodada.`;
        encerraVez = true;
        break;
      }

      case "va_para_prisao": {
        await turnoRepository.moverPlayer(player.id, { posicao: POS_PRISAO, emPrisao: true, turnosPrisao: 3 });
        mensagem = `${player.nome} foi direto para a prisão.`;
        encerraVez = true;
        break;
      }

      case "prisao_visita":
      case "inicio":
      default:
        break;
    }

    await turnoRepository.setAguardandoAcao(sessionId, aguardandoAcao);

    return { casa, aguardandoAcao, compraDisponivel, mensagem: mensagem || undefined, encerraVez };
  }

  // Processa a virada de rodada: ciclo de 3 rodadas — 1 de aviso (sem
  // evento ativo, eventoProximo anunciado) + EVENTO_DURACAO_RODADAS (2)
  // rodadas com o evento ativo. Máquina de estados baseada em
  // eventoRodadasRestantes (quantas rodadas o eventoAtual ainda dura),
  // não em aritmética sobre o número da rodada — assim o evento pode
  // durar mais de 1 rodada sem precisar recalcular a partir de rodadaAtual.
  private async processarViradaDeRodada(
    sessionId: number,
    novaRodada: number,
    session: { eventoAtual?: string | null; eventoProximo?: string | null; eventoRodadasRestantes?: number | null }
  ) {
    const restantes = session.eventoRodadasRestantes ?? 0;

    let eventoAtivo: string | null;
    let novasRestantes: number;
    let eventoProximo: string | null;
    let eventoRecemAtivado = false;
    // Continuação pura (evento já ativo, só decrementando) não muda nada
    // que o cliente precise saber além do que a sessão já carrega — sem
    // este flag, o modal de ativação reapareceria a cada rodada em que o
    // evento (agora com 2 rodadas de duração) segue ativo.
    let houveTransicao = true;

    if (session.eventoAtual && restantes > 1) {
      // Evento em curso, ainda tem rodada(s) sobrando — continua igual.
      eventoAtivo = session.eventoAtual;
      novasRestantes = restantes - 1;
      eventoProximo = null;
      houveTransicao = false;
    } else if (session.eventoAtual) {
      // Evento acabou de esgotar as rodadas — esta é a rodada de aviso:
      // sem evento ativo, sorteia e anuncia o próximo.
      eventoAtivo = null;
      novasRestantes = 0;
      eventoProximo = sortearEvento(session.eventoAtual).codigo;
    } else if (session.eventoProximo) {
      // Estávamos na rodada de aviso — o evento anunciado agora começa.
      eventoAtivo = session.eventoProximo;
      novasRestantes = EVENTO_DURACAO_RODADAS;
      eventoProximo = null;
      eventoRecemAtivado = true;
    } else {
      // Sem evento e sem aviso pendente (não deveria acontecer após o
      // bootstrap em iniciarTurnos, mas não deixa a sessão travada).
      eventoAtivo = null;
      novasRestantes = 0;
      eventoProximo = null;
    }

    await turnoRepository.updateEvento(sessionId, {
      eventoAtual: eventoAtivo,
      eventoProximo,
      eventoRodadasRestantes: novasRestantes,
    });

    const def = getEvento(eventoAtivo);
    if (eventoRecemAtivado && def?.efeito.creditoImediato) {
      await turnoRepository.creditarTodosAtivos(sessionId, def.efeito.creditoImediato);
    }

    if (eventoRecemAtivado) {
      await turnoRepository.criarHistorico({
        sessionId,
        tipo: "EVENTO_ECONOMICO",
        detalhes: `Rodada ${novaRodada}: ${def?.nome} — ${def?.descricao}`,
      });
    }

    // Só notifica em transições reais (evento ativou ou virou aviso) —
    // continuação pura não emite, pra não reabrir o modal de ativação
    // a cada rodada em que o mesmo evento segue valendo.
    if (houveTransicao) {
      const { emitToRoom } = await import("../../lib/socket.js");
      emitToRoom(sessionId, "evento:mudou", {
        rodada: novaRodada,
        eventoAtual: eventoAtivo,
        eventoProximo,
      });
    }
  }

  // Busca os multiplicadores do evento econômico ativo na sessão (evento
  // nenhum → objeto vazio, todos os multiplicadores tratados como 1/0
  // pelos callers). Público — reutilizado por propriedade.service.ts para
  // o custo de construção via getEvento (import puro, sem circularidade).
  async getModificadores(sessionId: number): Promise<EventoEfeito> {
    const session = await turnoRepository.findEventoAtual(sessionId);
    return getEvento(session?.eventoAtual)?.efeito ?? {};
  }

  // Calcula o extrato completo (crédito do Início, renda passiva, IPTU e
  // manutenção de todas as propriedades do jogador) para a passagem pelo
  // Início. Hipotecadas e ações (grupo Preto) ficam de fora.
  private async calcularExtratoInicio(sessionId: number, playerId: number): Promise<ExtratoInicio> {
    const posses = await propriedadeRepository.findSessionPossesByPlayer(sessionId, playerId);
    const mods = await this.getModificadores(sessionId);

    let iptu = 0;
    let manutencao = 0;
    let rendaPassiva = 0;
    const detalhes: ExtratoInicio["detalhes"] = [];

    for (const posse of posses) {
      const prop = posse.propriedade;
      if (!prop) continue;

      // Hipotecada não paga IPTU/manutenção nem gera renda — está com o banco.
      if (posse.hipotecada) continue;
      // Ações (grupo Preto) não têm IPTU/manutenção nem renda passiva.
      if (prop.tipo === "ação") continue;

      const casas = posse.casas ?? 0;
      const casasEquivalentes = casas >= 5 ? HOTEL_EQUIVALE_CASAS : casas;

      const propIptu = Math.round(prop.custo_compra * IPTU_PCT * (mods.iptuMult ?? 1));
      const propManut = Math.round(prop.custo_casa * MANUTENCAO_PCT * casasEquivalentes * (mods.manutencaoMult ?? 1));
      const aluguelAtual = this.calcularAluguel(prop, casas);
      const propRenda = Math.round(aluguelAtual * RENDA_PASSIVA_PCT * (mods.rendaPassivaMult ?? 1));

      iptu += propIptu;
      manutencao += propManut;
      rendaPassiva += propRenda;

      detalhes.push({
        propId: prop.id,
        nome: prop.nome,
        casas,
        iptu: propIptu,
        manutencao: propManut,
        rendaPassiva: propRenda,
      });
    }

    const liquido = CREDITO_INICIO + rendaPassiva - iptu - manutencao;

    return { creditoInicio: CREDITO_INICIO, rendaPassiva, iptu, manutencao, liquido, detalhes };
  }

  private calcularAluguel(prop: { aluguel_base: number; aluguel_1c: number; aluguel_2c: number; aluguel_3c: number; aluguel_4c: number; aluguel_hotel: number }, casas: number) {
    switch (casas) {
      case 0: return prop.aluguel_base ?? 0;
      case 1: return prop.aluguel_1c ?? prop.aluguel_base ?? 0;
      case 2: return prop.aluguel_2c ?? prop.aluguel_1c ?? prop.aluguel_base ?? 0;
      case 3: return prop.aluguel_3c ?? prop.aluguel_2c ?? prop.aluguel_1c ?? prop.aluguel_base ?? 0;
      case 4: return prop.aluguel_4c ?? prop.aluguel_3c ?? prop.aluguel_2c ?? prop.aluguel_base ?? 0;
      default: return prop.aluguel_hotel ?? prop.aluguel_4c ?? prop.aluguel_base ?? 0;
    }
  }

  // Cobra valor do pagador; se saldo insuficiente, paga o que dá e cria
  // Debt pelo restante (mesmo padrão já usado em carta.service.ts pra
  // pagamentos automáticos do banco). credor=null → dinheiro vai pro banco.
  private async cobrarComFallbackDivida(
    sessionId: number,
    pagador: { id: number; nome: string; saldo: number },
    valor: number,
    credor: { id: number; nome: string; saldo: number } | null,
    descricao: string
  ) {
    const pago = Math.min(pagador.saldo, valor);
    const debtValor = valor - pago;

    await turnoRepository.moverPlayer(pagador.id, { saldo: pagador.saldo - pago });
    if (credor) {
      // Se o pagador não tem saldo suficiente, o banco cobre a diferença
      // para que o proprietário receba o aluguel integral.
      await turnoRepository.moverPlayer(credor.id, { saldo: credor.saldo + valor });
    }

    if (debtValor > 0) {
      await turnoRepository.criarDivida({ sessionId, playerId: pagador.id, valor: debtValor, descricao: `${descricao} (dívida)` });
    }

    await turnoRepository.criarHistorico({
      sessionId,
      tipo: credor ? "PAGAMENTO_ALUGUEL" : "IMPOSTO",
      detalhes: `${pagador.nome} pagou R$ ${pago}${debtValor > 0 ? ` e ficou devendo R$ ${debtValor} (banco cobriu o restante para ${credor?.nome ?? ""})` : ""} — ${descricao}.`,
    });

    return { pago, debtCriada: debtValor > 0, debtValor };
  }

  async comprarCasaAtual(sessionId: number, playerId: number) {
    return withLock(`turno:${sessionId}`, async () => {
      const session = await this.validarPendenciaDeCompra(sessionId, playerId);
      const casa = getCasa(session.posicaoJogador);
      if (casa.propId == null) throw new AppError(400, "Não há nada pra comprar nesta casa.");

      const resultado = await propriedadeService.buyProp(casa.propId, sessionId, playerId);
      await turnoRepository.setAguardandoAcao(sessionId, false);

      const foiDuplo = session.ultimoDado1 != null && session.ultimoDado1 === session.ultimoDado2;
      if (!foiDuplo) {
        const avanco = await this.avancarTurno(sessionId, session);
        return { ...resultado, ...avanco };
      }

      await this.agendarTimeout(sessionId);
      const { emitUpdatedSession } = await import("../socket/socket.handler.js");
      await emitUpdatedSession(sessionId);
      return { ...resultado, turnoAtualPlayerId: session.turnoAtualPlayerId, avancou: false, duplo: true };
    });
  }

  async recusarCompra(sessionId: number, playerId: number) {
    return withLock(`turno:${sessionId}`, async () => {
      const session = await this.validarPendenciaDeCompra(sessionId, playerId);
      await turnoRepository.setAguardandoAcao(sessionId, false);

      const casa = getCasa(session.posicaoJogador);
      if (casa.propId == null) {
        // Nada a leiloar (não deveria acontecer — validarPendenciaDeCompra
        // já exige aguardandoAcao — mas defensivamente cai no comportamento
        // antigo em vez de travar o turno).
        return this.finalizarRecusaSemLeilao(sessionId, session);
      }

      // Recusar dispara o Leilão Cego — pausa o turno até o leilão fechar.
      return this.iniciarLeilao(sessionId, session, casa.propId);
    });
  }

  private async finalizarRecusaSemLeilao(
    sessionId: number,
    session: NonNullable<Awaited<ReturnType<typeof turnoRepository.findSessionComJogadores>>>
  ) {
    const foiDuplo = session.ultimoDado1 != null && session.ultimoDado1 === session.ultimoDado2;
    if (!foiDuplo) {
      const avanco = await this.avancarTurno(sessionId, session);
      return { recusado: true, ...avanco };
    }

    await this.agendarTimeout(sessionId);
    const { emitUpdatedSession } = await import("../socket/socket.handler.js");
    await emitUpdatedSession(sessionId);
    return { recusado: true, turnoAtualPlayerId: session.turnoAtualPlayerId, avancou: false, duplo: true };
  }

  // Leilão Cego (Mecânica 4): abre o leilão para todos os jogadores ativos.
  // PAUSA o turno — o timer de turno é cancelado e só retoma quando o
  // leilão fechar (encerrarLeilaoInterno). Lock já é o de `turno:${id}`
  // (herdado de recusarCompra) — iniciarLeilao NUNCA adquire o lock de
  // leilão, só o darLance/encerrarLeilaoPorTimeout fazem isso.
  private async iniciarLeilao(
    sessionId: number,
    session: NonNullable<Awaited<ReturnType<typeof turnoRepository.findSessionComJogadores>>>,
    propId: number
  ) {
    const posse = await propriedadeRepository.findSessionPosses(sessionId, propId);
    if (!posse?.propriedade) {
      return this.finalizarRecusaSemLeilao(sessionId, session);
    }

    const lanceMinimo = Math.round(posse.propriedade.custo_compra * LEILAO_LANCE_MINIMO_PCT);

    // Pausa o timer do turno — o leilão tem timer próprio (30s).
    cancelTurnoTimer(sessionId);

    await turnoRepository.updateLeilao(sessionId, {
      emLeilao: true,
      leilaoPropId: propId,
      leilaoIniciadoEm: new Date(),
      leilaoLanceMinimo: lanceMinimo,
    });

    // Limpa lances antigos desta propriedade (segurança — ex.: um leilão
    // anterior para a mesma prop que não tenha limpado corretamente).
    await leilaoRepository.limparLances(sessionId, propId);

    // Agenda o encerramento em 30s (timer resiliente — ver agendarTimeoutLeilao)
    await this.agendarTimeoutLeilao(sessionId);

    const { emitToRoom } = await import("../../lib/socket.js");
    emitToRoom(sessionId, "leilao:iniciado", {
      propId,
      nome: posse.propriedade.nome,
      precoTabela: posse.propriedade.custo_compra,
      lanceMinimo,
      timeoutMs: LEILAO_TIMEOUT_MS,
    });

    const { emitUpdatedSession } = await import("../socket/socket.handler.js");
    await emitUpdatedSession(sessionId);

    return { recusado: true, leilaoIniciado: true, propId, lanceMinimo };
  }

  async usarCartaPrisao(sessionId: number, playerId: number) {
    return withLock(`turno:${sessionId}`, async () => {
      const session = await this.validarESessaoAtiva(sessionId);
      if (session.turnoAtualPlayerId !== playerId) throw new AppError(403, "Não é sua vez de jogar.");

      const player = await turnoRepository.findPlayerParaJogada(playerId);
      if (!player || player.sessionId !== sessionId) throw new AppError(404, "Jogador não encontrado");
      if (player.desistiu) throw new AppError(403, "Você já saiu desta partida.");
      if (!player.emPrisao) throw new AppError(400, "Você não está na prisão.");

      const mensagem = await cartaService.usarCartaPrisao(sessionId, playerId);
      await turnoRepository.moverPlayer(playerId, { emPrisao: false, turnosPrisao: 0, tentativasPrisao: 0 });

      const { emitUpdatedSession } = await import("../socket/socket.handler.js");
      await emitUpdatedSession(sessionId);

      return { mensagem };
    });
  }

  private async validarPendenciaDeCompra(sessionId: number, playerId: number) {
    const session = await this.validarESessaoAtiva(sessionId);
    if (session.turnoAtualPlayerId !== playerId) throw new AppError(403, "Não é sua vez de jogar.");
    if (!session.aguardandoAcao) throw new AppError(400, "Não há nenhuma compra pendente.");

    const player = await turnoRepository.findPlayerParaJogada(playerId);
    if (!player || player.sessionId !== sessionId) throw new AppError(404, "Jogador não encontrado");
    if (player.desistiu) throw new AppError(403, "Você já saiu desta partida.");

    return { ...session, posicaoJogador: player.posicao };
  }

  // ═══════════════════ Leilão Cego (Mecânica 4) ═══════════════════════
  //
  // Lock PRÓPRIO (`leilao:${id}`) — NUNCA aninhado com `turno:${id}`.
  // iniciarLeilao/encerrarLeilaoInterno rodam dentro do lock de turno
  // (herdado de recusarCompra/avancarPorTimeout); darLance e
  // encerrarLeilaoPorTimeout rodam dentro do lock de leilão. Os dois
  // nunca se chamam um ao outro dentro do lock errado — deadlock evitado
  // por construção.

  async darLance(sessionId: number, playerId: number, valor: number) {
    return withLock(`leilao:${sessionId}`, async () => {
      const session = await turnoRepository.findSessionComJogadores(sessionId);
      if (!session?.emLeilao || session.leilaoPropId == null) {
        throw new AppError(400, "Não há leilão em andamento.");
      }

      const player = await turnoRepository.findPlayerParaJogada(playerId);
      if (!player || player.sessionId !== sessionId || player.desistiu) {
        throw new AppError(403, "Você não participa desta sessão.");
      }

      // Lance é VINCULANTE — não pode mudar de ideia depois de dar.
      const existente = await leilaoRepository.findLance(sessionId, session.leilaoPropId, playerId);
      if (existente) throw new AppError(400, "Você já deu seu lance neste leilão.");

      // valor 0 = passou (não quer participar)
      if (valor > 0) {
        const minimo = session.leilaoLanceMinimo ?? 0;
        if (valor < minimo) {
          throw new AppError(400, `O lance mínimo é R$ ${minimo}.`);
        }
        if (valor > player.saldo) {
          throw new AppError(400, "Você não tem saldo suficiente para esse lance.");
        }
      }

      await leilaoRepository.criarLance({
        sessionId, propId: session.leilaoPropId, playerId, valor,
      });

      // SIGILO: nunca inclui o valor — só avisa que o jogador decidiu.
      const { emitToRoom } = await import("../../lib/socket.js");
      emitToRoom(sessionId, "leilao:jogador_decidiu", { playerId });

      // Se todos os jogadores ativos já deram lance, encerra antes do timeout.
      const ativos = await leilaoRepository.contarJogadoresAtivos(sessionId);
      const lances = await leilaoRepository.contarLances(sessionId, session.leilaoPropId);

      if (lances >= ativos) {
        return this.encerrarLeilaoInterno(sessionId, session);
      }

      return { lanceRegistrado: true };
    });
  }

  // Privado — chamado de dentro do lock de leilão (darLance,
  // encerrarLeilaoPorTimeout). Nunca adquire o lock de turno.
  private async encerrarLeilaoInterno(
    sessionId: number,
    session: NonNullable<Awaited<ReturnType<typeof turnoRepository.findSessionComJogadores>>>
  ) {
    const propId = session.leilaoPropId;
    if (propId == null) return null;

    cancelLeilaoTimer(sessionId);

    const lances = await leilaoRepository.findLances(sessionId, propId);
    const validos = lances.filter(l => l.valor > 0);

    let vencedor: { playerId: number; valor: number } | null = null;

    if (validos.length > 0) {
      const maiorValor = Math.max(...validos.map(l => l.valor));
      const empatados = validos.filter(l => l.valor === maiorValor);

      if (empatados.length === 1) {
        vencedor = { playerId: empatados[0].playerId, valor: maiorValor };
      } else {
        // ── DESEMPATE: menor patrimônio leva (mecânica de catch-up) ──
        const patrimonios = await Promise.all(
          empatados.map(async l => ({
            playerId: l.playerId,
            patrimonio: await this.calcularPatrimonio(l.playerId),
          }))
        );
        patrimonios.sort((a, b) => a.patrimonio - b.patrimonio);
        vencedor = { playerId: patrimonios[0].playerId, valor: maiorValor };
      }
    }

    if (vencedor) {
      // Lance VINCULANTE: o vencedor é obrigado a comprar, pelo valor do
      // lance (não o de tabela).
      await propriedadeService.buyPropPorValor(propId, sessionId, vencedor.playerId, vencedor.valor);

      await turnoRepository.criarHistorico({
        sessionId,
        tipo: "LEILAO",
        detalhes: `Leilão encerrado: propriedade arrematada por R$ ${vencedor.valor}`,
      });
    } else {
      await turnoRepository.criarHistorico({
        sessionId,
        tipo: "LEILAO",
        detalhes: `Leilão encerrado sem lances — propriedade segue sem dono.`,
      });
    }

    // Limpa o estado de leilão
    await turnoRepository.updateLeilao(sessionId, {
      emLeilao: false,
      leilaoPropId: null,
      leilaoIniciadoEm: null,
      leilaoLanceMinimo: null,
    });
    await leilaoRepository.limparLances(sessionId, propId);

    // Revela TODOS os lances (agora sim — momento de tensão do leilão cego)
    const { emitToRoom } = await import("../../lib/socket.js");
    emitToRoom(sessionId, "leilao:resultado", {
      propId,
      lances: lances.map(l => ({ playerId: l.playerId, valor: l.valor })),
      vencedorId: vencedor?.playerId ?? null,
      valorFinal: vencedor?.valor ?? null,
    });

    // ── RETOMAR O TURNO ──────────────────────────────────────────────
    // O jogador que recusou continua na vez (a menos que tenha tirado
    // duplo, caso em que joga de novo; senão o turno avança).
    const foiDuplo = session.ultimoDado1 != null && session.ultimoDado1 === session.ultimoDado2;
    const { emitUpdatedSession } = await import("../socket/socket.handler.js");

    if (!foiDuplo) {
      const sessionAtual = await turnoRepository.findSessionComJogadores(sessionId);
      const avanco = await this.avancarTurno(sessionId, sessionAtual!);
      await emitUpdatedSession(sessionId);
      return { leilaoEncerrado: true, vencedor, ...avanco };
    }

    // Duplo: o mesmo jogador joga de novo — reagenda o timer do turno.
    await this.agendarTimeout(sessionId);
    await emitUpdatedSession(sessionId);
    return { leilaoEncerrado: true, vencedor, avancou: false, duplo: true };
  }

  // Reutiliza o mesmo cálculo usado na falência (saldo + custo_compra das
  // propriedades + casas × custo_casa) — aqui para o desempate do leilão.
  private async calcularPatrimonio(playerId: number): Promise<number> {
    const { prisma } = await import("../../lib/prisma.js");
    const player = await prisma.sessionPlayer.findUnique({ where: { id: playerId }, select: { saldo: true } });
    const posses = await prisma.sessionPosses.findMany({
      where: { playerId },
      include: { propriedade: true },
    });
    let patrimonio = player?.saldo ?? 0;
    for (const sp of posses) {
      if (sp.propriedade) {
        patrimonio += sp.propriedade.custo_compra;
        patrimonio += sp.casas * sp.propriedade.custo_casa;
      }
    }
    return patrimonio;
  }

  private async agendarTimeoutLeilao(sessionId: number) {
    cancelLeilaoTimer(sessionId);
    const timer = setTimeout(() => {
      this.encerrarLeilaoPorTimeout(sessionId).catch(err => {
        sessionLogger.error({ err, sessionId }, "erro ao encerrar leilão por timeout");
      });
    }, LEILAO_TIMEOUT_MS);
    leilaoTimers.set(sessionId, timer);
  }

  // Ponto de entrada do timeout — adquire o lock de LEILÃO (nunca o de
  // turno). Quem não deu lance a tempo conta implicitamente como "passou"
  // (não há registro — encerrarLeilaoInterno só considera quem deu lance).
  async encerrarLeilaoPorTimeout(sessionId: number) {
    return withLock(`leilao:${sessionId}`, async () => {
      const session = await turnoRepository.findSessionComJogadores(sessionId);
      if (!session?.emLeilao) return null; // já encerrado por outro caminho
      return this.encerrarLeilaoInterno(sessionId, session);
    });
  }

  // Varredura periódica (mesmo padrão do BUG 6 / varrerTurnosExpirados):
  // sem isso, um leilão cujo timer em memória se perdeu (hibernação/
  // restart do processo) trava a partida inteira, já que o turno não
  // avança enquanto emLeilao for true. Chamada no mesmo intervalo de 15s.
  async varrerLeiloesExpirados() {
    const sessions = await turnoRepository.findSessionsEmLeilao();
    const agora = Date.now();

    for (const s of sessions) {
      if (!s.leilaoIniciadoEm) continue;
      const elapsed = agora - new Date(s.leilaoIniciadoEm).getTime();

      if (elapsed >= LEILAO_TIMEOUT_MS + 2000) {
        sessionLogger.warn({ sessionId: s.id, elapsed }, "leilão expirado detectado pela varredura periódica");
        await this.encerrarLeilaoPorTimeout(s.id).catch(err => {
          if (err?.statusCode !== 423) {
            sessionLogger.error({ err, sessionId: s.id }, "erro ao encerrar leilão na varredura periódica");
          }
        });
      }
    }
  }

  // Disparado pelo timeout de 60s — se o jogador não agiu, o sistema
  // joga automaticamente: rola os dados, move a peça, recusa compras,
  // paga aluguéis/dívidas e avança o turno.
  //
  // BUG 6, Parte C (idempotência): `turnoEsperadoIniciadoEm` é o
  // turnoIniciadoEm que estava vigente quando ESTE timeout foi agendado.
  // Com timer em memória + varredura periódica + re-agendamento no join,
  // mais de um caminho pode tentar avançar o mesmo turno expirado (ex.:
  // o timer perdido dispara tarde, ao mesmo tempo em que a varredura ou
  // um F5 já avançaram). Se o turno já mudou desde o agendamento, este
  // disparo é obsoleto — ignorar em vez de avançar de novo (o que pularia
  // um jogador). Chamadas sem esse parâmetro (varredura, recuperação no
  // boot) não têm essa garantia extra, mas o lock por sessionId já evita
  // execução concorrente entre elas.
  async avancarPorTimeout(sessionId: number, turnoEsperadoIniciadoEm?: string) {
    return withLock(`turno:${sessionId}`, async () => {
      const session = await turnoRepository.findSessionComJogadores(sessionId);
      if (!session || session.status !== "Em Andamento" || session.tipoJogo !== "tabuleiro") {
        cancelTurnoTimer(sessionId);
        return null;
      }

      // Leilão em andamento: o turno está pausado de propósito (o timer
      // de turno já foi cancelado em iniciarLeilao). O leilão tem seu
      // próprio timer/varredura — não interferir aqui.
      if (session.emLeilao) {
        cancelTurnoTimer(sessionId);
        return null;
      }

      if (
        turnoEsperadoIniciadoEm &&
        session.turnoIniciadoEm?.toISOString() !== turnoEsperadoIniciadoEm
      ) {
        sessionLogger.info(
          { sessionId, esperado: turnoEsperadoIniciadoEm, atual: session.turnoIniciadoEm },
          "avancarPorTimeout ignorado — turno já avançou por outro caminho"
        );
        return { avancou: false, motivo: "turno já avançou" };
      }

      // Escolha de movimento pendente → tempo esgotado, aplica a SOMA
      // (comportamento clássico). Chama a versão interna (sem lock) —
      // já estamos dentro do withLock deste método, e escolherMovimento
      // público tem o seu próprio (chamá-lo aqui causaria deadlock).
      if (session.aguardandoEscolha && session.turnoAtualPlayerId) {
        sessionLogger.info(
          { sessionId, playerId: session.turnoAtualPlayerId },
          "timeout na escolha de movimento — usando a soma (padrão)"
        );
        return this.escolherMovimentoInterno(sessionId, session, "soma", true);
      }

      // Ação pendente (compra de propriedade) expirou — o jogador JÁ tinha
      // rolado os dados; só não respondeu ao modal de comprar/recusar.
      // Resolve isso como recusa automática (mesmo caminho de
      // recusarCompra, inclusive leilão) e retorna aqui — NUNCA cai no
      // fallback de "rolar os dados automaticamente" abaixo, que é só
      // para quando o jogador nem chegou a rolar.
      if (session.aguardandoAcao) {
        await turnoRepository.setAguardandoAcao(sessionId, false);

        const atualAcao = session.jogadores.find(j => j.id === session.turnoAtualPlayerId);
        if (!atualAcao || atualAcao.desistiu) {
          return this.avancarTurno(sessionId, session, true);
        }
        const playerAcao = await turnoRepository.findPlayerParaJogada(atualAcao.id);
        if (!playerAcao || playerAcao.sessionId !== sessionId) {
          return this.avancarTurno(sessionId, session, true);
        }

        const casaAcao = getCasa(playerAcao.posicao);
        if (casaAcao.propId == null) {
          return this.avancarTurno(sessionId, session, true);
        }
        // iniciarLeilao pausa o turno (não chama avancarTurno) — a
        // retomada acontece quando o leilão fechar.
        return this.iniciarLeilao(sessionId, session, casaAcao.propId);
      }

      const atual = session.jogadores.find(j => j.id === session.turnoAtualPlayerId);
      if (!atual || atual.desistiu) {
        return this.avancarTurno(sessionId, session, true);
      }

      await this.aplicarJurosEmprestimo(sessionId, atual.id);

      // Verifica falência do jogador que perdeu o tempo
      const falencia = await this.verificarFalencia(sessionId, session, { id: atual.id, nome: atual.nome });
      if (falencia) return falencia;

      // Busca dados completos do jogador (posicao, saldo, prisao, etc.)
      const player = await turnoRepository.findPlayerParaJogada(atual.id);
      if (!player || player.sessionId !== sessionId) {
        return this.avancarTurno(sessionId, session, true);
      }

      if (player.emPrisao) {
        // Turno na prisão: decrementa o contador; no último turno paga a multa
        if (player.turnosPrisao > 1) {
          await turnoRepository.moverPlayer(player.id, { turnosPrisao: player.turnosPrisao - 1 });
        } else {
          await this.cobrarComFallbackDivida(
            sessionId, { id: player.id, nome: player.nome, saldo: player.saldo },
            MULTA_PRISAO, null,
            `Multa de R$ ${MULTA_PRISAO} — não conseguiu sair da prisão`
          );
          await turnoRepository.moverPlayer(player.id, { emPrisao: false, turnosPrisao: 0, tentativasPrisao: 0 });
        }
      } else {
        // Rola os dados automaticamente
        const dado1 = Math.floor(Math.random() * 6) + 1;
        const dado2 = Math.floor(Math.random() * 6) + 1;
        const total = dado1 + dado2;

        await turnoRepository.registrarDados(sessionId, {
          ultimoDado1: dado1, ultimoDado2: dado2, aguardandoAcao: false,
        });

        // Move e resolve a casa (paga aluguel, sorteia carta, etc.)
        await this.moverEResolver(sessionId, player, total);
      }

      // Sempre avança o turno no timeout (sem bônus de duplos)
      return this.avancarTurno(sessionId, session, true);
    });
  }

  private async validarESessaoAtiva(sessionId: number) {
    const session = await turnoRepository.findSessionComJogadores(sessionId);
    if (!session) throw new AppError(404, "Sessão não encontrada");
    if (session.tipoJogo !== "tabuleiro") throw new AppError(400, "Sessão não é do Modo Tabuleiro");
    if (session.status !== "Em Andamento") throw new AppError(400, "Partida não está em andamento");
    // Leilão em andamento: bloqueia qualquer ação de turno (rolar dados,
    // escolher movimento, passar a vez, comprar/recusar). Sem este guard,
    // um cliente poderia chamar essas rotas — protegidas pelo lock
    // `turno:${id}` — enquanto encerrarLeilaoInterno roda sob o lock
    // `leilao:${id}` (namespaces diferentes, sem exclusão mútua entre
    // eles), correndo o risco de avançar o turno duas vezes ou mover o
    // jogador errado.
    if (session.emLeilao) {
      throw new AppError(400, "Há um leilão em andamento — aguarde o resultado.");
    }

    // Fallback: se o timer do servidor não disparou, avança o turno na
    // primeira ação do jogador após o timeout (emLeilao já foi rejeitado
    // acima, então chegar aqui garante que o turno não está pausado).
    if (session.turnoIniciadoEm && !session.aguardandoAcao) {
      const elapsed = Date.now() - new Date(session.turnoIniciadoEm).getTime();
      if (elapsed >= TURNO_TIMEOUT_MS) {
        await this.avancarTurno(sessionId, session, true);
        throw new AppError(400, "Tempo da rodada expirou. Turno avançado automaticamente.");
      }
    }

    return session;
  }

  private async avancarTurno(
    sessionId: number,
    session: NonNullable<Awaited<ReturnType<typeof turnoRepository.findSessionComJogadores>>>,
    porTimeout = false
  ) {
    const ordem = parseOrdem(session.ordemTurnos);
    if (ordem.length === 0) throw new AppError(400, "Ordem de turnos não definida");

    const jogadoresPorId = new Map(session.jogadores.map(j => [j.id, j]));
    const atualIdx = ordem.indexOf(session.turnoAtualPlayerId ?? -1);

    let proximo: { id: number; pularProximaRodada: boolean } | null = null;
    for (let step = 1; step <= ordem.length; step++) {
      const idx = (atualIdx + step) % ordem.length;
      const candidato = jogadoresPorId.get(ordem[idx]);
      if (!candidato || candidato.desistiu) continue;

      if (candidato.pularProximaRodada) {
        await turnoRepository.clearPularProximaRodada(candidato.id);
        continue; // pula a vez dele, mas ele já não pula a próxima
      }

      proximo = candidato;
      break;
    }

    // Turno de quem estava jogando terminou — zera contagem de duplos dele
    if (session.turnoAtualPlayerId != null) {
      duplosConsecutivos.delete(session.turnoAtualPlayerId);
      propriedadeService.limparConstrucoesTurno(sessionId, session.turnoAtualPlayerId);
    }

    // Ninguém mais ativo para jogar (edge case — o fluxo normal já
    // encerraria a partida antes disso via votação/falência)
    if (!proximo) {
      cancelTurnoTimer(sessionId);
      return { turnoAtualPlayerId: session.turnoAtualPlayerId, avancou: false };
    }

    // Rodada: incrementa quando o turno passa do último para o primeiro
    // da ordem (detectado pelo índice na ordem ser ≤ que o anterior)
    const proximoIdx = ordem.indexOf(proximo.id);
    if (session.turnoAtualPlayerId != null && proximoIdx <= atualIdx) {
      const novaRodada = session.rodadaAtual + 1;
      await turnoRepository.incrementRodada(sessionId);
      await this.processarViradaDeRodada(sessionId, novaRodada, session);
    }

    await turnoRepository.updateTurno(sessionId, {
      turnoAtualPlayerId: proximo.id,
      turnoIniciadoEm: new Date(),
      aguardandoAcao: false,
    });

    await this.agendarTimeout(sessionId);

    const { emitUpdatedSession } = await import("../socket/socket.handler.js");
    await emitUpdatedSession(sessionId);

    if (porTimeout) {
      const { emitTurnoTimeout } = await import("../socket/socket.handler.js");
      emitTurnoTimeout(sessionId, { jogadorAnteriorId: session.turnoAtualPlayerId });
    }

    return { turnoAtualPlayerId: proximo.id, avancou: true };
  }

  private async agendarTimeout(sessionId: number) {
    cancelTurnoTimer(sessionId);
    // Atualiza turnoIniciadoEm para o cliente reiniciar o contador
    const agora = new Date();
    try { await turnoRepository.updateTurno(sessionId, { turnoIniciadoEm: agora }); } catch {}
    const esperadoIso = agora.toISOString();
    const timer = setTimeout(async () => {
      try {
        await this.avancarPorTimeout(sessionId, esperadoIso);
      } catch (err: any) {
        if (err?.statusCode === 423) {
          // Lock ocupado — retenta
          this.agendarTimeout(sessionId);
        } else {
          sessionLogger.error({ err, sessionId }, "erro ao avançar turno por timeout");
        }
      }
    }, TURNO_TIMEOUT_MS);
    turnoTimers.set(sessionId, timer);
  }

  cancelarTimeout(sessionId: number) {
    cancelTurnoTimer(sessionId);
  }

  // BUG 6, Parte B: chamado quando um socket entra na room da sessão (F5,
  // reconexão, novo jogador entrando). Se o processo perdeu o timer em
  // memória (hibernação/restart), este é o caminho mais rápido de
  // recuperação — não precisa esperar a varredura periódica (até 15-17s).
  // Sessões com ação pendente (aguardandoAcao) ficam por conta da
  // varredura periódica, que já cobre esse caso.
  async garantirTimerAtivo(sessionId: number) {
    if (turnoTimers.has(sessionId)) return; // já tem timer rodando

    const session = await turnoRepository.findSessionComJogadores(sessionId);
    if (!session || session.status !== "Em Andamento" || session.tipoJogo !== "tabuleiro") return;
    if (session.emLeilao) return; // turno pausado de propósito — leilão tem timer próprio
    if (!session.turnoIniciadoEm || session.aguardandoAcao) return;

    const elapsed = Date.now() - new Date(session.turnoIniciadoEm).getTime();
    const restante = TURNO_TIMEOUT_MS - elapsed;

    if (restante <= 0) {
      // Já expirou — avançar imediatamente em vez de esperar a varredura
      await this.avancarPorTimeout(sessionId).catch(err => {
        if (err?.statusCode !== 423) {
          sessionLogger.error({ err, sessionId }, "erro ao avançar turno expirado no re-agendamento");
        }
      });
      return;
    }

    // Re-agenda pelo tempo restante, preservando o turnoIniciadoEm atual
    // (não reseta o contador visível ao jogador).
    const esperadoIso = new Date(session.turnoIniciadoEm).toISOString();
    const timer = setTimeout(async () => {
      try {
        await this.avancarPorTimeout(sessionId, esperadoIso);
      } catch (err: any) {
        if (err?.statusCode === 423) {
          this.agendarTimeout(sessionId);
        } else {
          sessionLogger.error({ err, sessionId }, "erro ao avançar turno por timeout (re-agendado)");
        }
      }
    }, restante);
    turnoTimers.set(sessionId, timer);
  }

  async recoverStuckSessions() {
    const sessions = await turnoRepository.findSessionsStuck();
    const now = Date.now();
    for (const s of sessions) {
      if (!s.turnoIniciadoEm) continue;
      const elapsed = now - new Date(s.turnoIniciadoEm).getTime();
      if (elapsed >= TURNO_TIMEOUT_MS) {
        sessionLogger.warn({ sessionId: s.id, elapsed }, "recuperando sessão travada no startup");
        await this.avancarPorTimeout(s.id).catch(err => {
          sessionLogger.error({ err, sessionId: s.id }, "erro ao recuperar sessão travada");
        });
      }
    }

    // Leilão Cego: recuperação imediata no startup (a periódica de 15s já
    // cobre isso, mas o timeout do leilão é só 30s — vale a pena não
    // esperar o primeiro ciclo da varredura).
    const emLeilao = await turnoRepository.findSessionsEmLeilao();
    for (const s of emLeilao) {
      if (!s.leilaoIniciadoEm) continue;
      const elapsed = now - new Date(s.leilaoIniciadoEm).getTime();
      if (elapsed >= LEILAO_TIMEOUT_MS) {
        sessionLogger.warn({ sessionId: s.id, elapsed }, "recuperando leilão travado no startup");
        await this.encerrarLeilaoPorTimeout(s.id).catch(err => {
          sessionLogger.error({ err, sessionId: s.id }, "erro ao recuperar leilão travado");
        });
      }
    }
  }

  // Varredura periódica (BUG 6): os timers de turno vivem em memória do
  // processo — se o servidor hibernar/reiniciar (Render free tier) no meio
  // de uma partida, o setTimeout agendado é perdido e ninguém avança o
  // turno automaticamente. Diferente de recoverStuckSessions (só no boot),
  // esta varredura roda a cada 15s enquanto o processo está de pé, usando
  // turnoIniciadoEm (persistido no banco) como fonte de verdade — nunca
  // depende do timer em memória ter sobrevivido.
  //
  // Margem de +2s sobre o timeout normal: evita competir com o setTimeout
  // in-memory que dispara exatamente em TURNO_TIMEOUT_MS quando ele está
  // saudável (a varredura só deve agir quando o timer normal falhou).
  async varrerTurnosExpirados() {
    const sessions = await turnoRepository.findSessionsStuck();
    const agora = Date.now();

    for (const s of sessions) {
      if (!s.turnoIniciadoEm) continue;
      const elapsed = agora - new Date(s.turnoIniciadoEm).getTime();

      if (elapsed >= TURNO_TIMEOUT_MS + 2000) {
        sessionLogger.warn({ sessionId: s.id, elapsed }, "turno expirado detectado pela varredura periódica");
        await this.avancarPorTimeout(s.id).catch(err => {
          // 423 = lock ocupado (outra ação concorrente já está resolvendo
          // este turno) — não é erro, só significa que já está sendo tratado.
          if (err?.statusCode !== 423) {
            sessionLogger.error({ err, sessionId: s.id }, "erro ao avançar turno na varredura periódica");
          }
        });
      }
    }
  }
}

export const turnoService = new TurnoService();
