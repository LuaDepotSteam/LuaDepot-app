import { HugeiconsIcon } from '@hugeicons/react';
import { LibraryIcon, Search01Icon, Settings01Icon, Refresh01Icon, InformationCircleIcon, Download01Icon, Leaf01Icon, CheckmarkCircle02Icon } from '@hugeicons/core-free-icons';
import { AnimatePresence, motion } from 'framer-motion';
import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import { toast, Toast } from '@heroui/react';
import Sidebar, { View } from './components/Sidebar';
import LibraryView from './components/LibraryView';
import SearchView from './components/SearchView';
import SettingsView from './components/SettingsView';
import ConnectScreen from './components/ConnectScreen';
import { SearchBar } from './components/ui/gooey/SearchBar';
import SplashLoader from './components/SplashLoader';
import { WindowControls } from './components/WindowControls';
import GamePreviewModal from './components/GamePreviewModal';
import ContextMenu, { showContextMenu } from './components/ContextMenu';
import { trackPageView } from './lib/track';
import FeedbackWidget from './components/FeedbackWidget';
import type { SteamAppInfo } from './types/steam';
import confetti from 'canvas-confetti';

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

interface UpdateInfo {
  version: string;
  notes: string | null;
  current_version: string;
}

function renderMarkdown(md: string): string {
  return md
    .replace(/^### (.*$)/gm, '<h3 class="text-sm font-semibold mb-1">$1</h3>')
    .replace(/^## (.*$)/gm, '<h2 class="text-base font-semibold mb-2">$1</h2>')
    .replace(/^# (.*$)/gm, '<h1 class="text-lg font-bold mb-2">$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^- (.*$)/gm, '<li class="ml-4">$1</li>')
    .replace(/(<li.*<\/li>\n?)+/g, (match) => `<ul class="list-disc mb-2">${match}</ul>`)
    .replace(/\n/g, '<br/>');
}

export default function App() {
  const [view, setView] = useState<View>('library');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SteamAppInfo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [libraryRefreshTrigger, setLibraryRefreshTrigger] = useState(0);
  const [previewAppId, setPreviewAppId] = useState<number | null>(null);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showWhatsNewModal, setShowWhatsNewModal] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installProgress, setInstallProgress] = useState<{ downloaded: number; total: number | null } | null>(null);
  const [installed, setInstalled] = useState(false);
  const [libraryGames, setLibraryGames] = useState<GameEntry[]>([]);
  const mainRef = useRef<HTMLDivElement>(null);
  const [scrollState, setScrollState] = useState({ atTop: true, atBottom: false });
  const [showFeedback, setShowFeedback] = useState(false);
  const [connected, setConnected] = useState(false);
  const [showRestartPopup, setShowRestartPopup] = useState(false);
  const [addedGames, setAddedGames] = useState<Array<{ appid: number; name: string }>>([]);

  const appWindow = getCurrentWindow();

  // Check connection status on mount
  useEffect(() => {
    invoke<{ backend_token: string }>('get_settings')
      .then((s) => setConnected(!!s.backend_token))
      .catch(() => setConnected(false));
  }, []);

  // Auto-check for updates every 30 minutes
  useEffect(() => {
    const checkUpdate = async () => {
      try {
        const info = await invoke<UpdateInfo | null>('check_for_update');
        if (info) {
          setUpdateInfo(info);
          setShowUpdateModal(true);
        }
      } catch (e) {
        // silently fail
      }
    };

    // Initial check after 5 seconds
    const initialTimer = setTimeout(() => {
      checkUpdate();
    }, 5000);

    // Then every 30 minutes
    const interval = setInterval(checkUpdate, 30 * 60 * 1000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const unlisten = listen<{ downloaded: number; total: number | null }>('update-progress', (event) => {
      setInstallProgress(event.payload);
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);

  useEffect(() => {
    const loadLibrary = async () => {
      try {
        const lib = await invoke<{ games: GameEntry[] }>('get_library');
        setLibraryGames(lib.games || []);
      } catch (e) {
        // silently fail
      }
    };
    loadLibrary();
  }, [libraryRefreshTrigger]);

  const handleViewChange = useCallback((v: View) => {
    setView(v);
    setScrollState({ atTop: true, atBottom: false });
    if (mainRef.current) mainRef.current.scrollTop = 0;
    trackPageView(`/${v}`);
  }, []);

  const handleSearchResults = (results: SteamAppInfo[], query: string) => {
    setSearchResults(results);
    setSearchQuery(query);
  };

  const handleAddQuick = async (appid: number, name: string) => {
    try {
      await invoke('download_and_compile', { appid, name });
      toast(`Added ${name} to Steam`);
      setLibraryRefreshTrigger(prev => prev + 1);
      setPreviewAppId(null);
      setAddedGames(prev => {
        if (prev.some(g => g.appid === appid)) return prev;
        return [...prev, { appid, name }];
      });
      setShowRestartPopup(true);
    } catch (e: any) {
      toast(e?.toString() || 'Failed to add game');
    }
  };

  const handleCheckUpdate = useCallback(async () => {
    try {
      const info = await invoke<UpdateInfo | null>('check_for_update');
      if (info) {
        setUpdateInfo(info);
        setShowUpdateModal(true);
      } else {
        toast('You are on the latest version.');
      }
    } catch (e: any) {
      toast(e?.toString() || 'Failed to check for updates');
    }
  }, []);

  const handleInstallUpdate = useCallback(async () => {
    setInstalling(true);
    setInstallProgress(null);
    setShowUpdateModal(false);
    try {
      await invoke('install_update');
      setInstalled(true);
      setInstalling(false);
      setShowWhatsNewModal(true);
    } catch (e: any) {
      setInstalling(false);
      setInstallProgress(null);
      toast(e?.toString() || 'Failed to install update');
    }
  }, []);

  const handleWhatsNewClose = useCallback(() => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#22c55e', '#3b82f6', '#eab308', '#a855f7'],
    });
    setShowWhatsNewModal(false);
    setUpdateInfo(null);
    setInstalled(false);
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const items = [
      { label: 'Library', icon: <HugeiconsIcon icon={LibraryIcon} size={15} />, onClick: () => handleViewChange('library') },
      { label: 'Search', icon: <HugeiconsIcon icon={Search01Icon} size={15} />, onClick: () => handleViewChange('search') },
      { label: 'Settings', icon: <HugeiconsIcon icon={Settings01Icon} size={15} />, onClick: () => handleViewChange('settings') },
      { separator: true as const },
      { label: 'Refresh Library', icon: <HugeiconsIcon icon={Refresh01Icon} size={15} />, onClick: () => setLibraryRefreshTrigger(prev => prev + 1) },
      { label: 'Reload App', icon: <HugeiconsIcon icon={Refresh01Icon} size={15} />, onClick: () => { location.reload(); }, shortcut: '⌘R' },
      { label: 'Check for Updates', icon: <HugeiconsIcon icon={Download01Icon} size={15} />, onClick: handleCheckUpdate },
      { separator: true as const },
      { label: 'Send Feedback', icon: <HugeiconsIcon icon={InformationCircleIcon} size={15} />, onClick: () => setShowFeedback(true) },
      { label: 'About LuaDepot', icon: <HugeiconsIcon icon={InformationCircleIcon} size={15} />, onClick: () => handleViewChange('settings') },
    ];
    showContextMenu(items, e.clientX, e.clientY);
  }, [handleCheckUpdate, handleViewChange, showFeedback]);

  return (
    <>
      <ContextMenu />
      <Toast.Provider />
      {showSplash && <SplashLoader onComplete={() => setShowSplash(false)} />}

      {connected === false && (
        <ConnectScreen onConnected={() => setConnected(true)} />
      )}

      {connected && (
        <div className="app-layout" onContextMenu={handleContextMenu}>
          <AnimatePresence>
            {previewAppId !== null && (
              <GamePreviewModal
                appid={previewAppId}
                onClose={() => setPreviewAppId(null)}
                onAdd={handleAddQuick}
                alreadyInLibrary={libraryGames.some(g => g.appid === previewAppId)}
              />
            )}
          </AnimatePresence>

          {/* Update Available Modal */}
          <AnimatePresence>
            {showUpdateModal && updateInfo && (
              <motion.div className="upd-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <motion.div className="upd-content" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}>
                  <div className="upd-icon upd-icon--update">
                    <HugeiconsIcon icon={Download01Icon} size={28} />
                  </div>
                  <h2 className="upd-title">Update Available</h2>
                  <p className="upd-subtitle">Version {updateInfo.version} is now available</p>
                  <div className="upd-buttons">
                    <button className="upd-btn-primary" onClick={handleInstallUpdate}>Update</button>
                    <button className="upd-btn-secondary" onClick={() => setShowUpdateModal(false)}>Later</button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Installing Progress */}
          <AnimatePresence>
            {installing && (
              <motion.div className="update-popup" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}>
                <div className="update-popup-inner">
                  <div className="update-popup-icon">
                    <HugeiconsIcon icon={Leaf01Icon} size={16} />
                  </div>
                  <div className="update-popup-text">
                    <div className="update-popup-title">Downloading update...</div>
                    <div className="update-popup-subtitle">
                      {installProgress?.total
                        ? `${Math.round((installProgress.downloaded / installProgress.total) * 100)}% — ${(installProgress.downloaded / 1024 / 1024).toFixed(1)} MB / ${(installProgress.total / 1024 / 1024).toFixed(1)} MB`
                        : 'Downloading...'}
                    </div>
                    {installProgress?.total && (
                      <div className="update-popup-progress">
                        <div className="update-popup-progress-bar" style={{ width: `${(installProgress.downloaded / installProgress.total) * 100}%` }} />
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* What's New Modal */}
          <AnimatePresence>
            {showWhatsNewModal && (
              <motion.div className="upd-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <motion.div className="upd-content" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}>
                  <motion.div className="upd-icon upd-icon--success" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.1 }}>
                    <HugeiconsIcon icon={CheckmarkCircle02Icon} size={32} />
                  </motion.div>
                  <h2 className="upd-title">You're all set!</h2>
                  <p className="upd-subtitle">You're now on version {updateInfo?.version}</p>
                  {updateInfo?.notes && (
                    <div className="upd-notes">
                      <h3 className="upd-notes-title">What's New</h3>
                      <div className="upd-notes-content" dangerouslySetInnerHTML={{ __html: renderMarkdown(updateInfo.notes) }} />
                    </div>
                  )}
                  <button className="upd-btn-primary" onClick={handleWhatsNewClose}>Okay</button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {!showSplash && (
            <header className="top-bar" onMouseDown={(e) => { if (e.buttons === 1) appWindow.startDragging(); }}>
              <div className="top-bar-refresh" onMouseDown={(e) => e.stopPropagation()}>
                <button className="topbar-icon-btn" onClick={() => setLibraryRefreshTrigger(prev => prev + 1)} title="Refresh">
                  <HugeiconsIcon icon={Refresh01Icon} size={16} />
                </button>
              </div>
              <div className="top-bar-center" onMouseDown={(e) => e.stopPropagation()}>
                <SearchBar onResults={handleSearchResults} onPreview={setPreviewAppId} setIsLoading={setIsSearching} isSearchPage={view === 'search'} />
              </div>
              <div className="window-controls-wrapper" onMouseDown={(e) => e.stopPropagation()}>
                <WindowControls />
              </div>
            </header>
          )}

          <Sidebar active={view} onChange={handleViewChange} onFeedback={() => setShowFeedback(true)} />

          <main className="main-content" ref={mainRef} onScroll={() => {
            const el = mainRef.current;
            if (!el) return;
            setScrollState({ atTop: el.scrollTop <= 4, atBottom: el.scrollTop + el.clientHeight >= el.scrollHeight - 4 });
          }}>
            <div className={`scroll-blur-top${!scrollState.atTop ? ' visible' : ''}`} />
            <div style={{ display: view === 'library' ? 'block' : 'none' }}>
              <LibraryView refreshTrigger={libraryRefreshTrigger} onPreview={setPreviewAppId} />
            </div>
            <div style={{ display: view === 'search' ? 'block' : 'none' }}>
              <SearchView results={searchResults} searching={isSearching} query={searchQuery} onGameClick={(appid) => setPreviewAppId(appid)} onAdd={handleAddQuick} libraryGames={libraryGames} />
            </div>
            <div style={{ display: view === 'settings' ? 'block' : 'none' }}>
              <SettingsView updateInfo={updateInfo} onCheckUpdate={handleCheckUpdate} onInstallUpdate={handleInstallUpdate} installing={installing} installed={installed} installProgress={installProgress} onRestart={() => invoke('restart_app')} />
            </div>
            <div className={`scroll-blur-bottom${!scrollState.atBottom ? ' visible' : ''}`} />
          </main>

          <div className={`stg-savebar ${showRestartPopup ? 'stg-savebar--visible' : ''}`}>
            <div className="stg-savebar-games">
              {addedGames.slice(-5).map((g, i) => (
                <img
                  key={g.appid}
                  src={`https://cdn.akamai.steamstatic.com/steam/apps/${g.appid}/header.jpg`}
                  alt={g.name}
                  className="stg-savebar-game-img"
                  style={{ zIndex: addedGames.length - i, marginLeft: i > 0 ? -18 : 0 }}
                  title={g.name}
                />
              ))}
            </div>
            <span className="stg-savebar-text">
              Restart Steam to load {addedGames.length === 1 ? addedGames[0]?.name : `${addedGames.length} games`}
            </span>
            <div className="stg-savebar-actions">
              <button className="stg-savebar-discard" onClick={() => { setShowRestartPopup(false); setAddedGames([]); }}>Later</button>
              <button className="stg-savebar-save" onClick={async () => {
                setShowRestartPopup(false);
                setAddedGames([]);
                try {
                  const s = await invoke<{ steam_path: string }>('get_settings');
                  await invoke('restart_steam', { steamPath: s.steam_path });
                } catch {}
              }}>
                <HugeiconsIcon icon={Refresh01Icon} size={13} /> Restart Steam
              </button>
            </div>
          </div>
        </div>
      )}

      <FeedbackWidget open={showFeedback} onClose={() => setShowFeedback(false)} />
    </>
  );
}
