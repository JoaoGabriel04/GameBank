/* eslint-disable */
'use client'

import LandingHeader from "@/components/LandingHeader";
import Footer from "@/components/Footer";
import Button1 from "@/components/Button01";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBook, faDice, faBuilding, faHome, faMoneyBillTransfer,
  faHandcuffs, faUmbrella, faChartLine, faStore, faHandshake,
  faScroll, faTrophy, faArrowRight, faGavel, faMoneyBillTrendUp,
} from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { useEffect } from "react";

interface SecaoProps {
  id: string;
  icon: IconDefinition;
  title: string;
  color: string;
  children: React.ReactNode;
}

const cores = [
  "green", "purple", "amber", "blue", "emerald", "pink", "cyan", "rose", "orange", "teal",
] as const;

const colorMap: Record<string, { text: string; bg: string; border: string; iconBg: string }> = {
  green:   { text: "text-green-400",   bg: "bg-green-500/10",   border: "border-green-500/30",   iconBg: "bg-green-500/20" },
  purple:  { text: "text-purple-400",  bg: "bg-purple-500/10",  border: "border-purple-500/30",  iconBg: "bg-purple-500/20" },
  amber:   { text: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/30",   iconBg: "bg-amber-500/20" },
  blue:    { text: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/30",    iconBg: "bg-blue-500/20" },
  emerald: { text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", iconBg: "bg-emerald-500/20" },
  pink:    { text: "text-pink-400",    bg: "bg-pink-500/10",    border: "border-pink-500/30",    iconBg: "bg-pink-500/20" },
  cyan:    { text: "text-cyan-400",    bg: "bg-cyan-500/10",    border: "border-cyan-500/30",    iconBg: "bg-cyan-500/20" },
  rose:    { text: "text-rose-400",    bg: "bg-rose-500/10",    border: "border-rose-500/30",    iconBg: "bg-rose-500/20" },
  orange:  { text: "text-orange-400",  bg: "bg-orange-500/10",  border: "border-orange-500/30",  iconBg: "bg-orange-500/20" },
  teal:    { text: "text-teal-400",    bg: "bg-teal-500/10",    border: "border-teal-500/30",    iconBg: "bg-teal-500/20" },
};

function Secao({ id, icon, title, color, children }: SecaoProps) {
  const c = colorMap[color];
  return (
    <section id={id} className={`rounded-xl border ${c.border} ${c.bg} p-6 sm:p-8`}>
      <div className="flex items-center gap-4 mb-6">
        <div className={`w-12 h-12 rounded-xl ${c.iconBg} flex items-center justify-center flex-shrink-0`}>
          <FontAwesomeIcon icon={icon} className={`text-xl ${c.text}`} />
        </div>
        <h2 className={`text-xl sm:text-2xl font-jaro ${c.text}`}>{title}</h2>
      </div>
      <div className="text-zinc-300 font-inconsolata text-sm sm:text-base leading-relaxed space-y-3">
        {children}
      </div>
    </section>
  );
}

function Tabela({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  return (
    <div className="overflow-x-auto my-4">
      <table className="w-full text-left text-sm border-collapse">
        <thead>
          <tr className="border-b border-zinc-700">
            {headers.map((h, i) => (
              <th key={i} className="py-2 px-3 font-jaro text-zinc-400 font-normal">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-zinc-800/50">
              {row.map((cell, j) => (
                <td key={j} className="py-2 px-3 text-zinc-300">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Regras() {
  const router = useRouter();
  const { user, loadFromStorage } = useAuthStore();

  useEffect(() => { loadFromStorage(); }, [loadFromStorage]);

  function handleNavigate(path: string) {
    if (user) {
      router.push(path);
    } else {
      router.push(`/login?redirect=${encodeURIComponent(path)}`);
    }
  }

  return (
    <main className="w-full bg-black pb-24 lg:pb-0">
      <LandingHeader />

      {/* Hero */}
      <section className="relative w-full pt-32 pb-16 sm:pt-40 sm:pb-20 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(34,197,94,0.08)_0%,_transparent_60%)]" />
        <div className="relative max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-jaro font-bold mb-6">
            <span className="bg-linear-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
              Regras do Jogo
            </span>
          </h1>
          <p className="text-zinc-400 font-inconsolata text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            Todas as mecânicas implementadas no GameBank — desde o básico até os detalhes
            mais específicos do Modo Tabuleiro. As regras aqui descritas refletem exatamente
            o que está no servidor do jogo.
          </p>
        </div>
      </section>

      {/* Índice */}
      <section className="w-full max-w-4xl mx-auto px-6 pb-12">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
          <h2 className="text-lg font-jaro text-zinc-100 mb-4">Índice</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              { href: "#modos", label: "Modos de Jogo" },
              { href: "#sessao", label: "Sessão e Jogadores" },
              { href: "#tabuleiro", label: "O Tabuleiro" },
              { href: "#propriedades", label: "Propriedades e Grupos" },
              { href: "#construcao", label: "Construção de Casas" },
              { href: "#acoes", label: "Ações (Grupo Preto)" },
              { href: "#hipoteca", label: "Hipoteca" },
              { href: "#emprestimos", label: "Empréstimos com Garantia" },
              { href: "#turno", label: "Turno (Modo Tabuleiro)" },
              { href: "#economia", label: "Economia (Modo Tabuleiro)" },
              { href: "#eventos", label: "Eventos Econômicos" },
              { href: "#escolha", label: "Escolha de Movimento" },
              { href: "#leilao", label: "Leilão Cego" },
              { href: "#prisao", label: "Prisão" },
              { href: "#feriado", label: "Feriado" },
              { href: "#cartas", label: "Cartas de Sorte e Revés" },
              { href: "#dividas", label: "Dívidas e Falência" },
              { href: "#negociacao", label: "Negociações" },
              { href: "#fim", label: "Fim de Partida" },
              { href: "#recompensas", label: "Recompensas" },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-zinc-400 hover:text-green-400 hover:bg-zinc-800/50 transition-all font-inconsolata text-sm"
              >
                <FontAwesomeIcon icon={faArrowRight} className="w-3 h-3" />
                {item.label}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Conteúdo */}
      <section className="w-full max-w-4xl mx-auto px-6 pb-16 space-y-8">

        <Secao id="modos" icon={faBook} title="Modos de Jogo" color="green">
          <Tabela
            headers={["", "Modo Banca", "Modo Tabuleiro"]}
            rows={[
              ["Tabuleiro físico", "Sim — os jogadores jogam no tabuleiro real", "Não — tudo acontece no app"],
              ["Peões, dados, casas", "Físicos, fora do app", "Digitais, dentro do app"],
              ["O app cuida de", "Saldos, propriedades, dívidas", "Tudo: dados, movimento, resolução de casa, turnos"],
              ["Sequência de turnos", "Livre (sem imposição)", "Controlada pelo servidor, com timeout de 60s por turno"],
            ]}
          />
          <p>
            Em <strong>Modo Banca</strong> o jogador registra manualmente cada ação (comprar,
            pagar aluguel, sortear carta) através dos menus do app, informando quem paga/recebe.
            Em <strong>Modo Tabuleiro</strong> o app rola os dados, move o peão, resolve a casa
            automaticamente e controla de quem é a vez.
          </p>
        </Secao>

        <Secao id="sessao" icon={faBuilding} title="Sessão e Jogadores" color="purple">
          <ul className="list-disc list-inside space-y-1">
            <li>Sala aceita de <strong>3 a 6 jogadores</strong> (padrão: 6), com saldo inicial configurável (padrão <strong>R$ 25.000</strong>)</li>
            <li>Modo <strong>individual</strong> (padrão) ou <strong>duplas</strong> por times</li>
            <li>Apenas o dono da sala pode iniciar ou encerrar a partida</li>
            <li>Sala com senha exige token de acesso; sem senha, entrada livre</li>
          </ul>
        </Secao>

        <Secao id="tabuleiro" icon={faDice} title="O Tabuleiro" color="amber">
          <p>40 casas, dispostas nos 4 lados de um tabuleiro 11×11 (posições 0–39):</p>
          <Tabela
            headers={["Tipo de casa", "Quantidade", "Efeito"]}
            rows={[
              ["Início", "1 (pos. 0)", "Passar ou cair credita R$ 2.000"],
              ["Propriedade", "28", "Pode ser comprada; cobra aluguel de quem não é dono"],
              ["Ação", "6 (grupo Preto)", "Pode ser comprada; cobra dividendo fixo por dado"],
              ["Notícias", "6", "Sorteia uma carta de Sorte ou Revés"],
              ["Prisão (só visitando)", "1 (pos. 10)", "Sem efeito se não está preso"],
              ["Vá para a Detenção", "1 (pos. 30)", "Envia direto para a prisão"],
              ["Restituição IR", "1", "Recebe R$ 2.000 do banco"],
              ["Receita Federal", "1", "Paga R$ 2.000 ao banco"],
              ["Feriado", "1", "Pula a próxima rodada"],
            ]}
          />
        </Secao>

        <Secao id="propriedades" icon={faStore} title="Propriedades e Grupos de Cor" color="blue">
          <p>
            As 28 propriedades normais são organizadas em <strong>8 grupos de cor</strong> (2 ou 3
            imóveis cada). Cada propriedade tem custo de compra, aluguel base e por número de
            casas (1 a 4), aluguel com hotel, custo por casa e valor de hipoteca.
          </p>
          <p>
            Ao cair numa propriedade/ação sem dono, o jogador pode comprá-la pelo custo de
            compra. Se pertence a outro jogador (e não está hipotecada), o aluguel é cobrado
            automaticamente — <strong>exceto</strong> se o dono estiver na prisão.
          </p>
        </Secao>

        <Secao id="construcao" icon={faHome} title="Construção de Casas e Hotéis" color="emerald">
          <ul className="list-disc list-inside space-y-1">
            <li>Só é permitido construir em propriedades <strong>normais com monopólio</strong> (o jogador precisa possuir <strong>todas</strong> as propriedades do grupo de cor)</li>
            <li>Máximo de <strong>5 níveis</strong>: 1 a 4 casas, o 5º nível vira <strong>hotel</strong></li>
            <li>Limite de <strong>1 casa construída por propriedade por turno</strong></li>
            <li>Só é possível vender casas de uma propriedade sem hipotecá-la primeiro</li>
            <li><strong>Preso não pode comprar casas</strong> — enquanto estiver na prisão, a opção de construir é bloqueada</li>
          </ul>
        </Secao>

        <Secao id="acoes" icon={faChartLine} title="Ações (Grupo Preto)" color="pink">
          <p>
            As 6 empresas do grupo Preto são compráveis como qualquer propriedade, mas seu
            rendimento é diferente: quem cair numa ação de outro jogador paga
            <strong> R$ 500 × soma dos dados</strong> da própria jogada. Não têm casas,
            hotéis nem aluguel progressivo.
          </p>
        </Secao>

        <Secao id="hipoteca" icon={faMoneyBillTransfer} title="Hipoteca" color="cyan">
          <ul className="list-disc list-inside space-y-1">
            <li>Hipotecar uma propriedade <strong>remove a posse</strong> e credita o valor de hipoteca ao jogador — só permitido sem casas construídas</li>
            <li>Qualquer jogador pode comprar de volta uma propriedade hipotecada, pagando <strong>hipoteca × 1.1</strong> (10% de juros)</li>
            <li>Comprar uma propriedade hipotecada "do zero" (sem dono) custa <strong>custo de compra × 1.2</strong></li>
            <li>Propriedade em garantia de empréstimo <strong>não pode ser hipotecada</strong></li>
          </ul>
        </Secao>

        <Secao id="emprestimos" icon={faMoneyBillTrendUp} title="Empréstimos com Garantia" color="orange">
          <p>
            Exclusivo do Modo Tabuleiro. O jogador pode pegar um <strong>empréstimo</strong>
            usando uma de suas propriedades como garantia. A propriedade que mais rende
            (aluguel + renda passiva) é automaticamente escolhida como garantia.
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Limite:</strong> até <strong>50%</strong> do valor da propriedade-garantia</li>
            <li><strong>Juros compostos:</strong> <strong>10% por rodada</strong> sobre o valor devido</li>
            <li><strong>Máximo:</strong> apenas <strong>1 empréstimo ativo</strong> por jogador</li>
            <li><strong>Quitação:</strong> pode quitar a qualquer momento pelo valor devido atual</li>
          </ul>
          <p className="font-semibold">Travas enquanto o empréstimo estiver ativo:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>A propriedade-garantia <strong>não pode ser hipotecada</strong></li>
            <li>A propriedade-garantia <strong>não pode ser vendida</strong></li>
            <li>A propriedade-garantia <strong>não pode ser negociada</strong> (nem ofertada nem pedida em troca)</li>
            <li>O jogador <strong>não pode desistir</strong> da partida com empréstimo ativo</li>
          </ul>
          <p>
            Se o jogador <strong>falir</strong>, a garantia é <strong>executada</strong> antes da
            falência limpar as propriedades — o credor (banco) toma a propriedade para cobrir
            parte da dívida.
          </p>
          <p>
            <strong>Eventos Econômicos afetam os juros:</strong> Alta de Juros (juros dobram) e
            Corte de Juros (juros caem pela metade).
          </p>
        </Secao>

        <Secao id="turno" icon={faDice} title="Turno (Modo Tabuleiro)" color="green">
          <ol className="list-decimal list-inside space-y-1">
            <li>O jogador da vez rola 2 dados (1–6 cada) — o peão <strong>ainda não se move</strong></li>
            <li>O jogador <strong>escolhe o movimento</strong>: andar o dado 1, o dado 2 ou a soma dos dois</li>
            <li>Só então o peão avança; se passar ou cair em Início, recebe R$ 2.000 − IPTU das suas propriedades</li>
            <li>A casa onde parou é resolvida automaticamente (compra, aluguel, imposto, carta, prisão, feriado...)</li>
            <li><strong>Dados iguais (duplo)</strong> → joga de novo, <strong>só se escolher a soma</strong>, <strong>exceto</strong> se a casa for Feriado, Vá para a Detenção ou carta de prisão</li>
            <li><strong>3 duplos seguidos</strong> → vai direto para a prisão</li>
            <li>Cada turno tem <strong>60 segundos</strong>; timeout rola automaticamente pela soma e passa a vez</li>
            <li>Comprar uma propriedade pode ficar <strong>pendente</strong> durante todo o turno</li>
            <li><strong>Recusar a compra</strong> manda a propriedade a <strong>leilão cego</strong></li>
          </ol>
        </Secao>

        <Secao id="economia" icon={faMoneyBillTransfer} title="Economia (Modo Tabuleiro)" color="purple">
          <ul className="list-disc list-inside space-y-1">
            <li>Ao passar pelo Início: <strong>+R$ 2.000 − IPTU</strong> das suas propriedades (15% do valor de compra)</li>
            <li>A cada rodada: <strong>renda passiva − manutenção</strong> das suas propriedades</li>
            <li><strong>Renda passiva</strong> — 35% do aluguel atual (quanto mais casas, mais renda)</li>
            <li><strong>Manutenção</strong> — 12% do custo da casa, por casa construída (hotel = 5 casas)</li>
            <li>Propriedades <strong>hipotecadas</strong> não pagam IPTU nem manutenção e não geram renda passiva</li>
            <li><strong>Ações</strong> (grupo Preto) não têm IPTU, manutenção nem renda passiva</li>
            <li><strong>Terreno parado só gera IPTU.</strong> Desenvolver é o que gera renda — acumular propriedades sem construir leva ao prejuízo</li>
          </ul>
        </Secao>

        <Secao id="eventos" icon={faChartLine} title="Eventos Econômicos" color="amber">
          <p>
            Ciclo de <strong>3 rodadas</strong>: 1 rodada de aviso + 2 rodadas com o evento ativo.
          </p>
          <Tabela
            headers={["Evento", "Efeito"]}
            rows={[
              ["Crise Imobiliária", "Aluguéis −50%"],
              ["Boom Imobiliário", "Aluguéis +50%"],
              ["IPTU Extraordinário", "IPTU dobra"],
              ["Isenção Fiscal", "IPTU zerado"],
              ["Escassez de Material", "Construção +50%"],
              ["Aquecimento do Mercado", "Construção −30%"],
              ["Inflação", "Manutenção +50%"],
              ["Recessão", "Renda passiva zerada"],
              ["Dividendos Extraordinários", "Ações rendem 2x"],
              ["Injeção de Liquidez", "Todos recebem R$ 1.000 imediatamente"],
              ["Alta de Juros", "Juros de empréstimos dobram"],
              ["Corte de Juros", "Juros de empréstimos caem pela metade"],
            ]}
          />
        </Secao>

        <Secao id="escolha" icon={faDice} title="Escolha de Movimento" color="blue">
          <p>
            Depois de rolar os dados, o jogador <strong>escolhe</strong> quantas casas andar —
            dado 1, dado 2 ou a soma. A UI mostra o destino de cada opção.
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Duplo só concede jogada extra se a escolha for a soma</strong></li>
            <li><strong>Na prisão não há escolha</strong> — vale sempre a soma</li>
            <li><strong>3 duplos seguidos</strong> vão direto para a prisão</li>
            <li><strong>Timeout</strong> aplica a soma automaticamente</li>
          </ul>
        </Secao>

        <Secao id="leilao" icon={faGavel} title="Leilão Cego" color="emerald">
          <p>
            Quando o jogador da vez <strong>recusa</strong> comprar a propriedade em que caiu,
            ela vai a leilão — <strong>pausa o turno</strong> até o leilão fechar.
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Cego:</strong> todos dão lance ao mesmo tempo, sem ver o lance dos outros</li>
            <li><strong>Lance mínimo:</strong> 50% do preço de tabela</li>
            <li><strong>Lance vinculante:</strong> quem vence é obrigado a comprar</li>
            <li><strong>Empate:</strong> vence quem tem menor patrimônio (catch-up)</li>
            <li><strong>Timeout de 30s:</strong> quem não decidiu conta como passou</li>
          </ul>
        </Secao>

        <Secao id="prisao" icon={faHandcuffs} title="Prisão" color="rose">
          <ul className="list-disc list-inside space-y-1">
            <li>Vai para a prisão: <strong>3 duplos seguidos</strong>, cair em <strong>Vá para a Detenção</strong> ou tirar uma <strong>carta de prisão</strong></li>
            <li>Nas <strong>2 primeiras rodadas</strong> presas: uma tentativa de duplo por rodada</li>
            <li>Na <strong>3ª rodada</strong> (última): até <strong>3 tentativas</strong> de duplo na mesma vez; se todas falharem, paga <strong>multa de R$ 500</strong> e sai</li>
            <li>Tirar duplo a qualquer momento liberta imediatamente (fica na casa Prisão, sem se mover, e ganha outra jogada)</li>
            <li>Carta <strong>"Saia da Prisão"</strong> pode ser usada a qualquer momento para sair sem pagar nem esperar</li>
          </ul>
          <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 mt-4">
            <p className="font-semibold text-rose-300">Restrições enquanto preso:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li><strong>Não recebe aluguéis</strong> — jogadores que caírem em suas propriedades não pagam aluguel</li>
              <li><strong>Não pode comprar casas</strong> — a opção de construir é bloqueada</li>
            </ul>
          </div>
        </Secao>

        <Secao id="feriado" icon={faUmbrella} title="Feriado" color="cyan">
          <p>
            Ao cair no Feriado, o jogador <strong>pula a próxima rodada</strong> (não joga na vez
            seguinte). Diferente da prisão, o jogador no Feriado <strong>pode fazer tudo
            normalmente</strong>: receber aluguéis, comprar casas, negociar e participar de
            leilões — apenas não joga a rodada.
          </p>
        </Secao>

        <Secao id="cartas" icon={faScroll} title="Cartas de Sorte e Revés" color="pink">
          <p>Baralho de 50 cartas de Sorte + 50 de Revés, sorteadas ao cair em "Notícias".</p>
          <Tabela
            headers={["Efeito", "Descrição"]}
            rows={[
              ["Ganhar dinheiro", "Recebe valor fixo do banco"],
              ["Perder dinheiro", "Paga valor fixo ao banco (vira dívida se não tiver saldo)"],
              ["Receber dos jogadores", "Recebe valor fixo de cada outro jogador"],
              ["Pagar aos jogadores", "Paga valor fixo a cada outro jogador"],
              ["Saia da Prisão", "Ganha a carta (ou R$ 500 se já tiver uma)"],
              ["Vá para a prisão", "Envia direto para a prisão"],
            ]}
          />
        </Secao>

        <Secao id="dividas" icon={faMoneyBillTransfer} title="Dívidas e Falência" color="orange">
          <ul className="list-disc list-inside space-y-1">
            <li>Quando um jogador não tem saldo suficiente, ele paga o que der e o restante vira <strong>dívida</strong> — o credor recebe o valor cheio (banco cobre)</li>
            <li>Na <strong>3ª rodada</strong> seguida sem quitar, o jogador <strong>declara falência</strong>: todas as propriedades voltam ao banco, saldo zera e ele sai</li>
            <li>Antes da falência limpar as propriedades, a <strong>garantia de empréstimo</strong> é executada</li>
            <li>Não é possível desistir voluntariamente com dívidas pendentes nem com patrimônio ≥ R$ 15.000</li>
            <li>Não é possível desistir voluntariamente com <strong>empréstimo ativo</strong></li>
          </ul>
        </Secao>

        <Secao id="negociacao" icon={faHandshake} title="Negociações" color="teal">
          <p>
            Jogadores podem propor trocas (propriedades e/ou dinheiro dos dois lados) para
            qualquer outro jogador. O alvo pode <strong>aceitar</strong>, <strong>recusar</strong>
            ou enviar uma <strong>contraproposta</strong>.
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>Propostas sem resposta <strong>expiram em 2 minutos</strong></li>
            <li>Propriedades em <strong>garantia de empréstimo</strong> não podem ser negociadas</li>
          </ul>
        </Secao>

        <Secao id="fim" icon={faTrophy} title="Fim de Partida e Classificação" color="amber">
          <p>
            A partida termina quando o dono encerra manualmente ou quando
            <strong> metade ou mais</strong> dos jogadores desistiu/faliu. A colocação final:
          </p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Jogadores <strong>ativos</strong> até o fim, do maior para o menor patrimônio</li>
            <li>Jogadores <strong>falidos</strong>, pelo patrimônio no momento da falência</li>
            <li>Jogadores que <strong>desistiram</strong>, por ordem de quem saiu por último primeiro</li>
          </ol>
        </Secao>

        <Secao id="recompensas" icon={faTrophy} title="Recompensas por Partida" color="green">
          <Tabela
            headers={["Posição", "Coins", "XP"]}
            rows={[
              ["1º", "500", "400"],
              ["2º", "350", "200"],
              ["3º", "200", "100"],
              ["4º+", "100", "50"],
            ]}
          />
          <p>
            Multiplicado por bônus de duração (×1.2 ≥30min, ×1.5 ≥60min). Sem recompensa se
            a partida durar menos de 5 minutos. Teto diário de 3.000 coins e 1.500 XP.
          </p>
        </Secao>

      </section>

      {/* CTA */}
      <section className="w-full bg-zinc-900/30 border-t border-zinc-800 py-16 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-jaro text-zinc-100 mb-4">Pronto para jogar?</h2>
          <p className="text-zinc-400 font-inconsolata mb-8">
            Crie sua conta, monte uma sala com os amigos e descubra uma nova forma de jogar.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button1 size="lg" color="green" handle={() => handleNavigate("/user/sessions")}>
              <FontAwesomeIcon icon={faBuilding} className="mr-2" />
              Ver Salas Disponíveis
            </Button1>
            <Button1 size="lg" color="blue" handle={() => handleNavigate("/user/new-session")}>
              <FontAwesomeIcon icon={faBook} className="mr-2" />
              Criar Nova Sala
            </Button1>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
