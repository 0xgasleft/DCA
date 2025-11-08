import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;


let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
} else {
  console.warn('[CACHE] Supabase not configured - using memory-only cache');
}

const memoryCache = new Map();

export async function getCachedEvents(buyerAddress, tableName = 'purchase_history_cache') {
  const key = buyerAddress.toLowerCase();

  if (memoryCache.has(key)) {
    return memoryCache.get(key);
  }

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('events, last_queried_block')
        .eq('buyer_address', key)
        .single();

      if (!error && data) {
        const cached = {
          events: data.events,
          lastQueriedBlock: data.last_queried_block
        };

        memoryCache.set(key, cached);
        return cached;
      }
    } catch (err) {
      console.error(`[CACHE ERROR] L2 read failed for ${key}:`, err.message);
    }
  }

  return null;
}


export async function updateCachedEvents(buyerAddress, tableName, events, lastBlock) {
  const key = buyerAddress.toLowerCase();
  const cached = {
    events,
    lastQueriedBlock: lastBlock
  };

  memoryCache.set(key, cached);

  if (supabase) {
    try {
      await supabase
        .from(tableName)
        .upsert({
          buyer_address: key,
          events: events,
          last_queried_block: lastBlock,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'buyer_address'
        });
    } catch (err) {
      console.error(`[CACHE ERROR] L2 write failed for ${key}:`, err.message);
    }
  }
}

export function clearMemoryCache() {
  memoryCache.clear();
}
