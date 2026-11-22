import type { ReactNode } from 'react'
import { useState } from 'react'
import type { StickerKey } from '../../assets/stickers/keys'
import { stickerManifest } from '../../assets/stickers/manifest.generated'

export function Sticker({ name, size, alt, fallback }: {
  name: StickerKey; size: number; alt: string; fallback: ReactNode
}) {
  const image = stickerManifest[name]
  const [failed, setFailed] = useState<string>()
  if (!image || failed === image.small) return alt ? <span role="img" aria-label={alt}>{fallback}</span> : <>{fallback}</>
  return <img className="sticker-image" src={image.small} srcSet={image.small + ' 1x, ' + image.large + ' 2x'}
    width={size} height={size} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(image.small)} />
}
