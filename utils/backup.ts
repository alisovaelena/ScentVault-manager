import { Perfume, Vial, Sale, SaleItem, Expense, Income, ClientData } from '../types';

export interface BackupData {
  perfumes: Perfume[];
  vials: Vial[];
  sales: Sale[];
  expenses: Expense[];
  incomes: Income[];
  clientsData: ClientData[];
}

export interface ValidationResult {
  ok: boolean;
  error?: string;
  data?: BackupData;
  skipped: number; // entries dropped because they were malformed
}

const num = (v: unknown, fallback = 0): number => {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number);
  return typeof n === 'number' && isFinite(n) ? n : fallback;
};
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/**
 * Validates and sanitizes a backup file before it is allowed to replace the
 * database. Malformed entries are skipped (and counted) instead of crashing
 * or silently corrupting the vault.
 */
export function validateBackup(raw: unknown): ValidationResult {
  if (!isObj(raw)) return { ok: false, error: 'Файл не похож на бэкап ScentVault (не JSON-объект).', skipped: 0 };
  if (!Array.isArray(raw.perfumes) || !Array.isArray(raw.sales)) {
    return { ok: false, error: 'В файле нет списков «perfumes» и «sales» — это не бэкап ScentVault.', skipped: 0 };
  }

  let skipped = 0;

  const perfumes: Perfume[] = arr(raw.perfumes).flatMap(p => {
    if (!isObj(p) || !str(p.id) || (!str(p.name) && !str(p.brand))) { skipped++; return []; }
    return [{
      id: str(p.id),
      brand: str(p.brand),
      name: str(p.name),
      totalVolumeMl: num(p.totalVolumeMl),
      currentVolumeMl: num(p.currentVolumeMl),
      purchasePrice: num(p.purchasePrice),
      retailPricePerMl: num(p.retailPricePerMl),
      lowStockThreshold: num(p.lowStockThreshold, 10),
      createdAt: num(p.createdAt, Date.now()),
      isArchived: p.isArchived === true,
      archivedAt: p.archivedAt ? num(p.archivedAt) : undefined,
    }];
  });

  const vials: Vial[] = arr(raw.vials).flatMap(v => {
    if (!isObj(v) || !str(v.id)) { skipped++; return []; }
    return [{
      id: str(v.id),
      name: str(v.name),
      sizeMl: num(v.sizeMl),
      purchasePrice: num(v.purchasePrice),
      retailPrice: num(v.retailPrice),
      stockQuantity: num(v.stockQuantity),
      lowStockThreshold: num(v.lowStockThreshold, 10),
    }];
  });

  const sales: Sale[] = arr(raw.sales).flatMap(s => {
    if (!isObj(s) || !str(s.id) || !str(s.customerName)) { skipped++; return []; }
    const items: SaleItem[] | undefined = Array.isArray(s.items)
      ? s.items.flatMap((it: unknown) => {
          // A valid line references a perfume OR is a vial-only sale (empty atomizer).
          if (!isObj(it) || (!str(it.perfumeId) && !str(it.vialId))) { skipped++; return []; }
          return [{
            id: str(it.id) || Math.random().toString(36).slice(2, 11),
            perfumeId: str(it.perfumeId),
            vialId: str(it.vialId) || undefined,
            volumeMl: num(it.volumeMl),
            price: num(it.price),
            isGift: it.isGift === true,
          }];
        })
      : undefined;
    const status = s.status;
    return [{
      id: str(s.id),
      customerName: str(s.customerName),
      customerContact: str(s.customerContact) || undefined,
      customerPhone: str(s.customerPhone) || undefined,
      perfumeId: str(s.perfumeId) || undefined,
      vialId: str(s.vialId) || undefined,
      volumeMl: s.volumeMl !== undefined ? num(s.volumeMl) : undefined,
      items,
      totalPrice: num(s.totalPrice),
      extraIncome: s.extraIncome !== undefined ? num(s.extraIncome) : undefined,
      date: num(s.date, Date.now()),
      isGift: s.isGift === true ? true : undefined,
      status: status === 'paid' || status === 'assembled' || status === 'shipped' || status === 'delivered' ? status : undefined,
      trackingNumber: str(s.trackingNumber) || undefined,
      shippingCost: s.shippingCost !== undefined ? num(s.shippingCost) : undefined,
    }];
  });

  const expenses: Expense[] = arr(raw.expenses).flatMap(e => {
    if (!isObj(e) || !str(e.id)) { skipped++; return []; }
    return [{ id: str(e.id), name: str(e.name), amount: num(e.amount), category: str(e.category), date: num(e.date, Date.now()) }];
  });

  const incomes: Income[] = arr(raw.incomes).flatMap(i => {
    if (!isObj(i) || !str(i.id)) { skipped++; return []; }
    return [{ id: str(i.id), name: str(i.name), amount: num(i.amount), category: str(i.category), date: num(i.date, Date.now()) }];
  });

  const clientsData: ClientData[] = arr(raw.clientsData).flatMap(c => {
    if (!isObj(c) || !str(c.name)) { skipped++; return []; }
    return [{
      name: str(c.name),
      phone: str(c.phone) || undefined,
      deliveryMethod: str(c.deliveryMethod) || undefined,
      pickupAddress: str(c.pickupAddress) || undefined,
      address: str(c.address) || undefined,
      notes: str(c.notes) || undefined,
      additionalContacts: str(c.additionalContacts) || undefined,
    }];
  });

  return { ok: true, data: { perfumes, vials, sales, expenses, incomes, clientsData }, skipped };
}

// --- Backup reminder bookkeeping -------------------------------------------

export const LAST_BACKUP_KEY = 'sv_last_backup';
export const BACKUP_SNOOZE_KEY = 'sv_backup_snooze';
const WEEK = 7 * 24 * 60 * 60 * 1000;
const SNOOZE = 2 * 24 * 60 * 60 * 1000;

export const markBackupDone = () => localStorage.setItem(LAST_BACKUP_KEY, String(Date.now()));
export const snoozeBackupReminder = () => localStorage.setItem(BACKUP_SNOOZE_KEY, String(Date.now()));

/** True when there is data worth protecting and the last backup is older than a week. */
export function isBackupOverdue(hasData: boolean): boolean {
  if (!hasData) return false;
  const snoozedAt = Number(localStorage.getItem(BACKUP_SNOOZE_KEY) || 0);
  if (Date.now() - snoozedAt < SNOOZE) return false;
  const last = Number(localStorage.getItem(LAST_BACKUP_KEY) || 0);
  return Date.now() - last > WEEK;
}
