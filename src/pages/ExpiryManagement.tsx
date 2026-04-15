import { useState, useEffect } from "react";
import { Calendar, AlertTriangle, Clock, CheckCircle, Search, Filter, Package, Truck } from "lucide-react";
import { apiFetch } from "../services/api";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ExpiryAlert {
  id: string;
  name: string;
  sku: string;
  stock_quantity: number;
  expiry_date: string;
  category_name: string;
  supplier_name?: string;
}

export default function ExpiryManagement() {
  const [alerts, setAlerts] = useState<ExpiryAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "expired" | "soon" | "safe">("all");

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const res = await apiFetch("/api/reports/expiry-alerts");
      if (res.ok) {
        const data = await res.json();
        setAlerts(Array.isArray(data) ? data : []);
      } else {
        setAlerts([]);
      }
    } catch (error) {
      console.error("Failed to fetch expiry alerts:", error);
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatus = (expiryDate: string) => {
    if (!expiryDate) return { label: "Unknown", color: "text-slate-600 bg-slate-50 border-slate-100", icon: AlertTriangle };
    const today = new Date();
    const expiry = new Date(expiryDate);
    if (isNaN(expiry.getTime())) return { label: "Invalid Date", color: "text-slate-600 bg-slate-50 border-slate-100", icon: AlertTriangle };
    
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { label: "Expired", color: "text-rose-600 bg-rose-50 border-rose-100", icon: AlertTriangle };
    if (diffDays <= 7) return { label: "Expires Soon", color: "text-amber-600 bg-amber-50 border-amber-100", icon: Clock };
    if (diffDays <= 30) return { label: "Expiring in 30 Days", color: "text-blue-600 bg-blue-50 border-blue-100", icon: Calendar };
    if (diffDays <= 90) return { label: "Expiring in 3 Months", color: "text-sky-600 bg-sky-50 border-sky-100", icon: Calendar };
    if (diffDays <= 180) return { label: "Expiring in 6 Months", color: "text-indigo-600 bg-indigo-50 border-indigo-100", icon: Calendar };
    return { label: "Safe", color: "text-emerald-600 bg-emerald-50 border-emerald-100", icon: CheckCircle };
  };

  const filteredAlerts = (Array.isArray(alerts) ? alerts : []).filter(alert => {
    const matchesSearch = (alert.name || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
                         (alert.sku || "").toLowerCase().includes(searchTerm.toLowerCase());
    
    const status = getStatus(alert.expiry_date).label;
    if (filterStatus === "expired") return matchesSearch && status === "Expired";
    if (filterStatus === "soon") return matchesSearch && (status === "Expires Soon" || status === "Expiring in 30 Days" || status === "Expiring in 3 Months");
    if (filterStatus === "safe") return matchesSearch && (status === "Safe" || status === "Expiring in 6 Months");
    
    return matchesSearch;
  });

  const stats = {
    expired: (Array.isArray(alerts) ? alerts : []).filter(a => {
      if (!a.expiry_date) return false;
      const diff = new Date(a.expiry_date).getTime() - new Date().getTime();
      return diff < 0;
    }).length,
    soon: (Array.isArray(alerts) ? alerts : []).filter(a => {
      if (!a.expiry_date) return false;
      const diff = new Date(a.expiry_date).getTime() - new Date().getTime();
      const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
      return days >= 0 && days <= 7;
    }).length,
    month: (Array.isArray(alerts) ? alerts : []).filter(a => {
      if (!a.expiry_date) return false;
      const diff = new Date(a.expiry_date).getTime() - new Date().getTime();
      const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
      return days > 7 && days <= 90;
    }).length,
    sixMonth: (Array.isArray(alerts) ? alerts : []).filter(a => {
      if (!a.expiry_date) return false;
      const diff = new Date(a.expiry_date).getTime() - new Date().getTime();
      const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
      return days > 90 && days <= 180;
    }).length,
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Expiration Notification</h1>
        <p className="text-slate-500">Monitor and manage product expiry dates to prevent stock loss.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-rose-50 border border-rose-100 p-6 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 bg-rose-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-rose-200">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-rose-600 uppercase tracking-widest">Expired</p>
            <p className="text-2xl font-bold text-slate-900">{stats.expired}</p>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-100 p-6 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-amber-200">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-amber-600 uppercase tracking-widest">Expires in 7 Days</p>
            <p className="text-2xl font-bold text-slate-900">{stats.soon}</p>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-100 p-6 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-blue-600 uppercase tracking-widest">Expires in 3 Months</p>
            <p className="text-2xl font-bold text-slate-900">{stats.month}</p>
          </div>
        </div>

        <div className="bg-sky-50 border border-sky-100 p-6 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 bg-sky-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-sky-200">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-sky-600 uppercase tracking-widest">Expires in 6 Months</p>
            <p className="text-2xl font-bold text-slate-900">{stats.sixMonth}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search products..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-200">
              {(["all", "expired", "soon", "safe"] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-xs font-medium capitalize transition-all",
                    filterStatus === status
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Expiry Details Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h3 className="font-bold text-slate-900">Expiration Details</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Product</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Stock Qty</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Supplier</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Expiry Date</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                      <p className="text-sm font-medium">Loading alerts...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredAlerts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-rose-500 font-medium">
                    No Records Found!
                  </td>
                </tr>
              ) : (
                filteredAlerts.map((alert) => {
                  const status = getStatus(alert.expiry_date);
                  return (
                    <tr key={alert.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-white transition-colors">
                            <Package className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">{alert.name}</p>
                            <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">{alert.sku}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-slate-700">{alert.stock_quantity}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-slate-600">
                          <Truck className="w-4 h-4" />
                          <p className="text-sm">{alert.supplier_name || "N/A"}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-slate-700">
                          {new Date(alert.expiry_date).toLocaleDateString()}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <div className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest border",
                          status.color
                        )}>
                          <status.icon className="w-3 h-3" />
                          {status.label}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button className="text-xs font-bold text-slate-900 hover:text-slate-600 transition-colors">
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
