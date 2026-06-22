import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import { open as shellOpen } from '@tauri-apps/plugin-shell';
import { HugeiconsIcon } from '@hugeicons/react';
import { ZapIcon, ExternalLinkIcon, Loading01Icon } from '@hugeicons/core-free-icons';
import { getCurrentWindow } from '@tauri-apps/api/window';

interface ConnectScreenProps {
  onConnected: () => void;
}

export default function ConnectScreen({ onConnected }: ConnectScreenProps) {
  const [connecting, setConnecting] = useState(false);
  const appWindow = getCurrentWindow();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  const handleConnect = async () => {
    const connectId = crypto.randomUUID();
    setConnecting(true);
    try {
      const res = await fetch('https://api.luadepot.dev/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connect_id: connectId }),
      });
      const data = await res.json();
      if (!res.ok || !data.connect_id) {
        setConnecting(false);
        return;
      }

      const connectUrl = `https://luadepot.dev/connect?id=${connectId}`;
      try {
        await openUrl(connectUrl);
      } catch (e) {
        console.warn('[connect] openUrl failed, trying shell.open:', e);
        try {
          await shellOpen(connectUrl);
        } catch (e2) {
          console.error('[connect] shell.open also failed:', e2);
        }
      }

      for (let i = 0; i < 120; i++) {
        await new Promise(r => setTimeout(r, 2000));
        try {
          const pollRes = await fetch(`https://api.luadepot.dev/connect/${connectId}`);
          const pollData = await pollRes.json();
          if (pollData.status === 'completed' && pollData.token) {
            await invoke('save_settings', {
              settings: { steam_path: '', crossover_mode: false, backend_token: pollData.token },
            });
            setConnecting(false);
            onConnected();
            return;
          }
        } catch {}
      }
      setConnecting(false);
    } catch {
      setConnecting(false);
    }
  };

  return (
    <div className="connect-screen">

      <div className={`connect-content ${mounted ? 'connect-content--visible' : ''}`}>
        <img src="./intro/flair-4.png" alt="Lua Depot" className="connect-logo-img" />

        <h1 className="connect-title">Lua Depot</h1>
        <p className="connect-sub">Your Steam game library, streamlined</p>

        <button className="connect-btn" onClick={handleConnect} disabled={connecting}>
          {connecting ? (
            <span className="connect-btn-inner">
              <HugeiconsIcon icon={Loading01Icon} size={15} className="connect-spinner" /> Connecting...
            </span>
          ) : (
            <span className="connect-btn-inner">
              <HugeiconsIcon icon={ZapIcon} size={15} /> Sign in with Discord <HugeiconsIcon icon={ExternalLinkIcon} size={11} />
            </span>
          )}
        </button>

        <button className="connect-quit" onClick={() => appWindow.close()}>Quit</button>
      </div>

      <div className="connect-footer">Lua Depot</div>
    </div>
  );
}
