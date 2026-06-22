import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import GameCard from './GameCard';
import DropZone from './DropZone';
import { toast } from '@heroui/react';
import DrawSvgLoader from './ui/DrawSvgLoader';

interface GameEntry {
  appid: number;
  name: string;
  image_url: string;
  installed_at: string;
  platforms?: string[];
  metacritic_score?: number;
  release_date?: string;
  review_summary?: string;
}

interface LibraryViewProps {
  refreshTrigger?: number;
  onPreview?: (appid: number) => void;
}

function isPlaceholderName(name: string): boolean {
  return /^Game \d+$/.test(name);
}

export default function LibraryView({ refreshTrigger, onPreview }: LibraryViewProps) {
  const [games, setGames] = useState<GameEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<number | null>(null);
  const resolvedRef = useRef<Set<number>>(new Set());

  const loadLibrary = async () => {
    try {
      const lib = await invoke<{ games: GameEntry[] }>('get_library');
      const loaded = lib.games || [];
      setGames(loaded);

      const unresolved = loaded.filter(g => isPlaceholderName(g.name) && !resolvedRef.current.has(g.appid));
      if (unresolved.length === 0) return;

      for (const game of unresolved) {
        resolvedRef.current.add(game.appid);
        try {
          const results = await invoke<{ name: string; platforms?: string[]; metacritic_score?: number; release_date?: string; review_summary?: string }[]>('search_steam', { query: String(game.appid) });
          if (results.length > 0 && !isPlaceholderName(results[0].name)) {
            setGames(prev => prev.map(g =>
              g.appid === game.appid
                ? { ...g, name: results[0].name, platforms: results[0].platforms || g.platforms, metacritic_score: results[0].metacritic_score ?? g.metacritic_score, release_date: results[0].release_date || g.release_date, review_summary: results[0].review_summary ?? g.review_summary }
                : g
            ));
          }
        } catch {
          // ignore - keep placeholder name
        }
      }
    } catch (e) {
      console.error('Failed to load library:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLibrary();
  }, [refreshTrigger]);

  const handleRemove = async (appid: number, name: string) => {
    setRemoving(appid);
    try {
      const lib = await invoke<{ games: GameEntry[] }>('remove_game_cmd', { appid });
      setGames(lib.games || []);
      toast(`Removed ${name}`);
    } catch (e: any) {
      toast(e?.toString() || 'Failed to remove game');
    } finally {
      setRemoving(null);
    }
  };

  if (loading) {
    return (
      <div className="loading-overlay">
        <DrawSvgLoader size={48} />
        <div style={{ marginTop: 8 }}>Loading library...</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', justifyContent: 'space-between' }}>
      <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', paddingTop: 8 }}>
        {games.length === 0 ? (
          <div className="empty-state" style={{ flexGrow: 1 }}>
            <DrawSvgLoader size={64} className="empty-state-emoji" />
            <div className="empty-state-text">No games yet</div>
            <div className="empty-state-subtext">
              Search for a game to add, or drop files below
            </div>
          </div>
        ) : (
          <div className="game-grid" style={{ padding: '8px 0' }}>
            {games.map(game => (
              <GameCard
                key={game.appid}
                appid={game.appid}
                name={game.name}
                imageUrl={game.image_url}
                platforms={game.platforms}
                metacritic_score={game.metacritic_score}
                release_date={game.release_date}
                review_summary={game.review_summary}
                actionLabel="View"
                onAction={() => onPreview?.(game.appid)}
                secondaryLabel={removing === game.appid ? 'Removing...' : 'Remove'}
                onSecondary={() => handleRemove(game.appid, game.name)}
              />
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: 32, paddingBottom: 24 }}>
        <DropZone onFilesProcessed={loadLibrary} />
      </div>
    </div>
  );
}
