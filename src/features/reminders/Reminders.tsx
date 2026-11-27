import { Link } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { CircleAlert, CircleCheck, CircleHelp } from 'lucide-react'
import { openDeviceSettings, readDeviceInfo } from './deviceSettings'
import { useToast } from '../../shared/ui/Toast'
import type { Access } from './schedulers'
import { queueLimits } from './window'
import { useReminders } from './useReminders'

const permissionLabels: Record<Access, string> = {
  checking: 'Checking…', granted: 'Allowed', denied: 'Off', unavailable: 'Unavailable',
  unknown: 'Unknown – tap to retry', error: 'Check failed',
}

function Status({ label, value }: { label: string; value: Access }) {
  const Icon = value === 'granted' ? CircleCheck : value === 'checking' ? CircleHelp : CircleAlert
  return <p role="status"><Icon size={18} aria-hidden /> {label} · {permissionLabels[value]}</p>
}

export function Reminders() {
  const reminders = useReminders()
  const { status, busy, platform } = reminders
  const android = platform === 'android'
  const show = useToast()
  const [device, setDevice] = useState<Awaited<ReturnType<typeof readDeviceInfo>>>()
  const prompted = useRef(false)
  const canPrompt = status?.canPrompt
  useEffect(() => {
    if (android) void readDeviceInfo().then(setDevice, () => {})
  }, [android])
  useEffect(() => {
    if (canPrompt && !prompted.current) {
      prompted.current = true
      window.dispatchEvent(new CustomEvent('tidyberrie-reminder-explain', { detail: true }))
    }
  }, [canPrompt])

  const notificationAccess = status?.notifications ?? 'unknown'
  const exactAccess = status?.exact ?? 'unknown'
  const settings = (screen: Parameters<typeof openDeviceSettings>[0]) => {
    void openDeviceSettings(screen).catch(() => show({ message: 'Android settings are unavailable.' }))
  }
  const formatTime = (time?: number) => time === undefined ? '—' : new Date(time).toLocaleString()
  async function copyDiagnostics() {
    const report = [
      'Tidyberrie reminder diagnostics', 'Notifications: ' + notificationAccess, 'Exact alarms: ' + exactAccess,
      'Battery optimization: check manually', 'Scheduled: ' + (reminders.pending?.length ?? 'Unknown'),
      'Upcoming times: ' + (reminders.pending ?? []).slice(0, 10).map(item => formatTime(item.at)).join(', '),
      'Last run: ' + formatTime(reminders.lastRun), 'Result: ' + (reminders.result ?? '—'),
      'Last error: ' + (reminders.lastError ?? status?.message ?? '—'),
      'App version: ' + (device?.appVersion ?? '—'), 'Android version: ' + (device?.androidVersion ?? '—'),
    ].join('\n')
    try { await navigator.clipboard.writeText(report); show({ message: 'Diagnostics copied.' }) }
    catch { show({ message: 'Could not copy diagnostics.' }) }
  }

  return <div className="settings-grid">
    <section className="settings-card wide">
      <h2>Delivery</h2>
      {!android && <p>Browser reminders may stop when Tidyberrie is closed or the browser pauses the tab.</p>}
      <Status label="Notifications" value={notificationAccess} />
      {notificationAccess === 'denied' && (canPrompt ? <button className="secondary" type="button" onClick={() => {
        if (android) window.dispatchEvent(new CustomEvent('tidyberrie-reminder-explain', { detail: true }))
        else void reminders.notifications()
      }}>Allow notifications</button> : <p>Allow Tidyberrie notifications in system settings.</p>)}
      {android && <button className="secondary" onClick={() => settings('notifications')}>Open notification settings</button>}
      <Status label="Exact alarms" value={exactAccess} />
      {android && exactAccess === 'denied' && <>
        <p>Android may deliver reminders late. Allow exact alarms if Android offers the setting.</p>
        <button className="secondary" disabled={busy} onClick={() => void reminders.exact()}>Open exact alarm settings</button>
      </>}
      {android && <>
        <p><CircleHelp size={18} aria-hidden /> Battery optimization · Check manually</p>
        <button className="secondary" onClick={() => settings('battery')}>Open battery settings</button>
      </>}
      {status?.message && <p role="alert">{status.message}</p>}
      {reminders.error && <p role="alert">{reminders.lastError} Check the reminders inbox for missed alerts.</p>}
      <button className="secondary" onClick={reminders.refresh}>Retry checks</button>
    </section>
    <section className="settings-card wide">
      <h2>Tests and diagnostics</h2>
      <p>Scheduled reminders · {reminders.pending?.length ?? 'Unknown'}</p>
      {reminders.cappedThrough && <p>Reminders are scheduled through {new Date(reminders.cappedThrough).toLocaleDateString('en-US')}. Open the app to extend.</p>}
      <p>Last run · {formatTime(reminders.lastRun)} · {reminders.result ?? '—'}</p>
      {reminders.lastError && <p>Last error · {reminders.lastError}</p>}
      {device && <p>Tidyberrie {device.appVersion} · Android {device.androidVersion} · {device.model}</p>}
      {!!reminders.pending?.length && <ol>{reminders.pending.slice(0, 10).map((item, index) =>
        <li key={index}>{item.title} · {formatTime(item.at)}</li>)}</ol>}
      <label htmlFor="reminder-limit">Maximum upcoming reminders</label>
      <select id="reminder-limit" value={reminders.limit} disabled={busy}
        onChange={event => void reminders.changeLimit(Number(event.target.value))}>
        {queueLimits.map(value => <option key={value}>{value}</option>)}
      </select>
      <button className="primary" disabled={busy || notificationAccess !== 'granted'} onClick={() => void reminders.test(10)}>Send test reminder in 10 seconds</button>
      <button className="secondary" disabled={busy || notificationAccess !== 'granted'} onClick={() => void reminders.test(60)}>Send test reminder in 1 minute</button>
      <button className="secondary" onClick={reminders.reschedule}>Reschedule all now</button>
      <button className="secondary" onClick={() => void copyDiagnostics()}>Copy diagnostics</button>
      {reminders.testAt && <p role="status">Test reminder due at {formatTime(reminders.testAt)}.</p>}
    </section>
    {android && <details className="settings-card wide reminder-help">
      <summary>Not ringing? (Xiaomi, Redmi, POCO, Oppo, Vivo, Realme, Infinix, Tecno)</summary>
      <ol>
        <li>Allow Autostart for Tidyberrie.</li>
        <li>Set Battery saver to No restrictions and lock Tidyberrie in Recents.</li>
        <li>Set Task reminders to Alert with sound.</li>
        <li>Turn off Do Not Disturb and silent mode while testing.</li>
      </ol>
      <div className="actions">
        <button className="secondary" onClick={() => settings('autostart')}>Open Autostart</button>
        <button className="secondary" onClick={() => settings('channel')}>Open Task reminder category</button>
        <button className="secondary" onClick={() => settings('app')}>Open Android app settings</button>
      </div>
    </details>}
    <Link className="secondary settings-link wide" to="/reminders">Open reminders inbox</Link>
  </div>
}
