import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon, PlusSignIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, GlobeIcon, Calendar01Icon, UserGroupIcon, Building01Icon } from '@hugeicons/core-free-icons';
import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import { motion, AnimatePresence } from 'framer-motion';
import DrawSvgLoader from './ui/DrawSvgLoader';

interface GameDetails {
  name: string;
  header_image: string;
  short_description: string;
  developers: string[];
  publishers: string[];
  release_date: { date: string };
  screenshots?: { path_thumbnail: string; path_full: string }[];
  pc_requirements: { recommended?: string };
  metacritic?: { score: number; url: string };
  platforms: { windows: boolean; mac: boolean; linux: boolean };
  categories?: { id: number; description: string }[];
  genres?: { id: string; description: string }[];
  recommendations?: { total: number };
}

interface ReviewSummary {
  review_score_desc: string;
  total_positive: number;
  total_negative: number;
  total_reviews: number;
}

interface GamePreviewModalProps {
  appid: number;
  onClose: () => void;
  onAdd: (appid: number, name: string) => void;
  alreadyInLibrary?: boolean;
}

const CATEGORY_LABELS: Record<number, string> = {
  1: 'Multi-player',
  2: 'Single-player',
  9: 'Co-op',
  20: 'MMO',
  27: 'Cross-Platform',
  30: 'Workshop',
  31: 'Remote Play',
  35: 'In-App Purchases',
  38: 'Online PvP',
};

const variants = {
  enter: (direction: number) => ({ x: direction > 0 ? '100%' : '-100%' }),
  center: { zIndex: 1, x: 0 },
  exit: (direction: number) => ({ zIndex: 0, x: direction < 0 ? '100%' : '-100%' })
};

export default function GamePreviewModal({ appid, onClose, onAdd, alreadyInLibrary }: GamePreviewModalProps) {
  const [details, setDetails] = useState<GameDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [heroError, setHeroError] = useState(false);
  const [[page, direction], setPage] = useState([0, 0]);

  const [reviewSummary, setReviewSummary] = useState<ReviewSummary | null>(null);
  const [loadingReviews, setLoadingReviews] = useState(true);

  useEffect(() => {
    setLoading(true);
    const fetchDetails = async () => {
      try {
        const data = await invoke<GameDetails>('get_game_details', { appid });
        setDetails(data);
        setPage([0, 0]);
        setHeroError(false);
      } catch (e) {
        console.error('Failed to load game details:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [appid]);

  // Fetch only the review summary
  useEffect(() => {
    if (!appid) return;
    setLoadingReviews(true);
    invoke<{ query_summary: ReviewSummary }>('get_game_reviews', {
      appid,
      cursor: null,
      numPerPage: 0,
    }).then((data) => {
      setReviewSummary(data.query_summary);
    }).catch(() => {}).finally(() => setLoadingReviews(false));
  }, [appid]);

  useEffect(() => {
    if (!details || loading) return;
    const timer = setInterval(() => { paginate(1); }, 5000);
    return () => clearInterval(timer);
  }, [details, page, loading]);

  const screenshots = details?.screenshots || [];
  const images = details ? [
    heroError ? details.header_image : `https://cdn.akamai.steamstatic.com/steam/apps/${appid}/library_hero.jpg`,
    ...screenshots.map(s => s.path_full),
  ] : [];

  const imgIndex = images.length > 0 ? ((page % images.length) + images.length) % images.length : 0;
  const paginate = (newDirection: number) => { setPage([page + newDirection, newDirection]); };
  const openLink = async (url: string) => { try { await openUrl(url); } catch (e) { window.open(url, '_blank'); } };

  const features = details?.categories?.filter((c) => CATEGORY_LABELS[c.id]) || [];
  const genres = details?.genres || [];
  const totalReviews = reviewSummary?.total_reviews || 0;
  const positivePct = totalReviews > 0 ? Math.round(((reviewSummary?.total_positive || 0) / totalReviews) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, filter: 'blur(20px)' }}
      animate={{ opacity: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, filter: 'blur(20px)' }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="modal-backdrop"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 10 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="gpm-modal"
        onClick={e => e.stopPropagation()}
      >
        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <DrawSvgLoader size={48} />
          </div>
        ) : details && (
          <>
            {/* Close button */}
            <button onClick={onClose} className="gpm-close">
              <HugeiconsIcon icon={Cancel01Icon} size={14} />
            </button>

            {/* Image carousel */}
            <div className="gpm-image-area">
              <AnimatePresence initial={false} custom={direction}>
                <motion.div key={page} custom={direction} variants={variants} initial="enter" animate="center" exit="exit" transition={{ type: "spring", stiffness: 300, damping: 35 }} style={{ width: '100%', height: '100%', position: 'absolute' }}>
                  <img src={images[imgIndex]} onError={() => { if (imgIndex === 0) setHeroError(true); }} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </motion.div>
              </AnimatePresence>

              {images.length > 1 && (
                <>
                  <button className="gpm-nav-btn" onClick={(e) => { e.stopPropagation(); paginate(-1); }}>
                    <HugeiconsIcon icon={ChevronLeftIcon} size={20} />
                  </button>
                  <button className="gpm-nav-btn gpm-nav-btn--right" onClick={(e) => { e.stopPropagation(); paginate(1); }}>
                    <HugeiconsIcon icon={ChevronRightIcon} size={20} />
                  </button>
                  <div className="gpm-dots">
                    {images.slice(0, 10).map((_, i) => (
                      <div key={i} onClick={() => setPage([i, i > imgIndex ? 1 : -1])} className={`gpm-dot ${i === imgIndex ? 'gpm-dot--active' : ''}`} />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Body — no scroll, fits content */}
            <div className="gpm-body">
              {/* Title + Actions */}
              <div className="gpm-header-row">
                <div className="gpm-title-area">
                  <h2 className="gpm-title">{details.name}</h2>
                  {details.metacritic && (
                    <div className="gpm-metascore-badge">
                      <span className="gpm-metascore-num">{details.metacritic.score}</span>
                      <span className="gpm-metascore-label">Metascore</span>
                    </div>
                  )}
                </div>
                <div className="gpm-actions">
                  {alreadyInLibrary ? (
                    <div className="gpm-action-group">
                      <span className="gpm-in-library">
                        <HugeiconsIcon icon={CheckIcon} size={14} /> In Library
                      </span>
                      <button onClick={async () => { await invoke('remove_game_cmd', { appid }); onClose(); }} className="gpm-remove-btn">
                        Remove
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => onAdd(appid, details.name)} className="gpm-add-btn">
                      <HugeiconsIcon icon={PlusSignIcon} size={15} /> Add to Steam
                    </button>
                  )}
                  <button onClick={() => openLink(`https://store.steampowered.com/app/${appid}`)} className="gpm-store-link">
                    Store Page <HugeiconsIcon icon={GlobeIcon} size={12} />
                  </button>
                </div>
              </div>

              {/* Steam rating — compact one-liner */}
              {(loadingReviews || reviewSummary) && (
                <div className="gpm-rating-row">
                  {loadingReviews ? (
                    <DrawSvgLoader size={14} />
                  ) : reviewSummary && (
                    <>
                      <div className="gpm-rating-bar">
                        <div className="gpm-rating-bar-fill" style={{ width: `${positivePct}%` }} />
                      </div>
                      <span className="gpm-rating-pct">{positivePct}%</span>
                      <span className="gpm-rating-text">{reviewSummary.review_score_desc}</span>
                      <span className="gpm-rating-count">({totalReviews.toLocaleString()})</span>
                    </>
                  )}
                </div>
              )}

              {/* Description */}
              <div className="gpm-description" dangerouslySetInnerHTML={{ __html: details.short_description }} />

              {/* Tags + Features — inline */}
              {(genres.length > 0 || features.length > 0) && (
                <div className="gpm-tags">
                  {genres.map((g) => (
                    <span key={g.id} className="gpm-tag">{g.description}</span>
                  ))}
                  {features.map((f) => (
                    <span key={f.id} className="gpm-tag">{CATEGORY_LABELS[f.id] || f.description}</span>
                  ))}
                </div>
              )}

              {/* Info panel */}
              <div className="gpm-info-panel">
                {details.release_date?.date && (
                  <div className="gpm-info-row">
                    <div className="gpm-label"><HugeiconsIcon icon={Calendar01Icon} size={11} /><span>Release</span></div>
                    <span className="gpm-value">{details.release_date.date}</span>
                  </div>
                )}
                {details.developers?.length > 0 && (
                  <div className="gpm-info-row">
                    <div className="gpm-label"><HugeiconsIcon icon={UserGroupIcon} size={11} /><span>Developers</span></div>
                    <span className="gpm-value">{details.developers.join(', ')}</span>
                  </div>
                )}
                {details.publishers?.length > 0 && (
                  <div className="gpm-info-row">
                    <div className="gpm-label"><HugeiconsIcon icon={Building01Icon} size={11} /><span>Publishers</span></div>
                    <span className="gpm-value">{details.publishers.join(', ')}</span>
                  </div>
                )}
                <div className="gpm-info-row gpm-info-footnote">
                  <span className="gpm-appid">AppID: {appid}</span>
                </div>
              </div>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
