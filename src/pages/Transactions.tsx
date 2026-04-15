import { useState, useEffect } from "react";
import { History, Search, Download, ExternalLink, Calendar, Receipt } from "lucide-react";
import type { Sale } from "../types";
import { apiFetch } from "../services/api";
import { useAuth } from "../context/AuthContext";

export default function Transactions() {
  const { user } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/sales")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch sales");
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setSales(data);
        } else {
          console.error("Expected array of sales, got:", data);
          setSales([]);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setSales([]);
        setLoading(false);
      });
  }, []);

  return (
    <div className="space-y-6 p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Sales History</h1>
          <p className="text-slate-500 mt-1">View and manage all completed sales.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm">
            <Calendar className="w-4 h-4" />
            Filter Date
          </button>
          {["Admin", "Manager"].includes(user?.role || "") && (
            <button className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-slate-500">Sale ID</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-slate-500">Customer</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-slate-500">Date & Time</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-slate-500">Subtotal</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-slate-500">Discount</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-slate-500">Tax</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-slate-500">Total</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-slate-500"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">Loading history...</td>
                </tr>
              ) : sales?.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">No sales recorded yet</td>
                </tr>
              ) : (
                sales?.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="text-sm font-mono text-slate-500 uppercase tracking-tight">
                        #{sale.id.slice(0, 8)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold text-slate-900">
                        {sale.customer_name || "Walk-in"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold text-slate-900">
                        {new Date(sale.created_at).toLocaleDateString()}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {new Date(sale.created_at).toLocaleTimeString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">${Number(sale.total_amount).toFixed(2)}</td>
                    <td className="px-6 py-4 text-sm text-rose-600">-${Number(sale.discount_amount).toFixed(2)}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">${Number(sale.tax_amount).toFixed(2)}</td>
                    <td className="px-6 py-4 text-sm font-black text-slate-900">${Number(sale.final_amount).toFixed(2)}</td>
                    <td className="px-6 py-4 text-right">
                      <button className="p-2 text-slate-400 hover:text-indigo-600 transition-colors" title="View Receipt">
                        <Receipt className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
