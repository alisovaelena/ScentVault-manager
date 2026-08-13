
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
import { Perfume, Sale, SaleItem, Vial, Expense, Income } from '../types';
import { TrendingUp, Gift, AlertTriangle } from 'lucide-react';
import { getSaleBaseTotal, getSaleItems } from '../utils/sales';

interface StatsProps {
  perfumes: Perfume[];
  sales: Sale[];
  vials: Vial[];
  expenses: Expense[];
  incomes: Income[];
}

const Stats: React.FC<StatsProps> = ({ perfumes, sales, vials, expenses, incomes }) => {
  const totalOtherExpenses = useMemo(() => expenses.reduce((sum, e) => sum + e.amount, 0), [expenses]);
  const totalExtraIncomes = useMemo(() => incomes.reduce((sum, i) => sum + i.amount, 0), [incomes]);

  // Cost price of one order line: liquid at the bottle's purchase price + the vial.
  const itemCost = (item: SaleItem) => {
    const perfume = perfumes.find(p => p.id === item.perfumeId);
    const vial = vials.find(v => v.id === item.vialId);
    const vialCost = vial?.purchasePrice || 0;
    if (!perfume) return vialCost; // vial-only line (empty atomizer)
    const perMl = perfume.totalVolumeMl > 0 ? perfume.purchasePrice / perfume.totalVolumeMl : 0;
    return perMl * item.volumeMl + vialCost;
  };

  // Money in and money out, kept apart so every figure is traceable.
  // Shipping is excluded entirely: the customer pays it and it goes straight to
  // the carrier, so it inflates neither turnover nor profit.
  const totals = useMemo(() => {
    let revenue = 0, cogs = 0, giftCost = 0, giftCount = 0;
    sales.forEach(sale => {
      revenue += getSaleBaseTotal(sale) + (sale.extraIncome || 0);
      getSaleItems(sale).forEach(item => {
        const cost = itemCost(item);
        if (item.isGift) { giftCost += cost; giftCount += 1; }
        else cogs += cost;
      });
    });
    return { revenue, cogs, giftCost, giftCount };
  }, [sales, perfumes, vials]);

  const netProfit = totals.revenue - totals.cogs - totals.giftCost + totalExtraIncomes - totalOtherExpenses;

  const overallMargin = useMemo(() => {
    if (totals.revenue === 0) return 0;
    return (netProfit / totals.revenue) * 100;
  }, [netProfit, totals.revenue]);

  // Perfumes that were sold or gifted but have no purchase price: their cost
  // counts as zero, which silently overstates profit.
  const missingCost = useMemo(() => {
    const used = new Set<string>();
    sales.forEach(s => getSaleItems(s).forEach(i => { if (i.perfumeId) used.add(i.perfumeId); }));
    return perfumes.filter(p => used.has(p.id) && !(p.purchasePrice > 0));
  }, [sales, perfumes]);

  const monthlyData = useMemo(() => {
    type Month = { month: string; revenue: number; costs: number; incomes: number; timestamp: number };
    const months: Record<string, Month> = {};
    const bucket = (ts: number): Month => {
      const d = new Date(ts);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!months[key]) {
        months[key] = {
          month: d.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' }),
          revenue: 0, costs: 0, incomes: 0,
          timestamp: new Date(d.getFullYear(), d.getMonth(), 1).getTime(),
        };
      }
      return months[key];
    };

    sales.forEach(sale => {
      const m = bucket(sale.date);
      m.revenue += getSaleBaseTotal(sale) + (sale.extraIncome || 0);
      // Cost of goods AND of gifts both land in the same "затраты" bar.
      getSaleItems(sale).forEach(item => { m.costs += itemCost(item); });
    });
    expenses.forEach(exp => { bucket(exp.date).costs += exp.amount; });
    incomes.forEach(inc => { bucket(inc.date).incomes += inc.amount; });

    return Object.values(months)
      .map(m => ({ ...m, finalProfit: m.revenue + m.incomes - m.costs }))
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
          <span className="text-sm font-bold">{totals.giftCount} подарено</span>
        </div>
      </div>

      {missingCost.length > 0 && (
        <div className="p-5 bg-amber-50 border border-amber-200 rounded-3xl flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0"><AlertTriangle size={20} /></div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-amber-800">Себестоимость занижена, прибыль завышена</p>
            <p className="text-xs text-amber-700/90 mt-0.5">
              У {missingCost.length}{' '}
              {missingCost.length === 1 ? 'аромата' : 'ароматов'} из проданных и подаренных не указана цена закупки — она считается нулевой.
              Впишите её в разделе «Парфюмерия»: {missingCost.slice(0, 5).map(p => `${p.brand} ${p.name}`).join(', ')}
              {missingCost.length > 5 ? ` и ещё ${missingCost.length - 5}` : ''}.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm">
          <p className="text-neutral-500 text-xs font-bold uppercase tracking-wider">Оборот</p>
          <p className="text-2xl font-bold text-neutral-900 mt-2">{Math.round(totals.revenue).toLocaleString()} ₽</p>
          <p className="text-[10px] text-neutral-400 mt-1">товары и чаевые, без доставки</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm">
          <p className="text-neutral-500 text-xs font-bold uppercase tracking-wider">Себестоимость проданного</p>
          <p className="text-2xl font-bold text-rose-600 mt-2">-{Math.round(totals.cogs).toLocaleString()} ₽</p>
          <p className="text-[10px] text-neutral-400 mt-1">закупка аромата и тары</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-pink-200 shadow-sm">
          <p className="text-pink-500 text-xs font-bold uppercase tracking-wider">Подарки по себестоимости</p>
          <p className="text-2xl font-bold text-rose-600 mt-2">-{Math.round(totals.giftCost).toLocaleString()} ₽</p>
          <p className="text-[10px] text-neutral-400 mt-1">{totals.giftCount} шт · чистый расход</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm">
          <p className="text-neutral-500 text-xs font-bold uppercase tracking-wider">Прочие расходы</p>
          <p className="text-2xl font-bold text-rose-600 mt-2">-{totalOtherExpenses.toLocaleString()} ₽</p>
          <p className="text-[10px] text-neutral-400 mt-1">раздел «Расходы»</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm">
          <p className="text-neutral-500 text-xs font-bold uppercase tracking-wider">Доп. доходы</p>
          <p className="text-2xl font-bold text-emerald-600 mt-2">+{totalExtraIncomes.toLocaleString()} ₽</p>
          <p className="text-[10px] text-neutral-400 mt-1">раздел «Доходы»</p>
        </div>

        <div className="bg-neutral-900 p-6 rounded-3xl shadow-lg">
          <p className="text-neutral-400 text-xs font-bold uppercase tracking-wider">Чистая прибыль</p>
          <p className={`text-2xl font-bold mt-2 ${netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {Math.round(netProfit).toLocaleString()} ₽
          </p>
          <p className="text-[10px] text-neutral-500 mt-1">маржинальность {overallMargin.toFixed(1)}%</p>
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
              <Bar name="Затраты" dataKey="costs" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={20} />
              <Bar name="Ч. Прибыль" dataKey="finalProfit" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Stats;
