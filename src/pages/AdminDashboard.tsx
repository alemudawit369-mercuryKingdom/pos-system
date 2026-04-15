import React, { useState, useEffect, useCallback } from "react";
import { 
  TrendingUp, 
  DollarSign, 
  Package, 
  AlertTriangle, 
  RefreshCcw,
  Calendar,
  Filter,
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight,
  PieChart as PieChartIcon,
  BarChart3,
  Activity,
  Layers,
  MapPin,
  Users as UsersIcon,
  ShoppingBag,
  CreditCard,
  Clock,
  AlertCircle
} from "lucide-react";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  Legend,
  LineChart,
  Line
} from 'recharts';
import { apiFetch } from "../services/api";
import KpiCard from "../components/KpiCard";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Branch {
  id: string;
  name: string;
  location: string;
}

interface FinancialData {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
  netIncome: number;
}

interface SalesAnalytics {
  byCategory: { name: string; value: number }[];
  byBranch: { name: string; sales: number }[];
  dailySales: { date: string; amount: number }[];
  monthlyRevenue: { month: string; revenue: number }[];
  paymentMethods: { name: string; value: number }[];
}

interface InventoryIntelligence {
  topSelling: { name: string; total_sold: number; stock: number }[];
  lowStock: { name: string; stock: number; min_stock: number }[];
  deadStock: { name: string; stock: number; last_sold: string | null }[];
  inventoryTable: { name: string; stock: number; last_sold: string | null; risk_level: 'High' | 'Medium' | 'Low' }[];
}

interface BranchPerformance {
  name: string;
  revenue: number;
  profit: number;
  transactions: number;
  avgValue: number;
  inventoryValue: number;
}

interface BranchPerformanceResponse {
  branches: BranchPerformance[];
  summary: {
    topBranch: BranchPerformance | null;
    worstBranch: BranchPerformance | null;
  };
}

interface RiskAlerts {
  expiredProducts: { name: string; batch: string; expiryDate: string; stock: number }[];
  nearExpiry: { name: string; batch: string; daysToExpiry: number; stock: number }[];
  lowStock: { name: string; current: number; minStock: number; branch: string }[];
  highDebtCustomers: { name: string; balance: number; lastPayment: string | null }[];
}

interface UserActivity {
  recentLogs: { user: string; action: string; detail: string; time: string; severity: string }[];
  userPerformance: { name: string; sales: number; transactions: number; avgValue: number }[];
}

interface DashboardSummary {
  todayRevenue: number;
  todayRevenueTrend: number;
  monthlyRevenue: number;
  monthlyRevenueTrend: number;
  profit: number;
  profitTrend: number;
  totalOrders: number;
  totalOrdersTrend: number;
  activeBranches: number;
  lowStockCount: number;
  expiredCount: number;
  outstandingCredit: number;
}

export default function AdminDashboard() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [financialData, setFinancialData] = useState<FinancialData[]>([]);
  const [salesAnalytics, setSalesAnalytics] = useState<SalesAnalytics | null>(null);
  const [inventoryIntel, setInventoryIntel] = useState<InventoryIntelligence | null>(null);
  const [branchPerf, setBranchPerf] = useState<BranchPerformanceResponse | null>(null);
  const [riskAlerts, setRiskAlerts] = useState<RiskAlerts | null>(null);
  const [userActivity, setUserActivity] = useState<UserActivity | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    setRefreshing(true);
    try {
      const branchParam = selectedBranch === "all" ? "" : `branch_id=${selectedBranch}`;
      const dateParams = startDate && endDate ? `&start_date=${startDate}&end_date=${endDate}` : "";
      const branchUrl = branchParam ? `?${branchParam}${dateParams}` : (dateParams ? `?${dateParams.substring(1)}` : "");
      
      const [branchesRes, financialRes, salesRes, inventoryRes, branchPerfRes, riskRes, userRes, summaryRes] = await Promise.all([
        apiFetch("/api/branches"),
        apiFetch(`/api/reports/financial-overview${branchUrl}`),
        apiFetch(`/api/reports/sales-analytics${branchUrl}`),
        apiFetch(`/api/reports/inventory-intelligence${branchUrl}`),
        apiFetch(`/api/reports/branch-performance${branchUrl}`),
        apiFetch(`/api/reports/risk-alerts${branchUrl}`),
        apiFetch(`/api/reports/user-activity${branchUrl}`),
        apiFetch(`/api/reports/admin-summary${branchUrl}`)
      ]);

      if (branchesRes.ok) setBranches(await branchesRes.json() || []);
      if (financialRes.ok) setFinancialData(await financialRes.json() || []);
      if (salesRes.ok) setSalesAnalytics(await salesRes.json() || null);
      if (inventoryRes.ok) setInventoryIntel(await inventoryRes.json() || null);
      if (branchPerfRes.ok) setBranchPerf(await branchPerfRes.json() || null);
      if (riskRes.ok) setRiskAlerts(await riskRes.json() || null);
      if (userRes.ok) setUserActivity(await userRes.json() || null);
      if (summaryRes.ok) setSummary(await summaryRes.json() || null);
    } catch (err) {
      console.error("Failed to fetch dashboard data", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedBranch, startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)] bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-slate-800 border-t-indigo-500 rounded-full animate-spin" />
            <Activity className="absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 text-indigo-500" />
          </div>
          <p className="text-slate-500 font-bold animate-pulse">Initializing Intelligence...</p>
        </div>
      </div>
    );
  }

  const latestData = financialData[financialData.length - 1] || { revenue: 0, expenses: 0, profit: 0, netIncome: 0 };
  const previousData = financialData[financialData.length - 2] || { revenue: 0, expenses: 0, profit: 0, netIncome: 0 };

  const calculateTrend = (current: number, previous: number) => {
    if (previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  };

  const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#06b6d4'];

  return (
    <div className="min-h-screen bg-slate-950 p-6 lg:p-10 space-y-10 text-slate-200">
      {/* Header & Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-black text-white tracking-tight flex items-center gap-3">
            Admin Intelligence
            <span className="text-[10px] font-black bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full uppercase tracking-widest">Advanced</span>
          </h1>
          <p className="text-slate-500 font-medium">Multi-branch performance & risk monitoring</p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="relative group">
            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-hover:text-indigo-400 transition-colors" />
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="pl-11 pr-10 py-3 bg-slate-900/50 border border-slate-800 rounded-2xl text-sm font-bold text-slate-300 shadow-sm focus:ring-2 focus:ring-indigo-500/50 outline-none appearance-none transition-all hover:border-slate-700 backdrop-blur-xl"
            >
              <option value="all">All Branches</option>
              {Array.isArray(branches) && branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          </div>

          <div className="flex items-center gap-2 bg-slate-900/50 border border-slate-800 rounded-2xl px-4 py-2 shadow-sm backdrop-blur-xl">
            <Calendar className="w-4 h-4 text-slate-500" />
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-sm font-bold text-slate-300 outline-none [color-scheme:dark]"
            />
            <span className="text-slate-600">to</span>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-sm font-bold text-slate-300 outline-none [color-scheme:dark]"
            />
          </div>

          <button 
            onClick={fetchData}
            disabled={refreshing}
            className="p-3 bg-slate-900/50 border border-slate-800 rounded-2xl text-slate-400 hover:bg-slate-800 hover:text-white transition-all shadow-sm disabled:opacity-50 backdrop-blur-xl"
          >
            <RefreshCcw className={cn("w-5 h-5", refreshing && "animate-spin")} />
          </button>

          <div className="flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-indigo-500/20">
            <Calendar className="w-4 h-4 text-indigo-200" />
            Last 12 Months
          </div>
        </div>
      </div>

      {/* Financial Overview Section */}
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-500/10 rounded-lg flex items-center justify-center border border-indigo-500/20">
            <Activity className="w-5 h-5 text-indigo-400" />
          </div>
          <h2 className="text-xl font-bold text-white">Key Performance Indicators</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <KpiCard 
            title="Today Revenue" 
            value={`$${(summary?.todayRevenue || 0).toLocaleString()}`}
            trend={summary?.todayRevenueTrend}
            trendLabel="vs yesterday"
            icon={TrendingUp}
            color="indigo"
            loading={refreshing && !summary}
          />
          <KpiCard 
            title="Monthly Revenue" 
            value={`$${(summary?.monthlyRevenue || 0).toLocaleString()}`}
            trend={summary?.monthlyRevenueTrend}
            trendLabel="vs last month"
            icon={DollarSign}
            color="emerald"
            loading={refreshing && !summary}
          />
          <KpiCard 
            title="Net Profit" 
            value={`$${(summary?.profit || 0).toLocaleString()}`}
            trend={summary?.profitTrend}
            trendLabel="vs last month"
            icon={Layers}
            color="violet"
            loading={refreshing && !summary}
          />
          <KpiCard 
            title="Total Orders" 
            value={summary?.totalOrders || 0}
            trend={summary?.totalOrdersTrend}
            trendLabel="vs last month"
            icon={ShoppingBag}
            color="sky"
            loading={refreshing && !summary}
          />
          <KpiCard 
            title="Active Branches" 
            value={summary?.activeBranches || branches.length}
            icon={MapPin}
            color="amber"
            loading={refreshing && !summary}
          />
          <KpiCard 
            title="Low Stock Items" 
            value={summary?.lowStockCount || 0}
            icon={Package}
            color="rose"
            inverseTrend
            trend={summary?.lowStockCount && summary.lowStockCount > 0 ? -10 : 0} // Mock trend for visual
            loading={refreshing && !summary}
          />
          <KpiCard 
            title="Expired Products" 
            value={summary?.expiredCount || 0}
            icon={AlertTriangle}
            color="rose"
            inverseTrend
            loading={refreshing && !summary}
          />
          <KpiCard 
            title="Outstanding Credit" 
            value={`$${(summary?.outstandingCredit || 0).toLocaleString()}`}
            icon={CreditCard}
            color="amber"
            inverseTrend
            loading={refreshing && !summary}
          />
        </div>

        <div className="bg-slate-900/50 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-800 shadow-sm space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-2xl font-black text-white tracking-tight">Financial Performance Trend</h3>
              <p className="text-slate-500 text-sm font-medium">Revenue vs Expenses vs Net Income over time</p>
            </div>
            <div className="flex items-center gap-6">
              <LegendItem color="#6366f1" label="Revenue" />
              <LegendItem color="#f43f5e" label="Expenses" />
              <LegendItem color="#10b981" label="Net Income" />
            </div>
          </div>

          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={financialData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                <XAxis 
                  dataKey="month" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }}
                  tickFormatter={(value) => `$${value / 1000}k`}
                />
                <RechartsTooltip 
                  contentStyle={{ 
                    backgroundColor: '#0f172a', 
                    border: '1px solid #1e293b', 
                    borderRadius: '16px',
                    color: '#fff',
                    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.5)'
                  }}
                  itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#6366f1" 
                  strokeWidth={4}
                  fillOpacity={1} 
                  fill="url(#colorRev)" 
                />
                <Area 
                  type="monotone" 
                  dataKey="netIncome" 
                  stroke="#10b981" 
                  strokeWidth={4}
                  fillOpacity={1} 
                  fill="url(#colorNet)" 
                />
                <Line 
                  type="monotone" 
                  dataKey="expenses" 
                  stroke="#f43f5e" 
                  strokeWidth={3}
                  strokeDasharray="8 4"
                  dot={{ r: 4, fill: '#f43f5e', strokeWidth: 2, stroke: '#0f172a' }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Sales Analytics Section */}
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-amber-500/10 rounded-lg flex items-center justify-center border border-amber-500/20">
            <BarChart3 className="w-5 h-5 text-amber-400" />
          </div>
          <h2 className="text-xl font-bold text-white">Sales Analytics</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Daily Sales Line Chart */}
          <div className="bg-slate-900/50 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-800 shadow-sm space-y-6">
            <h3 className="text-lg font-bold text-white">Daily Sales Trend</h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={salesAnalytics?.dailySales || []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
                    tickFormatter={(str) => new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
                    tickFormatter={(val) => `$${val}`}
                  />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', color: '#fff' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="amount" 
                    stroke="#6366f1" 
                    strokeWidth={3} 
                    dot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#0f172a' }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Monthly Revenue Bar Chart */}
          <div className="bg-slate-900/50 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-800 shadow-sm space-y-6">
            <h3 className="text-lg font-bold text-white">Monthly Revenue</h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesAnalytics?.monthlyRevenue || []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                  <XAxis 
                    dataKey="month" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
                    tickFormatter={(val) => `$${val / 1000}k`}
                  />
                  <RechartsTooltip 
                    cursor={{ fill: '#1e293b' }}
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', color: '#fff' }}
                  />
                  <Bar dataKey="revenue" fill="#10b981" radius={[6, 6, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Payment Methods Pie Chart */}
          <div className="bg-slate-900/50 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-800 shadow-sm space-y-6">
            <h3 className="text-lg font-bold text-white">Payment Methods Distribution</h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={salesAnalytics?.paymentMethods || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    stroke="none"
                  >
                    {salesAnalytics?.paymentMethods?.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', color: '#fff' }}
                  />
                  <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="bg-slate-900/50 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-800 shadow-sm space-y-6">
            <h3 className="text-lg font-bold text-white">Category Breakdown</h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={salesAnalytics?.byCategory || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {salesAnalytics?.byCategory?.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', color: '#fff' }}
                  />
                  <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Inventory Intelligence Section */}
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center border border-emerald-500/20">
            <Package className="w-5 h-5 text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-white">Inventory Intelligence</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Top Selling Products */}
          <div className="bg-slate-900/50 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-800 shadow-sm space-y-6">
            <h3 className="text-lg font-bold text-white">Top Velocity Products</h3>
            <div className="space-y-4">
              {inventoryIntel?.topSelling?.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50">
                  <div>
                    <div className="text-sm font-bold text-white">{item.name}</div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{item.total_sold} units sold</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-black text-indigo-400">{item.stock}</div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">In Stock</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Low Stock & Dead Stock Summary */}
          <div className="bg-slate-900/50 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-800 shadow-sm space-y-8">
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
                Critical Low Stock
              </h3>
              <div className="space-y-3">
                {inventoryIntel?.lowStock?.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span className="font-bold text-slate-300">{item.name}</span>
                    <span className="font-black text-rose-400">{item.stock} / {item.min_stock}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <RefreshCcw className="w-5 h-5 text-amber-400" />
                Dead Stock (90+ Days)
              </h3>
              <div className="space-y-3">
                {inventoryIntel?.deadStock?.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span className="font-bold text-slate-300">{item.name}</span>
                    <span className="font-medium text-slate-500">
                      {item.last_sold ? new Date(item.last_sold).toLocaleDateString() : 'Never Sold'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Detailed Risk Table */}
          <div className="lg:col-span-3 bg-slate-900/50 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-800 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Inventory Risk Assessment</h3>
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-rose-500" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">High Risk</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Medium Risk</span>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left border-b border-slate-800">
                    <th className="pb-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Product</th>
                    <th className="pb-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Stock Level</th>
                    <th className="pb-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Last Sold</th>
                    <th className="pb-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Risk Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {inventoryIntel?.inventoryTable?.map((item, idx) => (
                    <tr key={idx} className="group hover:bg-slate-800/30 transition-colors">
                      <td className="py-4 text-sm font-bold text-slate-300">{item.name}</td>
                      <td className="py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-white">{item.stock}</span>
                          <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div 
                              className={cn(
                                "h-full rounded-full",
                                item.risk_level === 'High' ? "bg-rose-500" : 
                                item.risk_level === 'Medium' ? "bg-amber-500" : "bg-emerald-500"
                              )}
                              style={{ width: `${Math.min(100, (item.stock / 100) * 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-4 text-sm font-medium text-slate-500">
                        {item.last_sold ? new Date(item.last_sold).toLocaleDateString() : 'Never'}
                      </td>
                      <td className="py-4">
                        <span className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                          item.risk_level === 'High' ? "bg-rose-500/10 text-rose-400" : 
                          item.risk_level === 'Medium' ? "bg-amber-500/10 text-amber-400" : 
                          "bg-emerald-500/10 text-emerald-400"
                        )}>
                          {item.risk_level} Risk
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Branch Performance Section */}
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-500/10 rounded-lg flex items-center justify-center border border-indigo-500/20">
            <MapPin className="w-5 h-5 text-indigo-400" />
          </div>
          <h2 className="text-xl font-bold text-white">Branch Performance</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Top vs Worst Branch Summary */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-slate-900/50 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-800 shadow-sm space-y-6">
              <h3 className="text-lg font-bold text-white">Performance Leaderboard</h3>
              
              <div className="space-y-6">
                {/* Top Branch */}
                <div className="p-6 bg-emerald-500/5 rounded-3xl border border-emerald-500/10 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Top Performer</span>
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-2xl font-black text-white">{branchPerf?.summary?.topBranch?.name || 'N/A'}</div>
                    <div className="text-sm font-bold text-emerald-400">${branchPerf?.summary?.topBranch?.revenue?.toLocaleString() || '0'} Revenue</div>
                  </div>
                </div>

                {/* Worst Branch */}
                <div className="p-6 bg-rose-500/5 rounded-3xl border border-rose-500/10 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Needs Attention</span>
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                  </div>
                  <div>
                    <div className="text-2xl font-black text-white">{branchPerf?.summary?.worstBranch?.name || 'N/A'}</div>
                    <div className="text-sm font-bold text-rose-400">${branchPerf?.summary?.worstBranch?.revenue?.toLocaleString() || '0'} Revenue</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 text-white space-y-6">
              <h3 className="text-lg font-bold">Network Efficiency</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Avg. Transaction</div>
                  <div className="text-xl font-black text-indigo-400">
                    ${((branchPerf?.branches?.reduce((acc, b) => acc + b.avgValue, 0) || 0) / (branchPerf?.branches?.length || 1)).toFixed(2)}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total Network Value</div>
                  <div className="text-xl font-black text-emerald-400">
                    ${(branchPerf?.branches?.reduce((acc, b) => acc + b.inventoryValue, 0) || 0).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Comparison Charts */}
          <div className="lg:col-span-2 bg-slate-900/50 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-800 shadow-sm space-y-8">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Branch Comparison</h3>
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-indigo-500" />
                  <span className="text-xs font-bold text-slate-500">Revenue</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-xs font-bold text-slate-500">Inventory Value</span>
                </div>
              </div>
            </div>

            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={branchPerf?.branches || []}
                  layout="vertical"
                  margin={{ left: 40, right: 40 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#1e293b" />
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 12, fontWeight: 700 }}
                    width={120}
                  />
                  <RechartsTooltip 
                    cursor={{ fill: '#1e293b' }}
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', color: '#fff' }}
                  />
                  <Bar dataKey="revenue" fill="#6366f1" radius={[0, 10, 10, 0]} barSize={20} />
                  <Bar dataKey="inventoryValue" fill="#10b981" radius={[0, 10, 10, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Detailed Table */}
            <div className="overflow-x-auto pt-6 border-t border-slate-800">
              <table className="w-full">
                <thead>
                  <tr className="text-left">
                    <th className="pb-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Branch</th>
                    <th className="pb-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Transactions</th>
                    <th className="pb-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Profit</th>
                    <th className="pb-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Efficiency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {branchPerf?.branches?.map((branch, idx) => (
                    <tr key={idx} className="group hover:bg-slate-800/30 transition-colors">
                      <td className="py-4 text-sm font-bold text-slate-300">{branch.name}</td>
                      <td className="py-4 text-sm font-black text-white text-right">{branch.transactions}</td>
                      <td className="py-4 text-sm font-bold text-emerald-400 text-right">${branch.profit.toLocaleString()}</td>
                      <td className="py-4 text-right">
                        <div className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-500/10 text-indigo-400 rounded-lg text-[10px] font-black uppercase">
                          <Activity className="w-3 h-3" />
                          {((branch.profit / branch.revenue) * 100).toFixed(1)}%
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Risk & Alerts Section */}
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-rose-500/10 rounded-lg flex items-center justify-center border border-rose-500/20">
            <AlertTriangle className="w-5 h-5 text-rose-400" />
          </div>
          <h2 className="text-xl font-bold text-white">Risk & Critical Alerts</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Expired Products (Critical - Red) */}
          <div className="bg-slate-900/50 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-800 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Expired Products</h3>
              <span className="px-3 py-1 bg-rose-500/10 text-rose-400 rounded-full text-[10px] font-black uppercase tracking-widest">Critical</span>
            </div>
            <div className="space-y-4">
              {riskAlerts?.expiredProducts?.length === 0 ? (
                <div className="text-sm text-slate-500 font-medium py-4 text-center italic">No expired products found.</div>
              ) : (
                riskAlerts?.expiredProducts?.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 bg-rose-500/5 rounded-2xl border border-rose-500/10">
                    <div className="space-y-1">
                      <div className="text-sm font-bold text-white">{item.name}</div>
                      <div className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">Batch: {item.batch}</div>
                    </div>
                    <div className="text-right space-y-1">
                      <div className="text-xs font-black text-rose-400 uppercase tracking-wider">Expired: {new Date(item.expiryDate).toLocaleDateString()}</div>
                      <div className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">Stock: {item.stock}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Near Expiry (Warning - Yellow) */}
          <div className="bg-slate-900/50 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-800 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Near Expiry (7-30 Days)</h3>
              <span className="px-3 py-1 bg-amber-500/10 text-amber-400 rounded-full text-[10px] font-black uppercase tracking-widest">Warning</span>
            </div>
            <div className="space-y-4">
              {riskAlerts?.nearExpiry?.length === 0 ? (
                <div className="text-sm text-slate-500 font-medium py-4 text-center italic">No products near expiry.</div>
              ) : (
                riskAlerts?.nearExpiry?.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 bg-amber-500/5 rounded-2xl border border-amber-500/10">
                    <div className="space-y-1">
                      <div className="text-sm font-bold text-white">{item.name}</div>
                      <div className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Batch: {item.batch}</div>
                    </div>
                    <div className="text-right space-y-1">
                      <div className="text-xs font-black text-amber-400 uppercase tracking-wider">{item.daysToExpiry} Days Remaining</div>
                      <div className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Stock: {item.stock}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Low Stock Alerts */}
          <div className="bg-slate-900/50 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-800 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Low Stock Alerts</h3>
              <Package className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="space-y-4">
              {riskAlerts?.lowStock?.length === 0 ? (
                <div className="text-sm text-slate-500 font-medium py-4 text-center italic">All stock levels are healthy.</div>
              ) : (
                riskAlerts?.lowStock?.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50">
                    <div className="space-y-1">
                      <div className="text-sm font-bold text-white">{item.name}</div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Branch: {item.branch}</div>
                    </div>
                    <div className="text-right space-y-1">
                      <div className="text-xs font-black text-rose-400 uppercase tracking-wider">{item.current} / {item.minStock} Left</div>
                      <div className="w-20 h-1.5 bg-slate-800 rounded-full overflow-hidden ml-auto">
                        <div 
                          className="h-full bg-rose-500" 
                          style={{ width: `${(item.current / item.minStock) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* High Debt Customers */}
          <div className="bg-slate-900/50 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-800 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">High Debt Customers</h3>
              <CreditCard className="w-5 h-5 text-rose-400" />
            </div>
            <div className="space-y-4">
              {riskAlerts?.highDebtCustomers?.length === 0 ? (
                <div className="text-sm text-slate-500 font-medium py-4 text-center italic">No outstanding debts.</div>
              ) : (
                riskAlerts?.highDebtCustomers?.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50">
                    <div className="space-y-1">
                      <div className="text-sm font-bold text-white">{item.name}</div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Last Payment: {item.lastPayment ? new Date(item.lastPayment).toLocaleDateString() : 'Never'}</div>
                    </div>
                    <div className="text-right space-y-1">
                      <div className="text-sm font-black text-rose-400">${item.balance.toLocaleString()}</div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Outstanding</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* User Activity Section */}
      <div className="space-y-6 pb-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-sky-500/10 rounded-lg flex items-center justify-center border border-sky-500/20">
            <UsersIcon className="w-5 h-5 text-sky-400" />
          </div>
          <h2 className="text-xl font-bold text-white">User Activity & Performance</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent Activity Logs */}
          <div className="bg-slate-900/50 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-800 shadow-sm space-y-6">
            <h3 className="text-lg font-bold text-white">Recent Audit Logs</h3>
            <div className="space-y-6">
              {userActivity?.recentLogs?.map((log, idx) => (
                <div key={idx} className="flex gap-4 relative">
                  {idx !== (userActivity?.recentLogs?.length || 0) - 1 && (
                    <div className="absolute left-[11px] top-8 bottom-[-24px] w-[2px] bg-slate-800" />
                  )}
                  <div className={cn(
                    "w-6 h-6 rounded-full border-4 border-slate-900 shadow-sm shrink-0 z-10",
                    log.severity === 'High' ? "bg-rose-500" : log.severity === 'Medium' ? "bg-amber-500" : "bg-indigo-500"
                  )} />
                  <div className="space-y-1">
                    <div className="text-xs font-black text-white">
                      {log.user} <span className="font-medium text-slate-500">{log.action}</span>
                      {log.severity === 'High' && (
                        <span className="ml-2 px-1.5 py-0.5 bg-rose-500/10 text-rose-400 text-[8px] rounded uppercase font-black">Suspicious</span>
                      )}
                    </div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{log.detail}</div>
                    <div className="text-[10px] font-medium text-indigo-400">{log.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* User Performance Table */}
          <div className="lg:col-span-2 bg-slate-900/50 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-800 shadow-sm space-y-6">
            <h3 className="text-lg font-bold text-white">Cashier Performance (Last 30 Days)</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left border-b border-slate-800">
                    <th className="pb-4 text-xs font-bold text-slate-500 uppercase tracking-widest">User</th>
                    <th className="pb-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Total Sales</th>
                    <th className="pb-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Transactions</th>
                    <th className="pb-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Avg. Ticket</th>
                    <th className="pb-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Efficiency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {userActivity?.userPerformance?.map((user, idx) => (
                    <tr key={idx} className="group hover:bg-slate-800/30 transition-colors">
                      <td className="py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center text-xs font-bold text-slate-400">
                            {user.name.charAt(0)}
                          </div>
                          <span className="text-sm font-bold text-slate-300">{user.name}</span>
                        </div>
                      </td>
                      <td className="py-4 text-sm font-bold text-white">${user.sales.toLocaleString()}</td>
                      <td className="py-4 text-sm font-medium text-slate-500">{user.transactions}</td>
                      <td className="py-4 text-sm font-medium text-slate-500">${user.avgValue.toFixed(0)}</td>
                      <td className="py-4">
                        <div className="w-24 h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-emerald-500 rounded-full" 
                            style={{ width: `${Math.min(100, (user.sales / 5000) * 100)}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string, label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</span>
    </div>
  );
}
