// Tokens de movimento: toda animação nova tira daqui duração, curva e
// distância. Os valores extras (micro, saida) existem porque já estavam em
// uso antes dos tokens; mudar o número aqui muda o app inteiro.

/** Durações em segundos (Framer Motion e GSAP usam segundos). */
export const duracao = {
  micro: 0.08,   // fadeIn de página (valor histórico)
  instant: 0.12,
  saida: 0.15,   // saída de modal
  fast: 0.2,
  base: 0.3,
  slow: 0.5,
} as const;

/** As mesmas durações em milissegundos, para setTimeout e CSS. */
export const duracaoMs = Object.fromEntries(
  Object.entries(duracao).map(([k, v]) => [k, Math.round(v * 1000)])
) as { [K in keyof typeof duracao]: number };

/** Curvas cúbicas para Framer Motion. */
export const curva = {
  easeOut: [0.22, 1, 0.36, 1],
  easeIn: [0.64, 0, 0.78, 0],
  easeInOut: [0.65, 0, 0.35, 1],
} as const;

/** As curvas equivalentes por nome, para GSAP. */
export const curvaGsap = {
  easeOut: "power2.out",
  easeIn: "power2.in",
  easeInOut: "power2.inOut",
  pop: "back.out(1.7)",
} as const;

/** Molas do Framer Motion. */
export const mola = {
  suave: { type: "spring", damping: 30, stiffness: 300 },   // bottom sheet
  firme: { type: "spring", damping: 25, stiffness: 300 },   // modal
  item: { type: "spring", damping: 20, stiffness: 200 },    // itens de lista
} as const;

/** Deslocamentos em px. */
export const distancia = {
  xs: 4,
  sm: 10,
  md: 12,   // entrada de itens de lista (valor histórico)
  lg: 20,
  xl: 40,
} as const;

/** Intervalo entre itens de uma lista em cascata (s). */
export const cascata = 0.04;

/** Nível de efeitos visuais resolvido (preferência + sistema + aparelho). */
export type NivelEfeitos = "completo" | "reduzido" | "desligado";
