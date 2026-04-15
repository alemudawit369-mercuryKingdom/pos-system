export interface Branch {
  id: string;
  name: string;
  location?: string;
  phone?: string;
  email?: string;
  is_active: boolean;
  created_at?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: "Admin" | "Manager" | "Cashier" | "StoreKeeper";
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  created_at?: string;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  sku: string;
  barcode?: string;
  unit: "kg" | "liter" | "piece";
  cost_price: number;
  selling_price: number;
  stock_quantity: number;
  min_stock: number;
  batch_number?: string;
  expiry_date?: string;
  category_id?: string;
  category_name?: string;
  created_at?: string;
}

export interface InventoryLog {
  id: string;
  product_id: string;
  product_name?: string;
  type: "IN" | "OUT" | "ADJUST";
  quantity: number;
  reason?: string;
  created_at: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address?: string;
  credit_balance: number;
  created_at: string;
}

export interface CustomerPayment {
  id: string;
  customer_id: string;
  amount: number;
  method: string;
  note?: string;
  created_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact_person?: string;
  phone: string;
  email?: string;
  address?: string;
  created_at: string;
}

export interface Purchase {
  id: string;
  supplier_id: string;
  supplier_name?: string;
  total_amount: number;
  status: 'PENDING' | 'RECEIVED' | 'CANCELLED';
  created_at: string;
}

export interface PurchaseItem {
  id: string;
  purchase_id: string;
  product_id: string;
  product_name?: string;
  quantity: number;
  unit_cost: number;
  subtotal: number;
}

export interface Expense {
  id: string;
  title: string;
  amount: number;
  category: string;
  date: string;
  created_at: string;
}

export interface Sale {
  id: string;
  customer_id?: string;
  customer_name?: string;
  total_amount: number;
  discount_amount: number;
  tax_amount: number;
  final_amount: number;
  created_at: string;
  items?: SaleItem[];
  payments?: Payment[];
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  product_name?: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface Payment {
  id: string;
  sale_id: string;
  amount: number;
  method: "CASH" | "BANK" | "MOBILE" | "CREDIT";
  created_at: string;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface Transaction {
  id: string;
  total_amount: number;
  payment_method: string;
  created_at: string;
}

export interface TransactionItem {
  id: string;
  transaction_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}
