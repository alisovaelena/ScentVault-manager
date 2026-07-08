
import React, { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import {
  LayoutDashboard,
  Droplets,
  Package,
  ShoppingCart,
  BarChart3,
  Plus,
  Bell,
  Download,
  Upload,
  Link as LinkIcon,
  Check,
  X,
  ReceiptRussianRuble,
  Users,
  ArrowRight,
  TrendingUp,
  MoreHorizontal,
  FileSpreadsheet,
  ShieldAlert,
  Cloud,
  CloudOff,
  LogOut
} from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { Perfume, Vial, Sale, View, Expense, Income, ClientData, isPerfumeArchived } from './types';
import Dashboard from './components/Dashboard';
import Inventory from './components/Inventory';
import Vials from './components/Vials';
import Sales from './components/Sales';
import Expenses from './components/Expenses';
import Incomes from './components/Incomes';
import Clients from './components/Clients';
import CloudLoginModal from './components/CloudLoginModal';
import { BackupData, validateBackup, isBackupOverdue, markBackupDone, snoozeBackupReminder } from './utils/backup';
import { exportToExcel } from './utils/excel';
import { isCloudConfigured, cloudGetSession, cloudOnAuthChange, cloudSignOut, cloudLoad, cloudSave } from './utils/cloud';

// Recharts is heavy — load the analytics screen only when it is opened.
const Stats = React.lazy(() => import('./components/Stats'));

type CloudState = 'idle' | 'syncing' | 'synced' | 'error';

const App: React.FC = () => {
  const [view, setView] = useState<View>('dashboard');
  const [perfumes, setPerfumes] = useState<Perfume[]>([]);
  const [vials, setVials] = useState<Vial[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [clientsData, setClientsData] = useState<ClientData[]>([]);
  const [copied, setCopied] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showBackupBanner, setShowBackupBanner] = useState(false);
  const [cloudSession, setCloudSession] = useState<Session | null>(null);
  const [cloudState, setCloudState] = useState<CloudState>('idle');
  const [showCloudLogin, setShowCloudLogin] = useState(false);
  const [showCloudMenu, setShowCloudMenu] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [cloudErrorMsg, setCloudErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
  // Guards the save effect so it never overwrites stored data with the empty
  // initial state before the first load has run (important under React.StrictMode,
  // whose double-mount would otherwise wipe LocalStorage on every reload).
  const skipInitialSave = useRef(true);
  // Cloud sync bookkeeping.
  const pulledRef = useRef(false);       // initial pull done for this session
  const pullDone = useRef(false);        // pushes are allowed only after the pull
  const applyingCloud = useRef(false);   // suppress the echo-push right after applying cloud data

  // Always-fresh snapshot of the vault for async consumers (export, cloud push).
  const dataRef = useRef<BackupData>({ perfumes: [], vials: [], sales: [], expenses: [], incomes: [], clientsData: [] });
  dataRef.current = { perfumes, vials, sales, expenses, incomes, clientsData };

  // Load data from LocalStorage
  useEffect(() => {
    const savedPerfumes = localStorage.getItem('sv_perfumes');
    const savedVials = localStorage.getItem('sv_vials');
    const savedSales = localStorage.getItem('sv_sales');
    const savedExpenses = localStorage.getItem('sv_expenses');
    const savedIncomes = localStorage.getItem('sv_incomes');
    const savedClients = localStorage.getItem('sv_clients_data');

    if (savedPerfumes) setPerfumes(JSON.parse(savedPerfumes));
    if (savedVials) setVials(JSON.parse(savedVials));
    if (savedSales) setSales(JSON.parse(savedSales));
    if (savedExpenses) setExpenses(JSON.parse(savedExpenses));
    if (savedIncomes) setIncomes(JSON.parse(savedIncomes));
    if (savedClients) setClientsData(JSON.parse(savedClients));

    const hasData = Boolean(
      (savedPerfumes && savedPerfumes !== '[]') ||
      (savedSales && savedSales !== '[]')
    );
    setShowBackupBanner(isBackupOverdue(hasData));

    // Migration stamp: a base that existed before sync was added has no
    // timestamp. Mark it as "fresh now" so an older cloud document can never
    // win against it and wipe real data.
    if (hasData && !localStorage.getItem('sv_updated_at')) {
      localStorage.setItem('sv_updated_at', String(Date.now()));
    }
  }, []);

  // Save data to LocalStorage
  useEffect(() => {
    if (skipInitialSave.current) { skipInitialSave.current = false; return; }
    // Extra safety (StrictMode double-mount, races): never overwrite a stored
    // base with the fully-empty initial state. Trade-off: deliberately deleting
    // the very last record of ALL registers at once won't persist — acceptable.
    const allEmpty = perfumes.length === 0 && vials.length === 0 && sales.length === 0
      && expenses.length === 0 && incomes.length === 0 && clientsData.length === 0;
    const stored = localStorage.getItem('sv_perfumes');
    const storedSales = localStorage.getItem('sv_sales');
    const lsHasData = Boolean((stored && stored !== '[]') || (storedSales && storedSales !== '[]'));
    if (allEmpty && lsHasData) return;
    localStorage.setItem('sv_perfumes', JSON.stringify(perfumes));
    localStorage.setItem('sv_vials', JSON.stringify(vials));
    localStorage.setItem('sv_sales', JSON.stringify(sales));
    localStorage.setItem('sv_expenses', JSON.stringify(expenses));
    localStorage.setItem('sv_incomes', JSON.stringify(incomes));
    localStorage.setItem('sv_clients_data', JSON.stringify(clientsData));
    localStorage.setItem('sv_updated_at', String(Date.now()));
    // "There are local changes not yet uploaded" — cleared after a successful push.
    localStorage.setItem('sv_dirty', '1');
  }, [perfumes, vials, sales, expenses, incomes, clientsData]);

  // --- Cloud sync (active only when Supabase env vars are configured) -------

  useEffect(() => {
    if (!isCloudConfigured) return;
    cloudGetSession().then(setCloudSession);
    return cloudOnAuthChange(session => {
      setCloudSession(session);
      if (!session) { pulledRef.current = false; pullDone.current = false; setCloudState('idle'); }
    });
  }, []);

  const pushNow = async () => {
    setCloudState('syncing');
    const res = await cloudSave({ data: dataRef.current, updatedAt: Date.now() });
    if (res.error) { setCloudState('error'); setCloudErrorMsg(res.error); }
    else {
      setCloudState('synced');
      setCloudErrorMsg('');
      setLastSyncAt(Date.now());
      localStorage.setItem('sv_dirty', '0');
    }
  };

  // Manual sync: replace THIS device's data with the cloud copy.
  const forcePull = async () => {
    if (!window.confirm('Забрать данные из облака?\n\nБаза на ЭТОМ устройстве будет заменена облачной копией.')) return;
    setCloudState('syncing');
    try {
      const doc = await cloudLoad();
      if (!doc) { alert('В облаке пока нет данных.'); setCloudState('idle'); return; }
      applyingCloud.current = true;
      setPerfumes(doc.data.perfumes || []);
      setVials(doc.data.vials || []);
      setSales(doc.data.sales || []);
      setExpenses(doc.data.expenses || []);
      setIncomes(doc.data.incomes || []);
      setClientsData(doc.data.clientsData || []);
      pullDone.current = true;
      setCloudState('synced');
      setCloudErrorMsg('');
      setLastSyncAt(Date.now());
      setShowCloudMenu(false);
      // Control readout so it is obvious WHAT arrived from the cloud.
      alert(`Получено из облака:\n• ароматов: ${doc.data.perfumes?.length || 0}\n• продаж: ${doc.data.sales?.length || 0}\n\nОблачная копия от ${new Date(doc.updatedAt).toLocaleString('ru-RU')}`);
    } catch (e) {
      setCloudState('error');
      setCloudErrorMsg(String(e));
    }
  };

  // Manual sync: replace the cloud copy with THIS device's data.
  const forcePush = async () => {
    if (!window.confirm('Отправить данные в облако?\n\nОблачная копия будет заменена базой с этого устройства.')) return;
    pullDone.current = true;
    await pushNow();
    setShowCloudMenu(false);
  };

  // Initial pull after sign-in: newer side wins (whole-document, single owner).
  useEffect(() => {
    if (!cloudSession || pulledRef.current) return;
    pulledRef.current = true;
    (async () => {
      setCloudState('syncing');
      try {
        const doc = await cloudLoad();
        const localUpdated = Number(localStorage.getItem('sv_updated_at') || 0);
        // Reconciliation rules. Timestamps alone are NOT trusted when one side
        // is empty: an empty side must never win over a full one, otherwise a
        // fresh device (or a stray test row) could wipe the real base.
        const cloudEmpty = !doc || ((doc.data.perfumes?.length || 0) === 0 && (doc.data.sales?.length || 0) === 0);
        const localEmpty = dataRef.current.perfumes.length === 0 && dataRef.current.sales.length === 0;
        const applyCloud = doc && !cloudEmpty && (localEmpty || doc.updatedAt > localUpdated);
        if (applyCloud && doc) {
          applyingCloud.current = true;
          setPerfumes(doc.data.perfumes || []);
          setVials(doc.data.vials || []);
          setSales(doc.data.sales || []);
          setExpenses(doc.data.expenses || []);
          setIncomes(doc.data.incomes || []);
          setClientsData(doc.data.clientsData || []);
          pullDone.current = true;
          setCloudState('synced');
          setCloudErrorMsg('');
          setLastSyncAt(Date.now());
        } else {
          // Local looks newer (or cloud is empty-ish). Push on open ONLY when
          // there are pending local edits that never made it to the cloud
          // (sv_dirty) — e.g. the tab was closed before the debounced upload
          // fired. A device that merely OPENED the app never overwrites the
          // cloud (that used to let stale devices clobber fresh data).
          pullDone.current = true;
          const dirty = localStorage.getItem('sv_dirty') === '1';
          if (!doc || cloudEmpty || (dirty && !localEmpty)) { await pushNow(); }
          else setCloudState('synced');
        }
      } catch (e) {
        pullDone.current = true;
        setCloudState('error');
        setCloudErrorMsg(String(e));
      }
    })();
  }, [cloudSession]);

  // Debounced push on every local change while signed in.
  useEffect(() => {
    if (!cloudSession || !pullDone.current) return;
    if (applyingCloud.current) { applyingCloud.current = false; return; }
    setCloudState('syncing');
    const t = setTimeout(pushNow, 800);
    return () => clearTimeout(t);
  }, [perfumes, vials, sales, expenses, incomes, clientsData, cloudSession]);

  // Keep the freshest session in a ref for the visibility flush below.
  const cloudSessionRef = useRef<Session | null>(null);
  useEffect(() => { cloudSessionRef.current = cloudSession; }, [cloudSession]);

  // Flush pending changes when the tab is closed or goes to background —
  // otherwise an edit made right before closing never reaches the cloud.
  useEffect(() => {
    const flush = () => {
      if (document.visibilityState !== 'hidden') return;
      if (!cloudSessionRef.current || !pullDone.current) return;
      if (localStorage.getItem('sv_dirty') !== '1') return;
      pushNow(); // best-effort: usually completes before the tab is killed
    };
    document.addEventListener('visibilitychange', flush);
    return () => document.removeEventListener('visibilitychange', flush);
  }, []);

  // ---------------------------------------------------------------------------

  // Close notifications on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const lowStockAlerts = useMemo(() => {
    // Archived / finished perfumes are excluded — they live in the archive, not in "low stock".
    const pAlerts = perfumes
      .filter(p => !isPerfumeArchived(p) && p.currentVolumeMl <= p.lowStockThreshold)
      .map(p => ({
        id: p.id,
        type: 'perfume' as const,
        title: p.brand,
        subtitle: p.name,
        value: `${p.currentVolumeMl} мл`,
        critical: p.currentVolumeMl <= p.lowStockThreshold / 2
      }));
    const vAlerts = vials.filter(v => v.stockQuantity <= (v.lowStockThreshold || 10)).map(v => ({
      id: v.id,
      type: 'vial' as const,
      title: v.name,
      subtitle: `${v.sizeMl} мл`,
      value: `${v.stockQuantity} шт`,
      critical: v.stockQuantity === 0
    }));
    return [...pAlerts, ...vAlerts];
  }, [perfumes, vials]);

  const exportData = () => {
    const data = { ...dataRef.current, exportDate: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `scentvault_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    markBackupDone();
    setShowBackupBanner(false);
  };

  const exportExcel = () => {
    exportToExcel(dataRef.current).catch(() => alert('Не удалось сформировать Excel-файл'));
  };

  const importData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        const res = validateBackup(json);
        if (!res.ok || !res.data) {
          alert(`Импорт отменён. ${res.error || ''}`);
          return;
        }
        const d = res.data;
        const summary = `Файл проверен: ${d.perfumes.length} ароматов, ${d.sales.length} продаж, ${d.clientsData.length} клиентов` +
          (res.skipped ? `\n⚠ Пропущено повреждённых записей: ${res.skipped}` : '');
        if (window.confirm(`${summary}\n\nТекущая база будет перезаписана (страховочная копия останется в браузере). Продолжить?`)) {
          // Safety net: keep the pre-import state so a bad import is recoverable.
          localStorage.setItem('sv_backup_before_import', JSON.stringify(dataRef.current));
          setPerfumes(d.perfumes);
          setVials(d.vials);
          setSales(d.sales);
          setExpenses(d.expenses);
          setIncomes(d.incomes);
          setClientsData(d.clientsData);
          alert('База данных успешно импортирована!');
        }
      } catch (err) { alert('Ошибка при чтении файла: это не корректный JSON.'); }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const navItems = [
    { id: 'dashboard', label: 'Обзор', icon: LayoutDashboard },
    { id: 'inventory', label: 'Парфюмерия', icon: Droplets },
    { id: 'vials', label: 'Тара', icon: Package },
    { id: 'expenses', label: 'Расходы', icon: ReceiptRussianRuble },
    { id: 'incomes', label: 'Доходы', icon: TrendingUp },
    { id: 'clients', label: 'Клиенты', icon: Users },
    { id: 'sales', label: 'Продажи', icon: ShoppingCart },
    { id: 'stats', label: 'Аналитика', icon: BarChart3 },
  ] as const;

  // Primary items shown directly on the mobile bottom bar; the rest live behind "Ещё".
  const mobilePrimary = ['dashboard', 'inventory', 'sales', 'stats'] as const;
  const mobilePrimaryItems = navItems.filter(i => (mobilePrimary as readonly string[]).includes(i.id));
  const mobileMoreItems = navItems.filter(i => !(mobilePrimary as readonly string[]).includes(i.id));

  const goTo = (v: View) => { setView(v); setShowMobileMenu(false); };

  const syncTime = lastSyncAt ? new Date(lastSyncAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : null;
  const cloudLabel = cloudState === 'syncing' ? 'Синхронизация…'
    : cloudState === 'error' ? 'Ошибка облака'
    : cloudState === 'synced' ? (syncTime ? `Облако · ${syncTime}` : 'Облако: сохранено')
    : 'Облако';
  const cloudColor = cloudState === 'error' ? 'text-rose-500' : cloudState === 'synced' ? 'text-emerald-600' : 'text-neutral-500';

  const statsFallback = (
    <div className="py-24 text-center text-neutral-400">
      <BarChart3 size={40} className="mx-auto mb-3 opacity-20 animate-pulse" />
      <p className="text-sm font-medium">Загружаем аналитику…</p>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-neutral-50 text-neutral-900">
      <aside className="w-64 bg-white border-r border-neutral-200 flex-col hidden md:flex sticky top-0 h-screen">
        <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
          <div className="flex items-center gap-2 text-indigo-600 mb-8 cursor-pointer" onClick={() => setView('dashboard')}>
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">S</div>
            <span className="text-xl font-display font-bold text-neutral-800">ScentVault</span>
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => goTo(item.id as View)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === item.id ? 'bg-indigo-50 text-indigo-600 font-semibold' : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800'}`}
              >
                <item.icon size={20} /> {item.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="mt-auto p-6 border-t border-neutral-100 space-y-2 shrink-0">
          {isCloudConfigured && (
            cloudSession ? (
              <button onClick={() => setShowCloudMenu(true)} className="w-full flex items-center justify-between px-4 py-2.5 text-sm rounded-xl bg-neutral-50 hover:bg-neutral-100 transition-all" title="Меню облака">
                <span className={`flex items-center gap-2 font-medium ${cloudColor}`}><Cloud size={16} /> {cloudLabel}</span>
              </button>
            ) : (
              <button onClick={() => setShowCloudLogin(true)} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800 rounded-xl transition-all"><CloudOff size={16} /> Войти в облако</button>
            )
          )}
          <button onClick={copyLink} className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm rounded-xl transition-all ${copied ? 'text-emerald-600 bg-emerald-50' : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800'}`}>
            {copied ? <Check size={16} /> : <LinkIcon size={16} />} {copied ? 'Скопировано!' : 'Копировать ссылку'}
          </button>
          <button onClick={exportData} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800 rounded-xl transition-all"><Download size={16} /> Бэкап</button>
          <button onClick={exportExcel} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800 rounded-xl transition-all"><FileSpreadsheet size={16} /> Экспорт в Excel</button>
          <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800 rounded-xl transition-all"><Upload size={16} /> Импорт</button>
          <input type="file" ref={fileInputRef} onChange={importData} className="hidden" accept=".json" />
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto relative">
        <header className="bg-white/80 backdrop-blur-md sticky top-0 z-30 border-b border-neutral-200 px-4 md:px-8 py-3 md:py-4 flex items-center justify-between gap-3">
          {/* Mobile logo; on desktop the current section name */}
          <div className="flex md:hidden items-center gap-2 text-indigo-600 shrink-0" onClick={() => setView('dashboard')}>
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">S</div>
          </div>
          <h2 className="hidden md:block text-lg font-bold text-neutral-800">{navItems.find(i => i.id === view)?.label}</h2>

          <div className="flex items-center gap-2 md:gap-4 shrink-0">
            <div className="relative" ref={notificationRef}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className={`p-2 rounded-xl transition-all ${showNotifications ? 'bg-indigo-50 text-indigo-600' : 'text-neutral-500 hover:bg-neutral-100'}`}
              >
                <Bell size={22} className={lowStockAlerts.some(a => a.critical) ? 'animate-bounce' : ''} />
                {lowStockAlerts.length > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-white text-[10px] flex items-center justify-center rounded-full border-2 border-white font-black">
                    {lowStockAlerts.length}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-3 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-3xl border border-neutral-200 shadow-2xl overflow-hidden animate-in slide-in-from-top-2">
                  <div className="p-5 border-b border-neutral-100 flex justify-between items-center bg-neutral-50/50">
                    <h4 className="font-bold text-sm">Уведомления</h4>
                    <span className="text-[10px] bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-black uppercase">Мало остатков</span>
                  </div>
                  <div className="max-h-96 overflow-y-auto custom-scrollbar">
                    {lowStockAlerts.length === 0 ? (
                      <div className="p-10 text-center space-y-2">
                        <Check className="mx-auto text-emerald-500" size={32} />
                        <p className="text-sm text-neutral-500 font-medium">Все запасы в порядке!</p>
                      </div>
                    ) : (
                      lowStockAlerts.map(alert => (
                        <div
                          key={alert.id}
                          onClick={() => { setView(alert.type === 'perfume' ? 'inventory' : 'vials'); setShowNotifications(false); }}
                          className="p-4 border-b border-neutral-50 hover:bg-neutral-50 transition-colors cursor-pointer flex items-center gap-4 group"
                        >
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${alert.critical ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
                            {alert.type === 'perfume' ? <Droplets size={18} /> : <Package size={18} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-neutral-900 truncate">{alert.title}</p>
                            <p className="text-[10px] text-neutral-500 truncate">{alert.subtitle}</p>
                          </div>
                          <div className="text-right">
                            <p className={`text-xs font-black ${alert.critical ? 'text-rose-600' : 'text-amber-600'}`}>{alert.value}</p>
                            <ArrowRight size={12} className="ml-auto mt-1 opacity-0 group-hover:opacity-100 transition-opacity text-neutral-300" />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={() => goTo('sales')}
              className="bg-indigo-600 text-white px-3 md:px-5 py-2.5 rounded-2xl text-sm font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 active:scale-95 transition-all flex items-center gap-2"
            >
              <Plus size={18} /> <span className="hidden sm:inline">Продажа</span>
            </button>
          </div>
        </header>

        {showBackupBanner && (
          <div className="mx-4 md:mx-8 mt-4 p-4 bg-amber-50 border border-amber-200 rounded-3xl flex flex-col sm:flex-row sm:items-center gap-3 animate-in slide-in-from-top-2">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0"><ShieldAlert size={20} /></div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-amber-800">Давно не было резервной копии</p>
                <p className="text-xs text-amber-700/80">База хранится в браузере — скачайте бэкап, чтобы ничего не потерять.</p>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={exportData} className="px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-bold hover:bg-amber-600 transition-all flex items-center gap-2"><Download size={14} /> Сделать бэкап</button>
              <button onClick={() => { snoozeBackupReminder(); setShowBackupBanner(false); }} className="px-4 py-2 text-amber-700 rounded-xl text-sm font-bold hover:bg-amber-100 transition-all">Позже</button>
            </div>
          </div>
        )}

        <div className="p-4 md:p-8 pb-28 md:pb-8 max-w-7xl mx-auto">
          {view === 'dashboard' && <Dashboard perfumes={perfumes} vials={vials} sales={sales} onViewChange={setView} />}
          {view === 'inventory' && <Inventory perfumes={perfumes} setPerfumes={setPerfumes} searchQuery="" />}
          {view === 'vials' && <Vials vials={vials} setVials={setVials} searchQuery="" />}
          {view === 'expenses' && <Expenses expenses={expenses} setExpenses={setExpenses} searchQuery="" />}
          {view === 'incomes' && <Incomes incomes={incomes} setIncomes={setIncomes} searchQuery="" />}
          {view === 'clients' && <Clients sales={sales} perfumes={perfumes} clientsData={clientsData} setClientsData={setClientsData} searchQuery="" />}
          {view === 'sales' && <Sales sales={sales} setSales={setSales} perfumes={perfumes} setPerfumes={setPerfumes} vials={vials} setVials={setVials} clientsData={clientsData} searchQuery="" />}
          {view === 'stats' && (
            <Suspense fallback={statsFallback}>
              <Stats perfumes={perfumes} sales={sales} vials={vials} expenses={expenses} incomes={incomes} />
            </Suspense>
          )}
        </div>
      </main>

      {/* Mobile bottom navigation */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-neutral-200 flex items-stretch justify-around px-1 pb-[env(safe-area-inset-bottom)]">
        {mobilePrimaryItems.map(item => (
          <button
            key={item.id}
            onClick={() => goTo(item.id as View)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 transition-colors ${view === item.id ? 'text-indigo-600' : 'text-neutral-400'}`}
          >
            <item.icon size={22} />
            <span className="text-[10px] font-bold leading-none">{item.label}</span>
          </button>
        ))}
        <button
          onClick={() => setShowMobileMenu(true)}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 transition-colors ${(mobileMoreItems.some(i => i.id === view)) ? 'text-indigo-600' : 'text-neutral-400'}`}
        >
          <MoreHorizontal size={22} />
          <span className="text-[10px] font-bold leading-none">Ещё</span>
        </button>
      </nav>

      {/* Mobile "more" sheet */}
      {showMobileMenu && (
        <div className="md:hidden fixed inset-0 z-50 flex items-end" onClick={() => setShowMobileMenu(false)}>
          <div className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm" />
          <div className="relative w-full bg-white rounded-t-[32px] p-6 pb-8 shadow-2xl animate-in slide-in-from-bottom duration-300" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-neutral-200 rounded-full mx-auto mb-6" />
            <div className="grid grid-cols-3 gap-3 mb-6">
              {mobileMoreItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => goTo(item.id as View)}
                  className={`flex flex-col items-center justify-center gap-2 py-4 rounded-2xl transition-colors ${view === item.id ? 'bg-indigo-50 text-indigo-600' : 'bg-neutral-50 text-neutral-500'}`}
                >
                  <item.icon size={24} />
                  <span className="text-xs font-bold">{item.label}</span>
                </button>
              ))}
            </div>
            <div className="border-t border-neutral-100 pt-4 grid grid-cols-3 gap-3">
              <button onClick={() => { copyLink(); }} className="flex flex-col items-center justify-center gap-2 py-4 rounded-2xl bg-neutral-50 text-neutral-500">
                {copied ? <Check size={22} className="text-emerald-500" /> : <LinkIcon size={22} />}
                <span className="text-xs font-bold">Ссылка</span>
              </button>
              <button onClick={() => { exportData(); setShowMobileMenu(false); }} className="flex flex-col items-center justify-center gap-2 py-4 rounded-2xl bg-neutral-50 text-neutral-500">
                <Download size={22} /><span className="text-xs font-bold">Бэкап</span>
              </button>
              <button onClick={() => { exportExcel(); setShowMobileMenu(false); }} className="flex flex-col items-center justify-center gap-2 py-4 rounded-2xl bg-neutral-50 text-neutral-500">
                <FileSpreadsheet size={22} /><span className="text-xs font-bold">Excel</span>
              </button>
              <button onClick={() => { fileInputRef.current?.click(); setShowMobileMenu(false); }} className="flex flex-col items-center justify-center gap-2 py-4 rounded-2xl bg-neutral-50 text-neutral-500">
                <Upload size={22} /><span className="text-xs font-bold">Импорт</span>
              </button>
              {isCloudConfigured && (
                cloudSession ? (
                  <button onClick={() => { setShowCloudMenu(true); setShowMobileMenu(false); }} className={`flex flex-col items-center justify-center gap-2 py-4 rounded-2xl bg-neutral-50 ${cloudColor}`}>
                    <Cloud size={22} /><span className="text-xs font-bold">{cloudState === 'error' ? 'Ошибка' : syncTime ? `Облако · ${syncTime}` : 'Облако ✓'}</span>
                  </button>
                ) : (
                  <button onClick={() => { setShowCloudLogin(true); setShowMobileMenu(false); }} className="flex flex-col items-center justify-center gap-2 py-4 rounded-2xl bg-neutral-50 text-neutral-500">
                    <CloudOff size={22} /><span className="text-xs font-bold">Войти в облако</span>
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cloud menu: status + manual sync controls */}
      {showCloudMenu && cloudSession && (
        <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowCloudMenu(false)}>
          <div className="bg-white rounded-[32px] w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in duration-300" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-neutral-100 flex justify-between items-center">
              <h2 className="text-xl font-bold flex items-center gap-2"><Cloud size={20} className="text-indigo-600" /> Облако</h2>
              <button onClick={() => setShowCloudMenu(false)} className="p-2 text-neutral-400 hover:bg-neutral-100 rounded-full transition-colors"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-neutral-50 rounded-2xl p-4 space-y-1 text-sm">
                <p className="text-neutral-500">Вход: <span className="font-bold text-neutral-800">{cloudSession.user.email}</span></p>
                <p className="text-neutral-500">Последняя синхронизация: <span className="font-bold text-neutral-800">{syncTime || 'ещё не было'}</span></p>
                {cloudErrorMsg && <p className="text-rose-600 font-medium break-words">Ошибка: {cloudErrorMsg}</p>}
              </div>
              <button onClick={forcePull} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-indigo-200 text-indigo-600 font-bold hover:bg-indigo-50 transition-all">
                <Download size={18} /> Забрать из облака
              </button>
              <button onClick={forcePush} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-lg transition-all">
                <Upload size={18} /> Отправить в облако
              </button>
              <button onClick={() => { if (window.confirm('Выйти из облака на этом устройстве? Данные останутся, но синхронизация остановится.')) { cloudSignOut(); setShowCloudMenu(false); } }} className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-neutral-400 font-bold hover:bg-neutral-50 transition-all">
                <LogOut size={16} /> Выйти из облака
              </button>
            </div>
          </div>
        </div>
      )}

      {showCloudLogin && <CloudLoginModal onClose={() => setShowCloudLogin(false)} />}
    </div>
  );
};

export default App;
