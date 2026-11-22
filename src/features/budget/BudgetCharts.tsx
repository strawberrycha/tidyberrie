import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import type { chartData } from './engine'

const tick = (value: number) => '₱' + new Intl.NumberFormat('en-PH').format(Math.round(value / 100))
const chartHeight = 240

export function BudgetCharts({ data }: { data: ReturnType<typeof chartData> }) {
  const categories = data.categories.map(row => ({ category: row.category, paid: Number(row.paid), planned: Number(row.planned) }))
  const trend = data.trend.map(row => ({
    month: row.month, received: Number(row.received), paid: Number(row.paid), balance: Number(row.balance),
  }))
  return <div className="budget-rows" aria-hidden="true">
    <div><p>Spending by category · paid on the left, planned on the right</p>{categories.length > 0 && <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart data={categories} accessibilityLayer={false}>
        <CartesianGrid stroke="var(--control-border)" vertical={false} />
        <XAxis dataKey="category" tick={{ fill: 'var(--text)' }} /><YAxis tickFormatter={tick} tick={{ fill: 'var(--text)' }} />
        <Bar name="Paid" dataKey="paid" fill="var(--chart-primary)" isAnimationActive={false} />
        <Bar name="Planned" dataKey="planned" fill="var(--chart-alternate)" isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>}</div>
    <div><p>Received income on the left, paid expenses on the right</p><ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart data={trend} accessibilityLayer={false}>
        <CartesianGrid stroke="var(--control-border)" vertical={false} />
        <XAxis dataKey="month" tick={{ fill: 'var(--text)' }} /><YAxis tickFormatter={tick} tick={{ fill: 'var(--text)' }} />
        <Bar dataKey="received" name="Received income" fill="var(--chart-primary)" isAnimationActive={false} />
        <Bar dataKey="paid" name="Paid expenses" fill="var(--chart-alternate)" isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer></div>
    <div><p>Balance trend</p><ResponsiveContainer width="100%" height={chartHeight}>
      <LineChart data={trend} accessibilityLayer={false}>
        <CartesianGrid stroke="var(--control-border)" vertical={false} />
        <XAxis dataKey="month" tick={{ fill: 'var(--text)' }} /><YAxis tickFormatter={tick} tick={{ fill: 'var(--text)' }} />
        <Line dataKey="balance" strokeWidth={3} stroke="var(--chart-primary)" isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer></div>
  </div>
}
