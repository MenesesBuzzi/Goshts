export type Courier = {
  id: string;
  name: string;
  phone: string;
  avatar_url: string;
  ghost_avatar: string | null;
  pix_key: string | null;
  username: string | null;
  online: boolean;
  active: boolean;
  user_id: string;
};

export type OrderItem = { qty?: number; name?: string; details?: string };

export type Order = {
  id: string;
  code: string;
  created_at: string;
  status: "recebido" | "preparo" | "saiu" | "entregue" | "cancelado";
  status_times: Record<string, string> | null;
  mode: "entrega" | "retirada";
  customer_name: string;
  customer_phone: string;
  address: string | null;
  neighborhood: string | null;
  items: OrderItem[] | null;
  total: number;
  payment: "pix" | "cartao" | "dinheiro";
  courier_id: string | null;
  lat: number | null;
  lng: number | null;
};

export type Stats = {
  today: number; week: number; month: number; total: number;
  bonus_today: number; bonus_week: number; bonus_month: number; bonus_total: number; bonus_per_delivery: number;
};

export const ORDER_FIELDS =
  "id, code, created_at, status, status_times, mode, customer_name, customer_phone, address, neighborhood, items, total, payment, courier_id, lat, lng";

export type AppSettings = { ranking_prize: string; stale_minutes: number; bonus_per_delivery: number };

export type DeliveryEvent = {
  id: string; title: string; description: string;
  center_lat: number; center_lng: number; radius_m: number;
  extra_bonus: number; starts_at: string; ends_at: string; active: boolean;
};

export type HotZone = { lat: number; lng: number; recent: number; typical: number };

export type LeaderRow = { pos: number; name: string; avatar_url: string | null; ghost_avatar: string | null; deliveries: number; is_me: boolean };

export type EarningRow = {
  id: string; code: string; neighborhood: string | null; delivered_at: string;
  delivery_fee: number; base_bonus: number; event_bonus: number; event_title: string | null; earning: number; paid: boolean;
};
export type Payout = { id: string; period_start: string | null; period_end: string | null; deliveries: number; amount: number; paid_at: string; note: string };
export type Earnings = {
  today: { n: number; total: number }; week: { n: number; total: number }; unpaid: { n: number; total: number };
  payouts: Payout[]; deliveries: EarningRow[];
};
