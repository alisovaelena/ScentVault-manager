import { Perfume, Vial, Sale, Expense, Income, ClientData } from '../types';
import { ORDER_STATUSES, getSaleItems, getSaleStatus, getSaleTotal } from './sales';

const fmtDate = (ts: number) => new Date(ts).toLocaleDateString('ru-RU');
const statusLabel = (sale: Sale) => ORDER_STATUSES.find(s => s.value === getSaleStatus(sale))?.label || '';

/**
 * Builds an .xlsx workbook with every register on its own sheet.
 * The heavy xlsx library is imported lazily so it never lands in the main bundle.
 */
export async function exportToExcel(data: {
  perfumes: Perfume[];
  vials: Vial[];
  sales: Sale[];
  expenses: Expense[];
  incomes: Income[];
  clientsData: ClientData[];
}) {
  const XLSX = await import('xlsx');
  const { perfumes, vials, sales, expenses, incomes, clientsData } = data;

  const perfumeName = (id: string) => {
    const p = perfumes.find(pf => pf.id === id);
    return p ? `${p.brand} ${p.name}` : 'Удалён';
  };
  const vialName = (id?: string) => {
    if (!id) return '';
    const v = vials.find(vl => vl.id === id);
    return v ? `${v.name} ${v.sizeMl} мл` : 'Удалён';
  };
  // A line without a perfume is a vial-only sale (empty atomizer).
  const lineLabel = (it: { perfumeId: string; vialId?: string; volumeMl: number; isGift?: boolean }) =>
    it.perfumeId
      ? `${perfumeName(it.perfumeId)} ${it.volumeMl} мл${it.isGift ? ' (подарок)' : ''}`
      : `Атомайзер ${vialName(it.vialId)}${it.isGift ? ' (подарок)' : ''}`;

  const sortedSales = [...sales].sort((a, b) => b.date - a.date);

  const orders = sortedSales.map(s => ({
    'Дата': fmtDate(s.date),
    'Клиент': s.customerName,
    'Телефон': s.customerPhone || s.customerContact || '',
    'Состав': getSaleItems(s).map(lineLabel).join('; '),
    'Статус': statusLabel(s),
    'Трек-номер': s.trackingNumber || '',
    'Сумма, ₽': getSaleTotal(s),
    'в т.ч. чаевые, ₽': s.extraIncome || 0,
    'в т.ч. доставка (клиент), ₽': s.shippingCost || 0,
  }));

  const lines = sortedSales.flatMap(s =>
    getSaleItems(s).map(it => ({
      'Дата': fmtDate(s.date),
      'Клиент': s.customerName,
      'Аромат': it.perfumeId ? perfumeName(it.perfumeId) : 'Атомайзер (пустой)',
      'Объём, мл': it.perfumeId ? it.volumeMl : '',
      'Флакон': vialName(it.vialId),
      'Цена, ₽': it.price,
      'Подарок': it.isGift ? 'Да' : '',
    }))
  );

  const perfumeRows = [...perfumes]
    .sort((a, b) => `${a.brand} ${a.name}`.localeCompare(`${b.brand} ${b.name}`, 'ru'))
    .map(p => ({
      'Бренд': p.brand,
      'Название': p.name,
      'Объём, мл': p.totalVolumeMl,
      'Остаток, мл': p.currentVolumeMl,
      'Закупка, ₽': p.purchasePrice,
      'Себестоимость, ₽/мл': p.totalVolumeMl > 0 ? +(p.purchasePrice / p.totalVolumeMl).toFixed(2) : 0,
      'Розница, ₽/мл': p.retailPricePerMl,
      'Архив': p.isArchived || p.currentVolumeMl <= 0 ? 'Да' : '',
    }));

  const vialRows = vials.map(v => ({
    'Название': v.name,
    'Объём, мл': v.sizeMl,
    'Остаток, шт': v.stockQuantity,
    'Закупка, ₽/шт': +v.purchasePrice.toFixed(2),
    'Розница, ₽': v.retailPrice,
  }));

  const clientRows = [...clientsData]
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
    .map(c => ({
      'Имя': c.name,
      'Телефон': c.phone || '',
      'Способ доставки': c.deliveryMethod || '',
      'Адрес ПВЗ': c.pickupAddress || '',
      'Адрес доставки': c.address || '',
      'Заметки': c.notes || '',
    }));

  const expenseRows = [...expenses].sort((a, b) => b.date - a.date).map(e => ({
    'Дата': fmtDate(e.date), 'Название': e.name, 'Категория': e.category, 'Сумма, ₽': e.amount,
  }));
  const incomeRows = [...incomes].sort((a, b) => b.date - a.date).map(i => ({
    'Дата': fmtDate(i.date), 'Название': i.name, 'Категория': i.category, 'Сумма, ₽': i.amount,
  }));

  const wb = XLSX.utils.book_new();
  const addSheet = (rows: Record<string, unknown>[], name: string, widths: number[]) => {
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ '—': 'нет данных' }]);
    ws['!cols'] = widths.map(wch => ({ wch }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  };

  addSheet(orders, 'Заказы', [11, 26, 16, 60, 11, 16, 10, 14, 20]);
  addSheet(lines, 'Позиции', [11, 26, 40, 10, 20, 9, 8]);
  addSheet(clientRows, 'Клиенты', [26, 16, 16, 40, 40, 50]);
  addSheet(perfumeRows, 'Парфюмерия', [24, 30, 10, 12, 11, 18, 14, 7]);
  addSheet(vialRows, 'Тара', [18, 10, 12, 14, 11]);
  addSheet(expenseRows, 'Расходы', [11, 30, 30, 10]);
  addSheet(incomeRows, 'Доходы', [11, 30, 30, 10]);

  XLSX.writeFile(wb, `scentvault_${new Date().toISOString().split('T')[0]}.xlsx`);
}
