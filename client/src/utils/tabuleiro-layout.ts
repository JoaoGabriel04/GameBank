// Grid 11x11: casa 0 (Início) no canto inferior-direito, casas percorrem o
// perímetro no sentido horário — 10 (Prisão) inferior-esquerdo, 20 (Feriado)
// superior-esquerdo, 30 (Vá para Detenção) superior-direito.
export function posToGrid(pos: number): { row: number; col: number } {
  if (pos <= 10) return { row: 11, col: 11 - pos }          // inferior
  if (pos <= 20) return { row: 11 - (pos - 10), col: 1 }    // esquerdo
  if (pos <= 30) return { row: 1, col: (pos - 20) + 1 }     // superior
  return { row: (pos - 30) + 1, col: 11 }                   // direito
}

export const TOTAL_CASAS = 40
export const GRID_SIZE = 11
export const TILE_SIZE = 140 // px, tamanho base de cada casa (antes do zoom)
export const BOARD_SIZE = GRID_SIZE * TILE_SIZE

// Centro (em px) da casa `pos`, útil para centralizar o viewport nela.
export function posToPixelCenter(pos: number): { x: number; y: number } {
  const { row, col } = posToGrid(pos)
  return {
    x: (col - 1) * TILE_SIZE + TILE_SIZE / 2,
    y: (row - 1) * TILE_SIZE + TILE_SIZE / 2,
  }
}
