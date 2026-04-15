import React from "react";
import { LucideIcon, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface KpiCardProps {
  title: string;
  value: string | number;
  trend?: number;
  trendLabel?: string;
  icon: LucideIcon;
  color: "indigo" | "emerald" | "rose" | "amber" | "sky" | "violet";
  inverseTrend?: boolean;
  loading?: boolean;
}

export default function KpiCard({
  title,
  value,
  trend,
  trendLabel,
  icon: Icon,
  color,
  inverseTrend = false,
  loading = false
}: KpiCardProps) {
  const isPositive = trend !== undefined ? trend >= 0 : null;
  const isGood = trend !== undefined ? (inverseTrend ? !isPositive : isPositive) : null;

  const colorClasses = {
    indigo: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    rose: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    amber: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    sky: "bg-sky-500/10 text-sky-400 border-sky-500/20",
    violet: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  };

  if (loading) {
    return (
      <div className="bg-slate-900/50 backdrop-blur-xl p-6 rounded-[2rem] border border-slate-800 space-y-4 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="w-12 h-12 bg-slate-800 rounded-2xl" />
          <div className="w-16 h-6 bg-slate-800 rounded-full" />
        </div>
        <div className="space-y-2">
          <div className="w-20 h-3 bg-slate-800 rounded" />
          <div className="w-32 h-8 bg-slate-800 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/50 backdrop-blur-xl p-6 rounded-[2rem] border border-slate-800 shadow-sm space-y-4 hover:shadow-indigo-500/10 hover:border-slate-700 hover:-translate-y-1 transition-all duration-300 group">
      <div className="flex items-center justify-between">
        <div className={cn(
          "w-12 h-12 rounded-2xl flex items-center justify-center border transition-transform group-hover:scale-110",
          colorClasses[color]
        )}>
          <Icon className="w-6 h-6" />
        </div>
        
        {trend !== undefined && (
          <div className={cn(
            "px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1",
            isGood ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
          )}>
            {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(trend).toFixed(1)}%
            {trendLabel && <span className="ml-1 opacity-60 font-medium lowercase">{trendLabel}</span>}
          </div>
        )}
      </div>

      <div>
        <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">{title}</div>
        <div className="text-3xl font-black text-white mt-1 tracking-tight">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </div>
      </div>
    </div>
  );
}
