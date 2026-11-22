import { Link } from 'react-router-dom'
import { moreGroups } from '../../app/navigation'

export function More() {
  return <div className="more-groups">{moreGroups.map(group => <section className="settings-card" key={group.label}>
    <h2>{group.label}</h2>
    {group.items.map(({ id, icon: Icon, label, route, enabled }) => enabled
      ? <Link className="more-row" key={id} to={route}><Icon aria-hidden size={20} />{label}</Link>
      : id === 'meals' && <p className="more-row" key={id}><Icon aria-hidden size={20} />{label}<span>Coming soon</span></p>)}
  </section>)}</div>
}
