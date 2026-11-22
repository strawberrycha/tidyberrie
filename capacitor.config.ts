import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.tidyberrie.app',
  appName: 'Tidyberrie',
  webDir: 'dist',
  plugins: { SystemBars: { insetsHandling: 'native', initialViewportFitValueHint: 'cover' } },
}

export default config
