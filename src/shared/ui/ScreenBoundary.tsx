import { Component } from 'react'
import type { ReactNode } from 'react'

export class ScreenBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return <section className="settings-card">
      <p role="alert">This screen could not open.</p>
      <button className="secondary" onClick={() => window.location.reload()}>Reload Tidyberrie</button>
    </section>
  }
}
