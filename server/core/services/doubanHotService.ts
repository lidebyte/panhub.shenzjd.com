/**
 * 豆瓣影视榜单服务
 * 使用豆瓣 JSON API (/j/chart/top_list) 获取数据，替代 HTML 爬虫
 *
 * 优点：返回结构化 JSON，无需 cheerio 解析，自带封面 URL，更稳定
 */

import { ofetch } from "ofetch";
import { DOUBAN_HOT_SOURCES, type DoubanHotSourceConfig } from "../../../config/doubanHot";
import { MemoryCache } from "../cache/memoryCache";

export interface DoubanHotItem {
  id?: number;
  title: string;
  url?: string;
  cover?: string;
  desc?: string;
  hot?: number;
}

export interface DoubanHotPageResult {
  items: DoubanHotItem[];
  hasMore: boolean;
}

/** 豆瓣 top_list API 返回的原始结构 */
interface DoubanApiItem {
  id: string;
  title: string;
  score: string;
  rating: string[];
  cover_url: string;
  url: string;
  types: string[];
  regions: string[];
  actors: string[];
  release_date: string;
  vote_count: number;
  rank: number;
}

const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 小时
const API_BASE = "https://movie.douban.com/j/chart/top_list";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
const PAGE_SIZE = 20;

const allItemsCache = new MemoryCache<DoubanHotItem[]>({ maxSize: 30 });

/** 将豆瓣 API 返回的 item 转为 DoubanHotItem */
function mapItem(raw: DoubanApiItem, index: number): DoubanHotItem {
  const score = raw.score || raw.rating?.[0] || "0";
  const title = `【${score}】${raw.title}`;
  const desc = [raw.types?.join("/"), raw.regions?.join("/")]
    .filter(Boolean)
    .join(" · ");

  return {
    id: Number(raw.id) || undefined,
    title,
    cover: raw.cover_url || undefined,
    desc,
    url: raw.url || `https://movie.douban.com/subject/${raw.id}/`,
  };
}

/**
 * 从豆瓣 JSON API 获取指定类型的榜单
 * @param typeId 豆瓣分类 ID（0=Top250, 3=剧情, 5=动作, ...）
 * @param limit 获取数量
 */
async function fetchTopList(typeId: number, limit = 50): Promise<DoubanHotItem[]> {
  const allItems: DoubanHotItem[] = [];
  const batchSize = Math.min(limit, PAGE_SIZE);

  for (let start = 0; start < limit; start += batchSize) {
    const url = `${API_BASE}?type=${typeId}&interval_id=100:90&action=&start=${start}&limit=${batchSize}`;

    try {
      const data = await ofetch<DoubanApiItem[]>(url, {
        headers: { "user-agent": UA },
        timeout: 10000,
      });

      if (!Array.isArray(data) || data.length === 0) break;

      for (let i = 0; i < data.length; i++) {
        allItems.push(mapItem(data[i], start + i));
      }

      // 如果返回的数据少于请求数，说明没有更多了
      if (data.length < batchSize) break;
    } catch (e: any) {
      console.warn(`[DoubanAPI] type=${typeId} start=${start} 失败:`, e?.message);
      break;
    }
  }

  return allItems;
}

/** 获取指定分类的全部数据（带缓存） */
async function fetchAllItems(categoryId: string): Promise<DoubanHotItem[]> {
  const cacheKey = `douban-api:${categoryId}`;
  const cached = allItemsCache.get(cacheKey);
  if (cached.hit && cached.value) return cached.value;

  const config = DOUBAN_HOT_SOURCES.find((s) => s.id === categoryId);
  if (!config) return [];

  const items = await fetchTopList(config.typeId);
  if (items.length > 0) {
    allItemsCache.set(cacheKey, items, CACHE_TTL_MS);
  }
  return items;
}

export function extractSearchTerm(title: string): string {
  return title.replace(/^【[\d.]+】/, "").trim() || title;
}

/** 分页获取指定分类的数据 */
export async function fetchDoubanHotByCategory(
  category: string,
  page: number = 1,
  limit: number = PAGE_SIZE
): Promise<DoubanHotPageResult> {
  const allItems = await fetchAllItems(category);
  const start = (page - 1) * limit;
  const end = start + limit;

  return {
    items: allItems.slice(start, end),
    hasMore: end < allItems.length,
  };
}

/** 获取所有分类的数据 */
export async function fetchDoubanHot(
  categories?: string[]
): Promise<{ categories: Record<string, { id: string; label: string; title: string; type: string; items: DoubanHotItem[] }> }> {
  const ids = categories?.length
    ? categories
    : DOUBAN_HOT_SOURCES.map((s) => s.id);

  const results: Record<string, { id: string; label: string; title: string; type: string; items: DoubanHotItem[] }> = {};

  await Promise.all(
    ids.map(async (id) => {
      const config = DOUBAN_HOT_SOURCES.find((s) => s.id === id);
      if (!config) return;

      try {
        const items = await fetchAllItems(id);
        results[id] = {
          id: config.id,
          label: config.label,
          title: config.label,
          type: config.type,
          items,
        };
      } catch (e: any) {
        results[id] = {
          id: config.id,
          label: config.label,
          title: config.label,
          type: config.type,
          items: [],
        };
        console.warn(`[DoubanAPI] ${id} 失败:`, e?.message);
      }
    })
  );

  return { categories: results };
}
