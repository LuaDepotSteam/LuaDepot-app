import { useState } from 'react';
import GameCard from './GameCard';
import DrawSvgLoader from './ui/DrawSvgLoader';
import type { SteamAppInfo } from '../types/steam';

interface GameEntry {
  appid: number;
  name: string;
}

interface SearchViewProps {
  results: SteamAppInfo[];
  searching: boolean;
  query: string;
  onGameClick: (appid: number) => void;
  onAdd?: (appid: number, name: string) => Promise<void>;
  libraryGames?: GameEntry[];
}

export default function SearchView({ results, searching, query, onGameClick, onAdd, libraryGames = [] }: SearchViewProps) {
  const [addingIds, setAddingIds] = useState<Set<number>>(new Set());
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());

  const handleAdd = async (appid: number, name: string) => {
    if (!onAdd) return;
    setAddingIds(prev => new Set(prev).add(appid));
    try {
      await onAdd(appid, name);
      setAddedIds(prev => new Set(prev).add(appid));
    } catch {
      // error handled upstream
    } finally {
      setAddingIds(prev => {
        const next = new Set(prev);
        next.delete(appid);
        return next;
      });
    }
  };

  if (searching || results.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
        {searching ? (
          <div className="loading-overlay">
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <DrawSvgLoader size={48} />
            </div>
            <div style={{ marginTop: 16 }}>Searching Steam...</div>
          </div>
        ) : query.trim().length > 0 ? (
          <div className="empty-state">
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <DrawSvgLoader size={64} className="empty-state-emoji" />
            </div>
            <div className="empty-state-text" style={{ fontSize: '18px' }}>No games found for "{query}"</div>
          </div>
        ) : (
          <div className="empty-state">
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <DrawSvgLoader size={64} className="empty-state-emoji" />
            </div>
            <div className="empty-state-text" style={{ fontSize: '18px', marginTop: '16px' }}>Search for a game using the bar at the top</div>
            <div className="empty-state-subtext" style={{ marginTop: '8px', fontSize: '14px' }}>
              Results will appear automatically as you type
            </div>
          </div>
        )}

      </div>
    );
  }

  return (
    <div style={{ paddingTop: 8 }}>
      <div className="game-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px' }}>
        {results.map(app => {
          const inLibrary = libraryGames.some(g => g.appid === app.appid) || addedIds.has(app.appid);
          const isAdding = addingIds.has(app.appid);

          return (
            <GameCard
              key={app.appid}
              appid={app.appid}
              name={app.name}
              imageUrl={app.image_url}
              platforms={app.platforms}
              metacritic_score={app.metacritic_score}
              release_date={app.release_date}
              review_summary={app.review_summary}
              actionLabel={'View'}
              actionDisabled={false}
              loading={false}
              onAction={() => onGameClick(app.appid)}
              onAdd={() => handleAdd(app.appid, app.name)}
              addDisabled={inLibrary}
              addLoading={isAdding}
            />
          );
        })}
      </div>
    </div>
  );
}
