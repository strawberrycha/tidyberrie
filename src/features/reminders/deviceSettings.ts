import { registerPlugin } from '@capacitor/core'

type Screen = 'app' | 'battery' | 'notifications' | 'channel' | 'autostart'
type DeviceInfo = { appVersion: string; androidVersion: string; model: string }
type DeviceSettingsPlugin = {
  open(options: { screen: Screen }): Promise<void>
  info(): Promise<DeviceInfo>
}

const plugin = registerPlugin<DeviceSettingsPlugin>('DeviceSettings')
export const readDeviceInfo = () => plugin.info()
export async function openDeviceSettings(screen: Screen, bridge = plugin) {
  try { await bridge.open({ screen }) }
  catch (error) {
    if (screen === 'app') throw error
    await bridge.open({ screen: 'app' })
  }
}
