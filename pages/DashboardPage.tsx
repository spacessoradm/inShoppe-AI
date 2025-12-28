
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { cn } from '../lib/utils';

// Mock Data for a richer dashboard
const kpiData = [
  {
    title: "Total Revenue",
    value: "RM45,231",
    change: "+20.1%",
    changeType: "increase",
    icon: DollarSignIcon,
    color: "from-emerald-500 to-teal-500"
  },
  {
    title: "New Leads",
    value: "2,350",
    change: "+180.1%",
    changeType: "increase",
    icon: UsersIcon,
    color: "from-blue-500 to-indigo-500"
  },
  {
    title: "Conversion Rate",
    value: "12.23%",
    change: "+1.9%",
    changeType: "increase",
    icon: ActivityIcon,
    color: "from-violet-500 to-purple-500"
  },
  {
    title: "Avg. Response Time",
    value: "3m 21s",
    change: "-5.2%",
    changeType: "decrease",
    icon: ClockIcon,
    color: "from-amber-500 to-orange-500"
  },
];

const salesData = [
    { name: 'Jan', sales: 4000 },
    { name: 'Feb', sales: 3000 },
    { name: 'Mar', sales: 5000 },
    { name: 'Apr', sales: 4500 },
    { name: 'May', sales: 6000 },
    { name: 'Jun', sales: 5500 },
];

const leadSources = [
    { source: 'WhatsApp Direct', value: 45, color: 'bg-emerald-500' },
    { source: 'Instagram Ads', value: 25, color: 'bg-violet-500' },
    { source: 'Website Form', value: 20, color: 'bg-blue-500' },
    { source: 'Referrals', value: 10, color: 'bg-amber-500' },
];

const recentActivities = [
    { name: 'Alice Johnson', message: 'Just confirmed their order for the premium package.', time: '2m ago', avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026707d', status: 'success' },
    { name: 'Bob Williams', message: 'New hot lead from Instagram campaign.', time: '15m ago', avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026708d', status: 'warning' },
    { name: 'Charlie Brown', message: 'Follow-up scheduled for tomorrow.', time: '1h ago', avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026709d', status: 'info' },
];


const DashboardPage: React.FC = () => {
    return (
        <div className="h-full overflow-y-auto p-4 lg:p-6 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent bg-slate-50">
            <div className="space-y-6 max-w-[1600px] mx-auto">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard</h1>
                        <p className="text-slate-500">Welcome back! Here's what's happening today.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className="flex items-center gap-2 border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
                            <CalendarIcon className="h-4 w-4 text-slate-500" />
                            <span>This Month</span>
                        </Button>
                    </div>
                </div>

                {/* KPI Cards */}
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                    {kpiData.map((kpi) => (
                        <Card key={kpi.title} className="relative overflow-hidden border border-slate-200 bg-white shadow-sm transition-all hover:scale-[1.02] hover:shadow-md group">
                            <div className={cn("absolute top-0 right-0 w-24 h-24 rounded-bl-full opacity-10 transition-opacity group-hover:opacity-20 bg-gradient-to-br", kpi.color)}></div>
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">{kpi.title}</CardTitle>
                                <div className={cn("p-2 rounded-lg bg-gradient-to-br shadow-sm", kpi.color)}>
                                    <kpi.icon className="h-4 w-4 text-white" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold text-slate-900 mb-1">{kpi.value}</div>
                                <p className={cn("text-xs font-semibold flex items-center gap-1", kpi.changeType === 'increase' ? 'text-emerald-600' : 'text-rose-600')}>
                                    {kpi.changeType === 'increase' ? '↑' : '↓'} {kpi.change} 
                                    <span className="text-slate-400 font-normal ml-1">vs last month</span>
                                </p>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Main Content Grid */}
                <div className="grid gap-6 lg:grid-cols-7">
                    {/* Sales Overview Chart (Left Column - Wider) */}
                    <Card className="lg:col-span-4 border border-slate-200 bg-white shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-xl text-slate-900">Sales Overview</CardTitle>
                            <CardDescription className="text-slate-500">Revenue performance over the last 6 months.</CardDescription>
                        </CardHeader>
                        <CardContent className="pl-0">
                        <BarChart data={salesData} />
                        </CardContent>
                    </Card>

                    {/* Lead Source Breakdown (Right Column - Narrower) */}
                    <Card className="lg:col-span-3 border border-slate-200 bg-white shadow-sm flex flex-col">
                        <CardHeader>
                            <CardTitle className="text-xl text-slate-900">Lead Sources</CardTitle>
                            <CardDescription className="text-slate-500">Traffic distribution by channel.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6 flex-1">
                            {leadSources.map(source => {
                                const total = leadSources.reduce((sum, s) => sum + s.value, 0);
                                const percentage = (source.value / total) * 100;
                                return (
                                    <div key={source.source} className="group">
                                        <div className="flex justify-between items-center mb-2">
                                            <div className="flex items-center gap-2">
                                                <div className={cn("w-3 h-3 rounded-full shadow-sm", source.color)}></div>
                                                <span className="text-sm font-medium text-slate-600 group-hover:text-slate-900 transition-colors">{source.source}</span>
                                            </div>
                                            <span className="text-sm font-bold text-slate-700">{source.value} leads</span>
                                        </div>
                                        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                                            <div className={cn("h-full rounded-full transition-all duration-1000 ease-out", source.color)} style={{ width: `${percentage}%` }}></div>
                                        </div>
                                    </div>
                                )
                            })}
                        </CardContent>
                    </Card>

                    {/* Recent Activities (Full Width) */}
                    <Card className="lg:col-span-7 border border-slate-200 bg-white shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-xl text-slate-900">Recent Activity</CardTitle>
                                <CardDescription className="text-slate-500">Latest actions from your team and customers.</CardDescription>
                            </div>
                            <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-900 hover:bg-slate-50">View All</Button>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {recentActivities.map((activity, i) => (
                                    <div key={i} className="flex items-start gap-4 p-3 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                                        <div className="relative">
                                            <img src={activity.avatar} alt={activity.name} className="w-10 h-10 rounded-full border border-slate-200 shadow-sm"/>
                                            <div className={cn("absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white", 
                                                activity.status === 'success' ? 'bg-emerald-500' : 
                                                activity.status === 'warning' ? 'bg-amber-500' : 'bg-blue-500'
                                            )}></div>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-slate-900">{activity.name}</p>
                                            <p className="text-sm text-slate-500 line-clamp-1">{activity.message}</p>
                                        </div>
                                        <span className="text-xs text-slate-400 whitespace-nowrap font-medium">{activity.time}</span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

// --- Reusable Chart Component ---
const BarChart = ({ data }: { data: { name: string, sales: number }[] }) => {
  const maxValue = Math.max(...data.map(d => d.sales));
  return (
    <div className="h-[300px] w-full mt-4">
      <svg width="100%" height="100%" viewBox="0 0 500 300" className="overflow-visible">
        <defs>
            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="1" />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.8" />
            </linearGradient>
        </defs>
        {/* Y-axis lines */}
        {[...Array(5)].map((_, i) => (
          <g key={i}>
            <line x1="0" x2="100%" y1={260 - i * 60} y2={260 - i * 60} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4,4" />
            <text x="-10" y={265 - i * 60} textAnchor="end" fontSize="10" fill="#94a3b8">
              {((maxValue / 4) * i).toFixed(0)}
            </text>
          </g>
        ))}
        
        {/* Bars and X-axis labels */}
        {data.map((d, i) => {
          const barHeight = (d.sales / maxValue) * 240;
          const slotWidth = 500 / data.length;
          const barWidth = 40;
          const x = (i * slotWidth) + (slotWidth - barWidth) / 2;
          
          return (
            <g key={d.name} className="group">
              <rect
                 x={i * slotWidth}
                 y="0"
                 width={slotWidth}
                 height="300"
                 fill="transparent"
                 className="hover:fill-slate-50 transition-colors"
              />
              <rect
                x={x}
                y={260 - barHeight}
                width={barWidth}
                height={barHeight}
                rx="6"
                fill="url(#barGradient)"
                className="transition-all duration-300 group-hover:brightness-110 group-hover:-translate-y-1 drop-shadow-md"
              />
              <text x={x + barWidth / 2} y="285" textAnchor="middle" fontSize="12" fontWeight="500" fill="#64748b">
                {d.name}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};


// --- Icon Components ---

function DollarSignIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" x2="12" y1="2" y2="22" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

function UsersIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function ActivityIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function ClockIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
        </svg>
    )
}

function CalendarIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
            <line x1="16" x2="16" y1="2" y2="6" />
            <line x1="8" x2="8" y1="2" y2="6" />
            <line x1="3" x2="21" y1="10" y2="10" />
        </svg>
    )
}

export default DashboardPage;
