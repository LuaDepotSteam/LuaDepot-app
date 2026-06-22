import { HugeiconsIcon } from '@hugeicons/react';
import { Delete04Icon, ExternalLinkIcon, Add01Icon, CheckmarkCircle02Icon } from '@hugeicons/core-free-icons';

interface GameCardProps {
  appid: number;
  name: string;
  imageUrl: string;
  platforms?: string[];
  metacritic_score?: number;
  release_date?: string;
  review_summary?: string;
  actionLabel?: string;
  actionDisabled?: boolean;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  loading?: boolean;
  onAdd?: () => void;
  addDisabled?: boolean;
  addLoading?: boolean;
}

export default function GameCard({
  name,
  imageUrl,
  platforms,
  metacritic_score,
  review_summary,
  actionLabel,
  actionDisabled,
  onAction,
  secondaryLabel,
  onSecondary,
  loading,
  onAdd,
  addDisabled,
  addLoading,
}: GameCardProps) {
  const reviewColor = (summary?: string) => {
    if (!summary) return '#6b6b7b';
    const s = summary.toLowerCase();
    if (s.includes('overwhelmingly positive') || s.includes('very positive')) return '#16a34a';
    if (s.includes('positive')) return '#22c55e';
    if (s.includes('mixed')) return '#ca8a04';
    if (s.includes('negative') || s.includes('overwhelmingly negative')) return '#dc2626';
    return '#6b6b7b';
  };

  return (
    <div className="group relative h-full">
      <div className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/5 bg-neutral-900 p-1.5 shadow-2xl">

        {/* Image — fills the card with the inset edges you liked */}
        <div className="relative w-full aspect-[460/215] overflow-hidden rounded-xl bg-black">
          <img
            alt={name}
            src={imageUrl}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>

        {/* Game info row */}
        <div style={{ padding: '10px 14px 4px 14px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#e8e8ed', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={name}>
            {name}
          </div>
          {(review_summary || metacritic_score !== undefined) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              {review_summary && (
                <span style={{ fontSize: 11, fontWeight: 600, color: reviewColor(review_summary), background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 6, textTransform: 'capitalize' }}>
                  {review_summary}
                </span>
              )}
              {metacritic_score != null && (
                <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: '#16a34a', padding: '2px 8px', borderRadius: 6 }}>
                  {metacritic_score}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Platform icons row */}
        {platforms && platforms.length > 0 && (
          <div style={{ display: 'flex', gap: 8, padding: '4px 14px 4px 14px' }}>
            {platforms.map(plat => (
              <span key={plat} title={plat}>
                {plat === 'windows' && (
                  <img src="/platforms/windows-svgrepo-com.svg" alt="Windows" width="14" height="14" style={{ filter: 'brightness(0) invert(1)' }} />
                )}
                {plat === 'mac' && (
                  <img src="/platforms/apple-173-svgrepo-com.svg" alt="Mac" width="14" height="14" style={{ filter: 'brightness(0) invert(1)' }} />
                )}
                {plat === 'linux' && (
                  <img src="/platforms/linux-svgrepo-com.svg" alt="Linux" width="14" height="14" style={{ filter: 'brightness(0) invert(1)' }} />
                )}
              </span>
            ))}
          </div>
        )}

        {/* Buttons - standard styling */}
        <div style={{ display: 'flex', gap: 6, padding: '8px 12px 14px 12px', marginTop: 'auto' }}>
          {actionLabel && (
            <button
              disabled={actionDisabled || loading}
              onClick={(e) => { e.stopPropagation(); onAction?.(); }}
              style={{ flex: '1 1 0', minWidth: 0, height: 34 }}
              className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 text-sm font-medium text-white transition-all active:scale-[0.96] disabled:opacity-50"
            >
              {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
              ) : (
                <>
                  <HugeiconsIcon icon={ExternalLinkIcon} size={14} />
                  {actionLabel}
                </>
              )}
            </button>
          )}

          {onAdd && (
            <button
              disabled={addDisabled || addLoading}
              onClick={(e) => { e.stopPropagation(); onAdd(); }}
              style={{ flexShrink: 0, width: 34, height: 34 }}
              className={`flex items-center justify-center rounded-lg transition-all active:scale-[0.96] disabled:opacity-50 ${addDisabled ? 'bg-green-600 text-white' : 'bg-blue-600 text-white'}`}
              title={addDisabled ? 'Added' : 'Add to Steam'}
            >
              {addLoading ? (
                <div className="search-add-spinner" />
              ) : addDisabled ? (
                <HugeiconsIcon icon={CheckmarkCircle02Icon} size={14} />
              ) : (
                <HugeiconsIcon icon={Add01Icon} size={14} />
              )}
            </button>
          )}

          {secondaryLabel && (
            <button
              onClick={(e) => { e.stopPropagation(); onSecondary?.(); }}
              style={{ flexShrink: 0, width: 34, height: 34 }}
              className="flex items-center justify-center rounded-lg bg-neutral-800 text-neutral-400 transition-all active:scale-[0.96]"
              title={secondaryLabel}
            >
              <HugeiconsIcon icon={Delete04Icon} size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
