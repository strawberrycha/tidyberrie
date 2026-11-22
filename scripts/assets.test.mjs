// @vitest-environment node
import { mkdir, mkdtemp, readFile, readdir, rm, stat, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { Buffer } from 'node:buffer'
import { afterEach, expect, it } from 'vitest'
import sharp from 'sharp'
import { buildStickers, budget } from './assets.mjs'

const testParent = resolve(tmpdir())
const testPrefix = 'tidyberrie-assets-test-'
const testRoots = []

afterEach(async () => {
  for (const root of testRoots.splice(0)) {
    if (dirname(root) !== testParent || !basename(root).startsWith(testPrefix)) throw new Error('Unexpected fixture path')
    await rm(root, { recursive: true, force: true })
  }
})

async function context() {
  const root = await mkdtemp(join(testParent, testPrefix))
  testRoots.push(root)
  const paths = { input: join(root, 'source'), output: join(root, 'output'), manifestFile: join(root, 'manifest.generated.ts') }
  await mkdir(paths.input)
  return paths
}

function fixture(width = 256, height = width, opaque = false) {
  const bytes = Buffer.alloc(width * height * 4, opaque ? 255 : 0)
  bytes.fill(255, 0, width * 4)
  return sharp(bytes, { raw: { width, height, channels: 4 } }).png()
}

it('generates two WebP sizes and a deterministic typed manifest, and preserves it when sources are absent', async () => {
  const paths = await context()
  await fixture().toFile(join(paths.input, 'study.png'))
  await fixture().toFile(join(paths.input, 'avatar-happy.png'))
  await fixture().toFile(join(paths.input, 'unknown.png'))
  const report = await buildStickers(paths)
  const manifest = await readFile(paths.manifestFile, 'utf8')
  expect(report).toMatchObject({ count: 2, ignored: ['unknown.png'] })
  expect(report.bytes).toBeGreaterThan(0)
  expect(report.bytes).toBeLessThan(budget)
  expect(report.missingIcons).toContain('book')
  expect(report.missingAvatars).not.toContain('avatar-happy')
  expect(manifest).toContain('stickerManifest: StickerManifest')
  expect(manifest).toContain('"study"')
  const files = await readdir(paths.output)
  expect(files).toHaveLength(4)
  for (const file of files) {
    const { width, height, format } = await sharp(join(paths.output, file)).metadata()
    const size = file.includes('-128-') ? 128 : 256
    expect({ width, height, format }).toEqual({ width: size, height: size, format: 'webp' })
    expect((await stat(join(paths.output, file))).size).toBeGreaterThan(0)
  }
  expect(await buildStickers(paths)).toEqual(report)
  expect(await readFile(paths.manifestFile, 'utf8')).toBe(manifest)
  expect(await buildStickers({ ...paths, input: join(paths.input, 'missing') })).toMatchObject({
    count: 2, inputMissing: true, bytes: report.bytes,
  })
  await unlink(join(paths.input, 'study.png'))
  expect(await buildStickers(paths)).toMatchObject({ count: 1, missingIcons: expect.arrayContaining(['study']) })
  expect(await readdir(paths.output)).toHaveLength(2)
})

it.each([[128, 128, false], [256, 300, false], [256, 256, true]])(
  'rejects undersized, nonsquare, or opaque PNGs (%s×%s, opaque %s)',
  async (width, height, opaque) => {
    const paths = await context()
    await fixture(width, height, opaque).toFile(join(paths.input, 'study.png'))
    await expect(buildStickers(paths)).rejects.toThrow('study.png:')
    await expect(readFile(paths.manifestFile, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
  },
)
