
import React, { useState, useMemo } from 'react';
import { Plus, Trash2, Edit2, ReceiptRussianRuble, X, Check, Search } from 'lucide-react';
import { Expense } from '../types';

interface ExpensesProps {
  expenses: Expense[];
  setExpenses: React.Dispatch<React.SetStateAction<Expense[]>>;
  searchQuery: string;
}

const CATEGORIES = [
  'Упаковка (коробки, пакеты)',
  'Инструменты (шприцы, иглы)',
  'Маркетинг (открытки, наклейки)',
  'Оборудование (ленты, бумага)',
  'Логистика',
  'Прочее'
];

const Expenses: React.FC<ExpensesProps> = ({ expenses, setExpenses, searchQuery }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', amount: 0, category: CATEGORIES[0], date: new Date().toISOString().split('T')[0] });

  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => 
      e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.category.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [expenses, searchQuery]);

  const totalExpensesAmount = useMemo(() => filteredExpenses.reduce((sum, e) => sum + e.amount, 0), [filteredExpenses]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingExpense) {
      setExpenses(prev => prev.map(ex => ex.id === editingExpense.id ? { ...ex, name: formData.name, amount: formData.amount, category: formData.category, date: new Date(formData.date).getTime() } : ex));
    } else {
      const newExpense: Expense = { id: Math.random().toString(36).substr(2, 9), name: formData.name, amount: formData.amount, category: formData.category, date: new Date(formData.date).getTime() };
      setExpenses(prev => [...prev, newExpense]);
    }
    setIsModalOpen(false);
    setEditingExpense(null);
    setFormData({ name: '', amount: 0, category: CATEGORIES[0], date: new Date().toISOString().split('T')[0] });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div><h1 className="text-2xl font-bold text-neutral-900">Дополнительные расходы</h1><p className="text-neutral-500 text-sm">Учет трат на сервис и упаковку.</p></div>
        <button onClick={() => { setEditingExpense(null); setIsModalOpen(true); }} className="w-full sm:w-auto bg-rose-600 text-white px-6 py-2.5 rounded-2xl hover:bg-rose-700 transition-all flex items-center justify-center gap-2 font-medium shadow-sm active:scale-95"><Plus size={20} /> Добавить расход</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white p-6 rounded-[32px] border border-neutral-200 shadow-sm"><p className="text-neutral-400 text-[10px] font-black uppercase tracking-wider mb-2">Найдено трат</p><p className="text-3xl font-bold text-rose-600">{totalExpensesAmount.toLocaleString()} ₽</p></div>
        <div className="lg:col-span-2 bg-white rounded-[32px] border border-neutral-200 overflow-hidden shadow-sm overflow-x-auto">
          <table className="w-full text-left min-w-[500px]">
            <thead><tr className="bg-neutral-50 text-neutral-400 text-[10px] uppercase font-bold tracking-widest"><th className="px-6 py-4">Дата</th><th className="px-6 py-4">Описание</th><th className="px-6 py-4 text-right">Сумма</th><th className="px-6 py-4"></th></tr></thead>
            <tbody className="divide-y divide-neutral-50 text-sm">
              {filteredExpenses.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-12 text-center text-neutral-400 italic">Расходов не найдено.</td></tr>
              ) : filteredExpenses.sort((a,b) => b.date - a.date).map(ex => (
                  <tr key={ex.id} className="hover:bg-neutral-50 transition-colors group">
                    <td className="px-6 py-4 text-neutral-500 text-xs font-bold">{new Date(ex.date).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })}</td>
                    <td className="px-6 py-4"><p className="font-bold text-neutral-800">{ex.name}</p><p className="text-[10px] text-neutral-400 font-bold uppercase">{ex.category}</p></td>
                    <td className="px-6 py-4 font-black text-rose-600 text-right">{ex.amount} ₽</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {!confirmDeleteId || confirmDeleteId !== ex.id ? (
                          <><button onClick={() => { setEditingExpense(ex); setFormData({ name: ex.name, amount: ex.amount, category: ex.category, date: new Date(ex.date).toISOString().split('T')[0] }); setIsModalOpen(true); }} className="p-2 text-neutral-300 hover:text-indigo-600"><Edit2 size={16} /></button><button onClick={() => setConfirmDeleteId(ex.id)} className="p-2 text-neutral-300 hover:text-rose-600"><Trash2 size={16} /></button></>
                        ) : (
                          <div className="flex gap-1"><button onClick={() => { setExpenses(prev => prev.filter(e => e.id !== ex.id)); setConfirmDeleteId(null); }} className="p-2 bg-rose-600 text-white rounded-lg"><Check size={14} /></button><button onClick={() => setConfirmDeleteId(null)} className="p-2 bg-neutral-100 text-neutral-400 rounded-lg"><X size={14} /></button></div>
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
            <div className="p-6 border-b border-neutral-100 shrink-0 flex justify-between items-center"><h2 className="text-xl font-bold">{editingExpense ? 'Редактировать' : 'Новый расход'}</h2><button onClick={() => setIsModalOpen(false)} className="p-2 text-neutral-400 hover:bg-neutral-100 rounded-full transition-colors"><X size={20} /></button></div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <input required placeholder="На что потратили?" type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-3 rounded-2xl border border-neutral-200 outline-none" />
              <input required type="number" value={formData.amount} onChange={e => setFormData({...formData, amount: +e.target.value})} className="w-full px-4 py-3 rounded-2xl border border-neutral-200 outline-none font-bold text-rose-600" />
              <button type="submit" className="w-full bg-rose-600 text-white py-4 rounded-2xl font-bold shadow-lg hover:bg-rose-700 transition-all">Сохранить</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Expenses;
