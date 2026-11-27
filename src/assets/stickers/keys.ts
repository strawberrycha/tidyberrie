export const iconKeys = [
  'check', 'book', 'briefcase', 'heart', 'home', 'leaf', 'star', 'sparkles',
  'study', 'work', 'deep-work', 'rest', 'self-care', 'health', 'errands',
  'travel', 'celebration', 'journal', 'goals', 'cleaning', 'budget-day', 'calendar', 'exercise', 'meals',
] as const

export const avatarKeys = [
  'avatar-happy', 'avatar-cheering', 'avatar-sleepy', 'avatar-proud', 'avatar-thinking', 'avatar-wallet',
] as const

export type IconKey = typeof iconKeys[number]
export type StickerKey = IconKey | typeof avatarKeys[number]
export type StickerManifest = Partial<Record<StickerKey, { small: string; large: string }>>
