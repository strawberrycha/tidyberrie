export const themes = ['strawberry', 'sakura'] as const
export type Theme = typeof themes[number]

export function applyTheme(theme: Theme, root = document.documentElement) {
  root.dataset.theme = theme
}
