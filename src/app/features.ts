type Module = 'tasks' | 'home' | 'calendar' | 'budget' | 'dayTheme'

const enabledForBrowserTests = import.meta.env.DEV && import.meta.env.MODE === 'feature-test'

export const features: Readonly<Record<Module, boolean>> = {
  tasks: true,
  home: true,
  calendar: enabledForBrowserTests,
  budget: enabledForBrowserTests,
  dayTheme: enabledForBrowserTests,
}
