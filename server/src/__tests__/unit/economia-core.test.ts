import { calcularAluguel, calcularPatrimonio, aplicarMod } from "../../shared/economia-core.js";

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
