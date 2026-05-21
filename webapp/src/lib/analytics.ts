import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd(), "public", "analytics", "data");

async function read<T>(name: string): Promise<T | null> {
  try {
    const buf = await fs.readFile(path.join(ROOT, name), "utf-8");
    return JSON.parse(buf) as T;
  } catch {
    return null;
  }
}

export type Overview = {
  generated_at: string;
  totals: {
    categories: number;
    channels: number;
    broadcasts: number;
    shortclips: number;
    broadcasts_with_comments: number;
    comments: number;
    products: number;
  };
  comment_count_dist: {
    min: number;
    max: number;
    avg: number;
    median: number;
  };
};

export type CategoryStat = {
  category_id: string;
  name: string;
  broadcasts: number;
  shortclips: number;
  broadcasts_only: number;
  comments: number;
  avg_comments: number;
};

export type ChannelStat = {
  broadcaster_id: string;
  name: string;
  profile_url: string | null;
  grade: string | null;
  broadcasts: number;
  comments: number;
  avg_comments: number;
  max_comments: number;
};

export type StatusDist = {
  category_id: string;
  name: string;
  statuses: Record<string, number>;
};

export type ProductStats = {
  total: number;
  broadcasts_with_products: number;
  avg_price: number;
  avg_sale_price: number;
  avg_discount_rate: number;
  top_brands: { name: string; count: number }[];
};

export type TopUser = { nickname: string; count: number; broadcasts: number };

export type TimeSeries = {
  daily: { day: string; count: number }[];
  heatmap: number[][]; // 7 x 24, [weekday(0=Sun)][hour]
};

export type TextStats = {
  sampled: number;
  top_words: { word: string; count: number }[];
  top_emojis: { emoji: string; count: number }[];
  length_histogram: { range: string; count: number }[];
};

export const loadOverview = () => read<Overview>("overview.json");
export const loadCategoryStats = () => read<CategoryStat[]>("category_stats.json");
export const loadChannelStats = () => read<ChannelStat[]>("channel_stats.json");
export const loadStatusDist = () => read<StatusDist[]>("status_dist.json");
export const loadProductStats = () => read<ProductStats>("product_stats.json");
export const loadTopUsers = () => read<TopUser[]>("top_users.json");
export const loadTimeSeries = () => read<TimeSeries>("timeseries.json");
export const loadTextStats = () => read<TextStats>("text_stats.json");
