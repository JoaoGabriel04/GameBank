import { turnoRepository } from "../turno.repository.js";
import { PropriedadeRepository } from "../../propriedade/propriedade.repository.js";
import { CartaService } from "../../carta/carta.service.js";
import { POS_PRISAO, MULTA_PRISAO, getCasa } from "../../tabuleiro/tabuleiro.data.js";
import { calcularAluguel, aplicarMod } from "../../../shared/economia-core.js";
import type { EventoEfeito } from "../../../constants/eventos.js";
import { economiaService } from "./economia.service.js";

const propriedadeRepository = new PropriedadeRepository();
const cartaService = new CartaService();

class CasaResolverService {
  // Dispara automaticamente após o movimento. Resolve o que acontece ao
  // parar na casa; casas que exigem decisão do jogador (comprar
  // propriedade sem dono) deixam aguardandoAcao=true.
  // `mods` é buscado uma vez pelo orquestrador e repassado.
  async resolverCasa(
    sessionId: number,
    player: { id: number; nome: string; posicao: number; saldo: number },
    numDados: number,
    mods: EventoEfeito
  ) {
    const casa = getCasa(player.posicao);
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
            ? aplicarMod(500 * numDados, mods.acoesMult)
            : aplicarMod(calcularAluguel(posse.propriedade, posse.casas), mods.aluguelMult);
          // Preso não recebe aluguel — o pagador não paga nada
          if (posse.player.emPrisao) {
            mensagem = `${posse.player.nome} está na prisão e não pode receber aluguel — ${player.nome} não pagou.`;
          } else {
            const r = await economiaService.cobrarComFallbackDivida(
              sessionId, player, valor, posse.player,
              `Aluguel de R$ ${valor} em ${posse.propriedade.nome}`
            );
            mensagem = r.debtCriada
              ? `${player.nome} pagou R$ ${r.pago} e ficou devendo R$ ${r.debtValor} de aluguel em ${posse.propriedade.nome}.`
              : `${player.nome} pagou R$ ${valor} de aluguel em ${posse.propriedade.nome}.`;
            const { emitToRoom } = await import("../../../lib/socket.js");
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
        const { emitToRoom } = await import("../../../lib/socket.js");
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
        const r = await economiaService.cobrarComFallbackDivida(sessionId, player, valor, null, `Imposto de R$ ${valor} (Receita Federal)`);
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

  // Rodadas 1-2 presas: 1 tentativa de duplo (falhou → turnosPrisao--,
  // permanece preso, turno acaba). Rodada 3 (turnosPrisao===1): até 3
  // tentativas na mesma vez; se as 3 falharem, paga a multa e sai.
  // `session` é repassado só para alimentar o avancarTurno do orquestrador
  // (importado dinamicamente aqui — back-edge, evita ciclo estático com
  // turno.service, que por sua vez importa este serviço estaticamente).
  async rolarDadosEmPrisao(
    sessionId: number,
    session: unknown,
    player: { id: number; nome: string; posicao: number; saldo: number; turnosPrisao: number; tentativasPrisao: number }
  ) {
    const dado1 = Math.floor(Math.random() * 6) + 1;
    const dado2 = Math.floor(Math.random() * 6) + 1;
    const duplo = dado1 === dado2;
    await turnoRepository.registrarDados(sessionId, { ultimoDado1: dado1, ultimoDado2: dado2, aguardandoAcao: false });

    if (duplo) {
      await turnoRepository.moverPlayer(player.id, { emPrisao: false, turnosPrisao: 0, tentativasPrisao: 0 });
      await turnoRepository.setAguardandoAcao(sessionId, false);
      // Escapou com duplo, joga de novo — novo timestamp explícito.
      const agoraDuplo = new Date();
      await turnoRepository.updateTurno(sessionId, { turnoIniciadoEm: agoraDuplo });
      const { timerService } = await import("./timer.service.js");
      await timerService.agendarTimeout(sessionId, agoraDuplo);
      const { emitUpdatedSession } = await import("../../socket/socket.handler.js");
      await emitUpdatedSession(sessionId);
      // Sai da prisão mas permanece na casa Prisão (pos 10) — ganha outra
      // jogada (duplo=true → rolarDados não avança o turno).
      return { dado1, dado2, duplo: true, escapouPrisao: true, novaPosicao: player.posicao, passouInicio: false, aguardandoAcao: false };
    }

    const ultimaRodada = player.turnosPrisao <= 1;
    const { turnoService } = await import("../turno.service.js");

    if (!ultimaRodada) {
      await turnoRepository.moverPlayer(player.id, { turnosPrisao: player.turnosPrisao - 1 });
      const avanco = await turnoService.avancarTurno(sessionId, session as any);
      return { dado1, dado2, duplo: false, escapouPrisao: false, aindaPreso: true, ...avanco };
    }

    const tentativas = player.tentativasPrisao + 1;
    if (tentativas < 3) {
      await turnoRepository.moverPlayer(player.id, { tentativasPrisao: tentativas });
      // Nova tentativa na mesma vez — novo timestamp explícito.
      const agoraTentativa = new Date();
      await turnoRepository.updateTurno(sessionId, { turnoIniciadoEm: agoraTentativa });
      const { timerService } = await import("./timer.service.js");
      await timerService.agendarTimeout(sessionId, agoraTentativa);
      const { emitUpdatedSession } = await import("../../socket/socket.handler.js");
      await emitUpdatedSession(sessionId);
      return { dado1, dado2, duplo: false, escapouPrisao: false, aindaPreso: true, tentativasPrisao: tentativas };
    }

    // 3ª tentativa falhou — paga a multa e sai sem andar, encerra a vez
    await economiaService.cobrarComFallbackDivida(
      sessionId, player, MULTA_PRISAO, null, `Multa de R$ ${MULTA_PRISAO} — não conseguiu sair da prisão`
    );
    await turnoRepository.moverPlayer(player.id, { emPrisao: false, turnosPrisao: 0, tentativasPrisao: 0 });

    const avanco = await turnoService.avancarTurno(sessionId, session as any);
    return {
      dado1, dado2, duplo: false, escapouPrisao: true, pagouMulta: true,
      novaPosicao: player.posicao, passouInicio: false, ...avanco,
    };
  }
}

export const casaResolverService = new CasaResolverService();
