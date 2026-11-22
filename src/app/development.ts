import { Capacitor } from '@capacitor/core'

export function showDevelopmentTools(dev: boolean, native = Capacitor.isNativePlatform()) {
  return dev && !native
}
