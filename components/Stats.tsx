
import React, { useMemo } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  Legend
} from 'recharts';
import { Perfume, Sale, Vial, Expense, Income } from '../types';
import { TrendingUp, Gift } from 'lucide-react';
import { getSaleGiftCount, getSaleItems, getSaleTotal } from '../utils/sales';

interface StatsProps {
  perfumes: Perfume[];
  sales: Sale[];
  vials: Vial[];
  expenses: Expense[];
  incomes: Income[];
}

const Stats: React.FC<StatsProps> = ({ perfumes, sales, vials, expenses, incomes }) => {
  const totalRevenue = useMemo(() => sales.reduce((sum, s) => sum + getSaleTotal(s), 0), [sales]);
  const totalOtherExpenses = useMemo(() => expenses.reduce((sum, e) => sum + e.amount, 0), [expenses]);
  const totalExtraIncomes = useMemo(() => incomes.reduce((sum, i) => sum + i.amount, 0), [incomes]);
  
  // Gifts count for display
  const giftsCount = useMemo(() => sales.reduce((sum, s) => sum + getSaleGiftCount(s), 0), [sales]);

  const calculateSaleProfit = (sale: Sale) => {
    const costs = getSaleItems(sale).reduce((sum, item) => {
      const perfume = perfumes.find(p => p.id === item.perfumeId);
      const vial = vials.find(v => v.id === item.vialId);
      const vialCost = vial?.purchasePrice || 0;
      // Vial-only line (empty atomizer): no liquid, but the vial itself has a cost.
      if (!perfume) return sum + vialCost;
      const perfumeCostPerMl = perfume.purchasePrice / perfume.totalVolumeMl;
      return sum + (perfumeCostPerMl * item.volumeMl) + vialCost;
    }, 0);

    // Profit = revenue - cost of liquid & vials - shipping forwarded to the carrier.
    // The customer pays shipping (it is inside getSaleTotal), so it cancels out here.
    return getSaleTotal(sale) - costs - (sale.shippingCost || 0);
  };

  const salesProfit = useMemo(() => 
    sales.reduce((sum, sale) => sum + calculateSaleProfit(sale), 0), 
  [sales, perfumes, vials]);

  const netProfit = salesProfit + totalExtraIncomes - totalOtherExpenses;

  const overallMargin = useMemo(() => {
    if (totalRevenue === 0) return 0;
    return (netProfit / totalRevenue) * 100;
  }, [netProfit, totalRevenue]);

  const monthlyData = useMemo(() => {
    const months: Record<string, { month: string, revenue: number, profit: number, expenses: number, incomes: number, timestamp: number }> = {};
    
    sales.forEach(sale => {
      const d = new Date(sale.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' });
      if (!months[key]) {
        months[key] = { month: label, revenue: 0, profit: 0, expenses: 0, incomes: 0, timestamp: new Date(d.getFullYear(), d.getMonth(), 1).getTime() };
      }
      months[key].revenue += getSaleTotal(sale);
      months[key].profit += calculateSaleProfit(sale);
    });

    expenses.forEach(exp => {
      const d = new Date(exp.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' });
      if (!months[key]) {
        months[key] = { month: label, revenue: 0, profit: 0, expenses: 0, incomes: 0, timestamp: new Date(d.getFullYear(), d.getMonth(), 1).getTime() };
      }
      months[key].expenses += exp.amount;
    });

    incomes.forEach(inc => {
      const d = new Date(inc.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' });
      if (!months[key]) {
        months[key] = { month: label, revenue: 0, profit: 0, expenses: 0, incomes: 0, timestamp: new Date(d.getFullYear(), d.getMonth(), 1).getTime() };
      }
      months[key].incomes += inc.amount;
    });

    return Object.values(months)
      .map(m => ({ ...m, finalProfit: m.profit + m.incomes - m.expenses }))
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [sales, perfumes, vials, expenses, incomes]);

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Бизнес-аналитика</h1>
          <p className="text-neutral-500 text-sm">Анализ доходности и расходов на подарки.</p>
        </div>
        <div className="bg-pink-50 border border-pink-100 px-4 py-2 rounded-2xl flex items-center gap-2 text-pink-600">
          <Gift size={18} />
          <span className="text-sm font-bold">{giftsCount} подарено</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm">
          <p className="text-neutral-500 text-xs font-bold uppercase tracking-wider">Оборот</p>
          <p className="text-2xl font-bold text-neutral-900 mt-2">{totalRevenue.toLocaleString()} ₽</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm">
          <p className="text-neutral-500 text-xs font-bold uppercase tracking-wider">Доп. доходы</p>
          <p className="text-2xl font-bold text-emerald-600 mt-2">+{totalExtraIncomes.toLocaleString()} ₽</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm">
          <p className="text-neutral-500 text-xs font-bold uppercase tracking-wider">Прочие расходы</p>
          <p className="text-2xl font-bold text-rose-600 mt-2">-{totalOtherExpenses.toLocaleString()} ₽</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm">
          <p className="text-neutral-500 text-xs font-bold uppercase tracking-wider">Чистая прибыль</p>
          <p className={`text-2xl font-bold mt-2 ${netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {Math.round(netProfit).toLocaleString()} ₽
          </p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm">
          <p className="text-neutral-500 text-xs font-bold uppercase tracking-wider">Маржинальность</p>
          <p className="text-2xl font-bold text-indigo-600 mt-2">{overallMargin.toFixed(1)}%</p>
        </div>
      </div>

      <div className="bg-white p-8 rounded-3xl border border-neutral-200 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <h3 className="font-bold text-lg">Динамика по месяцам</h3>
          <TrendingUp className="text-neutral-200" size={24} />
        </div>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} tickFormatter={(v) => `${v} ₽`} />
              <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
              <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px' }} />
              <Bar name="Оборот" dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={20} />
              <Bar name="Доп. доходы" dataKey="incomes" fill="#059669" radius={[4, 4, 0, 0]} barSize={20} />
              <Bar name="Расходы" dataKey="expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={20} />
              <Bar name="Ч. Прибыль" dataKey="finalProfit" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Stats;
