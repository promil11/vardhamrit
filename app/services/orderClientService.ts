import { api } from './api';

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number;
  variant_id: number;
  product_name: string;
  variant_label: string;
  unit_price: number;
  quantity: number;
  total_price: number;
  product_image?: string;
}

export interface Order {
  id: number;
  order_number: string;
  user_id: number;
  address_snapshot: any;
  subtotal: number;
  discount_amount: number;
  delivery_fee: number;
  tax_amount: number;
  total_amount: number;
  payment_method: string;
  payment_status: string;
  order_status: string;
  status: string;
  courier_name?: string;
  tracking_number?: string;
  rejection_reason?: string;
  created_at: string;
  items: OrderItem[];
  status_history?: any[];
  scratch_card_claimed?: boolean;
  scratch_card_coins?: number;
  scratch_card_claimed_at?: string | null;
}

export async function fetchUserOrders(page = 1, limit = 50): Promise<{
  orders: Order[];
  total: number;
  totalPages?: number;
  page?: number;
}> {
  try {
    const res = await api.get('/api/v1/orders', { params: { page, limit } });
    if (res.data?.success && res.data?.data) {
      return {
        orders: res.data.data.items || [],
        total: res.data.data.pagination?.total || 0,
        totalPages: res.data.data.pagination?.totalPages || 1,
        page: res.data.data.pagination?.page || 1,
      };
    }
    return { orders: [], total: 0, totalPages: 1, page: 1 };
  } catch (err) {
    console.warn('Error fetching orders:', err);
    return { orders: [], total: 0, totalPages: 1, page: 1 };
  }
}

export async function fetchOrderDetail(id: number): Promise<Order | null> {
  try {
    const res = await api.get(`/api/v1/orders/${id}`);
    if (res.data?.success && res.data?.data) {
      return res.data.data;
    }
    return null;
  } catch (err) {
    console.warn(`Error fetching order ${id}:`, err);
    return null;
  }
}
