export const SURFACE_COLORS = ['#4a9eff', '#ff6b6b', '#ffd93d', '#6bcb77'] as const

export function getSurfaceColor(index: number): string {
  return SURFACE_COLORS[index % SURFACE_COLORS.length]
}
