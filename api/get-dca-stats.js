import { supabase } from '../lib/supabase.js';

const statsCache = new Map();
const CACHE_TTL = 60 * 1000;


export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { source, destination } = req.query;

  if (!source || !destination) {
    return res.status(400).json({ error: 'Missing source or destination parameter' });
  }

  const sourceToken = source.toLowerCase();
  const destinationToken = destination.toLowerCase();
  const cacheKey = `${sourceToken}-${destinationToken}`;

  const cached = statsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return res.status(200).json({
      ...cached.data,
      cached: true,
      cacheAge: Math.floor((Date.now() - cached.timestamp) / 1000)
    });
  }

  try {
    const { data, error } = await supabase
      .from('dca_pair_stats')
      .select('*')
      .eq('source_token', sourceToken)
      .eq('destination_token', destinationToken)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        const emptyStats = {
          source_token: sourceToken,
          destination_token: destinationToken,
          volume_registered: '0',
          volume_executed: '0',
          purchase_count: 0
        };

        statsCache.set(cacheKey, {
          data: emptyStats,
          timestamp: Date.now()
        });

        return res.status(200).json(emptyStats);
      }

      throw error;
    }

    const formattedStats = {
      source_token: data.source_token,
      destination_token: data.destination_token,
      volume_registered: data.volume_registered,
      volume_executed: data.volume_executed,
      purchase_count: data.purchase_count,
      created_at: data.created_at,
      updated_at: data.updated_at
    };

    statsCache.set(cacheKey, {
      data: formattedStats,
      timestamp: Date.now()
    });

    return res.status(200).json(formattedStats);

  } catch (err) {
    console.error('[STATS] Error fetching stats:', err.message);
    return res.status(500).json({ error: 'Failed to fetch stats' });
  }
}


export async function getAllStats() {
  try {
    const { data, error } = await supabase
      .from('dca_pair_stats')
      .select('*')
      .order('volume_executed', { ascending: false });

    if (error) throw error;

    return data;
  } catch (err) {
    console.error('[STATS] Error fetching all stats:', err.message);
    throw err;
  }
}


export function clearStatsCache() {
  statsCache.clear();
}
