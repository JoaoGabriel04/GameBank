import { calcularAluguel, calcularPatrimonio, aplicarMod, calcularCustoOciosa } from "../../shared/economia-core.js";
import { OCIOSA_REGRA, OCIOSA_CARENCIA_RODADAS, OCIOSA_PCT, OCIOSA_DEGRAUS_MAX } from "../../constants/economia.js";

describe("calcularAluguel", () => {
  const prop = {
    aluguel_base: 100,
    aluguel_1c: 200,
    aluguel_2c: 400,
    aluguel_3c: 800,
    aluguel_4c: 1600,
    aluguel_hotel: 3200,
  };

  test.each([
    [0, 100],
    [1, 200],
    [2, 400],
    [3, 800],
    [4, 1600],
    [5, 3200], // hotel
  ])("com %i casas retorna %i", (casas, esperado) => {
    expect(calcularAluguel(prop, casas)).toBe(esperado);
  });
});

describe("calcularPatrimonio", () => {
  test("saldo sozinho, sem propriedades", () => {
    expect(calcularPatrimonio(5000, [])).toBe(5000);
  });

  test("saldo + propriedades sem casas", () => {
    const posses = [
      { casas: 0, propriedade: { custo_compra: 1000, custo_casa: 200 } },
      { casas: 0, propriedade: { custo_compra: 2000, custo_casa: 300 } },
    ];
    expect(calcularPatrimonio(1000, posses)).toBe(1000 + 1000 + 2000);
  });

  test("saldo + propriedades + casas", () => {
    const posses = [
      { casas: 3, propriedade: { custo_compra: 1000, custo_casa: 200 } },
    ];
    expect(calcularPatrimonio(500, posses)).toBe(500 + 1000 + 3 * 200);
  });

  test("ignora posses sem propriedade (ex.: registro órfão)", () => {
    const posses = [{ casas: 2, propriedade: null }];
    expect(calcularPatrimonio(100, posses)).toBe(100);
  });
});

describe("aplicarMod", () => {
  test("sem multiplicador (undefined) retorna o valor arredondado", () => {
    expect(aplicarMod(1234)).toBe(1234);
  });

  test("aplica o multiplicador e arredonda", () => {
    expect(aplicarMod(1000, 0.5)).toBe(500);
    expect(aplicarMod(1000, 1.5)).toBe(1500);
    expect(aplicarMod(1000, 2)).toBe(2000);
  });

  test("arredonda corretamente valores fracionários", () => {
    expect(aplicarMod(333, 0.5)).toBe(167); // 166.5 -> 167 (round half up)
  });
});

describe("calcularCustoOciosa", () => {
  // Regra fixa no teste (não OCIOSA_REGRA) para os valores esperados não
  // mudarem quando o balanceamento for ajustado em economia.ts.
  const regra = { carenciaRodadas: 8, pct: 0.03, degrausMax: 4 };
  const prop = { tipo: "normal", custo_compra: 2400 };

  test("antes da carência não cobra", () => {
    expect(calcularCustoOciosa(prop, 0, false, 7, {}, regra)).toBe(0);
  });

  test.each([
    [8, 72],   // degrau 1 = 3%
    [9, 144],  // degrau 2
    [10, 216], // degrau 3
    [11, 288], // degrau 4 = teto
    [12, 288], // degrau 5+ continua no teto
    [30, 288],
  ])("com %i rodadas ociosas cobra %i", (ociosas, esperado) => {
    expect(calcularCustoOciosa(prop, 0, false, ociosas, {}, regra)).toBe(esperado);
  });

  test("com casas não cobra", () => {
    expect(calcularCustoOciosa(prop, 1, false, 20, {}, regra)).toBe(0);
  });

  test("hipotecada não cobra", () => {
    expect(calcularCustoOciosa(prop, 0, true, 20, {}, regra)).toBe(0);
  });

  test("ação não cobra", () => {
    expect(calcularCustoOciosa({ tipo: "ação", custo_compra: 2400 }, 0, false, 20, {}, regra)).toBe(0);
  });

  test("Inflação (manutencaoMult 1,5) também encarece o terreno ocioso", () => {
    expect(calcularCustoOciosa(prop, 0, false, 8, { manutencaoMult: 1.5 }, regra)).toBe(108);
  });

  test("OCIOSA_REGRA segue as constantes de economia.ts", () => {
    expect(OCIOSA_REGRA).toEqual({
      carenciaRodadas: OCIOSA_CARENCIA_RODADAS,
      pct: OCIOSA_PCT,
      degrausMax: OCIOSA_DEGRAUS_MAX,
    });
  });
});
