import React, { useState, useEffect, useCallback } from "react";
import { ShoppingBag, Search, Plus, Truck, Calendar, CreditCard, AlertCircle, CheckCircle2, X, Trash2, ChevronRight, Package } from "lucide-react";
import { apiFetch } from "../services/api";
import type { Purchase, Supplier, Product, PurchaseItem } from "../types";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Purchases() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);

  // New Purchase State
  const [newPurchase, setNewPurchase] = useState({
    supplier_id: "",
    status: "PENDING" as const,
    items: [] as { product_id: string; quantity: number; unit_cost: number; subtotal: number }[]
  });

  const fetchPurchases = useCallback(async () => {
    try {
      const [purRes, supRes, prodRes] = await Promise.all([
        apiFetch("/api/purchases"),
        apiFetch("/api/suppliers"),
        apiFetch("/api/products")
      ]);
      
      if (purRes.ok) setPurchases(await purRes.json());
      if (supRes.ok) setSuppliers(await supRes.json());
      if (prodRes.ok) setProducts(await prodRes.json());
    } catch (err) {
      console.error("Failed to fetch data", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPurchases();
  }, [fetchPurchases]);

  const handleAddItem = () => {
    setNewPurchase(prev => ({
      ...prev,
      items: [...prev.items, { product_id: "", quantity: 1, unit_cost: 0, subtotal: 0 }]
    }));
  };

  const handleRemoveItem = (index: number) => {
    setNewPurchase(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    setNewPurchase(prev => {
      const newItems = [...prev.items];
      const item = { ...newItems[index], [field]: value };
      
      if (field === "product_id") {
        const product = products.find(p => p.id === value);
        if (product) {
          item.unit_cost = Number(product.selling_price) * 0.7; // Default cost estimate
        }
      }
      
      item.subtotal = item.quantity * item.unit_cost;
      newItems[index] = item;
      return { ...prev, items: newItems };
    });
  };

  const totalAmount = newPurchase.items.reduce((sum, item) => sum + item.subtotal, 0);

  const handleSavePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPurchase.items.length === 0) {
      setError("Please add at least one item");
      return;
    }
    if (!newPurchase.supplier_id) {
      setError("Please select a supplier");
      return;
    }

    setError("");
    setSuccess("");

    try {
      const res = await apiFetch("/api/purchases", {
        method: "POST",
        body: JSON.stringify({
          ...newPurchase,
          total_amount: totalAmount
        })
      });

      if (res.ok) {
        setSuccess("Purchase order created successfully!");
        setIsModalOpen(false);
        setNewPurchase({ supplier_id: "", status: "PENDING", items: [] });
        fetchPurchases();
      } else {
        const data = await res.json();
        setError(data.error || "Operation failed");
      }
    } catch (err) {
      setError("An error occurred");
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      const res = await apiFetch(`/api/purchases/${id}/status`, {
        method: "PUT",
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        setSuccess("Status updated and inventory adjusted!");
        fetchPurchases();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to update status");
      }
    } catch (err) {
      setError("An error occurred");
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Purchase Orders</h1>
          <p className="text-slate-500 mt-1">Manage inventory procurement and supplier orders.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
        >
          <Plus className="w-5 h-5" />
          Create Purchase
        </button>
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

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-slate-500">PO ID</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-slate-500">Supplier</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-slate-500">Date</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-slate-500">Total</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-slate-500">Status</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400">Loading purchases...</td></tr>
              ) : purchases.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400">No purchases found.</td></tr>
              ) : (
                purchases?.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs text-slate-500 uppercase">#{p.id.slice(0, 8)}</td>
                    <td className="px-6 py-4 font-bold text-slate-900">{p.supplier_name}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{new Date(p.created_at).toLocaleDateString()}</td>
                    <td className="px-6 py-4 font-bold text-slate-900">${Number(p.total_amount).toFixed(2)}</td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                        p.status === 'RECEIVED' ? "bg-emerald-50 text-emerald-600" :
                        p.status === 'PENDING' ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-500"
                      )}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {p.status === 'PENDING' && (
                          <button
                            onClick={() => updateStatus(p.id, 'RECEIVED')}
                            className="text-xs font-bold text-emerald-600 hover:underline"
                          >
                            Mark Received
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

      {/* Create Purchase Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">Create Purchase Order</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSavePurchase} className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Supplier</label>
                  <select
                    required
                    value={newPurchase.supplier_id}
                    onChange={(e) => setNewPurchase({ ...newPurchase, supplier_id: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  >
                    <option value="">Select Supplier</option>
                    {suppliers?.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Status</label>
                  <select
                    value={newPurchase.status}
                    onChange={(e) => setNewPurchase({ ...newPurchase, status: e.target.value as any })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  >
                    <option value="PENDING">Pending</option>
                    <option value="RECEIVED">Received (Auto-Stock)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Purchase Items
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    Add Item
                  </button>
                </div>

                <div className="space-y-3">
                  {newPurchase?.items?.map((item, index) => (
                    <div key={index} className="grid grid-cols-12 gap-3 items-end bg-slate-50 p-3 rounded-2xl border border-slate-100">
                      <div className="col-span-12 md:col-span-5 space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Product</label>
                        <select
                          required
                          value={item.product_id}
                          onChange={(e) => handleItemChange(index, "product_id", e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">Select Product</option>
                          {products?.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-4 md:col-span-2 space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Qty</label>
                        <input
                          required
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, "quantity", Number(e.target.value))}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="col-span-4 md:col-span-2 space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Cost</label>
                        <input
                          required
                          type="number"
                          step="0.01"
                          value={item.unit_cost}
                          onChange={(e) => handleItemChange(index, "unit_cost", Number(e.target.value))}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="col-span-3 md:col-span-2 text-right py-2">
                        <div className="text-[10px] text-slate-400 uppercase font-bold">Subtotal</div>
                        <div className="text-sm font-bold text-slate-900">${item.subtotal.toFixed(2)}</div>
                      </div>
                      <div className="col-span-1 flex justify-end py-2">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="text-rose-500 hover:text-rose-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </form>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <div className="text-right">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Amount</div>
                <div className="text-2xl font-black text-indigo-600">${totalAmount.toFixed(2)}</div>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSavePurchase}
                  className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                >
                  Save Order
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
