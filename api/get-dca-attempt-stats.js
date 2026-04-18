import { supabase } from "../lib/supabase.js";


export default async function handler(req, res) {
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    
    const params = req.method === 'GET' ? req.query : req.body;
    const { password, buyer, token, days = 30 } = params;

    
    const VISUALIZER_PASSWORD = process.env.VISUALIZER_PASSWORD || 'your-secure-password';
    if (password !== VISUALIZER_PASSWORD) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const daysBack = parseInt(days) || 30;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    
    let query = supabase
      .from('dca_attempt_tracking')
      .select('*')
      .gte('attempt_timestamp', cutoffDate.toISOString())
      .order('attempt_timestamp', { ascending: false });

    
    if (buyer) {
      query = query.eq('buyer_address', buyer.toLowerCase());
    }
    if (token) {
      query = query.eq('destination_token', token.toLowerCase());
    }

    const { data: attempts, error } = await query;

    if (error) {
      console.error('[get-dca-attempt-stats] Query error:', error);
      return res.status(500).json({ error: error.message });
    }

    
    const totalAttempts = attempts.length;
    const successfulAttempts = attempts.filter(a => a.success).length;
    const failedAttempts = attempts.filter(a => !a.success).length;
    const successRate = totalAttempts > 0 ? ((successfulAttempts / totalAttempts) * 100).toFixed(2) : 0;

    
    const retriedAttempts = attempts.filter(a => a.retry_count > 0);
    const retriedSuccess = retriedAttempts.filter(a => a.success).length;
    const retriedFailed = retriedAttempts.filter(a => !a.success).length;

    
    const byBuyerToken = {};
    attempts.forEach(attempt => {
      const key = `${attempt.buyer_address}:${attempt.destination_token}`;
      if (!byBuyerToken[key]) {
        byBuyerToken[key] = {
          buyer: attempt.buyer_address,
          sourceToken: attempt.source_token,
          destinationToken: attempt.destination_token,
          totalAttempts: 0,
          successful: 0,
          failed: 0,
          successRate: 0,
          lastAttempt: attempt.attempt_timestamp,
          avgPriceImpact: null
        };
      }
      byBuyerToken[key].totalAttempts++;
      if (attempt.success) {
        byBuyerToken[key].successful++;
      } else {
        byBuyerToken[key].failed++;
      }
    });

    
    const buyerTokenStats = Object.values(byBuyerToken).map(stat => {
      stat.successRate = stat.totalAttempts > 0
        ? ((stat.successful / stat.totalAttempts) * 100).toFixed(2)
        : 0;

      
      const successfulWithImpact = attempts.filter(a =>
        a.buyer_address === stat.buyer &&
        a.destination_token === stat.destinationToken &&
        a.success &&
        a.price_impact !== null
      );

      if (successfulWithImpact.length > 0) {
        const totalImpact = successfulWithImpact.reduce((sum, a) => sum + parseFloat(a.price_impact), 0);
        stat.avgPriceImpact = (totalImpact / successfulWithImpact.length).toFixed(4);
      }

      return stat;
    }).sort((a, b) => b.totalAttempts - a.totalAttempts);

    
    const dailyStats = {};
    attempts.forEach(attempt => {
      const date = attempt.attempt_timestamp.split('T')[0];
      if (!dailyStats[date]) {
        dailyStats[date] = {
          date,
          total: 0,
          successful: 0,
          failed: 0,
          successRate: 0
        };
      }
      dailyStats[date].total++;
      if (attempt.success) {
        dailyStats[date].successful++;
      } else {
        dailyStats[date].failed++;
      }
    });

    
    const dailyTimeline = Object.values(dailyStats).map(day => {
      day.successRate = day.total > 0 ? ((day.successful / day.total) * 100).toFixed(2) : 0;
      return day;
    }).sort((a, b) => a.date.localeCompare(b.date));

    
    const errorStats = {};
    attempts.filter(a => !a.success && a.error_message).forEach(attempt => {
      const msg = attempt.error_message;
      if (!errorStats[msg]) {
        errorStats[msg] = {
          message: msg,
          count: 0,
          affectedBuyers: new Set(),
          lastOccurrence: attempt.attempt_timestamp
        };
      }
      errorStats[msg].count++;
      errorStats[msg].affectedBuyers.add(attempt.buyer_address);
    });

    const topErrors = Object.values(errorStats).map(stat => ({
      message: stat.message,
      count: stat.count,
      affectedBuyers: stat.affectedBuyers.size,
      lastOccurrence: stat.lastOccurrence
    })).sort((a, b) => b.count - a.count).slice(0, 10);

    
    const routerStats = {};
    attempts.filter(a => a.success && a.router_used).forEach(attempt => {
      const router = attempt.router_used;
      routerStats[router] = (routerStats[router] || 0) + 1;
    });

    
    return res.status(200).json({
      success: true,
      data: {
        overview: {
          totalAttempts,
          successfulAttempts,
          failedAttempts,
          successRate: parseFloat(successRate),
          retriedAttempts: retriedAttempts.length,
          retriedSuccess,
          retriedFailed,
          retrySuccessRate: retriedAttempts.length > 0
            ? ((retriedSuccess / retriedAttempts.length) * 100).toFixed(2)
            : 0,
          daysAnalyzed: daysBack
        },
        buyerTokenStats,
        dailyTimeline,
        topErrors,
        routerStats,
        recentAttempts: attempts.slice(0, 50).map(a => ({
          buyer: a.buyer_address,
          sourceToken: a.source_token,
          destinationToken: a.destination_token,
          success: a.success,
          errorMessage: a.error_message,
          timestamp: a.attempt_timestamp,
          retryCount: a.retry_count,
          txHash: a.transaction_hash,
          priceImpact: a.price_impact,
          router: a.router_used
        }))
      }
    });

  } catch (error) {
    console.error('[get-dca-attempt-stats] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
