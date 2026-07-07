
import React, { useState, useEffect, useMemo } from 'react';
import { Package, Plus, Minus, Trash2, Edit2, AlertTriangle, Check, X, Calculator, ArrowDownCircle, LayoutGrid, List, ArrowUpDown } from 'lucide-react';
import { Vial } from '../types';

interface VialsProps {
  vials: Vial[];
  setVials: React.Dispatch<React.SetStateAction<Vial[]>>;
  searchQuery: string;
}

type SortOption = 'name' | 'size' | 'stock';

const Vials: React.FC<VialsProps> = ({ vials, setVials, searchQuery }) => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVial, setEditingVial] = useState<Vial | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    sizeMl: 5,
    batchTotalCost: 0,
    batchQuantity: 50,
    retailPrice: 0,
    lowStockThreshold: 10
  });

  const filteredVials = useMemo(() => {
    return vials.filter(v => v.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [vials, searchQuery]);

  const sortedVials = useMemo(() => {
    return [...filteredVials].sort((a, b) => {
      switch (sortBy) {
        case 'name': return a.name.localeCompare(b.name);
        case 'size': return a.sizeMl - b.sizeMl;
        case 'stock': return a.stockQuantity - b.stockQuantity;
        default: return 0;
      }
    });
  }, [filteredVials, sortBy]);

  useEffect(() => {
    if (!confirmDeleteId) return;
    const timeout = setTimeout(() => setConfirmDeleteId(null), 3000);
    return () => clearTimeout(timeout);
  }, [confirmDeleteId]);

  const calculatedUnitCost = useMemo(() => {
    if (formData.batchQuantity > 0 && formData.batchTotalCost > 0) {
      return (formData.batchTotalCost / formData.batchQuantity);
    }
    return 0;
  }, [formData.batchTotalCost, formData.batchQuantity]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const unitPurchasePrice = calculatedUnitCost || (editingVial?.purchasePrice ?? 0);
    setVials(prev => {
      if (editingVial) {
        return prev.map(v => v.id === editingVial.id ? { ...v, name: formData.name, sizeMl: formData.sizeMl, purchasePrice: unitPurchasePrice, retailPrice: formData.retailPrice, stockQuantity: formData.batchQuantity, lowStockThreshold: formData.lowStockThreshold } : v);
      }
      const newVial: Vial = { id: Math.random().toString(36).substr(2, 9), name: formData.name, sizeMl: formData.sizeMl, purchasePrice: unitPurchasePrice, retailPrice: formData.retailPrice, stockQuantity: formData.batchQuantity, lowStockThreshold: formData.lowStockThreshold };
      return [...prev, newVial];
    });
    setIsModalOpen(false);
    setEditingVial(null);
    // Reset form data after successful submission
    setFormData({ id: '', name: '', sizeMl: 5, batchTotalCost: 0, batchQuantity: 50, retailPrice: 0, lowStockThreshold: 10 });
  };

  // Fix: Defined handleEdit function to populate form with existing vial data
  const handleEdit = (v: Vial) => {
    setEditingVial(v);
    setFormData({
      id: v.id,
      name: v.name,
      sizeMl: v.sizeMl,
      batchTotalCost: v.purchasePrice * v.stockQuantity,
      batchQuantity: v.stockQuantity,
      retailPrice: v.retailPrice,
      lowStockThreshold: v.lowStockThreshold || 10
    });
    setIsModalOpen(true);
  };

  const processDelete = (id: string) => { setVials(prev => prev.filter(v => v.id !== id)); setConfirmDeleteId(null); };
  const adjustStock = (id: string, delta: number) => { setVials(prev => prev.map(v => v.id === id ? { ...v, stockQuantity: Math.max(0, v.stockQuantity + delta) } : v)); };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Тара и упаковка</h1>
          <p className="text-neutral-500 text-sm">Учет приходов и остатков на складе.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <div className="flex items-center bg-white border border-neutral-200 rounded-2xl p-1 shadow-sm">
            <button onClick={() => setViewMode('grid')} className={`p-2 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-neutral-400 hover:text-neutral-600'}`}><LayoutGrid size={20} /></button>
            <button onClick={() => setViewMode('list')} className={`p-2 rounded-xl transition-all ${viewMode === 'list' ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-neutral-400 hover:text-neutral-600'}`}><List size={20} /></button>
          </div>
          <div className="flex items-center gap-2 bg-white border border-neutral-200 rounded-2xl px-3 py-2 shadow-sm">
            <ArrowUpDown size={16} className="text-neutral-400" />
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortOption)} className="bg-transparent text-sm font-medium outline-none border-none cursor-pointer pr-2">
              <option value="name">Название</option>
              <option value="size">Объем</option>
              <option value="stock">Остаток</option>
            </select>
          </div>
          <button onClick={() => { 
            setEditingVial(null); 
            // Reset form data when opening for a new arrival
            setFormData({ id: '', name: '', sizeMl: 5, batchTotalCost: 0, batchQuantity: 50, retailPrice: 0, lowStockThreshold: 10 });
            setIsModalOpen(true); 
          }} className="flex-1 lg:flex-none bg-neutral-900 text-white px-6 py-2.5 rounded-2xl hover:bg-neutral-800 transition-all flex items-center justify-center gap-2 font-medium shadow-lg active:scale-95">
            <ArrowDownCircle size={20} /> Приход
          </button>
        </div>
      </div>

      {sortedVials.length === 0 ? (
        <div className="py-24 text-center text-neutral-400 bg-white rounded-[32px] border border-dashed border-neutral-200">
          <Package size={48} className="mx-auto mb-4 opacity-10" />
          <p className="text-lg font-medium">{searchQuery ? 'Ничего не найдено' : 'Список тары пуст'}</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {sortedVials.map(v => {
            const isLow = v.stockQuantity <= (v.lowStockThreshold || 10);
            return (
              <div key={v.id} className="bg-white p-6 rounded-[32px] border border-neutral-200 shadow-sm hover:shadow-xl transition-all group relative">
                <div className="flex justify-between items-start mb-4">
                  <div className={`p-3 rounded-2xl ${isLow ? 'bg-amber-100 text-amber-600' : 'bg-neutral-100 text-neutral-600'}`}><Package size={24} /></div>
                  <div className="flex gap-1">
                    {!confirmDeleteId || confirmDeleteId !== v.id ? (
                      /* Fix: Replaced openEditModal with handleEdit */
                      <><button onClick={() => handleEdit(v)} className="p-2 text-neutral-300 hover:text-indigo-600"><Edit2 size={18} /></button>
                      <button onClick={() => setConfirmDeleteId(v.id)} className="p-2 text-neutral-300 hover:text-rose-600"><Trash2 size={18} /></button></>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button onClick={() => processDelete(v.id)} className="p-2 bg-rose-600 text-white rounded-xl"><Check size={18} /></button>
                        <button onClick={() => setConfirmDeleteId(null)} className="p-2 bg-neutral-100 text-neutral-500 rounded-xl"><X size={18} /></button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="mb-4">
                  <h3 className="text-lg font-bold truncate leading-tight">{v.name}</h3>
                  <p className="text-[10px] text-neutral-400 font-black uppercase tracking-widest mt-1">{v.sizeMl} мл</p>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-2xl border border-neutral-100">
                    <div className="flex flex-col"><span className="text-[9px] text-neutral-400 font-black uppercase tracking-widest">Остаток</span><span className={`text-base font-bold ${isLow ? 'text-amber-600' : 'text-neutral-900'}`}>{v.stockQuantity} шт.</span></div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => adjustStock(v.id, -1)} className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-neutral-200 text-neutral-500 hover:text-indigo-600 transition-all shadow-sm active:scale-90"><Minus size={14} /></button>
                      <button onClick={() => adjustStock(v.id, 1)} className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-neutral-200 text-neutral-500 hover:text-indigo-600 transition-all shadow-sm active:scale-90"><Plus size={14} /></button>
                    </div>
                  </div>
                </div>
                {isLow && <div className="absolute top-3 left-3"><span className="bg-amber-500 text-white text-[9px] font-black px-2 py-0.5 rounded-lg uppercase flex items-center gap-1 shadow-lg shadow-amber-500/20"><AlertTriangle size={10} /> Мало</span></div>}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-[32px] border border-neutral-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-neutral-50/50 text-neutral-400 text-[10px] uppercase font-black tracking-widest">
                  <th className="px-8 py-5">Флакон</th>
                  <th className="px-6 py-5 text-center">Размер</th>
                  <th className="px-6 py-5">На складе</th>
                  <th className="px-6 py-5">Розница</th>
                  <th className="px-8 py-5 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {sortedVials.map(v => {
                  const isLow = v.stockQuantity <= (v.lowStockThreshold || 10);
                  return (
                    <tr key={v.id} className="hover:bg-neutral-50/50 transition-colors group">
                      <td className="px-8 py-4"><p className="font-bold text-neutral-900">{v.name}</p></td>
                      <td className="px-6 py-4 text-center"><span className="text-xs font-black text-neutral-400 bg-neutral-100 px-2 py-1 rounded-lg">{v.sizeMl} мл</span></td>
                      <td className="px-6 py-4"><span className={`text-sm font-bold ${isLow ? 'text-amber-600' : 'text-neutral-700'}`}>{v.stockQuantity} шт</span></td>
                      <td className="px-6 py-4"><span className="text-sm font-bold text-indigo-600">{v.retailPrice} ₽</span></td>
                      <td className="px-8 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {!confirmDeleteId || confirmDeleteId !== v.id ? (
                            /* Fix: Replaced openEditModal with handleEdit */
                            <><button onClick={() => handleEdit(v)} className="p-2 text-neutral-300 hover:text-indigo-600"><Edit2 size={16} /></button>
                            <button onClick={() => setConfirmDeleteId(v.id)} className="p-2 text-neutral-300 hover:text-rose-600"><Trash2 size={16} /></button></>
                          ) : (
                            <div className="flex gap-1">
                              <button onClick={() => processDelete(v.id)} className="p-2 bg-rose-600 text-white rounded-lg shadow-md"><Check size={14} /></button>
                              <button onClick={() => setConfirmDeleteId(null)} className="p-2 bg-neutral-100 text-neutral-400 rounded-lg"><X size={14} /></button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[32px] w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in duration-300 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-neutral-100 flex justify-between items-center shrink-0">
              <h2 className="text-xl font-bold">{editingVial ? 'Редактировать' : 'Приход тары'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-neutral-400 hover:bg-neutral-50 rounded-full transition-colors"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-400 uppercase ml-1">Наименование флакона</label>
                  <input required type="text" autoFocus value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-3 rounded-2xl border border-neutral-200 outline-none focus:border-indigo-500 transition-all" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1"><label className="text-xs font-bold text-neutral-400 uppercase ml-1">Объем (мл)</label><input required type="number" value={formData.sizeMl} onChange={e => setFormData({...formData, sizeMl: +e.target.value})} className="w-full px-4 py-3 rounded-2xl border border-neutral-200 outline-none focus:border-indigo-500" /></div>
                  <div className="space-y-1"><label className="text-xs font-bold text-neutral-400 uppercase ml-1">Кол-во (шт)</label><input required type="number" value={formData.batchQuantity} onChange={e => setFormData({...formData, batchQuantity: +e.target.value})} className="w-full px-4 py-3 rounded-2xl border border-neutral-200 outline-none focus:border-indigo-500" /></div>
                </div>
              </div>
              <div className="bg-neutral-50 p-5 rounded-3xl border border-neutral-100 space-y-4">
                <div className="space-y-1"><label className="text-xs font-bold text-neutral-400 uppercase ml-1">Сумма за всю партию (₽)</label><input required type="number" value={formData.batchTotalCost} onChange={e => setFormData({...formData, batchTotalCost: +e.target.value})} className="w-full px-4 py-3 rounded-2xl border border-neutral-200 outline-none focus:bg-white focus:border-indigo-500" /></div>
                <div className="flex items-center justify-between px-2"><div className="flex items-center gap-2 text-neutral-500 text-xs"><Calculator size={14} /> Себестоимость:</div><span className="text-lg font-bold text-neutral-900">{calculatedUnitCost.toFixed(2)} ₽/шт</span></div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-indigo-500 uppercase ml-1">Розничная цена шт (₽)</label>
                <input required type="number" value={formData.retailPrice} onChange={e => setFormData({...formData, retailPrice: +e.target.value})} className="w-full px-4 py-4 rounded-2xl border-2 border-indigo-100 bg-indigo-50/30 text-indigo-700 text-xl font-bold outline-none focus:border-indigo-500 transition-all" />
              </div>
              <div className="flex gap-4 pt-2 shrink-0">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 font-bold text-neutral-400">Отмена</button>
                <button type="submit" className="flex-[2] bg-neutral-900 text-white py-4 rounded-2xl font-bold shadow-lg active:scale-95 transition-all">Сохранить</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Vials;
