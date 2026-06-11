export type Raridade = "COMUM" | "INCOMUM" | "RARO" | "EPICO" | "LENDARIO"

export interface RaridadeData {
  label: string
  cor: string
  fundo: string
  delay: number
  ordem: number
  fragmentosSugeridos: number
}
