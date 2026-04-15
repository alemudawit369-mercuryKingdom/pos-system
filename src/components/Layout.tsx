import { useState, useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Package, History, ShoppingCart, LogOut, User as UserIcon, Users as UsersIcon, ClipboardList, Tags, Truck, ShoppingBag, Receipt, Calendar, Bell, Building2 } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../services/api";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const navItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard, roles: ['Admin', 'Manager'] },
  { path: "/cashier-dashboard", label: "Cashier Dashboard", icon: LayoutDashboard, roles: ['Cashier'] },
  { path: "/pos", label: "POS", icon: ShoppingCart, roles: ['Admin', 'Manager', 'Cashier'] },
  { path: "/products", label: "Products", icon: Package, roles: ['Admin', 'Manager', 'StoreKeeper'] },
  { path: "/categories", label: "Categories", icon: Tags, roles: ['Admin', 'Manager'] },
  { path: "/inventory", label: "Inventory", icon: ClipboardList, roles: ['Admin', 'Manager', 'StoreKeeper'] },
  { path: "/transactions", label: "Transactions", icon: History, roles: ['Admin', 'Manager', 'Cashier'] },
  { path: "/customers", label: "Customers", icon: UsersIcon, roles: ['Admin', 'Manager', 'Cashier'] },
  { path: "/suppliers", label: "Suppliers", icon: Truck, roles: ['Admin', 'Manager', 'StoreKeeper'] },
  { path: "/purchases", label: "Purchases", icon: ShoppingBag, roles: ['Admin', 'Manager', 'StoreKeeper'] },
  { path: "/sales", label: "Sales History", icon: History, roles: ['Admin', 'Manager', 'Cashier'] },
  { path: "/expenses", label: "Expenses", icon: Receipt, roles: ['Admin', 'Manager'] },
  { path: "/expiry", label: "Expiry Alerts", icon: Calendar, roles: ['Admin', 'Manager', 'StoreKeeper', 'Cashier'] },
  { path: "/branches", label: "Branches", icon: Building2, roles: ['Admin'] },
  { path: "/users", label: "Users", icon: UsersIcon, roles: ['Admin'] },
];

export default function Layout() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [expiryCount, setExpiryCount] = useState(0);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const endpoint = user?.role === 'Cashier' ? '/api/reports/cashier-summary' : '/api/reports/summary';
        const res = await apiFetch(endpoint);
        if (res.ok) {
          const data = await res.json();
          if (data) {
            setExpiryCount(data.expiryCount || 0);
          }
        }
      } catch (error) {
        console.error("Failed to fetch summary for notification:", error);
      }
    };

    if (user) {
      fetchSummary();
      // Refresh every 5 minutes
      const interval = setInterval(fetchSummary, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const filteredNavItems = navItems.filter(item => 
    user && item.roles.includes(user.role)
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">LibanosEPO</h1>
          <p className="text-xs text-slate-500 font-mono uppercase tracking-widest mt-1">POS System</p>
        </div>
        
        <nav className="mt-6 px-4 space-y-1 flex-1">
          {filteredNavItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
                location.pathname === item.path
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100 space-y-2">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 border border-slate-100">
            <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-slate-500">
              <UserIcon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 truncate">{user?.name}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8">
          <h2 className="text-lg font-semibold text-slate-900">
            {navItems.find((item) => item.path === location.pathname)?.label || "Page"}
          </h2>
          <div className="flex items-center gap-4">
            <Link to="/expiry" className="p-2 rounded-full hover:bg-slate-100 relative">
              <Bell className="w-5 h-5 text-slate-600" />
              {expiryCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white">
                  {expiryCount}
                </span>
              )}
            </Link>
            <button className="p-2 rounded-full hover:bg-slate-100 relative">
              <ShoppingCart className="w-5 h-5 text-slate-600" />
            </button>
          </div>
        </header>
        <div className="p-8 flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
