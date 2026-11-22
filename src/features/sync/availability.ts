import { Capacitor } from '@capacitor/core'

export function syncAvailable() {
  return !Capacitor.isNativePlatform() && (import.meta.env.VITE_SYNC_EMULATOR === 'true' ||
    !!(import.meta.env.VITE_FIREBASE_PROJECT_ID && import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_FIREBASE_APP_ID))
}
