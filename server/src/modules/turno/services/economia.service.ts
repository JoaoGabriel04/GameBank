import { turnoRepository } from "../turno.repository.js";
import { PropriedadeRepository } from "../../propriedade/propriedade.repository.js";
import { IPTU_PCT, MANUTENCAO_PCT, RENDA_PASSIVA_PCT, HOTEL_EQUIVALE_CASAS } from "../../../constants/economia.js";
import { CREDITO_INICIO } from "../../tabuleiro/tabuleiro.data.js";
import { calcularAluguel, aplicarMod } from "../../../shared/economia-core.js";
import type { EventoEfeito } from "../../../constants/eventos.js";

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

class EconomiaService {
  // Calcula o extrato completo (crédito do Início, renda passiva, IPTU e
  // manutenção de todas as propriedades do jogador) para a passagem pelo
  // Início. Hipotecadas e ações (grupo Preto) ficam de fora.
  // `mods` é buscado uma vez pelo orquestrador e repassado — este serviço
  // nunca busca os modificadores de evento por conta própria.
  async calcularExtratoInicio(sessionId: number, playerId: number, mods: EventoEfeito): Promise<ExtratoInicio> {
    const posses = await propriedadeRepository.findSessionPossesByPlayer(sessionId, playerId);

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

      const propIptu = aplicarMod(prop.custo_compra * IPTU_PCT, mods.iptuMult);
      const propManut = aplicarMod(prop.custo_casa * MANUTENCAO_PCT * casasEquivalentes, mods.manutencaoMult);
      const aluguelAtual = calcularAluguel(prop, casas);
      const propRenda = aplicarMod(aluguelAtual * RENDA_PASSIVA_PCT, mods.rendaPassivaMult);

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

  async aplicarJurosEmprestimo(sessionId: number, playerId: number) {
    const { EmprestimoService } = await import("../../emprestimo/emprestimo.service.js");
    const emprestimoService = new EmprestimoService();
    return emprestimoService.aplicarJurosEmprestimo(sessionId, playerId);
  }

  // Cobra valor do pagador; se saldo insuficiente, paga o que dá e cria
  // Debt pelo restante (mesmo padrão já usado em carta.service.ts pra
  // pagamentos automáticos do banco). credor=null → dinheiro vai pro banco.
  async cobrarComFallbackDivida(
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
}

export const economiaService = new EconomiaService();
