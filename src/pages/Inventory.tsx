import React, { useState, useEffect, useCallback } from "react";
import { Plus, Minus, Settings, History, Search, Package, AlertCircle, CheckCircle2, ChevronDown, ArrowUpRight, ArrowDownLeft, RefreshCw } from "lucide-react";
import { apiFetch } from "../services/api";
import type { Product, InventoryLog } from "../types";
import { useAuth } from "../context/AuthContext";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Inventory() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [updateType, setUpdateType] = useState<"IN" | "OUT" | "ADJUST">("IN");

  const [formData, setFormData] = useState({
    quantity: 1,
    reason: ""
  });

  const fetchData = useCallback(async () => {
    try {
      const [productsRes, logsRes] = await Promise.all([
        apiFetch("/api/products"),
        apiFetch("/api/inventory/logs")
      ]);

      if (productsRes.ok && logsRes.ok) {
        const [productsData, logsData] = await Promise.all([
          productsRes.json(),
          logsRes.json()
        ]);
        setProducts(productsData);
        setLogs(logsData);
      }
    } catch (err) {
      console.error("Failed to fetch inventory data", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleUpdateStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    setError("");
    setSuccess("");

    try {
      const res = await apiFetch("/api/inventory/update", {
        method: "POST",
        body: JSON.stringify({
          product_id: selectedProduct.id,
          type: updateType,
          quantity: formData.quantity,
          reason: formData.reason
        })
      });

      if (res.ok) {
        setSuccess(`Inventory updated successfully!`);
        setIsModalOpen(false);
        fetchData();
      } else {
        const data = await res.json();
        setError(data.error || "Update failed");
      }
    } catch (err) {
      setError("An error occurred");
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.sku.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Inventory Management</h1>
          <p className="text-slate-500 mt-1">Track stock movements and adjust inventory levels.</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl flex items-center gap-3 text-sm border border-rose-100">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center gap-3 text-sm border border-emerald-100">
          <CheckCircle2 className="w-5 h-5" />
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Stock Levels */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search products by name or SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Product</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Current Stock</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Expiry</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Quick Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-400">Loading inventory...</td>
                    </tr>
                  ) : filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-400">No products found.</td>
                    </tr>
                  ) : (
                    filteredProducts?.map((product) => (
                      <tr key={product.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 shrink-0">
                              <Package className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 truncate">{product.name}</div>
                              <div className="text-[10px] font-mono text-slate-400 uppercase">{product.sku}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={cn(
                            "inline-flex items-center px-3 py-1 rounded-full text-sm font-bold",
                            product.stock_quantity <= product.min_stock 
                              ? "bg-rose-50 text-rose-600" 
                              : "bg-emerald-50 text-emerald-600"
                          )}>
                            {product.stock_quantity} {product.unit}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {product.expiry_date ? (
                            <div className="space-y-0.5">
                              <div className={cn(
                                "text-xs font-bold",
                                new Date(product.expiry_date) < new Date() ? "text-rose-600" : 
                                new Date(product.expiry_date) < new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) ? "text-amber-600" : "text-slate-900"
                              )}>
                                {new Date(product.expiry_date).toLocaleDateString()}
                              </div>
                              <div className="text-[9px] text-slate-400 uppercase tracking-wider">
                                {new Date(product.expiry_date) < new Date() ? "Expired" : 
                                 new Date(product.expiry_date) < new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) ? "Soon" : "Safe"}
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">N/A</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => {
                                setSelectedProduct(product);
                                setUpdateType("IN");
                                setFormData({ quantity: 1, reason: "" });
                                setIsModalOpen(true);
                              }}
                              className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors"
                              title="Stock In"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedProduct(product);
                                setUpdateType("OUT");
                                setFormData({ quantity: 1, reason: "" });
                                setIsModalOpen(true);
                              }}
                              className="p-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-colors"
                              title="Stock Out"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            {["Admin", "Manager"].includes(user?.role || "") && (
                              <button
                                onClick={() => {
                                  setSelectedProduct(product);
                                  setUpdateType("ADJUST");
                                  setFormData({ quantity: product.stock_quantity, reason: "" });
                                  setIsModalOpen(true);
                                }}
                                className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
                                title="Adjust Stock"
                              >
                                <Settings className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Inventory History */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[600px]">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <History className="w-5 h-5" />
                Recent Activity
              </h3>
              <button 
                onClick={fetchData}
                className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6 space-y-6">
              {logs.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <History className="w-12 h-12 mx-auto mb-4 opacity-10" />
                  <p className="text-sm">No activity recorded yet</p>
                </div>
              ) : (
                logs?.map((log) => (
                  <div key={log.id} className="relative pl-8 before:absolute before:left-[11px] before:top-8 before:bottom-[-24px] before:w-px before:bg-slate-100 last:before:hidden">
                    <div className={cn(
                      "absolute left-0 top-1 w-6 h-6 rounded-full flex items-center justify-center",
                      log.type === "IN" ? "bg-emerald-50 text-emerald-600" : 
                      log.type === "OUT" ? "bg-rose-50 text-rose-600" : 
                      "bg-indigo-50 text-indigo-600"
                    )}>
                      {log.type === "IN" ? <ArrowUpRight className="w-3 h-3" /> : 
                       log.type === "OUT" ? <ArrowDownLeft className="w-3 h-3" /> : 
                       <RefreshCw className="w-3 h-3" />}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-900">{log.product_name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        <span className={cn(
                          "font-bold",
                          log.type === "IN" ? "text-emerald-600" : 
                          log.type === "OUT" ? "text-rose-600" : 
                          "text-indigo-600"
                        )}>
                          {log.type === "ADJUST" ? "Set to " : log.type === "IN" ? "+" : "-"}
                          {log.quantity}
                        </span>
                        {" "} units • {log.reason || "No reason provided"}
                      </p>
                      <p className="text-[10px] text-slate-300">
                        {new Date(log.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Update Modal */}
      {isModalOpen && selectedProduct && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">
                {updateType === "IN" ? "Stock In" : updateType === "OUT" ? "Stock Out" : "Adjust Stock"}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            
            <div className="p-6 bg-slate-50 border-b border-slate-100">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-slate-400 shadow-sm">
                  <Package className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900">{selectedProduct.name}</h4>
                  <p className="text-xs text-slate-500">Current Stock: {selectedProduct.stock_quantity} {selectedProduct.unit}</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleUpdateStock} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
                  {updateType === "ADJUST" ? "New Stock Level" : "Quantity"}
                </label>
                <input
                  required
                  type="number"
                  min="0"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Reason / Note</label>
                <textarea
                  rows={3}
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
                  placeholder="e.g., Restock from supplier, Damage, Correction..."
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={cn(
                    "flex-1 py-3 text-white rounded-xl font-bold text-sm transition-all shadow-lg",
                    updateType === "IN" ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100" :
                    updateType === "OUT" ? "bg-rose-600 hover:bg-rose-700 shadow-rose-100" :
                    "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100"
                  )}
                >
                  Confirm Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
