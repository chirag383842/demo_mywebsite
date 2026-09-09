import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from './supabase';
import type { Product, StoreStatus, Review, Feedback, GalleryImage } from './types';
import { DEFAULT_GALLERY_IMAGES } from './galleryData';
import { sendFeedbackToGoogleSheet } from './googleSheets';
import { calculateStoreStatus } from './constants';
import { withDedupe, invalidateCache } from './requestCache';
import { idbGet, idbSet } from './mediaStorage';

export type AsyncState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

const DEFAULT_PRODUCTS: Product[] = [
  {
    id: '1',
    slug: 'kachori',
    name: 'Regular Kachori',
    price: 40,
    description:
      'Crispy, golden-fried puffed pastry stuffed with our classic spiced lentil and onion filling — served fresh with tangy house chutneys.',
    image_url: '/images/kachori.webp',
    available: true,
    stock: 80,
    featured: true,
    display_order: 1,
  },
  {
    id: '2',
    slug: 'kachori-jain',
    name: 'Jain Kachori (No Onion / No Garlic)',
    price: 40,
    description:
      'Prepared strictly per Jain dietary traditions without onion or garlic — packed with rich authentic spices and served with fresh sweet and spicy chutneys.',
    image_url: '',
    available: true,
    stock: 50,
    featured: false,
    display_order: 2,
  },
  {
    id: '3',
    slug: 'kachori-swaminarayan',
    name: 'Swaminarayan Kachori (Satvik)',
    price: 40,
    description:
      'Pure satvik preparation crafted strictly without onion or garlic, following Swaminarayan dietary guidelines with fragrant spices and fresh chutneys.',
    image_url: '',
    available: true,
    stock: 50,
    featured: false,
    display_order: 3,
  },
  {
    id: '4',
    slug: 'bhel',
    name: 'Fresh Bhel',
    price: 50,
    description:
      'Light, crunchy puffed rice tossed with fresh tomatoes, onions, sev and our house chutneys — a burst of flavour in every bite.',
    image_url: '/images/bhel.webp',
    available: true,
    stock: 60,
    featured: false,
    display_order: 4,
  },
];

const INITIAL_PINNED_REVIEWS: Review[] = [
  {
    id: 'jd-001',
    rating: 5,
    customer_name: 'Ramesh Prajapati',
    message:
      'Paras Kachoriwala has been my family go-to for years. The Regular Kachori is always crispy on the outside and perfectly stuffed inside — Jain Kachori is equally authentic without onion-garlic. Fresh chutneys make every bite special.',
    created_at: '2025-06-14T18:30:00.000Z',
    display_order: 1,
    source: 'justdial',
  },
  {
    id: 'jd-002',
    rating: 5,
    customer_name: 'Kinjal Shah',
    message:
      'I live nearby and visit almost every evening. The Swaminarayan Kachori is satvik, tasty and strictly prepared the way we prefer. Their Bhel is light, crunchy and never oily. Best part — reasonable prices and large, jumbo-sized portions.',
    created_at: '2025-07-02T19:05:00.000Z',
    display_order: 2,
    source: 'justdial',
  },
  {
    id: 'jd-003',
    rating: 4,
    customer_name: 'Haresh Patel',
    message:
      'Took my family of 6 last week. The counter token system is smooth — no confusion at all. Kachori was fresh and filling. Sometimes the evening rush can be busy but wait is worthwhile. Recommended for authentic street-style kachori.',
    created_at: '2025-05-21T20:12:00.000Z',
    display_order: 3,
    source: 'justdial',
  },
  {
    id: 'jd-004',
    rating: 5,
    customer_name: 'Daxa Ben Mehta',
    message:
      'We order almost every weekend for the entire joint family. Kids love the Bhel and elders enjoy the Jain Kachori. The taste has been consistent for as long as I remember. Paras ji ke kachori mein woh baat hai!',
    created_at: '2025-08-09T19:20:00.000Z',
    display_order: 4,
    source: 'justdial',
  },
  {
    id: 'jd-005',
    rating: 5,
    customer_name: 'Vivek Trivedi',
    message:
      'As someone who has tried kachori shops across the city, Paras Kachoriwala stands out for freshness. Every piece is puffed, the filling is generous, and the chutneys are balanced — not too sweet, not too tangy. Pure 5 stars from a regular customer.',
    created_at: '2025-04-30T19:45:00.000Z',
    display_order: 5,
    source: 'justdial',
  },
  {
    id: 'jd-006',
    rating: 4,
    customer_name: 'Bharat Desai',
    message:
      'Genuine local kachori place. Cash only, token system, very orderly service. Portions are big — one jumbo kachori with Bhel is enough for two adults. My friends from Mumbai were really impressed when I took them here last month.',
    created_at: '2025-07-27T20:30:00.000Z',
    display_order: 6,
    source: 'justdial',
  },
];

const DEFAULT_STORE_STATUS: StoreStatus = {
  id: 'store_status_main',
  is_open: true,
  crowd_level: 'Moderate',
  last_updated: new Date().toISOString(),
  closed_for_date: null,
  force_open_date: null,
};

const STORAGE_STATUS_KEY = 'pk_local_store_status_v3';
const STORAGE_PRODUCTS_KEY = 'pk_local_products_v3';
const STORAGE_GALLERY_KEY = 'pk_local_gallery_v3';
const STORAGE_FEEDBACK_KEY = 'pk_all_feedback_records_v3';
const STORAGE_DELETED_REVIEWS_KEY = 'pk_deleted_review_ids_v3';

const CACHE_TTL_SHORT = 10_000;
const CACHE_TTL_MEDIUM = 20_000;
const REQUEST_TIMEOUT_MS = 2_500;

// Cross-tab Real-Time Broadcast Channel
let syncBroadcastChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    syncBroadcastChannel = new BroadcastChannel('paras_kachoriwala_sync');
  }
} catch {
  syncBroadcastChannel = null;
}

export function broadcastRealtimeEvent(type: string, data?: unknown) {
  try {
    syncBroadcastChannel?.postMessage({ type, data, timestamp: Date.now() });
  } catch {
    /* ignore */
  }
}

function toErrMsg(err: unknown, fallback = 'Request failed'): string {
  if (err instanceof Error) return err.message || fallback;
  if (typeof err === 'string') return err || fallback;
  if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
    return err.message || fallback;
  }
  return fallback;
}

function getLocalStatus(): StoreStatus | null {
  try {
    const raw = localStorage.getItem(STORAGE_STATUS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

let memoryProducts: Product[] | null = null;
let memoryGallery: GalleryImage[] | null = null;

function getLocalProducts(): Product[] | null {
  if (memoryProducts && memoryProducts.length > 0) return memoryProducts;
  try {
    const raw = localStorage.getItem(STORAGE_PRODUCTS_KEY);
    if (raw) {
      memoryProducts = JSON.parse(raw);
      return memoryProducts;
    }
  } catch {
    /* ignore */
  }
  return memoryProducts;
}

export function normalizeGalleryItem(img: GalleryImage): GalleryImage {
  let cat = img.category;
  if ((cat as string) === 'shop' || (cat as string) === 'home' || (cat as string) === 'about') {
    cat = 'stall';
  }
  let mediaType = img.media_type;
  if (!mediaType) {
    const srcLower = (img.src || '').toLowerCase();
    if (srcLower.endsWith('.mp4') || srcLower.endsWith('.webm') || srcLower.startsWith('data:video/')) {
      mediaType = 'video';
    } else if (
      srcLower.endsWith('.mp3') ||
      srcLower.endsWith('.wav') ||
      srcLower.endsWith('.ogg') ||
      srcLower.startsWith('data:audio/')
    ) {
      mediaType = 'audio';
    } else {
      mediaType = 'image';
    }
  }
  if (mediaType === 'video' || mediaType === 'audio') {
    if (cat !== 'customers' && cat !== 'stall' && cat !== 'food') {
      cat = 'videos';
    }
  }
  return { ...img, category: cat, media_type: mediaType };
}

function getLocalGallery(): GalleryImage[] | null {
  if (memoryGallery && memoryGallery.length > 0) return memoryGallery;
  try {
    const raw = localStorage.getItem(STORAGE_GALLERY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        memoryGallery = parsed.map(normalizeGalleryItem);
        return memoryGallery;
      }
    }
  } catch {
    /* ignore */
  }
  return memoryGallery;
}

function getLocalFeedbackList(): Feedback[] {
  try {
    const raw = localStorage.getItem(STORAGE_FEEDBACK_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalFeedbackList(list: Feedback[]): void {
  try {
    localStorage.setItem(STORAGE_FEEDBACK_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

function getDeletedReviewIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_DELETED_REVIEWS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function markReviewDeleted(id: string): void {
  try {
    const deleted = getDeletedReviewIds();
    deleted.add(id);
    localStorage.setItem(STORAGE_DELETED_REVIEWS_KEY, JSON.stringify(Array.from(deleted)));
  } catch {
    /* ignore */
  }
}

async function withTimeout<T>(fn: () => T | PromiseLike<T>, ms = REQUEST_TIMEOUT_MS): Promise<Awaited<T>> {
  const timeout = new Promise<never>((_, reject) => {
    const id = setTimeout(() => {
      clearTimeout(id);
      reject(new Error(`Request timed out after ${ms}ms`));
    }, ms);
  });
  return Promise.race([Promise.resolve(fn()), timeout]);
}

// ----------------------------------------------------
// 1. PRODUCTS HOOK
// ----------------------------------------------------
export function useProducts() {
  const [state, setState] = useState<AsyncState<Product[]>>(() => {
    const cached = getLocalProducts();
    return { data: cached ?? DEFAULT_PRODUCTS, loading: false, error: null };
  });

  // Async load from IndexedDB to ensure custom added menu items are never lost
  useEffect(() => {
    idbGet<Product[]>(STORAGE_PRODUCTS_KEY).then((idbProducts) => {
      if (idbProducts && idbProducts.length > 0) {
        memoryProducts = idbProducts;
        setState((prev) => ({
          ...prev,
          data: idbProducts,
        }));
      }
    });
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const result = await withDedupe<Product[]>(
        'sb:products',
        async () => {
          const cached = getLocalProducts();
          const { data, error } = await withTimeout(() =>
            supabase
              .from('products')
              .select('*')
              .order('display_order', { ascending: true })
          );

          const baseList = memoryProducts ?? cached ?? DEFAULT_PRODUCTS;
          if (error || !data || data.length === 0) {
            return baseList;
          }

          // Build a map of remote items by slug and id
          const remoteMap = new Map<string, Product>();
          (data as Product[]).forEach((p) => {
            remoteMap.set(p.slug, p);
            if (p.id) remoteMap.set(p.id, p);
          });

          // Merge with cached/default products so that:
          // 1. Any items not yet in Supabase (Jain, Swaminarayan, custom added items) are 100% preserved
          // 2. Any local author modifications are never overwritten by stale remote rows
          const merged: Product[] = baseList.map((localItem) => {
            const remoteItem = remoteMap.get(localItem.slug) || (localItem.id ? remoteMap.get(localItem.id) : undefined);
            if (!remoteItem) return localItem;

            return {
              ...remoteItem,
              ...localItem,
              id: remoteItem.id || localItem.id,
              price: typeof localItem.price === 'number' && localItem.price > 0 ? localItem.price : remoteItem.price,
              available: typeof localItem.available === 'boolean' ? localItem.available : remoteItem.available,
              stock: localItem.stock ?? remoteItem.stock,
              image_url: localItem.image_url || remoteItem.image_url,
              description: localItem.description || remoteItem.description,
              updated_at: localItem.updated_at || remoteItem.updated_at || new Date().toISOString(),
            };
          });

          // Also include any remote items not in baseList
          (data as Product[]).forEach((p) => {
            if (!merged.some((m) => m.slug === p.slug || (p.id && m.id === p.id))) {
              merged.push(p);
            }
          });

          memoryProducts = merged;
          try {
            localStorage.setItem(STORAGE_PRODUCTS_KEY, JSON.stringify(merged));
          } catch {
            /* ignore */
          }
          void idbSet(STORAGE_PRODUCTS_KEY, merged);
          return merged;
        },
        CACHE_TTL_MEDIUM
      );
      setState({ data: result, loading: false, error: null });
    } catch (err) {
      const cached = memoryProducts ?? getLocalProducts();
      setState({
        data: cached ?? DEFAULT_PRODUCTS,
        loading: false,
        error: toErrMsg(err, 'Unable to load menu data.'),
      });
    }
  }, []);

  const refetch = useCallback(() => {
    invalidateCache('sb:products');
    return fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchData();

    const handleLocalUpdate = () => {
      const cached = memoryProducts ?? getLocalProducts();
      if (cached) {
        setState({ data: [...cached], loading: false, error: null });
      }
    };

    window.addEventListener('pk_products_changed', handleLocalUpdate);

    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_PRODUCTS_KEY) {
        handleLocalUpdate();
      }
    };
    window.addEventListener('storage', handleStorage);

    const handleBroadcast = (e: MessageEvent) => {
      if (e.data?.type === 'PRODUCTS_CHANGED') {
        if (e.data.data?.newProduct) {
          const np = e.data.data.newProduct as Product;
          const current = memoryProducts ?? getLocalProducts() ?? DEFAULT_PRODUCTS;
          if (!current.some((p) => p.id === np.id || p.slug === np.slug)) {
            memoryProducts = [...current, np];
          }
        } else if (e.data.data?.productId && e.data.data?.action === 'deleted') {
          const pid = e.data.data.productId;
          const current = memoryProducts ?? getLocalProducts() ?? DEFAULT_PRODUCTS;
          memoryProducts = current.filter((p) => p.id !== pid && p.slug !== pid);
        }
        const cached = memoryProducts ?? getLocalProducts();
        if (cached) setState({ data: [...cached], loading: false, error: null });
        invalidateCache('sb:products');
        fetchData();
      }
    };
    syncBroadcastChannel?.addEventListener('message', handleBroadcast);

    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel('realtime-products')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
          invalidateCache('sb:products');
          fetchData();
        })
        .subscribe();
    } catch {
      channel = null;
    }

    // Periodic background sync for non-websocket clients
    const pollInterval = window.setInterval(() => {
      fetchData();
    }, 30_000);

    return () => {
      window.clearInterval(pollInterval);
      window.removeEventListener('pk_products_changed', handleLocalUpdate);
      window.removeEventListener('storage', handleStorage);
      syncBroadcastChannel?.removeEventListener('message', handleBroadcast);
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch {
          /* ignore */
        }
      }
    };
  }, [fetchData]);

  return { ...state, refetch };
}

// ----------------------------------------------------
// 2. STORE STATUS HOOK
// ----------------------------------------------------
export function useStoreStatus() {
  const [state, setState] = useState<AsyncState<StoreStatus>>(() => {
    const cached = getLocalStatus();
    return { data: cached ?? DEFAULT_STORE_STATUS, loading: false, error: null };
  });
  const [, setTimeTick] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      const result = await withDedupe<StoreStatus>(
        'sb:store_status',
        async () => {
          const cached = getLocalStatus();
          try {
            const { data, error } = await withTimeout(() =>
              supabase
                .from('store_status')
                .select('*')
                .limit(1)
                .maybeSingle()
            );
            if (error || !data) {
              return cached ?? DEFAULT_STORE_STATUS;
            }

            // Parse any serialized metadata from updated_by if present
            let parsedClosedDate = (data as Record<string, unknown>).closed_for_date as string | null | undefined;
            let parsedForceOpenDate = (data as Record<string, unknown>).force_open_date as string | null | undefined;
            if (data.updated_by && typeof data.updated_by === 'string' && data.updated_by.startsWith('{')) {
              try {
                const meta = JSON.parse(data.updated_by);
                if (meta.closed_for_date !== undefined) parsedClosedDate = meta.closed_for_date;
                if (meta.force_open_date !== undefined) parsedForceOpenDate = meta.force_open_date;
              } catch {
                /* ignore */
              }
            }

            const remoteStatus: StoreStatus = {
              id: data.id || 'store_status_main',
              is_open: Boolean(data.is_open),
              crowd_level: data.crowd_level || 'Moderate',
              last_updated: data.last_updated || new Date().toISOString(),
              closed_for_date: parsedClosedDate ?? null,
              force_open_date: parsedForceOpenDate ?? null,
              updated_by: data.updated_by,
            };

            // If local storage has a more recent modification, do not let stale remote data overwrite it!
            if (cached && cached.last_updated) {
              const localTime = new Date(cached.last_updated).getTime();
              const remoteTime = new Date(remoteStatus.last_updated).getTime();
              if (localTime > remoteTime) {
                return cached;
              }
            }

            try {
              localStorage.setItem(STORAGE_STATUS_KEY, JSON.stringify(remoteStatus));
            } catch {
              /* ignore */
            }
            return remoteStatus;
          } catch {
            return cached ?? DEFAULT_STORE_STATUS;
          }
        },
        CACHE_TTL_SHORT
      );
      setState({ data: result, loading: false, error: null });
    } catch (err) {
      const cached = getLocalStatus();
      setState({
        data: cached ?? DEFAULT_STORE_STATUS,
        loading: false,
        error: toErrMsg(err, 'Unable to load store status.'),
      });
    }
  }, []);

  const refetch = useCallback(() => {
    invalidateCache('sb:store_status');
    return fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchData();

    const handleLocalUpdate = () => {
      const cached = getLocalStatus();
      if (cached) setState({ data: cached, loading: false, error: null });
    };

    window.addEventListener('pk_store_status_changed', handleLocalUpdate);

    const handleBroadcast = (e: MessageEvent) => {
      if (e.data?.type === 'STORE_STATUS_CHANGED') {
        const newStatus = e.data.data as StoreStatus;
        if (newStatus) {
          setState({ data: newStatus, loading: false, error: null });
        } else {
          invalidateCache('sb:store_status');
          fetchData();
        }
      }
    };
    syncBroadcastChannel?.addEventListener('message', handleBroadcast);

    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel('realtime-store-status')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'store_status' }, () => {
          invalidateCache('sb:store_status');
          fetchData();
        })
        .subscribe();
    } catch {
      channel = null;
    }

    // 15-second timer for Indian Standard Time (IST) auto-trigger & periodic sync
    const timerInterval = window.setInterval(() => {
      setTimeTick((t) => t + 1);
      fetchData();
    }, 15_000);

    return () => {
      window.clearInterval(timerInterval);
      window.removeEventListener('pk_store_status_changed', handleLocalUpdate);
      syncBroadcastChannel?.removeEventListener('message', handleBroadcast);
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch {
          /* ignore */
        }
      }
    };
  }, [fetchData]);

  const computed = calculateStoreStatus(state.data);

  return {
    ...state,
    computed,
    refetch,
  };
}

// ----------------------------------------------------
// 3. GALLERY HOOK
// ----------------------------------------------------
export function useGallery() {
  const [state, setState] = useState<AsyncState<GalleryImage[]>>(() => {
    const cached = getLocalGallery();
    return { data: cached ?? DEFAULT_GALLERY_IMAGES, loading: false, error: null };
  });

  // Async load from IndexedDB so uploaded videos/audios are never lost
  useEffect(() => {
    idbGet<GalleryImage[]>(STORAGE_GALLERY_KEY).then((idbGallery) => {
      if (idbGallery && idbGallery.length > 0) {
        memoryGallery = idbGallery;
        setState((prev) => ({ ...prev, data: idbGallery }));
      }
    });
  }, []);

  const fetchGallery = useCallback(async () => {
    try {
      const result = await withDedupe<GalleryImage[]>(
        'sb:gallery',
        async () => {
          try {
            const { data, error } = await withTimeout(() =>
              supabase
                .from('gallery')
                .select('*')
                .order('display_order', { ascending: true })
            );
            const currentLocal = memoryGallery ?? getLocalGallery() ?? DEFAULT_GALLERY_IMAGES;
            if (error || !data || data.length === 0) {
              return currentLocal;
            }
            // CRITICAL: Merge remote records with local items so uploaded videos/audios are NEVER lost!
            const remoteFormatted = (data as GalleryImage[]).map(normalizeGalleryItem);
            const remoteIds = new Set(remoteFormatted.map((r) => r.id));
            const merged: GalleryImage[] = [...remoteFormatted];
            currentLocal.forEach((item) => {
              if (!remoteIds.has(item.id)) {
                merged.unshift(item);
              }
            });
            memoryGallery = merged;
            try {
              localStorage.setItem(STORAGE_GALLERY_KEY, JSON.stringify(merged));
            } catch {
              /* ignore */
            }
            void idbSet(STORAGE_GALLERY_KEY, merged);
            return merged;
          } catch {
            const currentLocal = memoryGallery ?? getLocalGallery() ?? DEFAULT_GALLERY_IMAGES;
            return currentLocal;
          }
        },
        CACHE_TTL_MEDIUM
      );
      setState({ data: result, loading: false, error: null });
    } catch (err) {
      const cached = memoryGallery ?? getLocalGallery();
      setState({
        data: cached ?? DEFAULT_GALLERY_IMAGES,
        loading: false,
        error: toErrMsg(err, 'Unable to load gallery.'),
      });
    }
  }, []);

  const refetch = useCallback(() => {
    invalidateCache('sb:gallery');
    return fetchGallery();
  }, [fetchGallery]);

  useEffect(() => {
    fetchGallery();

    const handleGalleryUpdate = () => {
      const cached = memoryGallery ?? getLocalGallery();
      if (cached) setState({ data: cached, loading: false, error: null });
    };

    window.addEventListener('pk_gallery_changed', handleGalleryUpdate);

    const handleBroadcast = (e: MessageEvent) => {
      if (e.data?.type === 'GALLERY_CHANGED') {
        const cached = memoryGallery ?? getLocalGallery();
        if (cached) setState({ data: cached, loading: false, error: null });
        invalidateCache('sb:gallery');
        fetchGallery();
      }
    };
    syncBroadcastChannel?.addEventListener('message', handleBroadcast);

    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel('realtime-gallery')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'gallery' }, () => {
          invalidateCache('sb:gallery');
          fetchGallery();
        })
        .subscribe();
    } catch {
      channel = null;
    }

    const pollInterval = window.setInterval(() => {
      fetchGallery();
    }, 30_000);

    return () => {
      window.clearInterval(pollInterval);
      window.removeEventListener('pk_gallery_changed', handleGalleryUpdate);
      syncBroadcastChannel?.removeEventListener('message', handleBroadcast);
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch {
          /* ignore */
        }
      }
    };
  }, [fetchGallery]);

  return { ...state, refetch };
}

// ----------------------------------------------------
// 4. REVIEWS HOOK (CUSTOMER FACING)
// ----------------------------------------------------
export function useReviews() {
  const [state, setState] = useState<AsyncState<Review[]>>({
    data: INITIAL_PINNED_REVIEWS,
    loading: false,
    error: null,
  });

  const fetchReviews = useCallback(async () => {
    try {
      const deletedIds = getDeletedReviewIds();

      // 1. Fetch approved from Supabase
      const { data: supabaseFeedback } = await withTimeout(() =>
        supabase
          .from('feedback')
          .select('*')
          .eq('approved', true)
          .order('created_at', { ascending: false })
      ).catch(() => ({ data: null }));

      // 2. Read local approved feedback
      const localFeedback = getLocalFeedbackList().filter((f) => f.approved);

      const approvedReviews: Review[] = [];

      if (supabaseFeedback && supabaseFeedback.length > 0) {
        supabaseFeedback.forEach((f, i) => {
          if (!deletedIds.has(f.id)) {
            approvedReviews.push({
              id: f.id,
              rating: f.overall_rating,
              message: f.message || 'Delicious fresh Kachori and great taste!',
              customer_name: f.customer_name || 'Verified Customer',
              display_order: i + 1,
              created_at: f.created_at,
              source: 'verified',
            });
          }
        });
      }

      localFeedback.forEach((f, i) => {
        if (!deletedIds.has(f.id) && !approvedReviews.some((r) => r.id === f.id)) {
          approvedReviews.push({
            id: f.id,
            rating: f.overall_rating,
            message: f.message || 'Delicious fresh Kachori and great taste!',
            customer_name: f.customer_name || 'Verified Customer',
            display_order: i + 1,
            created_at: f.created_at,
            source: 'verified',
          });
        }
      });

      const seenIds = new Set<string>();
      const merged: Review[] = [];

      // Requirement #4: First Justdial reviews are shown
      INITIAL_PINNED_REVIEWS.forEach((r) => {
        if (!deletedIds.has(r.id) && !seenIds.has(r.id)) {
          seenIds.add(r.id);
          merged.push({ ...r, source: 'justdial' });
        }
      });

      // Requirement #4: After that, verified reviews are shown
      approvedReviews.forEach((r) => {
        if (!deletedIds.has(r.id) && !seenIds.has(r.id)) {
          seenIds.add(r.id);
          merged.push({ ...r, source: 'verified' });
        }
      });

      setState({ data: merged, loading: false, error: null });
    } catch (err) {
      const deletedIds = getDeletedReviewIds();
      const filteredPinned = INITIAL_PINNED_REVIEWS.filter((r) => !deletedIds.has(r.id));
      setState({
        data: filteredPinned,
        loading: false,
        error: toErrMsg(err, 'Unable to load reviews.'),
      });
    }
  }, []);

  const refetch = useCallback(() => {
    invalidateCache('sb:reviews');
    return fetchReviews();
  }, [fetchReviews]);

  useEffect(() => {
    fetchReviews();

    const handleReviewsChange = () => {
      invalidateCache('sb:reviews');
      fetchReviews();
    };
    window.addEventListener('pk_reviews_changed', handleReviewsChange);

    const handleBroadcast = (e: MessageEvent) => {
      if (
        e.data?.type === 'NEW_FEEDBACK_SUBMITTED' ||
        e.data?.type === 'REVIEW_APPROVED_TOGGLED' ||
        e.data?.type === 'REVIEW_DELETED'
      ) {
        invalidateCache('sb:reviews');
        fetchReviews();
      }
    };
    syncBroadcastChannel?.addEventListener('message', handleBroadcast);

    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel('realtime-reviews-customer')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'feedback' }, () => {
          invalidateCache('sb:reviews');
          fetchReviews();
        })
        .subscribe();
    } catch {
      channel = null;
    }

    // 30-second periodic sync for real-time reviews across all users
    const pollInterval = window.setInterval(() => {
      fetchReviews();
    }, 30_000);

    return () => {
      window.clearInterval(pollInterval);
      window.removeEventListener('pk_reviews_changed', handleReviewsChange);
      syncBroadcastChannel?.removeEventListener('message', handleBroadcast);
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch {
          /* ignore */
        }
      }
    };
  }, [fetchReviews]);

  return { ...state, refetch };
}

// ----------------------------------------------------
// 5. ALL CUSTOMER FEEDBACK HOOK (AUTHOR PANEL)
// ----------------------------------------------------
export function useFeedbackList() {
  const [state, setState] = useState<AsyncState<Feedback[]>>(() => {
    const local = getLocalFeedbackList();
    const deleted = getDeletedReviewIds();
    const filtered = local.filter((f) => !deleted.has(f.id));
    return { data: filtered.length > 0 ? filtered : null, loading: filtered.length === 0, error: null };
  });

  const fetchFeedback = useCallback(async () => {
    try {
      const deletedIds = getDeletedReviewIds();

      // Fetch from Supabase
      const { data: remoteData, error: remoteError } = await withTimeout(() =>
        supabase
          .from('feedback')
          .select('*')
          .order('created_at', { ascending: false })
      ).catch(() => ({ data: null, error: null }));

      const localData = getLocalFeedbackList();

      const combinedMap = new Map<string, Feedback>();

      if (remoteData && remoteData.length > 0) {
        remoteData.forEach((item: Feedback) => {
          if (!deletedIds.has(item.id)) {
            combinedMap.set(item.id, item);
          }
        });
      }

      localData.forEach((item) => {
        if (!deletedIds.has(item.id)) {
          if (!combinedMap.has(item.id)) {
            combinedMap.set(item.id, item);
          } else {
            // Keep latest approved status
            const existing = combinedMap.get(item.id)!;
            combinedMap.set(item.id, { ...existing, ...item });
          }
        }
      });

      const list = Array.from(combinedMap.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      saveLocalFeedbackList(list);
      setState({ data: list, loading: false, error: null });
    } catch (err) {
      const localData = getLocalFeedbackList();
      const deletedIds = getDeletedReviewIds();
      const filtered = localData.filter((f) => !deletedIds.has(f.id));
      setState({
        data: filtered,
        loading: false,
        error: toErrMsg(err, 'Failed to load feedback'),
      });
    }
  }, []);

  const refetch = useCallback(() => fetchFeedback(), [fetchFeedback]);

  useEffect(() => {
    fetchFeedback();

    const handleReviewsChange = () => {
      fetchFeedback();
    };
    window.addEventListener('pk_reviews_changed', handleReviewsChange);

    const handleBroadcast = (e: MessageEvent) => {
      if (
        e.data?.type === 'NEW_FEEDBACK_SUBMITTED' ||
        e.data?.type === 'REVIEW_APPROVED_TOGGLED' ||
        e.data?.type === 'REVIEW_DELETED'
      ) {
        fetchFeedback();
      }
    };
    syncBroadcastChannel?.addEventListener('message', handleBroadcast);

    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel('realtime-feedback-admin-panel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'feedback' }, () => {
          fetchFeedback();
        })
        .subscribe();
    } catch {
      channel = null;
    }

    // 30-second periodic sync for admin panel
    const pollInterval = window.setInterval(() => {
      fetchFeedback();
    }, 30_000);

    return () => {
      window.clearInterval(pollInterval);
      window.removeEventListener('pk_reviews_changed', handleReviewsChange);
      syncBroadcastChannel?.removeEventListener('message', handleBroadcast);
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch {
          /* ignore */
        }
      }
    };
  }, [fetchFeedback]);

  return { ...state, refetch };
}

// ----------------------------------------------------
// 6. PAGE INITIAL LOAD COORDINATOR
// ----------------------------------------------------
export function useInitialPageLoad(deps: Array<{ loading: boolean; error: string | null }>) {
  const readyRef = useRef(false);
  const allDone = deps.every((d) => !d.loading);
  const hasError = deps.some((d) => d.error);
  const [initialLoadComplete, setInitialLoadComplete] = useState<boolean>(() => {
    return deps.length === 0 || allDone;
  });

  useEffect(() => {
    if (readyRef.current) return;
    if (allDone || hasError) {
      readyRef.current = true;
      setInitialLoadComplete(true);
      return;
    }
    const timeoutId = window.setTimeout(() => {
      readyRef.current = true;
      setInitialLoadComplete(true);
    }, 400);
    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [allDone, hasError, deps.length]);

  return initialLoadComplete;
}

// ----------------------------------------------------
// 7. SUBMIT FEEDBACK ACTION
// ----------------------------------------------------
export type FeedbackPayload = {
  overall_rating: number;
  food_rating: number;
  service_rating: number;
  cleanliness_rating: number;
  message: string;
  customer_name: string;
};

export async function submitFeedback(payload: FeedbackPayload): Promise<{ success: boolean; error?: string }> {
  const overallRating = Number(payload.overall_rating);
  const message = payload.message.trim();

  if (!Number.isInteger(overallRating) || overallRating < 1 || overallRating > 5) {
    return { success: false, error: 'Please choose an overall rating from 1 to 5 stars.' };
  }
  if (message.length < 5) {
    return { success: false, error: 'Please share at least a few words of feedback.' };
  }

  const customerName = payload.customer_name.trim() || 'Anonymous Customer';
  const newId = `fb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const nowIso = new Date().toISOString();

  const newRecord: Feedback = {
    id: newId,
    overall_rating: overallRating,
    food_rating: payload.food_rating || null,
    service_rating: payload.service_rating || null,
    cleanliness_rating: payload.cleanliness_rating || null,
    message,
    customer_name: customerName,
    approved: false,
    created_at: nowIso,
  };

  // 1. Immediately store in local feedback records for instantaneous display
  try {
    const current = getLocalFeedbackList();
    const updated = [newRecord, ...current.filter((f) => f.id !== newId)];
    saveLocalFeedbackList(updated);
  } catch {
    /* ignore */
  }

  // 2. Insert into Supabase
  try {
    const { data: inserted, error: sbError } = await withTimeout(() =>
      supabase.from('feedback').insert({
        overall_rating: overallRating,
        food_rating: payload.food_rating || null,
        service_rating: payload.service_rating || null,
        cleanliness_rating: payload.cleanliness_rating || null,
        message,
        customer_name: customerName,
        approved: false,
      }).select().maybeSingle()
    );

    if (sbError) {
      console.warn('Supabase feedback insert notice:', sbError.message);
    } else if (inserted && inserted.id) {
      // Update local storage ID to match Supabase database ID for future admin edits
      newRecord.id = inserted.id;
      try {
        const current = getLocalFeedbackList();
        const updated = current.map((f) => (f.id === newId ? { ...f, id: inserted.id } : f));
        saveLocalFeedbackList(updated);
      } catch {
        /* ignore */
      }
    }
  } catch (err) {
    console.warn('Supabase feedback insert notice:', err);
  }

  // 3. Send to Google Sheets webhook in real-time
  void sendFeedbackToGoogleSheet({
    record_id: newRecord.id,
    customer_name: customerName,
    overall_rating: overallRating,
    food_rating: payload.food_rating,
    service_rating: payload.service_rating,
    cleanliness_rating: payload.cleanliness_rating,
    message,
  });

  // 4. Broadcast real-time events across all tabs/windows
  invalidateCache('sb:reviews');
  broadcastRealtimeEvent('NEW_FEEDBACK_SUBMITTED', newRecord);
  window.dispatchEvent(new Event('pk_reviews_changed'));

  return { success: true };
}

// ----------------------------------------------------
// 8. AUTHOR ACTIONS: STORE STATUS
// ----------------------------------------------------
export async function updateStoreStatus(status: {
  is_open: boolean;
  crowd_level: string;
  closed_for_date?: string | null;
  force_open_date?: string | null;
  override_mode?: 'force_open' | 'force_close' | null;
}): Promise<{ success: boolean; error?: string }> {
  const timestamp = new Date().toISOString();
  const metaObj = {
    closed_for_date: status.closed_for_date ?? null,
    force_open_date: status.force_open_date ?? null,
    override_mode:
      status.override_mode ??
      (status.force_open_date ? 'force_open' : status.closed_for_date ? 'force_close' : null),
    updated_at: timestamp,
  };

  const newStatus: StoreStatus = {
    id: 'store_status_main',
    is_open: status.is_open,
    crowd_level: status.crowd_level,
    last_updated: timestamp,
    closed_for_date: status.closed_for_date ?? null,
    force_open_date: status.force_open_date ?? null,
    override_mode: metaObj.override_mode,
    updated_by: JSON.stringify(metaObj),
  };

  // 1. Immediately persist locally and broadcast so UI and all open tabs respond instantaneously
  try {
    localStorage.setItem(STORAGE_STATUS_KEY, JSON.stringify(newStatus));
  } catch {
    /* ignore */
  }

  invalidateCache('sb:store_status');
  broadcastRealtimeEvent('STORE_STATUS_CHANGED', newStatus);
  window.dispatchEvent(new Event('pk_store_status_changed'));

  // 2. Best-effort background remote sync to Supabase
  try {
    const { data: existing } = await withTimeout(() =>
      supabase.from('store_status').select('id').limit(1).maybeSingle()
    );

    const fullPayload: Record<string, unknown> = {
      is_open: status.is_open,
      crowd_level: status.crowd_level,
      last_updated: newStatus.last_updated,
      closed_for_date: newStatus.closed_for_date,
      force_open_date: newStatus.force_open_date,
      updated_by: newStatus.updated_by,
    };

    if (existing && existing.id) {
      let { error } = await withTimeout(() =>
        supabase.from('store_status').update(fullPayload).eq('id', existing.id)
      );

      // If columns don't exist in Supabase yet (PostgREST code 42703), fallback to standard columns
      if (error && (error.code === '42703' || error.message?.includes('column'))) {
        const fallbackPayload = {
          is_open: status.is_open,
          crowd_level: status.crowd_level,
          last_updated: newStatus.last_updated,
          updated_by: newStatus.updated_by,
        };
        const res = await withTimeout(() =>
          supabase.from('store_status').update(fallbackPayload).eq('id', existing.id)
        );
        error = res.error;
      }
      if (error) console.warn('Supabase remote status sync note:', error.message);
    } else {
      let { error } = await withTimeout(() =>
        supabase.from('store_status').insert(fullPayload)
      );
      if (error && (error.code === '42703' || error.message?.includes('column'))) {
        const fallbackPayload = {
          is_open: status.is_open,
          crowd_level: status.crowd_level,
          last_updated: newStatus.last_updated,
          updated_by: newStatus.updated_by,
        };
        const res = await withTimeout(() =>
          supabase.from('store_status').insert(fallbackPayload)
        );
        error = res.error;
      }
      if (error) console.warn('Supabase remote status insert note:', error.message);
    }
  } catch (err) {
    console.warn('Supabase remote status update notice (offline/RLS):', err);
  }

  return { success: true };
}

// ----------------------------------------------------
// 9. AUTHOR ACTIONS: PRODUCT UPDATES
// ----------------------------------------------------
export async function updateProduct(
  productIdOrSlug: string,
  updates: Partial<Product>,
  explicitSlug?: string
): Promise<{ success: boolean; error?: string; remoteSync?: boolean }> {
  const timestamp = new Date().toISOString();
  let updatedProduct: Product | undefined;

  try {
    const targetSlug = explicitSlug || productIdOrSlug;
    const currentProducts = getLocalProducts() ?? DEFAULT_PRODUCTS;
    let found = false;

    const updated = currentProducts.map((p) => {
      const isMatch =
        p.id === productIdOrSlug ||
        p.slug === targetSlug ||
        (explicitSlug && p.slug === explicitSlug) ||
        p.slug === productIdOrSlug;

      if (isMatch) {
        found = true;
        updatedProduct = { ...p, ...updates, updated_at: timestamp };
        return updatedProduct;
      }
      return p;
    });

    if (!found) {
      const defaultMatch = DEFAULT_PRODUCTS.find(
        (d) => d.slug === targetSlug || d.id === productIdOrSlug || (explicitSlug && d.slug === explicitSlug)
      );
      if (defaultMatch) {
        updatedProduct = { ...defaultMatch, ...updates, updated_at: timestamp };
        updated.push(updatedProduct);
      }
    }

    memoryProducts = updated;
    try {
      localStorage.setItem(STORAGE_PRODUCTS_KEY, JSON.stringify(updated));
    } catch {
      /* ignore */
    }
    void idbSet(STORAGE_PRODUCTS_KEY, updated);
  } catch {
    /* ignore */
  }

  invalidateCache('sb:products');
  broadcastRealtimeEvent('PRODUCTS_CHANGED', {
    productId: productIdOrSlug,
    slug: explicitSlug || updatedProduct?.slug,
    updates,
    updatedProduct,
    timestamp,
  });
  window.dispatchEvent(new Event('pk_products_changed'));

  // Non-blocking background remote sync to Supabase (keeps UI instantaneous)
  void (async () => {
    try {
      const slugToUpdate = explicitSlug || updatedProduct?.slug || productIdOrSlug;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productIdOrSlug);

      const payload = {
        ...updates,
        updated_at: timestamp,
      };

      let remoteSync = false;
      // 1. If valid UUID, attempt update by primary key id
      if (isUuid) {
        const { data, error } = await withTimeout(() =>
          supabase
            .from('products')
            .update(payload)
            .eq('id', productIdOrSlug)
            .select(),
          2000
        );
        if (!error && data && data.length > 0) {
          remoteSync = true;
        }
      }

      // 2. If not UUID or not matched yet, update by slug
      if (!remoteSync && slugToUpdate) {
        const { data, error } = await withTimeout(() =>
          supabase
            .from('products')
            .update(payload)
            .eq('slug', slugToUpdate)
            .select(),
          2000
        );
        if (!error && data && data.length > 0) {
          remoteSync = true;
        }
      }
    } catch (err) {
      console.warn('Remote sync product notice (offline/RLS):', err);
    }
  })();

  return { success: true, remoteSync: true };
}

export async function addProduct(
  productData: Omit<Product, 'id'> & { id?: string }
): Promise<{ success: boolean; data?: Product; error?: string }> {
  const timestamp = new Date().toISOString();
  const slug =
    productData.slug?.trim() ||
    productData.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') ||
    `item-${Date.now()}`;

  const currentProducts = memoryProducts ?? getLocalProducts() ?? DEFAULT_PRODUCTS;
  const newId = productData.id || `prod_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  const newProduct: Product = {
    id: newId,
    slug,
    name: productData.name.trim(),
    price: Number(productData.price) || 40,
    description: productData.description?.trim() || '',
    image_url: productData.image_url || '/images/kachori.webp',
    available: productData.available !== undefined ? productData.available : true,
    stock: productData.stock !== undefined ? productData.stock : 50,
    featured: Boolean(productData.featured),
    display_order: productData.display_order ?? currentProducts.length + 1,
    updated_at: timestamp,
  };

  const updatedList = [...currentProducts, newProduct];
  memoryProducts = updatedList;

  try {
    localStorage.setItem(STORAGE_PRODUCTS_KEY, JSON.stringify(updatedList));
  } catch {
    /* ignore */
  }
  void idbSet(STORAGE_PRODUCTS_KEY, updatedList);

  invalidateCache('sb:products');
  broadcastRealtimeEvent('PRODUCTS_CHANGED', {
    productId: newId,
    slug,
    newProduct,
    timestamp,
  });
  window.dispatchEvent(new Event('pk_products_changed'));

  void (async () => {
    try {
      const { data, error } = await withTimeout(() =>
        supabase
          .from('products')
          .insert({
            slug: newProduct.slug,
            name: newProduct.name,
            price: newProduct.price,
            description: newProduct.description,
            image_url: newProduct.image_url,
            available: newProduct.available,
            stock: newProduct.stock,
            featured: newProduct.featured,
            display_order: newProduct.display_order,
          })
          .select()
          .maybeSingle(),
        2500
      );
      if (!error && data?.id) {
        newProduct.id = data.id;
      }
    } catch (err) {
      console.warn('Supabase product insert notice:', err);
    }
  })();

  return { success: true, data: newProduct };
}

export async function deleteProduct(
  productIdOrSlug: string
): Promise<{ success: boolean; error?: string }> {
  const timestamp = new Date().toISOString();
  try {
    const currentProducts = memoryProducts ?? getLocalProducts() ?? DEFAULT_PRODUCTS;
    const updated = currentProducts.filter(
      (p) => p.id !== productIdOrSlug && p.slug !== productIdOrSlug
    );
    memoryProducts = updated;
    try {
      localStorage.setItem(STORAGE_PRODUCTS_KEY, JSON.stringify(updated));
    } catch {
      /* ignore */
    }
    await idbSet(STORAGE_PRODUCTS_KEY, updated);
  } catch {
    /* ignore */
  }

  invalidateCache('sb:products');
  broadcastRealtimeEvent('PRODUCTS_CHANGED', {
    productId: productIdOrSlug,
    action: 'deleted',
    timestamp,
  });
  window.dispatchEvent(new Event('pk_products_changed'));

  void (async () => {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productIdOrSlug);
      if (isUuid) {
        await withTimeout(() => supabase.from('products').delete().eq('id', productIdOrSlug), 2000);
      } else {
        await withTimeout(() => supabase.from('products').delete().eq('slug', productIdOrSlug), 2000);
      }
    } catch (err) {
      console.warn('Remote sync delete product notice:', err);
    }
  })();

  return { success: true };
}

// ----------------------------------------------------
// 10. AUTHOR ACTIONS: GALLERY MANAGEMENT
// ----------------------------------------------------
export async function addGalleryImage(
  image: Omit<GalleryImage, 'id'>
): Promise<{ success: boolean; data?: GalleryImage; error?: string }> {
  const newId = `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const normalized = normalizeGalleryItem({
    id: newId,
    src: image.src,
    alt: image.alt || 'Paras Kachoriwala Media',
    category: image.category || 'food',
    media_type: image.media_type,
    caption: image.caption || '',
    display_order: image.display_order ?? 99,
    created_at: new Date().toISOString(),
  });

  const current = memoryGallery ?? getLocalGallery() ?? DEFAULT_GALLERY_IMAGES;
  const updated = [normalized, ...current];
  memoryGallery = updated;

  try {
    localStorage.setItem(STORAGE_GALLERY_KEY, JSON.stringify(updated));
  } catch {
    /* ignore */
  }
  await idbSet(STORAGE_GALLERY_KEY, updated);

  invalidateCache('sb:gallery');
  broadcastRealtimeEvent('GALLERY_CHANGED');
  window.dispatchEvent(new Event('pk_gallery_changed'));

  try {
    const { data, error } = await withTimeout(() =>
      supabase
        .from('gallery')
        .insert({
          src: normalized.src,
          alt: normalized.alt,
          category: normalized.category,
          caption: normalized.caption,
          display_order: normalized.display_order,
        })
        .select()
        .maybeSingle(),
      2500
    );

    if (error) {
      console.warn('Supabase gallery insert notice:', error.message);
    }
    if (data) {
      normalized.id = data.id;
    }
  } catch (err) {
    console.warn('Supabase gallery sync notice:', err);
  }

  return { success: true, data: normalized };
}

export async function updateGalleryImage(
  id: string,
  updates: Partial<GalleryImage>
): Promise<{ success: boolean; error?: string }> {
  const current = memoryGallery ?? getLocalGallery() ?? DEFAULT_GALLERY_IMAGES;
  const updated = current.map((img) => (img.id === id ? { ...img, ...updates } : img));
  memoryGallery = updated;

  try {
    localStorage.setItem(STORAGE_GALLERY_KEY, JSON.stringify(updated));
  } catch {
    /* ignore */
  }
  await idbSet(STORAGE_GALLERY_KEY, updated);

  invalidateCache('sb:gallery');
  broadcastRealtimeEvent('GALLERY_CHANGED');
  window.dispatchEvent(new Event('pk_gallery_changed'));

  try {
    await withTimeout(() => supabase.from('gallery').update(updates).eq('id', id));
  } catch (err) {
    console.warn('Gallery update notice:', err);
  }

  return { success: true };
}

export async function deleteGalleryImage(id: string): Promise<{ success: boolean; error?: string }> {
  const current = memoryGallery ?? getLocalGallery() ?? DEFAULT_GALLERY_IMAGES;
  const updated = current.filter((img) => img.id !== id);
  memoryGallery = updated;

  try {
    localStorage.setItem(STORAGE_GALLERY_KEY, JSON.stringify(updated));
  } catch {
    /* ignore */
  }
  await idbSet(STORAGE_GALLERY_KEY, updated);

  invalidateCache('sb:gallery');
  broadcastRealtimeEvent('GALLERY_CHANGED');
  window.dispatchEvent(new Event('pk_gallery_changed'));

  try {
    await withTimeout(() => supabase.from('gallery').delete().eq('id', id));
  } catch (err) {
    console.warn('Gallery delete notice:', err);
  }

  return { success: true };
}

// ----------------------------------------------------
// 11. AUTHOR ACTIONS: FEEDBACK / REVIEWS MANAGEMENT
// ----------------------------------------------------
export async function toggleApproveFeedback(
  id: string,
  approved: boolean
): Promise<{ success: boolean; error?: string }> {
  // 1. Update in local storage list
  try {
    const list = getLocalFeedbackList();
    const updated = list.map((f) => (f.id === id ? { ...f, approved } : f));
    saveLocalFeedbackList(updated);
  } catch {
    /* ignore */
  }

  // 2. Broadcast immediately
  invalidateCache('sb:reviews');
  broadcastRealtimeEvent('REVIEW_APPROVED_TOGGLED', { id, approved });
  window.dispatchEvent(new Event('pk_reviews_changed'));

  // 3. Update Supabase
  try {
    const { error } = await withTimeout(() =>
      supabase.from('feedback').update({ approved }).eq('id', id)
    );
    if (error) {
      console.warn('Supabase toggle feedback notice:', error.message);
    }
  } catch (err) {
    console.warn('Supabase toggle feedback notice:', err);
  }

  return { success: true };
}

export async function deleteFeedback(feedbackId: string): Promise<{ success: boolean; error?: string }> {
  // 1. Permanently mark deleted locally
  markReviewDeleted(feedbackId);

  // 2. Remove from local feedback records
  try {
    const list = getLocalFeedbackList();
    const updated = list.filter((f) => f.id !== feedbackId);
    saveLocalFeedbackList(updated);
  } catch {
    /* ignore */
  }

  // 3. Broadcast deletion immediately across tabs & window
  invalidateCache('sb:reviews');
  broadcastRealtimeEvent('REVIEW_DELETED', { id: feedbackId });
  window.dispatchEvent(new Event('pk_reviews_changed'));

  // 4. Delete from Supabase
  try {
    const { error } = await withTimeout(() =>
      supabase.from('feedback').delete().eq('id', feedbackId)
    );
    if (error) {
      console.warn('Supabase delete feedback notice:', error.message);
    }
  } catch (err) {
    console.warn('Supabase delete feedback notice:', err);
  }

  return { success: true };
}
