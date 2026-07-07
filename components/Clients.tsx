import React, { useState, useMemo } from 'react';
import { Users, ShoppingBag, Calendar, X, Gift, Phone, MapPin, StickyNote, Edit3, Check, Copy, Truck, Package, LayoutGrid, List, ArrowUpDown } from 'lucide-react';
import { Sale, Perfume, ClientData } from '../types';
import { getSaleGiftCount, getSaleItems, getSaleSummary, getSaleTotal } from '../utils/sales';

interface ClientsProps {
  sales: Sale[];
  perfumes: Perfume[];
  clientsData: ClientData[];
  setClientsData: React.Dispatch<React.SetStateAction<ClientData[]>>;
  searchQuery: string;
}

interface ClientSummary {
  name: string;
  phone: string;
  totalSpent: number;
  ordersCount: number;
  lastOrderDate: number;
  history: Sale[];
  metadata?: ClientData;
}

type ClientSortOption = 'ltv' | 'name' | 'date' | 'orders';

const Clients: React.FC<ClientsProps> = ({ sales, perfumes, clientsData, setClientsData, searchQuery }) => {
  const [selectedClient, setSelectedClient] = useState<ClientSummary | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<ClientSortOption>('ltv');
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState<ClientData>({ name: '' });
  const [copiedField, setCopiedField] = useState('');

  const clientsMap = useMemo(() => {
    const map: Record<string, ClientSummary> = {};
    const sortedSales = [...sales].sort((a, b) => b.date - a.date);

    sortedSales.forEach(sale => {
      const key = sale.customerName.trim().toLowerCase();
      const metadata = clientsData.find(cd => cd.name.toLowerCase() === key);
      if (!map[key]) {
        map[key] = {
          name: sale.customerName,
          phone: metadata?.phone || sale.customerPhone || sale.customerContact || '',
          totalSpent: 0,
          ordersCount: 0,
          lastOrderDate: sale.date,
          history: [],
          metadata
        };
      }
      map[key].totalSpent += getSaleTotal(sale);
      map[key].ordersCount += 1;
      map[key].history.push(sale);
      if (sale.date > map[key].lastOrderDate) map[key].lastOrderDate = sale.date;
    });
    return Object.values(map).sort((a, b) => b.totalSpent - a.totalSpent);
  }, [sales, clientsData]);

  const filteredClients = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return clientsMap.filter(c =>
      c.name.toLowerCase().includes(query) ||
      c.phone.toLowerCase().includes(query) ||
      (c.metadata?.deliveryMethod || '').toLowerCase().includes(query) ||
      (c.metadata?.pickupAddress || '').toLowerCase().includes(query)
    );
  }, [clientsMap, searchQuery]);

  const sortedClients = useMemo(() => {
    return [...filteredClients].sort((a, b) => {
      switch (sortBy) {
        case 'name': return a.name.localeCompare(b.name, 'ru');
        case 'date': return b.lastOrderDate - a.lastOrderDate;
        case 'orders': return b.ordersCount - a.ordersCount;
        default: return b.totalSpent - a.totalSpent; // ltv
      }
    });
  }, [filteredClients, sortBy]);

  const handleStartEdit = () => {
    if (!selectedClient) return;
    setEditFormData({
      name: selectedClient.name,
      phone: selectedClient.metadata?.phone || selectedClient.phone || '',
      deliveryMethod: selectedClient.metadata?.deliveryMethod || '',
      pickupAddress: selectedClient.metadata?.pickupAddress || '',
      address: selectedClient.metadata?.address || '',
      notes: selectedClient.metadata?.notes || '',
      additionalContacts: selectedClient.metadata?.additionalContacts || ''
    });
    setIsEditing(true);
  };

  const handleSaveMetadata = () => {
    if (!selectedClient) return;
    setClientsData(prev => {
      const filtered = prev.filter(c => c.name.toLowerCase() !== selectedClient.name.toLowerCase());
      return [...filtered, editFormData];
    });
    setIsEditing(false);
    setSelectedClient(prev => prev ? { ...prev, phone: editFormData.phone || prev.phone, metadata: editFormData } : null);
  };

  const copyToClipboard = (label: string, text?: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(''), 2000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">База клиентов</h1>
          <p className="text-neutral-500 text-sm">Контакты, доставка и история заказов.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white border border-neutral-200 rounded-2xl p-1 shadow-sm">
            <button onClick={() => setViewMode('grid')} className={`p-2 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-neutral-400 hover:text-neutral-600'}`} title="Плиткой"><LayoutGrid size={20} /></button>
            <button onClick={() => setViewMode('list')} className={`p-2 rounded-xl transition-all ${viewMode === 'list' ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-neutral-400 hover:text-neutral-600'}`} title="Списком"><List size={20} /></button>
          </div>
          <div className="flex items-center gap-2 bg-white border border-neutral-200 rounded-2xl px-3 py-2 shadow-sm">
            <ArrowUpDown size={16} className="text-neutral-400" />
            <select value={sortBy} onChange={e => setSortBy(e.target.value as ClientSortOption)} className="bg-transparent text-sm font-medium outline-none border-none cursor-pointer pr-2">
              <option value="ltv">По сумме покупок</option>
              <option value="name">По алфавиту</option>
              <option value="date">По дате заказа</option>
              <option value="orders">По числу заказов</option>
            </select>
          </div>
        </div>
      </div>

      {sortedClients.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-[28px] sm:rounded-[32px] border border-dashed border-neutral-300">
          <Users size={48} className="mx-auto mb-4 opacity-10" />
          <p className="text-neutral-400 font-medium">{searchQuery ? 'Никто не найден' : 'Клиенты не найдены'}</p>
        </div>
      ) : viewMode === 'list' ? (
        <div className="bg-white rounded-[28px] sm:rounded-[32px] border border-neutral-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="bg-neutral-50 text-neutral-400 text-[10px] uppercase font-black tracking-widest">
                  <th className="px-6 py-4">Клиент</th>
                  <th className="px-6 py-4">Доставка</th>
                  <th className="px-6 py-4 text-center">Заказов</th>
                  <th className="px-6 py-4 text-center">Последний</th>
                  <th className="px-6 py-4 text-right">Сумма покупок</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50 text-sm">
                {sortedClients.map(client => (
                  <tr key={client.name} onClick={() => { setSelectedClient(client); setIsEditing(false); }} className="hover:bg-indigo-50/40 transition-colors cursor-pointer">
                    <td className="px-6 py-4">
                      <p className="font-bold text-neutral-900">{client.name}</p>
                      {client.phone && <p className="text-[11px] text-neutral-400 flex items-center gap-1 mt-0.5"><Phone size={10} />{client.phone}</p>}
                    </td>
                    <td className="px-6 py-4 text-xs text-neutral-500">{client.metadata?.deliveryMethod || '—'}</td>
                    <td className="px-6 py-4 text-center font-bold text-neutral-700">{client.ordersCount}</td>
                    <td className="px-6 py-4 text-center text-xs font-bold text-neutral-500">{new Date(client.lastOrderDate).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: '2-digit' })}</td>
                    <td className="px-6 py-4 text-right font-bold text-indigo-600">{client.totalSpent.toLocaleString()} ₽</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {(
          sortedClients.map(client => (
            <button
              key={client.name}
              onClick={() => { setSelectedClient(client); setIsEditing(false); }}
              className="text-left bg-white p-6 rounded-[28px] sm:rounded-[32px] border border-neutral-200 shadow-sm hover:shadow-lg hover:border-indigo-100 transition-all group relative"
            >
              <div className="flex justify-between items-start mb-6">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors"><Users size={24} /></div>
                <div className="text-right"><p className="text-[10px] text-neutral-400 font-black uppercase tracking-widest">LTV</p><p className="text-xl font-bold text-neutral-900">{client.totalSpent.toLocaleString()} ₽</p></div>
              </div>
              <div className="space-y-1 mb-6">
                <h3 className="text-lg font-bold text-neutral-900 truncate">{client.name}</h3>
                <div className="flex items-center gap-2 text-xs text-neutral-400"><Phone size={12} /><span>{client.phone || 'Телефон не указан'}</span></div>
                <div className="flex gap-2 mt-2">
                  {client.metadata?.deliveryMethod && <Truck size={13} className="text-indigo-400" />}
                  {client.metadata?.pickupAddress && <Package size={13} className="text-emerald-500" />}
                  {client.metadata?.notes && <StickyNote size={13} className="text-amber-400" />}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-neutral-50">
                <div><p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Заказов</p><p className="text-sm font-bold text-neutral-800">{client.ordersCount}</p></div>
                <div><p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Последний</p><p className="text-sm font-bold text-neutral-800">{new Date(client.lastOrderDate).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })}</p></div>
              </div>
            </button>
          ))
        )}
      </div>
      )}

      {selectedClient && (
        <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-[28px] sm:rounded-[32px] w-full max-w-3xl overflow-hidden shadow-2xl animate-in zoom-in duration-300 flex flex-col max-h-[96vh] sm:max-h-[90vh]">
            <div className="p-5 sm:p-8 border-b border-neutral-100 flex justify-between items-start sm:items-center gap-4 shrink-0">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shrink-0"><Users size={26} /></div>
                <div className="min-w-0">
                  <h2 className="text-xl sm:text-2xl font-bold truncate">{selectedClient.name}</h2>
                  <p className="text-neutral-500 text-sm font-medium truncate">{selectedClient.phone || 'Телефон не указан'}</p>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                {!isEditing && <button onClick={handleStartEdit} className="p-3 text-indigo-600 hover:bg-indigo-50 rounded-2xl transition-all flex items-center gap-2 font-bold text-sm"><Edit3 size={18} /><span className="hidden sm:inline">Правка</span></button>}
                <button onClick={() => setSelectedClient(null)} className="p-2 text-neutral-400 hover:bg-neutral-50 rounded-full transition-colors"><X size={24} /></button>
              </div>
            </div>
            <div className="p-5 sm:p-8 overflow-y-auto custom-scrollbar flex-1 space-y-8">
              {isEditing ? (
                <div className="space-y-5 animate-in slide-in-from-top-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1"><label className="text-[10px] font-black text-neutral-400 uppercase ml-1">Телефон</label><input type="tel" value={editFormData.phone} onChange={e => setEditFormData({ ...editFormData, phone: e.target.value })} className="w-full px-4 py-3 rounded-2xl border border-neutral-200 outline-none focus:border-indigo-500" /></div>
                    <div className="space-y-1"><label className="text-[10px] font-black text-neutral-400 uppercase ml-1">Способ доставки</label><input type="text" value={editFormData.deliveryMethod} onChange={e => setEditFormData({ ...editFormData, deliveryMethod: e.target.value })} className="w-full px-4 py-3 rounded-2xl border border-neutral-200 outline-none focus:border-indigo-500" placeholder="СДЭК, Boxberry, курьер..." /></div>
                    <div className="space-y-1 sm:col-span-2"><label className="text-[10px] font-black text-neutral-400 uppercase ml-1">Адрес пункта выдачи</label><input type="text" value={editFormData.pickupAddress} onChange={e => setEditFormData({ ...editFormData, pickupAddress: e.target.value })} className="w-full px-4 py-3 rounded-2xl border border-neutral-200 outline-none focus:border-indigo-500" /></div>
                    <div className="space-y-1 sm:col-span-2"><label className="text-[10px] font-black text-neutral-400 uppercase ml-1">Адрес доставки</label><input type="text" value={editFormData.address} onChange={e => setEditFormData({ ...editFormData, address: e.target.value })} className="w-full px-4 py-3 rounded-2xl border border-neutral-200 outline-none focus:border-indigo-500" /></div>
                    <div className="space-y-1 sm:col-span-2"><label className="text-[10px] font-black text-neutral-400 uppercase ml-1">Заметки / предпочтения</label><textarea rows={4} value={editFormData.notes} onChange={e => setEditFormData({ ...editFormData, notes: e.target.value })} className="w-full px-4 py-3 rounded-2xl border border-neutral-200 outline-none resize-none" /></div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button onClick={handleSaveMetadata} className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 shadow-lg active:scale-95 transition-all"><Check size={20} /> Сохранить</button>
                    <button onClick={() => setIsEditing(false)} className="px-6 py-4 text-neutral-400 font-bold">Отмена</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      { key: 'phone', icon: Phone, title: 'Телефон', value: selectedClient.metadata?.phone || selectedClient.phone, color: 'indigo' },
                      { key: 'delivery', icon: Truck, title: 'Способ доставки', value: selectedClient.metadata?.deliveryMethod, color: 'emerald' },
                      { key: 'pickup', icon: Package, title: 'Адрес ПВЗ', value: selectedClient.metadata?.pickupAddress, color: 'blue' },
                      { key: 'address', icon: MapPin, title: 'Адрес доставки', value: selectedClient.metadata?.address, color: 'amber' }
                    ].map(field => {
                      const FieldIcon = field.icon;
                      return (
                        <div key={field.key} className="bg-neutral-50 p-5 rounded-3xl border border-neutral-100 group relative">
                          <p className="text-[10px] text-neutral-400 font-black uppercase tracking-wider mb-2 flex items-center gap-2"><FieldIcon size={12} /> {field.title}</p>
                          {field.value ? (
                            <>
                              <p className="text-sm font-medium text-neutral-800 pr-8">{field.value}</p>
                              <button onClick={() => copyToClipboard(field.key, field.value)} className="absolute right-4 top-4 p-2 text-neutral-300 hover:text-indigo-600 transition-colors">{copiedField === field.key ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}</button>
                            </>
                          ) : <p className="text-xs italic text-neutral-400">Не указано</p>}
                        </div>
                      );
                    })}
                    <div className="sm:col-span-2 bg-amber-50/50 p-5 rounded-3xl border border-amber-100">
                      <p className="text-[10px] text-amber-500 font-black uppercase tracking-wider mb-2 flex items-center gap-2"><StickyNote size={12} /> Заметки</p>
                      {selectedClient.metadata?.notes ? <p className="text-sm font-medium text-neutral-800 whitespace-pre-wrap">{selectedClient.metadata.notes}</p> : <p className="text-xs italic text-neutral-400">Записей нет</p>}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-bold text-neutral-900 flex items-center gap-2"><ShoppingBag size={18} className="text-indigo-600" /> История заказов</h3>
                    <div className="space-y-3">
                      {selectedClient.history.map(sale => (
                        <div key={sale.id} className="p-5 rounded-2xl border border-neutral-100 bg-white transition-all">
                          <div className="flex flex-col sm:flex-row sm:justify-between gap-3">
                            <div className="space-y-2 min-w-0">
                              <p className="font-bold text-neutral-900">{getSaleSummary(sale, perfumes)}</p>
                              <div className="flex items-center gap-3 text-xs text-neutral-400 font-medium"><Calendar size={12} />{new Date(sale.date).toLocaleDateString('ru-RU')}</div>
                              <div className="flex flex-wrap gap-2">
                                {getSaleItems(sale).map(item => {
                                  const perfume = perfumes.find(p => p.id === item.perfumeId);
                                  return (
                                    <span key={item.id} className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase ${item.isGift ? 'bg-pink-50 text-pink-600' : 'bg-neutral-100 text-neutral-500'}`}>
                                      {perfume?.name || 'Удален'} {item.volumeMl} мл {item.isGift && 'подарок'}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                            <div className="text-left sm:text-right shrink-0">
                              {getSaleGiftCount(sale) > 0 && <div className="mb-2 bg-pink-500 text-white text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-wider inline-flex items-center gap-1"><Gift size={12} /> Подарок</div>}
                              <p className="text-lg font-bold text-indigo-600">{getSaleTotal(sale).toLocaleString()} ₽</p>
                              {!!sale.extraIncome && <p className="text-[10px] text-emerald-600 font-black">+{sale.extraIncome} ₽ доп. доход</p>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="p-5 sm:p-6 border-t border-neutral-100 bg-neutral-50/50 flex justify-end shrink-0"><button onClick={() => setSelectedClient(null)} className="w-full sm:w-auto px-8 py-3 bg-neutral-900 text-white rounded-2xl font-bold shadow-lg active:scale-95 transition-all">Закрыть</button></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Clients;
