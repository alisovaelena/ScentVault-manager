
import React from 'react';
import { TrendingUp, Package, Droplets, ShoppingCart, AlertCircle, ArrowUpRight } from 'lucide-react';
import { Perfume, Vial, Sale, View, isPerfumeArchived } from '../types';
import { getSaleItems, getSaleSummary, getSaleTotal } from '../utils/sales';

interface DashboardProps {
  perfumes: Perfume[];
  vials: Vial[];
  sales: Sale[];
  onViewChange: (view: View) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ perfumes, vials, sales, onViewChange }) => {
  const totalRevenue = sales.reduce((sum, s) => sum + getSaleTotal(s), 0);
  const totalSalesCount = sales.length;
  
  const lowStockPerfumes = perfumes.filter(p => !isPerfumeArchived(p) && p.currentVolumeMl <= p.lowStockThreshold);
  const lowStockVials = vials.filter(v => v.stockQuantity <= (v.lowStockThreshold || 10));
  const lowStockCount = lowStockPerfumes.length + lowStockVials.length;

  const stats = [
    { label: 'Выручка', value: `${totalRevenue.toLocaleString()} ₽`, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Продажи', value: totalSalesCount, icon: ShoppingCart, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Ароматы', value: perfumes.length, icon: Droplets, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Мало остатков', value: lowStockCount, icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-display font-bold text-neutral-900 mb-2">Обзор бизнеса</h1>
        <p className="text-neutral-500 text-sm">Краткая сводка состояния вашей коллекции и заказов.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className={`${stat.bg} ${stat.color} p-3 rounded-2xl`}>
                <stat.icon size={24} />
              </div>
            </div>
            <p className="text-neutral-500 text-xs font-bold uppercase tracking-wider mb-1">{stat.label}</p>
            <p className="text-2xl font-bold">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Restock Alerts Combined */}
        <div className="lg:col-span-1 bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-lg">Закупки и остатки</h3>
            <div className="flex gap-2">
              <button onClick={() => onViewChange('inventory')} className="text-indigo-600 text-[10px] font-bold uppercase hover:underline">Парфюм</button>
              <button onClick={() => onViewChange('vials')} className="text-neutral-400 text-[10px] font-bold uppercase hover:underline">Тара</button>
            </div>
          </div>
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {lowStockCount === 0 ? (
              <div className="py-12 text-center">
                <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Package size={24} />
                </div>
                <p className="text-neutral-400 text-sm italic">Все запасы в норме.</p>
              </div>
            ) : (
              <>
                {lowStockPerfumes.map(p => (
                  <div key={p.id} className="flex items-center gap-4 p-3 rounded-2xl bg-rose-50 border border-rose-100 group hover:bg-rose-100/50 transition-colors">
                    <div className="bg-white p-2 rounded-xl text-rose-600 shadow-sm">
                      <Droplets size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-xs truncate leading-tight">{p.brand}</p>
                      <p className="text-[10px] text-rose-600 font-medium">Жидкость: {p.currentVolumeMl}мл</p>
                    </div>
                  </div>
                ))}
                {lowStockVials.map(v => (
                  <div key={v.id} className="flex items-center gap-4 p-3 rounded-2xl bg-amber-50 border border-amber-100 group hover:bg-amber-100/50 transition-colors">
                    <div className="bg-white p-2 rounded-xl text-amber-600 shadow-sm">
                      <Package size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-xs truncate leading-tight">{v.name}</p>
                      <p className="text-[10px] text-amber-600 font-medium">Флаконы: {v.stockQuantity}шт</p>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Recent Sales */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-lg">Последние заказы</h3>
            <button onClick={() => onViewChange('sales')} className="text-indigo-600 text-sm hover:underline font-medium">История</button>
          </div>
          <div className="overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="text-neutral-400 text-[10px] uppercase tracking-widest">
                  <th className="pb-4 font-bold">Клиент</th>
                  <th className="pb-4 font-bold">Товар</th>
                  <th className="pb-4 font-bold text-right">Сумма</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {sales.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-12 text-center text-neutral-400 italic">Заказов пока не было.</td>
                  </tr>
                ) : (
                  sales.slice(-6).reverse().map(sale => {
                    const firstItem = getSaleItems(sale)[0];
                    return (
                      <tr key={sale.id} className="border-t border-neutral-50 group hover:bg-neutral-50 transition-colors">
                        <td className="py-4">
                          <p className="font-bold text-neutral-800">{sale.customerName}</p>
                          <p className="text-[10px] text-neutral-400">{new Date(sale.date).toLocaleDateString('ru-RU')}</p>
                        </td>
                        <td className="py-4">
                          <p className="text-xs text-neutral-600 truncate max-w-[260px]">{getSaleSummary(sale, perfumes)}</p>
                          <p className="text-[10px] text-neutral-400">{getSaleItems(sale).length} поз., {firstItem?.volumeMl || 0}мл первая</p>
                        </td>
                        <td className="py-4 font-bold text-right text-indigo-600">{getSaleTotal(sale)} ₽</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
