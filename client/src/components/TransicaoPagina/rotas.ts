// Hierarquia das rotas da área logada, para a direção da transição:
// ir mais fundo entra pela direita, voltar entra pela esquerda, e entre
// abas irmãs (barra de navegação) só há fade com escala sutil.

/** Abas da barra de navegação: todas no nível 0, irmãs entre si. */
const ABAS = ["/user", "/user/cofre", "/user/loja", "/user/recompensas", "/user/ranking"];

/** Profundidade das demais rotas (quanto maior, mais "para dentro"). */
const PROFUNDIDADE: Record<string, number> = {
  "/user/perfil": 1,
  "/user/diamantes": 1,
  "/user/sessions": 1,
  "/user/configuracoes": 2,
  "/user/new-session": 2,
};

function nivelDaRota(pathname: string) {
  if (ABAS.includes(pathname)) return 0;
  return PROFUNDIDADE[pathname] ?? 1;
}

/** 1 = mais fundo (entra pela direita), -1 = voltando, 0 = irmãs (fade). */
export type Direcao = -1 | 0 | 1;

export function direcaoEntre(de: string, para: string): Direcao {
  const a = nivelDaRota(de);
  const b = nivelDaRota(para);
  if (a === b) return 0;
  return b > a ? 1 : -1;
}
