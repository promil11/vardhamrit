import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useAuth } from './authContext';

export interface CartItem {
  id: number;
  variant_id: number;
  quantity: number;
  variant_label: string;
  price: number;
  stock: number;
  sku: string;
  product_id: number;
  product_name: string;
  product_image: string;
  line_total: number;
  in_stock: boolean;
}

export interface AppliedCoupon {
  code: string;
  discountAmount: number;
  type: string;
  value: number;
  message: string;
}

interface CartContextType {
  items: CartItem[];
  subtotal: number;
  totalQuantity: number;
  allInStock: boolean;
  isLoading: boolean;
  appliedCoupon: AppliedCoupon | null;
  addToCart: (variantId: number, quantity?: number) => Promise<void>;
  updateQuantity: (cartItemId: number, quantity: number) => Promise<void>;
  removeItem: (cartItemId: number) => Promise<void>;
  clearCart: () => Promise<void>;
  applyCoupon: (code: string, paymentMethod?: 'ONLINE' | 'COD' | 'ALL') => Promise<{ success: boolean; message: string }>;
  removeCoupon: () => void;
  refreshCart: () => Promise<void>;
}

const CartContext = createContext<CartContextType>({} as CartContextType);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [subtotal, setSubtotal] = useState<number>(0);
  const [totalQuantity, setTotalQuantity] = useState<number>(0);
  const [allInStock, setAllInStock] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);

  const fetchCart = useCallback(async () => {
    if (!isAuthenticated) {
      setItems([]);
      setSubtotal(0);
      setTotalQuantity(0);
      return;
    }

    try {
      setIsLoading(true);
      const res = await api.get('/cart');
      if (res.data?.success) {
        setItems(res.data.data.items || []);
        setSubtotal(res.data.data.subtotal || 0);
        setTotalQuantity(res.data.data.totalQuantity || 0);
        setAllInStock(res.data.data.allInStock ?? true);
      }
    } catch (e) {
      console.warn('Failed to fetch cart:', e);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  const addToCart = async (variantId: number, quantity = 1) => {
    const res = await api.post('/cart', { variantId, quantity });
    if (res.data?.success) {
      setItems(res.data.data.items || []);
      setSubtotal(res.data.data.subtotal || 0);
      setTotalQuantity(res.data.data.totalQuantity || 0);
      setAllInStock(res.data.data.allInStock ?? true);
    }
  };

  const updateQuantity = async (cartItemId: number, quantity: number) => {
    const res = await api.patch(`/cart/${cartItemId}`, { quantity });
    if (res.data?.success) {
      setItems(res.data.data.items || []);
      setSubtotal(res.data.data.subtotal || 0);
      setTotalQuantity(res.data.data.totalQuantity || 0);
      setAllInStock(res.data.data.allInStock ?? true);
    }
  };

  const removeItem = async (cartItemId: number) => {
    const res = await api.delete(`/cart/${cartItemId}`);
    if (res.data?.success) {
      setItems(res.data.data.items || []);
      setSubtotal(res.data.data.subtotal || 0);
      setTotalQuantity(res.data.data.totalQuantity || 0);
      setAllInStock(res.data.data.allInStock ?? true);
    }
  };

  const clearCart = async () => {
    await api.delete('/cart');
    setItems([]);
    setSubtotal(0);
    setTotalQuantity(0);
    setAppliedCoupon(null);
  };

  const applyCoupon = async (code: string, paymentMethod: 'ONLINE' | 'COD' | 'ALL' = 'ALL') => {
    try {
      const res = await api.post('/coupons/validate', { code, paymentMethod, subtotal });
      if (res.data?.success) {
        setAppliedCoupon({
          code: res.data.data.code,
          discountAmount: res.data.data.discountAmount,
          type: res.data.data.type,
          value: res.data.data.value,
          message: res.data.data.message,
        });
        return { success: true, message: res.data.data.message };
      }
      return { success: false, message: 'Invalid coupon' };
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Failed to apply coupon';
      return { success: false, message: msg };
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
  };

  return (
    <CartContext.Provider
      value={{
        items,
        subtotal,
        totalQuantity,
        allInStock,
        isLoading,
        appliedCoupon,
        addToCart,
        updateQuantity,
        removeItem,
        clearCart,
        applyCoupon,
        removeCoupon,
        refreshCart: fetchCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
