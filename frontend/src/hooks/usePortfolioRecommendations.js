import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/client';

const DEFAULT_POLL_MS = 20000;
const INITIAL_DELAY_MS = 3000;

/** Map Concierge recommendations to per-cap_id chips for the portfolio table. */
export function indexRecommendationsByCap(recommendations = []) {
  const byCap = {};
  const sorted = [...recommendations].sort((a, b) => {
    const rankA = a.rank ?? 99;
    const rankB = b.rank ?? 99;
    if (rankA !== rankB) return rankA - rankB;
    return (b.reliability_score || 0) - (a.reliability_score || 0);
  });
  for (const rec of sorted) {
    const cap = rec.cap_id;
    if (!cap || byCap[cap]) continue;
    byCap[cap] = rec;
  }
  return byCap;
}

export function chipClassForRecommendation(rec) {
  if (!rec) return 'mut';
  const action = `${rec.action || ''} ${rec.rationale || ''}`.toLowerCase();
  if (/surplus|lend|donor|cross-util|redistribute|hold|on plan|balanced/.test(action)) return 'pos';
  if (/short|critical|under|deficit|raise|hire|overtime|ot |drift|gap|roster|revise|lower/.test(action)) {
    return 'neg';
  }
  if (rec.domain === 'wfm' && rec.reliability_score >= 0.7) return 'neg';
  return 'mut';
}

export function chipTextForRecommendation(rec) {
  if (!rec) return null;
  const action = (rec.action || '').trim();
  const rationale = (rec.rationale || '').trim();
  if (action && rationale && action !== rationale) return `${action} — ${rationale}`;
  return action || rationale || null;
}

/**
 * Poll Concierge + portfolio analysis for per-plan recommendation pills.
 */
export function usePortfolioRecommendations({ enabled = true, capIds = [] } = {}) {
  const [byCap, setByCap] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);
  const activeRef = useRef(false);
  const capSet = useMemo(() => new Set(capIds), [capIds.join('|')]);

  const refresh = useCallback(async () => {
    if (!enabled || activeRef.current) return;
    activeRef.current = true;
    setLoading(true);
    try {
      const [conciergeData, analysisData] = await Promise.all([
        api.conciergeRecommendations(200),
        api.portfolioAnalysis().catch(() => null),
      ]);

      const byCapNext = indexRecommendationsByCap(
        (conciergeData?.recommendations || []).filter((r) => !capSet.size || capSet.has(r.cap_id)),
      );

      for (const row of analysisData?.recommendations || []) {
        const cap = row.cap_id;
        if (!cap || byCapNext[cap]) continue;
        if (capSet.size && !capSet.has(cap)) continue;
        byCapNext[cap] = {
          id: `analysis-${cap}`,
          cap_id: cap,
          action: row.why,
          rationale: (row.suggested_actions || []).join(' · '),
          rank: 1,
          reliability_score: row.bucket === 'decision' ? 0.85 : 0.65,
          domain: 'wfm',
        };
      }

      setByCap(byCapNext);
      setError(null);
    } catch (err) {
      setError(err?.message || 'Recommendations unavailable');
    } finally {
      setLoading(false);
      setReady(true);
      activeRef.current = false;
    }
  }, [enabled, capSet]);

  useEffect(() => {
    if (!enabled) return undefined;
    const t0 = setTimeout(refresh, INITIAL_DELAY_MS);
    const t1 = setInterval(refresh, DEFAULT_POLL_MS);
    return () => {
      clearTimeout(t0);
      clearInterval(t1);
    };
  }, [enabled, refresh]);

  return { byCap, loading, error, ready, refresh };
}
