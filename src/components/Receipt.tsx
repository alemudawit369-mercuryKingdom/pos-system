import React from 'react';
import { Printer, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface ReceiptProps {
  sale: {
    id: string;
    created_at: string;
    total_amount: number;
    discount_amount: number;
    tax_amount: number;
    final_amount: number;
    customer_name?: string;
    items?: Array<{
      id: string;
      product_name?: string;
      quantity: number;
      unit_price: number;
      subtotal: number;
    }>;
    payments?: Array<{
      amount: number;
      method: string;
    }>;
  };
  amountReceived?: number;
  onClose?: () => void;
}

const Receipt: React.FC<ReceiptProps> = ({ sale, amountReceived, onClose }) => {
  const { user } = useAuth();
  
  const handlePrint = () => {
    window.print();
  };

  const subtotal = Number(sale.total_amount);
  const discount = Number(sale.discount_amount);
  const tax = Number(sale.tax_amount);
  const total = Number(sale.final_amount);
  const received = amountReceived || total;
  const change = received - total;

  return (
    <div className="flex flex-col items-center">
      {/* Receipt Container */}
      <div className="bg-white p-6 shadow-2xl rounded-2xl border border-slate-100 print:shadow-none print:border-none print:p-0 print:w-[80mm] w-[400px] font-sans text-slate-900">
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            @page {
              margin: 0;
              size: 80mm auto;
            }
            body {
              margin: 0;
              padding: 0;
              -webkit-print-color-adjust: exact;
            }
            .no-print {
              display: none !important;
            }
            .print-only {
              display: block !important;
            }
            .receipt-content {
              width: 80mm;
              padding: 5mm;
              font-size: 12px;
            }
          }
          .font-mono-receipt {
            font-family: 'JetBrains Mono', 'Fira Code', monospace;
          }
        `}} />

        <div className="receipt-content space-y-4">
          {/* Header */}
          <div className="text-center space-y-1">
            <h1 className="text-xl font-black uppercase tracking-tight">Libanos Epoxy Store</h1>
            <p className="text-xs text-slate-500">Addis Ababa, Jacros</p>
            <p className="text-xs text-slate-500">Tel: +251 911 234 567</p>
          </div>

          {/* Transaction Info */}
          <div className="border-y border-dashed border-slate-200 py-3 space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-500 uppercase font-bold">Receipt #:</span>
              <span className="font-mono-receipt font-bold">{String(sale.id).slice(0, 8).toUpperCase()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 uppercase font-bold">Date:</span>
              <span>{new Date(sale.created_at).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 uppercase font-bold">Cashier:</span>
              <span className="font-medium">{user?.name || 'System'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 uppercase font-bold">Branch:</span>
              <span>Main Branch</span>
            </div>
            {sale.customer_name && (
              <div className="flex justify-between">
                <span className="text-slate-500 uppercase font-bold">Customer:</span>
                <span className="font-bold">{sale.customer_name}</span>
              </div>
            )}
          </div>

          {/* Items Table */}
          <div className="space-y-2">
            <div className="grid grid-cols-12 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1">
              <div className="col-span-6">Item</div>
              <div className="col-span-2 text-center">Qty</div>
              <div className="col-span-4 text-right">Total</div>
            </div>
            <div className="space-y-2">
              {sale.items?.map((item, index) => (
                <div key={index} className="grid grid-cols-12 text-[11px] items-start">
                  <div className="col-span-6">
                    <div className="font-bold leading-tight">{item.product_name}</div>
                    <div className="text-[9px] text-slate-400 font-mono-receipt">@ ${Number(item.unit_price).toFixed(2)}</div>
                  </div>
                  <div className="col-span-2 text-center font-mono-receipt">
                    {item.quantity}
                  </div>
                  <div className="col-span-4 text-right font-bold font-mono-receipt">
                    ${Number(item.subtotal).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="border-t border-dashed border-slate-200 pt-3 space-y-1.5">
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-500">Subtotal:</span>
              <span className="font-mono-receipt font-bold">${subtotal.toFixed(2)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-[11px] text-rose-600">
                <span>Discount:</span>
                <span className="font-mono-receipt font-bold">-${discount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-500">Tax:</span>
              <span className="font-mono-receipt font-bold">${tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-base font-black pt-2 border-t border-slate-100">
              <span>TOTAL:</span>
              <span className="font-mono-receipt">${total.toFixed(2)}</span>
            </div>
          </div>

          {/* Payment Info */}
          <div className="bg-slate-50 rounded-xl p-3 space-y-1.5 print:bg-transparent print:p-0 print:border-t print:border-dashed print:border-slate-200 print:rounded-none">
            {sale.payments?.map((payment, index) => (
              <div key={index} className="flex justify-between text-[11px]">
                <span className="text-slate-500 uppercase font-bold">Paid via {payment.method}:</span>
                <span className="font-bold font-mono-receipt">${Number(payment.amount).toFixed(2)}</span>
              </div>
            ))}
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-500 uppercase font-bold">Amount Received:</span>
              <span className="font-bold font-mono-receipt">${received.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-[11px] pt-1 border-t border-slate-200/50">
              <span className="text-slate-500 uppercase font-bold">Change:</span>
              <span className="font-bold font-mono-receipt">${change.toFixed(2)}</span>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center pt-4 space-y-2">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Thank you for your business!</p>
            <p className="text-[9px] text-slate-300">Please keep this receipt for your records.</p>
          </div>
        </div>
      </div>

      {/* Action Buttons (Hidden on Print) */}
      <div className="mt-6 flex gap-3 w-full max-w-[400px] no-print">
        <button
          onClick={handlePrint}
          className="flex-1 py-3.5 bg-slate-900 text-white rounded-2xl font-bold text-sm hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-xl shadow-slate-200"
        >
          <Printer className="w-4 h-4" />
          Print Receipt
        </button>
        {onClose && (
          <button
            onClick={onClose}
            className="flex-1 py-3.5 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
          >
            <X className="w-4 h-4" />
            Close
          </button>
        )}
      </div>
    </div>
  );
};

export default Receipt;

