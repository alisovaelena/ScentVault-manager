
export interface Perfume {
  id: string;
  brand: string;
  name: string;
  totalVolumeMl: number;
  currentVolumeMl: number;
  purchasePrice: number; // For the whole bottle
  retailPricePerMl: number;
  lowStockThreshold: number;
  createdAt: number;
  isArchived?: boolean;
  archivedAt?: number;
}

export interface Vial {
  id: string;
  sizeMl: number;
  name: string;      // Custom name for the vial (e.g. "Glass Gold", "Plastic Simple")
  purchasePrice: number; // What the owner pays
  retailPrice: number;   // What the customer pays
  stockQuantity: number;
  lowStockThreshold: number; // New field for alerts
}

// Order lifecycle: paid -> assembled -> shipped -> delivered.
export type OrderStatus = 'paid' | 'assembled' | 'shipped' | 'delivered';

export interface Sale {
  id: string;
  customerName: string;
  customerContact?: string; // Legacy contact info
  customerPhone?: string;
  perfumeId?: string; // Legacy single-item sale
  vialId?: string; // Legacy single-item sale
  volumeMl?: number; // Legacy single-item sale
  items?: SaleItem[];
  totalPrice: number;
  extraIncome?: number;
  date: number;
  isGift?: boolean; // Legacy gift flag
  status?: OrderStatus;    // Legacy sales without status are treated as delivered
  trackingNumber?: string; // Postal / pickup-point tracking code
  shippingCost?: number;   // Delivery cost paid BY THE CUSTOMER; owner forwards it to the carrier (profit-neutral)
}

export interface SaleItem {
  id: string;
  perfumeId: string;
  vialId?: string;
  volumeMl: number;
  price: number;
  isGift?: boolean;
}

export interface ClientData {
  name: string; // Linked by name
  phone?: string;
  deliveryMethod?: string;
  pickupAddress?: string;
  address?: string;
  notes?: string;
  additionalContacts?: string;
}

export interface Expense {
  id: string;
  name: string;
  amount: number;
  category: string;
  date: number;
}

// Unplanned / additional income not tied to a specific order (mirror of Expense).
export interface Income {
  id: string;
  name: string;
  amount: number;
  category: string;
  date: number;
}

// A perfume is archived when it is manually archived or has run out of liquid.
export const isPerfumeArchived = (p: Perfume): boolean =>
  p.isArchived === true || p.currentVolumeMl <= 0;

export type View = 'dashboard' | 'inventory' | 'vials' | 'sales' | 'stats' | 'expenses' | 'incomes' | 'clients';
