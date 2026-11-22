import { useState } from 'react'
import { Link } from 'react-router-dom'
import { queueLimits } from './window'
import { useReminders } from './useReminders'

const permissionLabels = { granted: 'Allowed', denied: 'Denied', prompt: 'Not requested', unsupported: 'Unavailable' }

export function Reminders() {
  const reminders = useReminders()
  const { status, busy, due, platform } = reminders
  const [limit, setLimit] = useState(20)
  const android = platform === 'android'

  return <div className="settings-grid">
    <Link className="secondary" to="/settings">Back to Settings</Link>
    <section className="settings-card wide">
      <h2>Delivery</h2>
      <p>{android ? 'Allow notifications so Android can show task alerts, including when the app is closed.'
        : 'Web reminders use a running Tidyberrie page. Browsers can pause background tabs. Delivery cannot be guaranteed when the app is closed.'}</p>
      <p role="status">Notifications {status ? permissionLabels[status.notifications].toLowerCase() : 'checking'}</p>
      {status && status.notifications !== 'granted' && status.notifications !== 'unsupported' &&
        <button className="secondary" type="button" disabled={busy} onClick={() => void reminders.notifications()}>Allow notifications</button>}
      {!android && status?.notifications === 'denied' && <p>To allow alerts again, change this site’s notification permission in your browser settings.</p>}
      <p>Exact alarms {status ? permissionLabels[status.exact].toLowerCase() : 'checking'}</p>
      {android && <>
        <p>Allow exact alarms to improve timing. Without this permission Android may deliver notifications late.</p>
        {status?.exact === 'denied' && <button className="secondary" type="button" disabled={busy}
          onClick={() => void reminders.exact()}>Open exact alarm settings</button>}
        <p>For reliable delivery, check Tidyberrie’s battery settings. If your phone has an auto-start or background activity setting, allow it for Tidyberrie.</p>
        <button className="secondary" type="button" disabled={busy} onClick={() => void reminders.settings()}>Open Android app settings</button>
      </>}
      {reminders.error && <p role="alert">Could not sync system notifications. Check Due reminders for missed alerts.</p>}
      <label htmlFor="reminder-limit">Maximum upcoming reminders</label>
      <select id="reminder-limit" value={reminders.limit} disabled={busy}
        onChange={event => void reminders.changeLimit(Number(event.target.value))}>
        {queueLimits.map(value => <option key={value}>{value}</option>)}
      </select>
      <button className="primary" type="button" disabled={busy} onClick={() => void reminders.test()}>Send test reminder in 1 minute</button>
      {reminders.testAt && <p role="status">Test reminder set for {new Date(reminders.testAt).toLocaleTimeString()}.</p>}
    </section>
    <section className="settings-card wide">
      <h2>Due reminders</h2>
      <p>Recent reminders appear here even when system notifications are turned off.</p>
      <p role="status">{due.length ? due.length + ' due' : 'No due reminders.'}</p>
      {due.length > 0 && <ul className="settings-grid">{due.slice(0, limit).map(item => <li key={item.key} className="settings-card wide">
        <h3>{item.title}</h3>
        <time dateTime={new Date(item.at).toISOString()}>{new Date(item.at).toLocaleString()}</time>
        <div className="actions">
          <button type="button" className="secondary" disabled={busy} onClick={() => void reminders.snooze(item, '10-minutes')}>Snooze 10 min</button>
          <button type="button" className="secondary" disabled={busy} onClick={() => void reminders.snooze(item, '1-hour')}>Snooze 1 hour</button>
          <button type="button" className="secondary" disabled={busy} onClick={() => void reminders.snooze(item, 'tomorrow')}>Snooze until tomorrow</button>
          <button type="button" className="secondary" disabled={busy} onClick={() => void reminders.dismiss(item)}>Dismiss</button>
        </div>
      </li>)}</ul>}
      {due.length > limit && <button type="button" className="secondary" onClick={() => setLimit(limit + 20)}>Show more reminders</button>}
    </section>
  </div>
}
