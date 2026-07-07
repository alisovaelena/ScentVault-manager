import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ShoppingCart, Plus, Trash2, X, Check, Edit2, Gift, Phone, PackagePlus, Truck } from 'lucide-react';
import { Sale, SaleItem, Perfume, Vial, ClientData, OrderStatus, isPerfumeArchived } from '../types';
import { ORDER_STATUSES, getSaleGiftCount, getSaleItems, getSaleStatus, getSaleSummary, getSaleTotal } from '../utils/sales';

interface SalesProps {
  sales: Sale[];
  setSales: React.Dispatch<React.SetStateAction<Sale[]>>;
  perfumes: Perfume[];
  setPerfumes: React.Dispatch<React.SetStateAction<Perfume[]>>;
  vials: Vial[];
  setVials: React.Dispatch<React.SetStateAction<Vial[]>>;
  clientsData: ClientData[];
  searchQuery: string;
}

type SortField = 'date' | 'customer' | 'perfume' | 'price';
type SortDirection = 'asc' | 'desc';

interface SaleFormData {
  customerName: string;
  customerPhone: string;
  extraIncome: number;
  status: OrderStatus;
  trackingNumber: string;
  shippingCost: number;
  items: SaleItem[];
}

const createEmptyItem = (): SaleItem => ({
  id: Math.random().toString(36).slice(2, 11),
  perfumeId: '',
  vialId: '',
  volumeMl: 5,
  price: 0,
  isGift: false
});

// Searchable perfume picker: type to filter, list is sorted alphabetically.
const PerfumeCombobox: React.FC<{
  perfumes: Perfume[];
  value: string;
  onChange: (id: string) => void;
}> = ({ perfumes, value, onChange }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const boxRef = useRef<HTMLDivElement>(null);
  const selected = perfumes.find(p => p.id === value);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const sorted = useMemo(
    () => [...perfumes].sort((a, b) => `${a.brand} ${a.name}`.localeCompare(`${b.brand} ${b.name}`, 'ru')),
    [perfumes]
  );
  const q = query.trim().toLowerCase();
  const filtered = q ? sorted.filter(p => `${p.brand} ${p.name}`.toLowerCase().includes(q)) : sorted;

  return (
    <div ref={boxRef} className="relative">
      <input
        type="text"
        value={open ? query : (selected ? `${selected.brand} ${selected.name}` : '')}
        placeholder={selected ? `${selected.brand} ${selected.name}` : 'Начните вводить бренд или название…'}
        onFocus={() => { setOpen(true); setQuery(''); }}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        className="w-full px-4 py-3 rounded-2xl border border-neutral-200 bg-white outline-none focus:border-indigo-500"
      />
      {open && (
        <div className="absolute z-20 mt-2 w-full max-h-64 overflow-y-auto custom-scrollbar bg-white border border-neutral-200 rounded-2xl shadow-xl">
          {filtered.length === 0 ? (
            <p className="p-4 text-sm text-neutral-400 italic">Ничего не найдено</p>
          ) : (
            filtered.map(p => (
              <button
                type="button"
                key={p.id}
                onClick={() => { onChange(p.id); setOpen(false); setQuery(''); }}
                className={`w-full text-left px-4 py-2.5 hover:bg-indigo-50 transition-colors border-b border-neutral-50 last:border-0 ${p.id === value ? 'bg-indigo-50/60' : ''}`}
              >
                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-wider">{p.brand}</span>
                <p className="text-sm font-medium text-neutral-800 leading-tight">
                  {p.name} <span className="text-neutral-400 text-xs font-normal">· {p.currentVolumeMl} мл · {p.retailPricePerMl} ₽/мл{isPerfumeArchived(p) ? ' · архив' : ''}</span>
                </p>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

const emptyForm = (): SaleFormData => ({
  customerName: '',
  customerPhone: '',
  extraIncome: 0,
  status: 'paid',
  trackingNumber: '',
  shippingCost: 0,
  items: [createEmptyItem()]
});

const Sales: React.FC<SalesProps> = ({ sales, setSales, perfumes, setPerfumes, vials, setVials, clientsData, searchQuery }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [formError, setFormError] = useState('');
  const [formData, setFormData] = useState<SaleFormData>(emptyForm());

  const activePerfumes = useMemo(() => perfumes.filter(p => !isPerfumeArchived(p)), [perfumes]);

  // Known clients for the name autocomplete (metadata first, then names seen in sales).
  const knownClients = useMemo(() => {
    const map = new Map<string, { name: string; phone?: string }>();
    clientsData.forEach(c => {
      const key = c.name.trim().toLowerCase();
      if (key) map.set(key, { name: c.name.trim(), phone: c.phone });
    });
    sales.forEach(s => {
      const key = s.customerName.trim().toLowerCase();
      if (key && !map.has(key)) map.set(key, { name: s.customerName.trim(), phone: s.customerPhone || s.customerContact });
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }, [clientsData, sales]);

  // When an existing client is picked, fill the phone automatically (never overwrite a typed one).
  const handleCustomerNameChange = (name: string) => {
    setFormData(prev => {
      const match = knownClients.find(c => c.name.toLowerCase() === name.trim().toLowerCase());
      const phone = !prev.customerPhone && match?.phone ? match.phone : prev.customerPhone;
      return { ...prev, customerName: name, customerPhone: phone };
    });
  };

  useEffect(() => {
    if (!confirmDeleteId) return;
    const timeout = setTimeout(() => setConfirmDeleteId(null), 3000);
    return () => clearTimeout(timeout);
  }, [confirmDeleteId]);

  const processedSales = useMemo(() => {
    const query = searchQuery.toLowerCase();
    let result = sales.filter(sale => {
      const summary = getSaleSummary(sale, perfumes).toLowerCase();
      const matchesSearch =
        sale.customerName.toLowerCase().includes(query) ||
        (sale.customerPhone || sale.customerContact || '').toLowerCase().includes(query) ||
        (sale.trackingNumber || '').toLowerCase().includes(query) ||
        summary.includes(query);
      if (!matchesSearch) return false;
      if (statusFilter !== 'all' && getSaleStatus(sale) !== statusFilter) return false;

      const saleDate = new Date(sale.date);
      const start = dateRange.start ? new Date(dateRange.start) : null;
      const end = dateRange.end ? new Date(dateRange.end) : null;
      if (start) { start.setHours(0, 0, 0, 0); if (saleDate < start) return false; }
      if (end) { end.setHours(23, 59, 59, 999); if (saleDate > end) return false; }
      return true;
    });

    result.sort((a, b) => {
      let comp = 0;
      switch (sortField) {
        case 'date': comp = a.date - b.date; break;
        case 'customer': comp = a.customerName.localeCompare(b.customerName); break;
        case 'price': comp = getSaleTotal(a) - getSaleTotal(b); break;
        case 'perfume': comp = getSaleSummary(a, perfumes).localeCompare(getSaleSummary(b, perfumes)); break;
      }
      return sortDirection === 'asc' ? comp : -comp;
    });
    return result;
  }, [sales, dateRange, statusFilter, sortField, sortDirection, perfumes, searchQuery]);

  const orderTotal = useMemo(
    () => formData.items.reduce((sum, item) => sum + item.price, 0) + formData.extraIncome + (formData.shippingCost || 0),
    [formData.items, formData.extraIncome, formData.shippingCost]
  );

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDirection('asc'); }
  };

  const recalculateItem = (item: SaleItem): SaleItem => {
    const perfume = perfumes.find(p => p.id === item.perfumeId);
    const vial = vials.find(v => v.id === item.vialId);
    const price = item.isGift ? 0 : (perfume ? perfume.retailPricePerMl * item.volumeMl : 0) + (vial?.retailPrice || 0);
    return { ...item, price };
  };

  const updateItem = (id: string, patch: Partial<SaleItem>) => {
    setFormError('');
    setFormData(prev => ({
      ...prev,
      items: prev.items.map(item => item.id === id ? recalculateItem({ ...item, ...patch }) : item)
    }));
  };

  const changeInventory = (items: SaleItem[], direction: 1 | -1) => {
    setPerfumes(prev => prev.map(perfume => {
      const used = items
        .filter(item => item.perfumeId === perfume.id)
        .reduce((sum, item) => sum + item.volumeMl, 0);
      if (!used) return perfume;

      const nextVolume = Math.max(0, perfume.currentVolumeMl + (direction * used));
      return {
        ...perfume,
        currentVolumeMl: nextVolume,
        isArchived: nextVolume <= 0,
        archivedAt: nextVolume <= 0 ? Date.now() : undefined
      };
    }));

    setVials(prev => prev.map(vial => {
      const used = items.filter(item => item.vialId === vial.id).length;
      return used ? { ...vial, stockQuantity: Math.max(0, vial.stockQuantity + (direction * used)) } : vial;
    }));
  };

  const validateForm = () => {
    const filledItems = formData.items.filter(item => item.perfumeId && item.volumeMl > 0);
    if (!formData.customerName.trim()) return 'Укажите имя клиента.';
    if (!filledItems.length) return 'Добавьте хотя бы одну позицию заказа.';

    for (const item of filledItems) {
      const perfume = perfumes.find(p => p.id === item.perfumeId);
      if (!perfume) return 'Один из ароматов не найден.';
      const returnedVolume = editingSale ? getSaleItems(editingSale).filter(old => old.perfumeId === item.perfumeId).reduce((sum, old) => sum + old.volumeMl, 0) : 0;
      const requestedVolume = filledItems.filter(i => i.perfumeId === item.perfumeId).reduce((sum, i) => sum + i.volumeMl, 0);
      if (requestedVolume > perfume.currentVolumeMl + returnedVolume) {
        return `Недостаточно остатка: ${perfume.brand} ${perfume.name}.`;
      }
    }

    for (const vial of vials) {
      const requested = filledItems.filter(item => item.vialId === vial.id).length;
      const returned = editingSale ? getSaleItems(editingSale).filter(item => item.vialId === vial.id).length : 0;
      if (requested > vial.stockQuantity + returned) return `Недостаточно тары: ${vial.name}.`;
    }

    return '';
  };

  const openNewSale = () => {
    setEditingSale(null);
    setFormError('');
    setFormData(emptyForm());
    setIsModalOpen(true);
  };

  const openEditSale = (sale: Sale) => {
    setEditingSale(sale);
    setFormError('');
    setFormData({
      customerName: sale.customerName,
      customerPhone: sale.customerPhone || sale.customerContact || '',
      extraIncome: sale.extraIncome || 0,
      status: getSaleStatus(sale),
      trackingNumber: sale.trackingNumber || '',
      shippingCost: sale.shippingCost || 0,
      items: getSaleItems(sale).map(item => recalculateItem({ ...item, id: Math.random().toString(36).slice(2, 11) }))
    });
    setIsModalOpen(true);
  };

  // Quick status change straight from the table.
  const updateSaleStatus = (id: string, status: OrderStatus) => {
    setSales(prev => prev.map(s => s.id === id ? { ...s, status } : s));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const error = validateForm();
    if (error) { setFormError(error); return; }

    const items = formData.items.filter(item => item.perfumeId && item.volumeMl > 0).map(recalculateItem);
    if (editingSale) {
      changeInventory(getSaleItems(editingSale), 1);
      changeInventory(items, -1);
      setSales(prev => prev.map(s => s.id === editingSale.id ? {
        ...s,
        customerName: formData.customerName.trim(),
        customerPhone: formData.customerPhone.trim(),
        customerContact: formData.customerPhone.trim(),
        items,
        perfumeId: undefined,
        vialId: undefined,
        volumeMl: undefined,
        isGift: undefined,
        extraIncome: formData.extraIncome,
        status: formData.status,
        trackingNumber: formData.trackingNumber.trim(),
        shippingCost: formData.shippingCost || 0,
        totalPrice: items.reduce((sum, item) => sum + item.price, 0) + formData.extraIncome + (formData.shippingCost || 0)
      } : s));
    } else {
      const newSale: Sale = {
        id: Math.random().toString(36).slice(2, 11),
        customerName: formData.customerName.trim(),
        customerPhone: formData.customerPhone.trim(),
        customerContact: formData.customerPhone.trim(),
        items,
        extraIncome: formData.extraIncome,
        status: formData.status,
        trackingNumber: formData.trackingNumber.trim(),
        shippingCost: formData.shippingCost || 0,
        totalPrice: items.reduce((sum, item) => sum + item.price, 0) + formData.extraIncome + (formData.shippingCost || 0),
        date: Date.now()
      };
      changeInventory(items, -1);
      setSales(prev => [...prev, newSale]);
    }

    setIsModalOpen(false);
    setEditingSale(null);
  };

  const processDelete = (id: string) => {
    const sale = sales.find(s => s.id === id);
    if (sale) changeInventory(getSaleItems(sale), 1);
    setSales(prev => prev.filter(s => s.id !== id));
    setConfirmDeleteId(null);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">История продаж</h1>
          <p className="text-neutral-500 text-sm">Заказы с несколькими позициями, подарками и доплатами.</p>
        </div>
        <button onClick={openNewSale} className="w-full sm:w-auto bg-indigo-600 text-white px-6 py-2.5 rounded-2xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 font-medium shadow-sm active:scale-95">
          <Plus size={20} /> Оформить заказ
        </button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-white rounded-3xl border border-neutral-200 p-4">
        <input type="date" value={dateRange.start} onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))} className="px-4 py-2 rounded-2xl border border-neutral-200 text-sm outline-none" />
        <input type="date" value={dateRange.end} onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))} className="px-4 py-2 rounded-2xl border border-neutral-200 text-sm outline-none" />
        <div className="flex flex-wrap gap-1.5 sm:ml-auto">
          <button onClick={() => setStatusFilter('all')} className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${statusFilter === 'all' ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white text-neutral-400 border-neutral-200 hover:border-neutral-400'}`}>Все</button>
          {ORDER_STATUSES.map(s => (
            <button key={s.value} onClick={() => setStatusFilter(statusFilter === s.value ? 'all' : s.value)} className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${statusFilter === s.value ? s.badge : 'bg-white text-neutral-400 border-neutral-200 hover:border-neutral-400'}`}>{s.label}</button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-[28px] sm:rounded-[32px] border border-neutral-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left">
            <thead>
              <tr className="bg-neutral-50 text-neutral-400 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-medium text-center cursor-pointer" onClick={() => handleSort('date')}>Дата</th>
                <th className="px-6 py-4 font-medium cursor-pointer" onClick={() => handleSort('customer')}>Клиент</th>
                <th className="px-6 py-4 font-medium cursor-pointer" onClick={() => handleSort('perfume')}>Позиции</th>
                <th className="px-6 py-4 font-medium text-center">Статус</th>
                <th className="px-6 py-4 font-medium text-right cursor-pointer" onClick={() => handleSort('price')}>Итого</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50 text-sm">
              {processedSales.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-neutral-400 italic">Ничего не найдено.</td></tr>
              ) : processedSales.map(sale => {
                const giftCount = getSaleGiftCount(sale);
                const statusMeta = ORDER_STATUSES.find(s => s.value === getSaleStatus(sale)) || ORDER_STATUSES[3];
                return (
                  <tr key={sale.id} className="hover:bg-neutral-50 transition-colors group">
                    <td className="px-6 py-4 text-center font-bold text-neutral-900">{new Date(sale.date).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })}</td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-neutral-900">{sale.customerName}</span>
                      {(sale.customerPhone || sale.customerContact) && <p className="text-[10px] text-neutral-400 flex items-center gap-1 mt-1"><Phone size={10} />{sale.customerPhone || sale.customerContact}</p>}
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-neutral-800 truncate max-w-[320px]">{getSaleSummary(sale, perfumes)}</p>
                      {giftCount > 0 && <p className="text-[10px] text-pink-500 font-black uppercase mt-1">{giftCount} подарок</p>}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <select
                        value={getSaleStatus(sale)}
                        onChange={e => updateSaleStatus(sale.id, e.target.value as OrderStatus)}
                        className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-xl border outline-none cursor-pointer appearance-none text-center ${statusMeta.badge}`}
                        title="Изменить статус заказа"
                      >
                        {ORDER_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                      {sale.trackingNumber && <p className="text-[10px] text-neutral-400 mt-1 font-mono truncate max-w-[120px] mx-auto" title={sale.trackingNumber}>{sale.trackingNumber}</p>}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-indigo-600">
                      {getSaleTotal(sale).toLocaleString()} ₽
                      {!!sale.extraIncome && <p className="text-[10px] text-emerald-600 font-black">+{sale.extraIncome} ₽ доп.</p>}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {!confirmDeleteId || confirmDeleteId !== sale.id ? (
                          <>
                            <button onClick={() => openEditSale(sale)} className="text-neutral-300 hover:text-indigo-600 p-2"><Edit2 size={16} /></button>
                            <button onClick={() => setConfirmDeleteId(sale.id)} className="text-neutral-300 hover:text-rose-500 p-2"><Trash2 size={16} /></button>
                          </>
                        ) : (
                          <div className="flex gap-1">
                            <button onClick={() => processDelete(sale.id)} className="p-2 bg-rose-600 text-white rounded-lg"><Check size={14} /></button>
                            <button onClick={() => setConfirmDeleteId(null)} className="p-2 bg-neutral-100 text-neutral-400 rounded-lg"><X size={14} /></button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-[28px] sm:rounded-[32px] w-full max-w-3xl overflow-hidden shadow-2xl animate-in zoom-in duration-300 flex flex-col max-h-[96vh] sm:max-h-[90vh]">
            <div className="p-5 sm:p-6 border-b border-neutral-100 flex justify-between items-center shrink-0">
              <h2 className="text-xl sm:text-2xl font-bold">{editingSale ? 'Редактировать заказ' : 'Новый заказ'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-neutral-400 hover:bg-neutral-100 rounded-full transition-colors"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input required placeholder="Имя клиента" type="text" list="known-clients" value={formData.customerName} onChange={e => handleCustomerNameChange(e.target.value)} className="w-full px-4 py-3 rounded-2xl border border-neutral-200 outline-none" />
                <datalist id="known-clients">
                  {knownClients.map(c => <option key={c.name} value={c.name} />)}
                </datalist>
                <input placeholder="Телефон" type="tel" value={formData.customerPhone} onChange={e => setFormData({ ...formData, customerPhone: e.target.value })} className="w-full px-4 py-3 rounded-2xl border border-neutral-200 outline-none" />
              </div>

              <div className="space-y-3">
                {formData.items.map((item, index) => {
                  const selectedPerfume = perfumes.find(p => p.id === item.perfumeId);
                  return (
                    <div key={item.id} className="p-4 rounded-3xl border border-neutral-200 bg-neutral-50/50 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-black uppercase tracking-wider text-neutral-400">Позиция {index + 1}</p>
                        <button type="button" onClick={() => setFormData(prev => ({ ...prev, items: prev.items.filter(i => i.id !== item.id) }))} className="p-2 text-neutral-300 hover:text-rose-500 disabled:opacity-30" disabled={formData.items.length === 1}><Trash2 size={16} /></button>
                      </div>
                      <PerfumeCombobox
                        perfumes={[...activePerfumes, ...(selectedPerfume && isPerfumeArchived(selectedPerfume) ? [selectedPerfume] : [])]}
                        value={item.perfumeId}
                        onChange={id => updateItem(item.id, { perfumeId: id })}
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <input type="number" min={0.1} step={0.1} value={item.volumeMl} onChange={e => updateItem(item.id, { volumeMl: +e.target.value })} className="px-4 py-3 rounded-2xl border border-neutral-200 bg-white outline-none" placeholder="мл" />
                        <select value={item.vialId || ''} onChange={e => updateItem(item.id, { vialId: e.target.value })} className="px-4 py-3 rounded-2xl border border-neutral-200 bg-white outline-none">
                          <option value="">Без флакона</option>
                          {vials.map(v => <option key={v.id} value={v.id}>{v.name} ({v.stockQuantity} шт)</option>)}
                        </select>
                        <button type="button" onClick={() => updateItem(item.id, { isGift: !item.isGift })} className={`px-4 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 border transition-all ${item.isGift ? 'bg-pink-500 border-pink-500 text-white' : 'bg-white border-neutral-200 text-neutral-500'}`}>
                          <Gift size={16} /> Подарок
                        </button>
                      </div>
                      <div className="flex justify-between text-sm font-bold px-1">
                        <span className="text-neutral-400">{selectedPerfume ? `${selectedPerfume.retailPricePerMl} ₽/мл` : 'Цена появится после выбора'}</span>
                        <span className={item.isGift ? 'text-pink-500' : 'text-indigo-600'}>{item.isGift ? '0 ₽' : `${item.price.toLocaleString()} ₽`}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button type="button" onClick={() => setFormData(prev => ({ ...prev, items: [...prev.items, createEmptyItem()] }))} className="w-full py-3 rounded-2xl border border-dashed border-indigo-200 text-indigo-600 font-bold flex items-center justify-center gap-2 hover:bg-indigo-50">
                <PackagePlus size={18} /> Добавить позицию
              </button>

              <div className="p-4 rounded-3xl border border-neutral-200 bg-neutral-50/50 space-y-3">
                <p className="text-xs font-black uppercase tracking-wider text-neutral-400 flex items-center gap-2"><Truck size={14} /> Доставка и статус</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-black text-neutral-400 uppercase ml-1">Статус заказа</label>
                    <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value as OrderStatus })} className="w-full px-4 py-3 rounded-2xl border border-neutral-200 bg-white outline-none">
                      {ORDER_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-neutral-400 uppercase ml-1">Трек-номер</label>
                    <input type="text" placeholder="Необязательно" value={formData.trackingNumber} onChange={e => setFormData({ ...formData, trackingNumber: e.target.value })} className="w-full px-4 py-3 rounded-2xl border border-neutral-200 bg-white outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-neutral-400 uppercase ml-1">Доставка, платит клиент (₽)</label>
                    <input type="number" min={0} value={formData.shippingCost} onChange={e => setFormData({ ...formData, shippingCost: +e.target.value })} className="w-full px-4 py-3 rounded-2xl border border-neutral-200 bg-white font-bold outline-none focus:border-indigo-500" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                <div>
                  <label className="text-[10px] font-black text-emerald-600 uppercase ml-1">Доп. доход / чаевые</label>
                  <input type="number" min={0} value={formData.extraIncome} onChange={e => setFormData({ ...formData, extraIncome: +e.target.value })} className="w-full px-4 py-3 rounded-2xl border border-emerald-100 bg-emerald-50/40 text-emerald-700 font-bold outline-none" />
                </div>
                <div className="bg-neutral-900 text-white rounded-2xl px-5 py-4">
                  <p className="text-[10px] uppercase font-black text-neutral-400">Итого к оплате</p>
                  <p className="text-2xl font-bold">{orderTotal.toLocaleString()} ₽</p>
                </div>
              </div>

              {formError && <div className="p-4 rounded-2xl bg-rose-50 text-rose-600 text-sm font-bold">{formError}</div>}

              <button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all">Подтвердить</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sales;
