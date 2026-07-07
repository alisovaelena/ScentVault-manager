
import React, { useState, useMemo } from 'react';
import { Plus, Trash2, Edit2, X, Check } from 'lucide-react';
import { Income } from '../types';

interface IncomesProps {
  incomes: Income[];
  setIncomes: React.Dispatch<React.SetStateAction<Income[]>>;
  searchQuery: string;
}

const CATEGORIES = [
  'Чаевые',
  'Доплата за срочность',
  'Бонус / кешбэк',
  'Возврат от поставщика',
  'Продажа оборудования',
  'Прочее'
];

const Incomes: React.FC<IncomesProps> = ({ incomes, setIncomes, searchQuery }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIncome, setEditingIncome] = useState<Income | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', amount: 0, category: CATEGORIES[0], date: new Date().toISOString().split('T')[0] });

  const filteredIncomes = useMemo(() => {
    return incomes.filter(i =>
      i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.category.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [incomes, searchQuery]);

  const totalIncomesAmount = useMemo(() => filteredIncomes.reduce((sum, i) => sum + i.amount, 0), [filteredIncomes]);

  const openNew = () => {
    setEditingIncome(null);
    setFormData({ name: '', amount: 0, category: CATEGORIES[0], date: new Date().toISOString().split('T')[0] });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingIncome) {
      setIncomes(prev => prev.map(inc => inc.id === editingIncome.id ? { ...inc, name: formData.name, amount: formData.amount, category: formData.category, date: new Date(formData.date).getTime() } : inc));
    } else {
      const newIncome: Income = { id: Math.random().toString(36).substr(2, 9), name: formData.name, amount: formData.amount, category: formData.category, date: new Date(formData.date).getTime() };
      setIncomes(prev => [...prev, newIncome]);
    }
    setIsModalOpen(false);
    setEditingIncome(null);
    setFormData({ name: '', amount: 0, category: CATEGORIES[0], date: new Date().toISOString().split('T')[0] });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div><h1 className="text-2xl font-bold text-neutral-900">Внеплановые доходы</h1><p className="text-neutral-500 text-sm">Чаевые, доплаты и прочие поступления вне продаж.</p></div>
        <button onClick={openNew} className="w-full sm:w-auto bg-emerald-600 text-white px-6 py-2.5 rounded-2xl hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 font-medium shadow-sm active:scale-95"><Plus size={20} /> Добавить доход</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white p-6 rounded-[32px] border border-neutral-200 shadow-sm"><p className="text-neutral-400 text-[10px] font-black uppercase tracking-wider mb-2">Найдено доходов</p><p className="text-3xl font-bold text-emerald-600">+{totalIncomesAmount.toLocaleString()} ₽</p></div>
        <div className="lg:col-span-2 bg-white rounded-[32px] border border-neutral-200 overflow-hidden shadow-sm overflow-x-auto">
          <table className="w-full text-left min-w-[500px]">
            <thead><tr className="bg-neutral-50 text-neutral-400 text-[10px] uppercase font-bold tracking-widest"><th className="px-6 py-4">Дата</th><th className="px-6 py-4">Описание</th><th className="px-6 py-4 text-right">Сумма</th><th className="px-6 py-4"></th></tr></thead>
            <tbody className="divide-y divide-neutral-50 text-sm">
              {filteredIncomes.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-12 text-center text-neutral-400 italic">Доходов не найдено.</td></tr>
              ) : [...filteredIncomes].sort((a, b) => b.date - a.date).map(inc => (
                <tr key={inc.id} className="hover:bg-neutral-50 transition-colors group">
                  <td className="px-6 py-4 text-neutral-500 text-xs font-bold">{new Date(inc.date).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })}</td>
                  <td className="px-6 py-4"><p className="font-bold text-neutral-800">{inc.name}</p><p className="text-[10px] text-neutral-400 font-bold uppercase">{inc.category}</p></td>
                  <td className="px-6 py-4 font-black text-emerald-600 text-right">+{inc.amount} ₽</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {!confirmDeleteId || confirmDeleteId !== inc.id ? (
                        <><button onClick={() => { setEditingIncome(inc); setFormData({ name: inc.name, amount: inc.amount, category: inc.category, date: new Date(inc.date).toISOString().split('T')[0] }); setIsModalOpen(true); }} className="p-2 text-neutral-300 hover:text-indigo-600"><Edit2 size={16} /></button><button onClick={() => setConfirmDeleteId(inc.id)} className="p-2 text-neutral-300 hover:text-rose-600"><Trash2 size={16} /></button></>
                      ) : (
                        <div className="flex gap-1"><button onClick={() => { setIncomes(prev => prev.filter(i => i.id !== inc.id)); setConfirmDeleteId(null); }} className="p-2 bg-rose-600 text-white rounded-lg"><Check size={14} /></button><button onClick={() => setConfirmDeleteId(null)} className="p-2 bg-neutral-100 text-neutral-400 rounded-lg"><X size={14} /></button></div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[32px] w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in duration-300 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-neutral-100 shrink-0 flex justify-between items-center"><h2 className="text-xl font-bold">{editingIncome ? 'Редактировать' : 'Новый доход'}</h2><button onClick={() => setIsModalOpen(false)} className="p-2 text-neutral-400 hover:bg-neutral-100 rounded-full transition-colors"><X size={20} /></button></div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
              <div className="space-y-1"><label className="text-xs font-bold text-neutral-400 uppercase ml-1">Описание</label><input required placeholder="Откуда доход?" type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-3 rounded-2xl border border-neutral-200 outline-none focus:border-emerald-500 transition-all" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><label className="text-xs font-bold text-neutral-400 uppercase ml-1">Сумма (₽)</label><input required type="number" value={formData.amount} onChange={e => setFormData({ ...formData, amount: +e.target.value })} className="w-full px-4 py-3 rounded-2xl border border-neutral-200 outline-none font-bold text-emerald-600 focus:border-emerald-500" /></div>
                <div className="space-y-1"><label className="text-xs font-bold text-neutral-400 uppercase ml-1">Дата</label><input required type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} className="w-full px-4 py-3 rounded-2xl border border-neutral-200 outline-none focus:border-emerald-500" /></div>
              </div>
              <div className="space-y-1"><label className="text-xs font-bold text-neutral-400 uppercase ml-1">Категория</label><select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} className="w-full px-4 py-3 rounded-2xl border border-neutral-200 outline-none focus:border-emerald-500 bg-white">{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
              <button type="submit" className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold shadow-lg hover:bg-emerald-700 transition-all">Сохранить</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Incomes;
