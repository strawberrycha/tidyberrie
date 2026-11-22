// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

const native = new URL('../../../android/app/src/main/', import.meta.url)
const read = (path: string) => readFileSync(new URL(path, native), 'utf8')

it('declares reminder permissions and registers both native plugins', () => {
  const manifest = read('AndroidManifest.xml')
  const permissions = [...manifest.matchAll(/<uses-permission\s+android:name="([^"]+)"([^>]*)\/>/g)]
  const declared = new Map(permissions.map(([, name, attributes]) => [name, attributes]))
  for (const name of ['POST_NOTIFICATIONS', 'RECEIVE_BOOT_COMPLETED', 'VIBRATE', 'USE_EXACT_ALARM']) {
    expect(declared.has('android.permission.' + name)).toBe(true)
  }
  expect(declared.get('android.permission.SCHEDULE_EXACT_ALARM')).toContain('android:maxSdkVersion="32"')
  const registry = new URL('assets/capacitor.plugins.json', native)
  if (existsSync(registry)) {
    expect(JSON.parse(readFileSync(registry, 'utf8'))).toEqual(expect.arrayContaining([
      expect.objectContaining({ pkg: '@capacitor/local-notifications' }),
      expect.objectContaining({ pkg: '@capacitor/app' }),
    ]))
  }
  expect(read('../../capacitor.build.gradle')).toContain("implementation project(':capacitor-local-notifications')")
  expect(read('../../../capacitor.settings.gradle')).toContain("include ':capacitor-local-notifications'")
  expect(read('java/com/tidyberrie/app/MainActivity.java')).toContain('registerPlugin(DeviceSettingsPlugin.class)')
  expect(read('java/com/tidyberrie/app/DeviceSettingsPlugin.java')).toContain('@CapacitorPlugin(name = "DeviceSettings")')
})
