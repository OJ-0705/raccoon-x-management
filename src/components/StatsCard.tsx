interface StatsCardProps {
  title: string
  value: string | number
  icon: string
  change?: string
  changePositive?: boolean
  color?: string
}

export default function StatsCard({ title, value, icon, change, changePositive, color = 'orange' }: StatsCardProps) {
  const colorClasses: Record<string, string> = {
    orange: 'bg-orange-500/10 text-orange-400',
    green: 'bg-green-500/10 text-green-400',
    blue: 'bg-blue-500/10 text-blue-400',
    purple: 'bg-purple-500/10 text-purple-400',
    cyan: 'bg-cyan-500/10 text-cyan-400',
    red: 'bg-red-500/10 text-red-400',
  }

  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-400 mb-1">{title}</p>
          <p className="text-2xl font-bold text-white">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          {change && (
            <p className={`text-xs mt-1 ${changePositive ? 'text-green-400' : 'text-red-400'}`}>
              {changePositive ? '▲' : '▼'} {change}
            </p>
          )}
        </div>
        <div className={`p-2.5 rounded-lg text-xl ${colorClasses[color] || colorClasses.orange}`}>
          {icon}
        </div>
      </div>
    </div>
  )
}
