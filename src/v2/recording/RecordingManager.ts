export function calcGrid(
  n: number,
  w: number,
  h: number,
): { cols: number; rows: number; cellW: number; cellH: number } {
  const cols = Math.ceil(Math.sqrt(n))
  const rows = Math.ceil(n / cols)
  return { cols, rows, cellW: Math.floor(w / cols), cellH: Math.floor(h / rows) }
}
