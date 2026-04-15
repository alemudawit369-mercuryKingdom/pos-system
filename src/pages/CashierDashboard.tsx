import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { 
  ShoppingBag, 
  Users, 
  ShoppingCart, 
  Calculator, 
  Star, 
  TrendingUp, 
  CreditCard, 
  Calendar,
  Clock,
  Search,
  RefreshCcw,
  ClipboardList,
  Receipt,
  History,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  AlertTriangle,
  HelpCircle,
  Settings,
  UserPlus
} from "lucide-react";
import { apiFetch } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface CashierSummary {
  dailySales: number;
  weeklySales: number;
  monthlySales: number;
  yearlySales: number;
  todayInvoices: number;
  totalInvoices: number;
  availableProducts: number;
  lowStockCount: number;
  expiryCount: number;
  revenue: number;
}

interface SalesChartData {
  date: string;
  total: string;
}

interface TopProduct {
  name: string;
  total_sold: string;
}

export default function CashierDashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<CashierSummary>({
    dailySales: 0,
    weeklySales: 0,
    monthlySales: 0,
    yearlySales: 0,
    todayInvoices: 0,
    totalInvoices: 0,
    availableProducts: 0,
    lowStockCount: 0,
    expiryCount: 0,
    revenue: 0
  });
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [salesChart, setSalesChart] = useState<SalesChartData[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryRes, salesRes, chartRes, topRes] = await Promise.all([
        apiFetch("/api/reports/cashier-summary"),
        apiFetch("/api/sales"),
        apiFetch("/api/reports/sales-chart"),
        apiFetch("/api/reports/top-products")
      ]);

      if (summaryRes.ok) {
        const data = await summaryRes.json();
        if (data) setSummary(data);
      }
      if (salesRes.ok) {
        const sales = await salesRes.json();
        setRecentSales(sales.slice(0, 10));
      }
      if (chartRes.ok) setSalesChart(await chartRes.json());
      if (topRes.ok) setTopProducts(await topRes.json());
    } catch (err) {
      console.error("Failed to fetch cashier dashboard data", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const salesData = {
    labels: salesChart?.map(d => new Date(d.date).toLocaleDateString(undefined, { weekday: 'short' })) || [],
    datasets: [
      {
        fill: true,
        label: 'Your Daily Sales ($)',
        data: salesChart?.map(d => Number(d.total)) || [],
        borderColor: 'rgb(6, 182, 212)',
        backgroundColor: 'rgba(6, 182, 212, 0.1)',
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: 'rgb(6, 182, 212)',
      },
    ],
  };

  const topProductsData = {
    labels: topProducts?.map(p => p.name) || [],
    datasets: [
      {
        label: 'Units Sold',
        data: topProducts?.map(p => Number(p.total_sold)) || [],
        backgroundColor: [
          'rgba(6, 182, 212, 0.8)',
          'rgba(16, 185, 129, 0.8)',
          'rgba(245, 158, 11, 0.8)',
          'rgba(239, 68, 68, 0.8)',
          'rgba(107, 114, 128, 0.8)',
        ],
        borderRadius: 8,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: '#1e293b',
        padding: 12,
        titleFont: { size: 14, weight: 'bold' as const },
        bodyFont: { size: 13 },
        cornerRadius: 8,
        displayColors: false,
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          display: true,
          color: 'rgba(0,0,0,0.05)',
        },
        ticks: {
          font: { size: 11 },
          color: '#64748b'
        }
      },
      x: {
        grid: {
          display: false
        },
        ticks: {
          font: { size: 11 },
          color: '#64748b'
        }
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-4">
          <RefreshCcw className="w-8 h-8 text-indigo-600 animate-spin" />
          <p className="text-slate-500 font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Top Header Bar */}
      <div className="bg-amber-50 border border-amber-100 p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="space-y-1">
          <h2 className="text-amber-900 font-black text-xl tracking-tight">LibanosEPO POS, Store One.</h2>
          <p className="text-amber-700/60 text-xs font-bold uppercase tracking-widest">Active Session</p>
        </div>
        <div className="flex items-center gap-4">
          <Link 
            to="/pos" 
            className="hidden md:flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-indigo-200 transition-all hover:scale-105 active:scale-95"
          >
            <Plus className="w-5 h-5" />
            <span>New Sale</span>
          </Link>
          <div className="bg-emerald-500 text-white px-6 py-3 rounded-xl font-mono font-bold flex items-center gap-3 shadow-lg shadow-emerald-200">
            <Clock className="w-5 h-5" />
            <span className="text-lg">{currentTime.toLocaleTimeString()}</span>
          </div>
          <div className="flex items-center gap-3 px-4 py-2 bg-white border border-amber-200 rounded-xl shadow-sm">
            <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center border-2 border-white ring-1 ring-slate-200">
              <Users className="w-5 h-5 text-slate-500" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-black text-slate-900 truncate">{user?.name}</p>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{user?.role}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Welcome to LibanosEPO POS, Store One.</h1>
        <p className="text-slate-500">Here's what's happening in your store today.</p>
      </div>

      {/* Low Stock Alert */}
      {summary.lowStockCount > 0 && (
        <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex items-center gap-4 animate-pulse">
          <div className="w-10 h-10 bg-rose-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-rose-200">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-black text-rose-900">Low Stock Alert!</h4>
            <p className="text-xs text-rose-700">{summary.lowStockCount} products are running low on stock. Please check inventory.</p>
          </div>
          <Link to="/inventory" className="ml-auto text-xs font-black text-rose-600 hover:text-rose-700 underline underline-offset-4">
            View Inventory
          </Link>
        </div>
      )}

      {/* Expiry Alert */}
      {summary.expiryCount > 0 && (
        <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex items-center gap-4 animate-pulse">
          <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-amber-200">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-black text-amber-900">Expiry Alert!</h4>
            <p className="text-xs text-amber-700">{summary.expiryCount} products are expiring soon. Please check expiry management.</p>
          </div>
          <Link to="/expiry" className="ml-auto text-xs font-black text-amber-600 hover:text-amber-700 underline underline-offset-4">
            View Expiry Alerts
          </Link>
        </div>
      )}

      {/* Main Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MainCard 
          title="Daily Sales" 
          value={`$${(summary.dailySales ?? 0).toLocaleString()}`} 
          icon={ShoppingBag} 
          color="emerald" 
        />
        <MainCard 
          title="Weekly Sales" 
          value={`$${(summary.weeklySales ?? 0).toLocaleString()}`} 
          icon={CreditCard} 
          color="rose" 
        />
        <MainCard 
          title="Monthly Sales Records" 
          value={`$${(summary.monthlySales ?? 0).toLocaleString()}`} 
          icon={Calendar} 
          color="amber" 
        />
        <MainCard 
          title="Yearly Sales Records" 
          value={`$${(summary.yearlySales ?? 0).toLocaleString()}`} 
          icon={TrendingUp} 
          color="sky" 
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Your Sales Performance</h3>
              <p className="text-xs text-slate-500">Revenue trends over the last 7 days</p>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <Line data={salesData} options={chartOptions} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Top Selling Products</h3>
            <p className="text-xs text-slate-500">Best selling items by volume</p>
          </div>
          <div className="h-[300px] w-full">
            <Bar data={topProductsData} options={{
              ...chartOptions,
              indexAxis: 'y' as const,
              scales: {
                ...chartOptions.scales,
                x: {
                  beginAtZero: true,
                  grid: { display: false },
                  ticks: { font: { size: 10 }, color: '#64748b' }
                }
              }
            }} />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
        <h3 className="text-xl font-black text-slate-900 tracking-tight">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <QuickAction 
            label="New Sale" 
            icon={ShoppingCart} 
            href="/pos" 
            color="indigo" 
          />
          <QuickAction 
            label="Transactions" 
            icon={History} 
            href="/transactions" 
            color="cyan" 
          />
          <QuickAction 
            label="Customers" 
            icon={Users} 
            href="/customers" 
            color="emerald" 
          />
          <QuickAction 
            label="New Customer" 
            icon={UserPlus} 
            href="/customers?new=true" 
            color="cyan" 
          />
          <QuickAction 
            label="Sales History" 
            icon={History} 
            href="/sales" 
            color="amber" 
          />
          <QuickAction 
            label="Inventory" 
            icon={ClipboardList} 
            href="/inventory" 
            color="rose" 
          />
          <QuickAction 
            label="Expenses" 
            icon={Receipt} 
            href="/expenses" 
            color="slate" 
          />
          <QuickAction 
            label="Help" 
            icon={HelpCircle} 
            href="/help" 
            color="sky" 
          />
          <QuickAction 
            label="Settings" 
            icon={Settings} 
            href="/settings" 
            color="purple" 
          />
        </div>
      </div>

      {/* Secondary Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Today Invoices" value={summary.todayInvoices} icon={Users} color="orange" />
        <StatCard title="Total Invoices" value={summary.totalInvoices} icon={ShoppingCart} color="purple" />
        <StatCard title="Available Products" value={summary.availableProducts} icon={Calculator} color="pink" />
        <StatCard title="Revenue" value={`$${summary.revenue.toLocaleString()}`} icon={Star} color="yellow" />
      </div>

      {/* Today's Transactions Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-white">
          <h3 className="text-2xl font-black text-cyan-600 tracking-tight">Today's Transactions</h3>
          <button 
            onClick={fetchData}
            className="p-2 text-slate-400 hover:text-cyan-600 transition-colors"
          >
            <RefreshCcw className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/30 border-b border-slate-100">
          <div className="flex items-center gap-3 text-sm font-bold text-slate-500">
            <span>Show</span>
            <select className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 outline-none focus:ring-2 focus:ring-cyan-500/20 shadow-sm">
              <option>10</option>
              <option>25</option>
              <option>50</option>
            </select>
            <span>entries</span>
          </div>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search transactions..." 
              className="w-full pl-12 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-cyan-500/20 shadow-sm transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 bg-slate-50/50">
                <th className="px-8 py-5">Order ID</th>
                <th className="px-8 py-5">Customer</th>
                <th className="px-8 py-5">Payment Method</th>
                <th className="px-8 py-5">Amount</th>
                <th className="px-8 py-5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {recentSales.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <ShoppingCart className="w-12 h-12 text-slate-200" />
                      <p className="text-slate-400 font-medium">No transactions recorded today</p>
                    </div>
                  </td>
                </tr>
              ) : (
                recentSales.map((sale) => (
                  <tr key={sale.id} className="text-sm hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-5 font-mono font-bold text-slate-600">
                      <span className="bg-slate-100 px-2 py-1 rounded text-xs">#{sale.id.slice(0, 8).toUpperCase()}</span>
                    </td>
                    <td className="px-8 py-5 font-bold text-slate-900">{sale.customer_name || "Walk-in Customer"}</td>
                    <td className="px-8 py-5">
                      <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-black uppercase tracking-widest">{sale.payment_method || "CASH"}</span>
                    </td>
                    <td className="px-8 py-5 font-black text-slate-900 text-lg">${Number(sale.final_amount).toFixed(2)}</td>
                    <td className="px-8 py-5">
                      <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm shadow-emerald-100">Completed</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-6 flex items-center justify-between bg-slate-50/30 border-t border-slate-100 text-xs font-bold text-slate-400">
          <div>Showing {recentSales.length} of {recentSales.length} entries</div>
          <div className="flex items-center gap-2">
            <button className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-400 hover:bg-slate-50 disabled:opacity-50 shadow-sm transition-all">Previous</button>
            <button className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-400 hover:bg-slate-50 disabled:opacity-50 shadow-sm transition-all">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MainCard({ title, value, icon: Icon, color }: any) {
  const colors = {
    emerald: "bg-emerald-500/5 border-emerald-100 text-emerald-600",
    rose: "bg-rose-500/5 border-rose-100 text-rose-600",
    amber: "bg-amber-500/5 border-amber-100 text-amber-600",
    sky: "bg-sky-500/5 border-sky-100 text-sky-600",
  };

  const iconColors = {
    emerald: "bg-emerald-500 shadow-emerald-200",
    rose: "bg-rose-500 shadow-rose-200",
    amber: "bg-amber-500 shadow-amber-200",
    sky: "bg-sky-500 shadow-sky-200",
  };

  return (
    <div className={cn("p-6 rounded-3xl border flex items-center gap-6 shadow-sm hover:shadow-md transition-all", colors[color as keyof typeof colors])}>
      <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg", iconColors[color as keyof typeof iconColors])}>
        <Icon className="w-7 h-7" />
      </div>
      <div>
        <div className="text-[10px] font-black uppercase tracking-[0.15em] opacity-60">{title}</div>
        <div className="text-2xl font-black mt-0.5 tracking-tight">{value}</div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color }: any) {
  const colors = {
    orange: "text-orange-400 bg-orange-50",
    purple: "text-purple-400 bg-purple-50",
    pink: "text-pink-400 bg-pink-50",
    yellow: "text-yellow-400 bg-yellow-50",
  };

  return (
    <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between group hover:shadow-md transition-all">
      <div className="space-y-1">
        <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{title}</div>
        <div className="text-3xl font-black text-slate-900 tracking-tight">{value}</div>
      </div>
      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center transition-all group-hover:scale-110", colors[color as keyof typeof colors])}>
        <Icon className="w-6 h-6" />
      </div>
    </div>
  );
}

function QuickAction({ label, icon: Icon, href, color }: any) {
  const colors = {
    indigo: "text-indigo-600 bg-indigo-50 hover:bg-indigo-100",
    cyan: "text-cyan-600 bg-cyan-50 hover:bg-cyan-100",
    emerald: "text-emerald-600 bg-emerald-50 hover:bg-emerald-100",
    amber: "text-amber-600 bg-amber-50 hover:bg-amber-100",
    rose: "text-rose-600 bg-rose-50 hover:bg-rose-100",
    slate: "text-slate-600 bg-slate-50 hover:bg-slate-100",
    sky: "text-sky-600 bg-sky-50 hover:bg-sky-100",
    purple: "text-purple-600 bg-purple-50 hover:bg-purple-100",
  };

  return (
    <Link 
      to={href}
      className={cn(
        "flex flex-col items-center gap-3 p-6 rounded-2xl transition-all hover:scale-105 active:scale-95",
        colors[color as keyof typeof colors]
      )}
    >
      <Icon className="w-8 h-8" />
      <span className="text-xs font-black uppercase tracking-widest text-center">{label}</span>
    </Link>
  );
}
