export type Category = {
  category_id: string;
  name: string;
  nclick_code: string | null;
  thumbnail_url: string | null;
  icon_url: string | null;
};

export type Channel = {
  broadcaster_id: string;
  name: string;
  account_no: string | null;
  profile_url: string | null;
  channel_url: string | null;
  grade: string | null;
  description: string | null;
  broadcast_count?: number;
  comment_count?: number;
};

export type Broadcast = {
  broadcast_id: string;
  category_id: string | null;
  broadcaster_id: string | null;
  broadcaster_name?: string | null;
  category_name?: string | null;
  title: string | null;
  description: string | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  viewer_url: string | null;
  thumbnail_url: string | null;
  product_count: number | null;
  is_shortclip: number | null;
  comment_count: number;
};

export type Product = {
  broadcast_id: string;
  product_no: string;
  name: string | null;
  brand_name: string | null;
  mall_name: string | null;
  image_url: string | null;
  price: number | null;
  sale_price: number | null;
  discount_rate: number | null;
  product_url: string | null;
};

export type Comment = {
  comment_no: number;
  broadcast_id: string;
  nickname: string | null;
  message: string | null;
  created_at: string | null;
  created_at_milli: number | null;
  comment_type: string | null;
};

export type Paged<T> = {
  items: T[];
  nextCursor: number | string | null;
  total?: number;
};
