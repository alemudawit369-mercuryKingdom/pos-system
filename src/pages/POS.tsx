import React, { useState, useEffect, useRef, useCallback } from "react";
import { Search, ShoppingCart, Plus, Minus, Trash2, CreditCard, Banknote, Smartphone, Receipt as ReceiptIcon, AlertCircle, CheckCircle2, X, User, UserPlus, Loader2 } from "lucide-react";
import { apiFetch } from "../services/api";
import type { Product, CartItem, Sale, Customer } from "../types";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import Receipt from "../components/Receipt";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function POS() {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  // Sale settings
  const [discountType, setDiscountType] = useState<"FIXED" | "PERCENT">("FIXED");
  const [discountValue, setDiscountValue] = useState(0);
  const [taxRate, setTaxRate] = useState(15); // Default 15%
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "BANK" | "MOBILE" | "CREDIT">("CASH");
  
  // Receipt
  const [lastSale, setLastSale] = useState<any>(null);
  const [showReceipt, setShowReceipt] = useState(false);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  const fetchProducts = useCallback(async () => {
    try {
      const [prodRes, custRes] = await Promise.all([
        apiFetch("/api/products"),
        apiFetch("/api/customers")
      ]);
      
      if (prodRes.ok) {
        const data = await prodRes.json();
        setProducts(data);
      }
      
      if (custRes.ok) {
        const data = await custRes.json();
        setCustomers(data);
      }
    } catch (err) {
      console.error("Failed to fetch data", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    setSearch("");
    barcodeInputRef.current?.focus();
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.selling_price * item.quantity), 0);
  const discountAmount = discountType === "FIXED" ? discountValue : (subtotal * discountValue) / 100;
  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const taxAmount = (taxableAmount * taxRate) / 100;
  const total = taxableAmount + taxAmount;

  const [amountReceived, setAmountReceived] = useState<number>(0);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (paymentMethod === "CREDIT" && !selectedCustomer) {
      setError("Please select a customer for credit sales");
      return;
    }
    
    setShowCheckoutModal(true);
    setAmountReceived(total);
  };

  const confirmCheckout = async () => {
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const res = await apiFetch("/api/sales", {
        method: "POST",
        body: JSON.stringify({
          customer_id: selectedCustomer?.id,
          items: cart,
          total_amount: subtotal,
          discount_amount: discountAmount,
          tax_amount: taxAmount,
          final_amount: total,
          payments: [{ amount: total, method: paymentMethod }]
        })
      });

      if (res.ok) {
        const data = await res.json();
        
        // Fetch full sale details for the receipt
        const saleDetailsRes = await apiFetch(`/api/sales/${data.id}`);
        if (saleDetailsRes.ok) {
          const saleData = await saleDetailsRes.json();
          setLastSale(saleData);
          setSuccess("Sale completed successfully!");
          setCart([]);
          setDiscountValue(0);
          setSelectedCustomer(null);
          setShowCheckoutModal(false);
          setShowReceipt(true);
          fetchProducts();
        }
      } else {
        const data = await res.json();
        setError(data.error || "Checkout failed");
      }
    } catch (err) {
      setError("An error occurred during checkout");
    } finally {
      setLoading(false);
    }
  };

  const handleBarcodeSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const product = products.find(p => p.barcode === search || p.sku === search);
    if (product) {
      addToCart(product);
    } else {
      // If not exact match, maybe it's a partial name search
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.sku.toLowerCase().includes(search.toLowerCase()) ||
    p.barcode?.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 8);

  return (
    <div className="h-[calc(100vh-64px)] flex overflow-hidden bg-slate-50">
      {/* Left Side: Product Selection */}
      <div className="flex-1 flex flex-col p-6 space-y-6 overflow-hidden">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <form onSubmit={handleBarcodeSearch}>
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                ref={barcodeInputRef}
                type="text"
                placeholder="Search by name, SKU, or scan barcode..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                autoFocus
              />
            </form>
            
            {search && filteredProducts?.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl z-10 overflow-hidden">
                {filteredProducts?.map(p => (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    className="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center justify-between border-b border-slate-100 last:border-0 transition-colors"
                  >
                    <div>
                      <div className="font-bold text-slate-900">{p.name}</div>
                      <div className="text-xs text-slate-500">{p.sku} • {p.stock_quantity} in stock</div>
                    </div>
                    <div className="font-bold text-indigo-600">${p.selling_price.toFixed(2)}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-2">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {products?.slice(0, 20).map(p => (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                disabled={p.stock_quantity <= 0}
                className={cn(
                  "p-4 bg-white border border-slate-200 rounded-2xl text-left space-y-3 hover:border-indigo-500 hover:shadow-md transition-all group relative overflow-hidden",
                  p.stock_quantity <= 0 && "opacity-50 grayscale cursor-not-allowed"
                )}
              >
                <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                  <Plus className="w-6 h-6" />
                </div>
                <div>
                  <div className="font-bold text-slate-900 line-clamp-2 leading-tight">{p.name}</div>
                  <div className="text-xs text-slate-500 mt-1">${p.selling_price.toFixed(2)}</div>
                </div>
                <div className={cn(
                  "text-[10px] font-bold px-2 py-0.5 rounded-full inline-block",
                  p.stock_quantity <= p.min_stock ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-600"
                )}>
                  {p.stock_quantity} {p.unit}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right Side: Cart & Checkout */}
      <div className="w-[400px] bg-white border-l border-slate-200 flex flex-col shadow-2xl">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ShoppingCart className="w-6 h-6" />
            Current Cart
          </h2>
          <span className="bg-indigo-600 text-white text-xs font-bold px-2.5 py-1 rounded-full">
            {cart.length} Items
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4 opacity-50">
              <ShoppingCart className="w-16 h-16" />
              <p className="font-medium">Your cart is empty</p>
            </div>
          ) : (
            cart?.map(item => (
              <div key={item.id} className="flex items-center gap-4 group">
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-slate-900 truncate">{item.name}</div>
                  <div className="text-xs text-slate-500">${item.selling_price.toFixed(2)} / {item.unit}</div>
                </div>
                <div className="flex items-center gap-2 bg-slate-50 rounded-xl p-1 border border-slate-100">
                  <button 
                    onClick={() => updateQuantity(item.id, -1)}
                    className="p-1 hover:bg-white hover:shadow-sm rounded-lg transition-all text-slate-400 hover:text-rose-600"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-8 text-center font-bold text-sm">{item.quantity}</span>
                  <button 
                    onClick={() => updateQuantity(item.id, 1)}
                    className="p-1 hover:bg-white hover:shadow-sm rounded-lg transition-all text-slate-400 hover:text-emerald-600"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="text-right min-w-[60px]">
                  <div className="font-bold text-slate-900">${(item.selling_price * item.quantity).toFixed(2)}</div>
                  <button 
                    onClick={() => removeFromCart(item.id)}
                    className="text-[10px] text-rose-500 font-bold hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-200 space-y-4">
          {/* Customer Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Customer</label>
            <div className="relative">
              <select
                value={selectedCustomer?.id || ""}
                onChange={(e) => {
                  const customer = customers.find(c => c.id === e.target.value);
                  setSelectedCustomer(customer || null);
                }}
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none appearance-none pr-10"
              >
                <option value="">Walk-in Customer</option>
                {customers?.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <User className="w-4 h-4" />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-slate-500">
              <span>Subtotal</span>
              <span className="font-medium">${subtotal.toFixed(2)}</span>
            </div>
            
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500">Discount</span>
                <select 
                  value={discountType} 
                  onChange={(e) => setDiscountType(e.target.value as any)}
                  className="text-[10px] font-bold bg-white border border-slate-200 rounded px-1 py-0.5 outline-none"
                >
                  <option value="FIXED">$</option>
                  <option value="PERCENT">%</option>
                </select>
              </div>
              <input 
                type="number"
                min="0"
                value={discountValue}
                onChange={(e) => setDiscountValue(Number(e.target.value))}
                className="w-20 text-right text-sm font-bold bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center justify-between text-sm text-slate-500">
              <span>Tax ({taxRate}%)</span>
              <span className="font-medium">${taxAmount.toFixed(2)}</span>
            </div>

            <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
              <span className="text-lg font-bold text-slate-900">Total</span>
              <span className="text-2xl font-black text-indigo-600">${total.toFixed(2)}</span>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {[
              { id: 'CASH', icon: Banknote, label: 'Cash' },
              { id: 'BANK', icon: CreditCard, label: 'Bank' },
              { id: 'MOBILE', icon: Smartphone, label: 'Mobile' },
              { id: 'CREDIT', icon: ReceiptIcon, label: 'Credit' }
            ].map(method => (
              <button
                key={method.id}
                onClick={() => setPaymentMethod(method.id as any)}
                className={cn(
                  "flex flex-col items-center justify-center p-2 rounded-xl border transition-all gap-1",
                  paymentMethod === method.id 
                    ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100" 
                    : "bg-white border-slate-200 text-slate-500 hover:border-indigo-200"
                )}
              >
                <method.icon className="w-5 h-5" />
                <span className="text-[10px] font-bold uppercase">{method.label}</span>
              </button>
            ))}
          </div>

          <button
            onClick={handleCheckout}
            disabled={cart.length === 0}
            className={cn(
              "w-full py-4 rounded-2xl font-black text-lg shadow-xl transition-all flex items-center justify-center gap-2",
              cart.length > 0 
                ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100" 
                : "bg-slate-100 text-slate-400 cursor-not-allowed"
            )}
          >
            Complete Sale
          </button>
        </div>
      </div>

      {/* Checkout Confirmation Modal */}
      {showCheckoutModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">Confirm Payment</h3>
              <button onClick={() => setShowCheckoutModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="bg-slate-50 rounded-2xl p-6 text-center space-y-2">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Total Amount Due</div>
                <div className="text-4xl font-black text-indigo-600">${total.toFixed(2)}</div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Amount Received</label>
                <div className="relative">
                  <Banknote className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="number"
                    step="0.01"
                    value={amountReceived}
                    onChange={(e) => setAmountReceived(Number(e.target.value))}
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-xl font-black focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    autoFocus
                    onFocus={(e) => e.target.select()}
                  />
                </div>
              </div>

              {amountReceived >= total && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-center justify-between">
                  <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Change to Return</div>
                  <div className="text-xl font-black text-emerald-700">${(amountReceived - total).toFixed(2)}</div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setShowCheckoutModal(false)}
                  className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmCheckout}
                  disabled={loading || amountReceived < total}
                  className={cn(
                    "flex-2 py-4 rounded-2xl font-black text-sm shadow-xl transition-all flex items-center justify-center gap-2",
                    amountReceived >= total 
                      ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100" 
                      : "bg-slate-100 text-slate-400 cursor-not-allowed"
                  )}
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Confirm & Print"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceipt && lastSale && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="my-auto">
            <Receipt 
              sale={lastSale} 
              amountReceived={amountReceived}
              onClose={() => setShowReceipt(false)} 
            />
          </div>
        </div>
      )}
    </div>
  );
}
