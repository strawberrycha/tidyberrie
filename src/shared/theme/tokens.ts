export const lightTokens = { bg: '#FFF0F5' } as const
export const themes = ['strawberry', 'sakura'] as const
export type Theme = typeof themes[number]

export function applyTheme(theme: Theme, root = document.documentElement) {
  root.dataset.theme = theme
}
