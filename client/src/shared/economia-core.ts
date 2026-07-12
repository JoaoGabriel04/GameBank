// ESPELHADO em client/src/shared/economia-core.ts — manter os dois
// arquivos IDÊNTICOS byte a byte (garantido pelo teste de espelho em
// server/src/__tests__/unit/economia-core-espelho.test.ts). Este é o
// núcleo de regras de dinheiro compartilhado entre backend e frontend
// (Fase 1 de REFORMULACAO_TELA_JOGO.md) — sem ele, calcularAluguel e
// calcularPatrimonio viviam duplicados e podiam divergir silenciosamente
// (o jogador vê um valor na UI e o servidor cobra outro).

export type PropriedadeAluguel = {
  aluguel_base: number; aluguel_1c: number; aluguel_2c: number;
  aluguel_3c: number; aluguel_4c: number; aluguel_hotel: number;
};

/** Aluguel de uma propriedade conforme o número de casas. Fonte única. */
export function calcularAluguel(prop: PropriedadeAluguel, casas: number): number {
  switch (casas) {
    case 0: return prop.aluguel_base ?? 0;
    case 1: return prop.aluguel_1c ?? prop.aluguel_base ?? 0;
    case 2: return prop.aluguel_2c ?? prop.aluguel_1c ?? prop.aluguel_base ?? 0;
    case 3: return prop.aluguel_3c ?? prop.aluguel_2c ?? prop.aluguel_base ?? 0;
    case 4: return prop.aluguel_4c ?? prop.aluguel_3c ?? prop.aluguel_base ?? 0;
    default: return prop.aluguel_hotel ?? prop.aluguel_4c ?? prop.aluguel_base ?? 0;
  }
}

export type PosseParaPatrimonio = {
  casas: number;
  propriedade: { custo_compra: number; custo_casa: number } | null;
};

/** Patrimônio = saldo + valor das propriedades + casas. Fonte única. */
export function calcularPatrimonio(saldo: number, posses: PosseParaPatrimonio[]): number {
  let total = saldo;
  for (const p of posses) {
    if (!p.propriedade) continue;
    total += p.propriedade.custo_compra;
    total += (p.casas ?? 0) * p.propriedade.custo_casa;
  }
  return total;
}

/** Aplica um multiplicador e arredonda. Fonte única para eventos. */
export function aplicarMod(valor: number, mult?: number): number {
  return Math.round(valor * (mult ?? 1));
}
