
import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Edit2, Droplets, Check, X, Calculator, LayoutGrid, List, ArrowUpDown, ArchiveRestore } from 'lucide-react';
import { Perfume, isPerfumeArchived } from '../types';

interface InventoryProps {
  perfumes: Perfume[];
  setPerfumes: React.Dispatch<React.SetStateAction<Perfume[]>>;
  searchQuery: string;
}

type SortOption = 'brand' | 'volume' | 'price' | 'newest';

const Inventory: React.FC<InventoryProps> = ({ perfumes, setPerfumes, searchQuery }) => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showArchive, setShowArchive] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPerfume, setEditingPerfume] = useState<Perfume | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    brand: '',
    name: '',
    totalVolumeMl: 100,
    currentVolumeMl: 100,
    purchasePrice: 0,
    retailPricePerMl: 0,
    lowStockThreshold: 10
  });

  const filteredPerfumes = useMemo(() => {
    return perfumes.filter(p => {
      const matchesArchive = isPerfumeArchived(p) === showArchive;
      const matchesSearch =
        p.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesArchive && matchesSearch;
    });
  }, [perfumes, searchQuery, showArchive]);

  const sortedPerfumes = useMemo(() => {
    return [...filteredPerfumes].sort((a, b) => {
      switch (sortBy) {
        case 'brand': return `${a.brand} ${a.name}`.localeCompare(`${b.brand} ${b.name}`);
        case 'volume': return a.currentVolumeMl - b.currentVolumeMl;
        case 'price': return b.retailPricePerMl - a.retailPricePerMl;
        case 'newest': return b.createdAt - a.createdAt;
        default: return 0;
      }
    });
  }, [filteredPerfumes, sortBy]);

  const costPerMl = useMemo(() => {
    if (formData.totalVolumeMl > 0 && formData.purchasePrice > 0) {
      return (formData.purchasePrice / formData.totalVolumeMl).toFixed(2);
    }
    return "0.00";
  }, [formData.totalVolumeMl, formData.purchasePrice]);

  const markup = useMemo(() => {
    const cost = parseFloat(costPerMl);
    if (cost > 0 && formData.retailPricePerMl > 0) {
      const diff = formData.retailPricePerMl - cost;
      const percent = (diff / cost) * 100;
      return { diff: diff.toFixed(2), percent: percent.toFixed(0) };
    }
    return null;
  }, [costPerMl, formData.retailPricePerMl]);

  useEffect(() => {
    if (!confirmDeleteId) return;
    const timeout = setTimeout(() => setConfirmDeleteId(null), 3000);
    return () => clearTimeout(timeout);
  }, [confirmDeleteId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingPerfume) {
      setPerfumes(prev => prev.map(p => p.id === editingPerfume.id ? { ...p, ...formData } : p));
    } else {
      const newPerfume: Perfume = {
        ...formData,
        id: Math.random().toString(36).substr(2, 9),
        createdAt: Date.now()
      };
      setPerfumes(prev => [...prev, newPerfume]);
    }
    setIsModalOpen(false);
    setEditingPerfume(null);
    setFormData({ brand: '', name: '', totalVolumeMl: 100, currentVolumeMl: 100, purchasePrice: 0, retailPricePerMl: 0, lowStockThreshold: 10 });
  };

  const processDelete = (id: string) => {
    setPerfumes(prev => prev.filter(p => p.id !== id));
    setConfirmDeleteId(null);
  };

  const restorePerfume = (id: string) => {
    setPerfumes(prev => prev.map(p => p.id === id ? { ...p, isArchived: false, archivedAt: undefined } : p));
  };

  const handleEdit = (p: Perfume) => {
    setEditingPerfume(p);
    setFormData({
      brand: p.brand,
      name: p.name,
      totalVolumeMl: p.totalVolumeMl,
      currentVolumeMl: p.currentVolumeMl,
      purchasePrice: p.purchasePrice,
      retailPricePerMl: p.retailPricePerMl,
      lowStockThreshold: p.lowStockThreshold
    });
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Инвентарь парфюмерии</h1>
          <p className="text-neutral-500 text-sm">{showArchive ? 'Законченные флаконы и история архива.' : 'Управление основными флаконами и ценами.'}</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <div className="flex items-center bg-white border border-neutral-200 rounded-2xl p-1 shadow-sm">
            <button onClick={() => setShowArchive(false)} className={`px-3 py-2 rounded-xl text-sm font-bold transition-all ${!showArchive ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-neutral-400 hover:text-neutral-600'}`}>Активные</button>
            <button onClick={() => setShowArchive(true)} className={`px-3 py-2 rounded-xl text-sm font-bold transition-all ${showArchive ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-neutral-400 hover:text-neutral-600'}`}>Архив</button>
          </div>
          <div className="flex items-center bg-white border border-neutral-200 rounded-2xl p-1 shadow-sm">
            <button onClick={() => setViewMode('grid')} className={`p-2 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-neutral-400 hover:text-neutral-600'}`}><LayoutGrid size={20} /></button>
            <button onClick={() => setViewMode('list')} className={`p-2 rounded-xl transition-all ${viewMode === 'list' ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-neutral-400 hover:text-neutral-600'}`}><List size={20} /></button>
          </div>
          <div className="flex items-center gap-2 bg-white border border-neutral-200 rounded-2xl px-3 py-2 shadow-sm">
            <ArrowUpDown size={16} className="text-neutral-400" />
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortOption)} className="bg-transparent text-sm font-medium outline-none border-none cursor-pointer pr-2">
              <option value="newest">Новые</option>
              <option value="brand">Бренд</option>
              <option value="volume">Остаток</option>
              <option value="price">Цена</option>
            </select>
          </div>
          {!showArchive && <button onClick={() => { setEditingPerfume(null); setIsModalOpen(true); }} className="flex-1 lg:flex-none bg-indigo-600 text-white px-6 py-2.5 rounded-2xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 font-medium shadow-lg active:scale-95">
            <Plus size={20} /> Добавить
          </button>}
        </div>
      </div>

      {sortedPerfumes.length === 0 ? (
        <div className="py-24 text-center text-neutral-400 bg-white rounded-[32px] border border-dashed border-neutral-200">
          <Droplets size={48} className="mx-auto mb-4 opacity-10" />
          <p className="text-lg font-medium">{searchQuery ? 'Ничего не найдено' : showArchive ? 'Архив пуст' : 'Коллекция пуста'}</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedPerfumes.map(p => {
            const progress = (p.currentVolumeMl / p.totalVolumeMl) * 100;
            const isLow = p.currentVolumeMl <= p.lowStockThreshold;
            const actualCostPerMl = (p.purchasePrice / p.totalVolumeMl).toFixed(1);
            return (
              <div key={p.id} className="bg-white p-6 rounded-[32px] border border-neutral-200 shadow-sm hover:shadow-xl transition-all group">
                <div className="flex justify-between items-start mb-4">
                  <div className="min-w-0">
                    <span className="text-[10px] font-black text-indigo-500 bg-indigo-50 px-2.5 py-1 rounded-full uppercase tracking-wider">{p.brand}</span>
                    <h3 className="text-lg font-bold mt-2 truncate leading-tight" title={p.name}>{p.name}</h3>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {showArchive ? (
                      <>
                        <button onClick={() => handleEdit(p)} className="p-2 text-neutral-300 hover:text-indigo-600 transition-all" title="Редактировать (впишите остаток — аромат вернётся из архива)"><Edit2 size={16} /></button>
                        <button onClick={() => restorePerfume(p.id)} className="p-2 text-neutral-300 hover:text-emerald-600 transition-all" title="Вернуть из архива"><ArchiveRestore size={16} /></button>
                      </>
                    ) : !confirmDeleteId || confirmDeleteId !== p.id ? (
                      <><button onClick={() => handleEdit(p)} className="p-2 text-neutral-300 hover:text-indigo-600 transition-all"><Edit2 size={16} /></button>
                      <button onClick={() => setConfirmDeleteId(p.id)} className="p-2 text-neutral-300 hover:text-rose-600 transition-all"><Trash2 size={16} /></button></>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button onClick={() => processDelete(p.id)} className="p-2 bg-rose-600 text-white rounded-xl shadow-lg"><Check size={16} /></button>
                        <button onClick={() => setConfirmDeleteId(null)} className="p-2 bg-neutral-100 text-neutral-500 rounded-xl"><X size={16} /></button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between text-[10px] text-neutral-400 font-black uppercase tracking-widest">
                    <span>Остаток</span>
                    <span className={isLow ? 'text-rose-500' : 'text-neutral-900'}>{p.currentVolumeMl} / {p.totalVolumeMl} мл</span>
                  </div>
                  <div className="h-1.5 w-full bg-neutral-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-1000 ${isLow ? 'bg-rose-500' : 'bg-indigo-600'}`} style={{ width: `${progress}%` }} />
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="p-4 bg-neutral-50 rounded-2xl"><p className="text-[9px] text-neutral-400 uppercase font-black tracking-widest mb-1">Себест.</p><p className="text-sm font-bold text-neutral-800">{actualCostPerMl} ₽/мл</p></div>
                    <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100/30"><p className="text-[9px] text-indigo-400 uppercase font-black tracking-widest mb-1">Розница</p><p className="text-sm font-bold text-indigo-600">{p.retailPricePerMl} ₽/мл</p></div>
                  </div>
                </div>
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
                  <th className="px-8 py-5">Парфюм</th>
                  <th className="px-6 py-5">Остаток</th>
                  <th className="px-6 py-5">Себест.</th>
                  <th className="px-6 py-5">Розница</th>
                  <th className="px-8 py-5 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {sortedPerfumes.map(p => {
                  const isLow = p.currentVolumeMl <= p.lowStockThreshold;
                  return (
                    <tr key={p.id} className="hover:bg-neutral-50/50 transition-colors group">
                      <td className="px-8 py-4"><p className="text-[10px] font-bold text-indigo-500 uppercase">{p.brand}</p><p className="font-bold text-neutral-900">{p.name}</p></td>
                      <td className="px-6 py-4"><span className={`text-xs font-bold ${isLow ? 'text-rose-500' : 'text-neutral-600'}`}>{p.currentVolumeMl} мл</span></td>
                      <td className="px-6 py-4"><span className="text-xs font-bold text-neutral-500">{(p.purchasePrice / p.totalVolumeMl).toFixed(1)} ₽/мл</span></td>
                      <td className="px-6 py-4"><span className="text-sm font-bold text-indigo-600">{p.retailPricePerMl} ₽/мл</span></td>
                      <td className="px-8 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {showArchive ? (
                            <>
                              <button onClick={() => handleEdit(p)} className="p-2 text-neutral-300 hover:text-indigo-600 transition-colors" title="Редактировать"><Edit2 size={16} /></button>
                              <button onClick={() => restorePerfume(p.id)} className="p-2 text-neutral-300 hover:text-emerald-600 transition-colors" title="Вернуть из архива"><ArchiveRestore size={16} /></button>
                            </>
                          ) : !confirmDeleteId || confirmDeleteId !== p.id ? (
                            <><button onClick={() => handleEdit(p)} className="p-2 text-neutral-300 hover:text-indigo-600 transition-colors"><Edit2 size={16} /></button>
                            <button onClick={() => setConfirmDeleteId(p.id)} className="p-2 text-neutral-300 hover:text-rose-600 transition-colors"><Trash2 size={16} /></button></>
                          ) : (
                            <div className="flex gap-1">
                              <button onClick={() => processDelete(p.id)} className="p-2 bg-rose-600 text-white rounded-lg shadow-md"><Check size={14} /></button>
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
          <div className="bg-white rounded-[32px] w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in duration-300 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-neutral-100 shrink-0 flex justify-between items-center">
              <h2 className="text-xl font-bold">{editingPerfume ? 'Редактировать аромат' : 'Новый аромат'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-neutral-400 hover:bg-neutral-100 rounded-full transition-colors"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-400 uppercase ml-1">Бренд</label>
                  <input required type="text" value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} className="w-full px-4 py-3 rounded-2xl border border-neutral-200 outline-none focus:border-indigo-500 transition-all" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-400 uppercase ml-1">Название</label>
                  <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-3 rounded-2xl border border-neutral-200 outline-none focus:border-indigo-500 transition-all" />
                </div>
              </div>
              <div className="bg-neutral-50 p-5 rounded-3xl border border-neutral-100 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-neutral-400 uppercase ml-1">Объем (мл)</label>
                    <input required type="number" value={formData.totalVolumeMl} onChange={e => setFormData({...formData, totalVolumeMl: +e.target.value, currentVolumeMl: +e.target.value})} className="w-full px-4 py-3 rounded-2xl border border-neutral-200 outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-neutral-400 uppercase ml-1">Цена закупки (₽)</label>
                    <input required type="number" value={formData.purchasePrice} onChange={e => setFormData({...formData, purchasePrice: +e.target.value})} className="w-full px-4 py-3 rounded-2xl border border-neutral-200 outline-none" />
                  </div>
                </div>
                <div className="flex items-center justify-between px-2 text-xs">
                  <div className="flex items-center gap-2 text-neutral-500 font-medium"><Calculator size={14} /> Себестоимость:</div>
                  <span className="font-bold text-neutral-900">{costPerMl} ₽ / мл</span>
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-1 relative">
                  <label className="text-xs font-bold text-indigo-400 uppercase ml-1">Цена за 1 мл (₽)</label>
                  <input required type="number" value={formData.retailPricePerMl} onChange={e => setFormData({...formData, retailPricePerMl: +e.target.value})} className="w-full px-4 py-4 rounded-2xl border-2 border-indigo-100 bg-indigo-50/30 text-indigo-700 text-xl font-bold outline-none focus:border-indigo-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-400 uppercase ml-1">Порог уведомления (мл)</label>
                  <input required type="number" value={formData.lowStockThreshold} onChange={e => setFormData({...formData, lowStockThreshold: +e.target.value})} className="w-full px-4 py-3 rounded-2xl border border-neutral-200 outline-none" />
                </div>
              </div>
              <div className="flex gap-4 pt-4 shrink-0">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-4 font-bold text-neutral-400">Отмена</button>
                <button type="submit" className="flex-[2] bg-indigo-600 text-white px-4 py-4 rounded-2xl font-bold hover:bg-indigo-700 shadow-lg active:scale-95 transition-all">
                  {editingPerfume ? 'Сохранить' : 'Добавить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
