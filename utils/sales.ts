import { OrderStatus, Perfume, Sale, SaleItem } from '../types';

export const ORDER_STATUSES: { value: OrderStatus; label: string; badge: string }[] = [
  { value: 'paid', label: 'Оплачен', badge: 'bg-indigo-50 text-indigo-600 border-indigo-200' },
  { value: 'assembled', label: 'Собран', badge: 'bg-amber-50 text-amber-600 border-amber-200' },
  { value: 'shipped', label: 'Отправлен', badge: 'bg-blue-50 text-blue-600 border-blue-200' },
  { value: 'delivered', label: 'Доставлен', badge: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
];

// Orders created before statuses existed are historical — treat them as delivered.
export const getSaleStatus = (sale: Sale): OrderStatus => sale.status ?? 'delivered';

export const getSaleItems = (sale: Sale): SaleItem[] => {
  if (sale.items?.length) return sale.items;
  if (!sale.perfumeId || !sale.volumeMl) return [];

  return [{
    id: `${sale.id}-legacy`,
    perfumeId: sale.perfumeId,
    vialId: sale.vialId,
    volumeMl: sale.volumeMl,
    price: sale.isGift ? 0 : sale.totalPrice - (sale.extraIncome || 0),
    isGift: sale.isGift
  }];
};

export const getSaleBaseTotal = (sale: Sale) =>
  getSaleItems(sale).reduce((sum, item) => sum + item.price, 0);

// Total the customer pays: items + tips + shipping (the customer covers
// delivery; the owner forwards the same amount to the carrier, so shipping
// is profit-neutral — see calculateSaleProfit in Stats).
export const getSaleTotal = (sale: Sale) =>
  getSaleBaseTotal(sale) + (sale.extraIncome || 0) + (sale.shippingCost || 0);

export const getSaleGiftCount = (sale: Sale) =>
  getSaleItems(sale).filter(item => item.isGift).length;

export const getSaleSummary = (sale: Sale, perfumes: Perfume[]) => {
  const items = getSaleItems(sale);
  if (!items.length) return 'Без позиций';

  return items.map(item => {
    const perfume = perfumes.find(p => p.id === item.perfumeId);
    const name = perfume ? `${perfume.brand} ${perfume.name}` : 'Аромат удален';
    return `${name} ${item.volumeMl} мл${item.isGift ? ' (подарок)' : ''}`;
  }).join(', ');
};
