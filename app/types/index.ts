/**
 * Chai Patti App Data Types & Models
 */

export interface ProductVariant {
  id: number;
  label: string;       // e.g. "250 g", "500 g", "1 kg"
  weightGrams: number;
  price: number;       // Discounted selling price, e.g. 199
  mrp: number;         // Maximum retail price, e.g. 249
  stock: number;
}

export interface Product {
  id: number;
  name: string;
  tagline: string;
  description: string;
  imageUrl: string;
  images?: string[];
  category:
    | 'kadak'
    | 'elaichi'
    | 'masala'
    | 'ginger'
    | 'green'
    | 'keser'
    | 'chocolate'
    | 'gift'
    | 'combo'
    | 'offers'
    | string;
  rating: number;
  reviewCount: number;
  isBestSeller?: boolean;
  isFreshHarvest?: boolean;
  discountPercentage?: number; // e.g. 20
  variants: ProductVariant[];
  badges?: string[];           // e.g. ["Fresh", "Strong Taste", "Fast Delivery"]
}

export interface CartItem {
  id: string;                  // `${productId}-${variantId}`
  productId: number;
  variantId: number;
  productName: string;
  variantLabel: string;
  imageUrl: string;
  price: number;
  mrp: number;
  quantity: number;
  maxStock: number;
  dbCartId?: number;
}

export interface Coupon {
  code: string;
  title: string;
  description: string;
  discountType: 'PERCENT' | 'FLAT';
  discountValue: number;
  minOrderValue: number;
  maxDiscount?: number;
}

export interface Address {
  id: string;
  name: string;
  phone: string;
  tag: 'HOME' | 'WORK' | 'OTHER' | 'Current Location' | string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  landmark?: string;
  latitude?: number;
  longitude?: number;
  isDefault: boolean;
}
