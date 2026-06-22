import { HugeiconsIcon } from '@hugeicons/react';
import { CloudIcon, FolderOpenIcon, Refresh01Icon, Download01Icon, CheckIcon, ZapIcon, ExternalLinkIcon, Loading01Icon } from '@hugeicons/core-free-icons';
import { useState, useEffect, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { openUrl } from '@tauri-apps/plugin-opener';
import { toast } from '@heroui/react';

interface AppSettings {
  steam_path: string;
  crossover_mode: boolean;
  backend_token: string;
}

interface UpdateInfo {
  version: string;
  notes: string | null;
  current_version: string;
}

interface SettingsViewProps {
  updateInfo: UpdateInfo | null;
  onCheckUpdate: () => void;
  onInstallUpdate: () => void;
  installing: boolean;
  installed: boolean;
  installProgress: { downloaded: number; total: number | null } | null;
  onRestart: () => void;
}

export default function SettingsView({ updateInfo, onCheckUpdate, onInstallUpdate, installing, installed, installProgress, onRestart }: SettingsViewProps) {
  const [settings, setSettings] = useState<AppSettings>({
    steam_path: '',
    crossover_mode: false,
    backend_token: '',
  });
  const [savedSettings, setSavedSettings] = useState<AppSettings | null>(null);
  const [detectedPath, setDetectedPath] = useState('');
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const isMac = navigator.platform.toLowerCase().includes('mac');

  const isDirty = useMemo(() => {
    if (!savedSettings) return false;
    return JSON.stringify(settings) !== JSON.stringify(savedSettings);
  }, [settings, savedSettings]);

  useEffect(() => {
    loadSettings();
    detectSteam();
  }, []);

  const loadSettings = async () => {
    try {
      const s = await invoke<AppSettings>('get_settings');
      setSettings(s);
      setSavedSettings(s);
    } catch (e) {
      console.error('Failed to load settings:', e);
    }
  };

  const detectSteam = async () => {
    try {
      const path = await invoke<string>('detect_steam');
      setDetectedPath(path);
    } catch (e) {
      console.error('Failed to detect Steam:', e);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await invoke('save_settings', { settings });
      setSavedSettings(settings);
      toast('Settings saved');
    } catch (e: any) {
      toast(e?.toString() || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    if (savedSettings) setSettings(savedSettings);
  };

  const handleDetect = () => {
    if (detectedPath) {
      setSettings(prev => ({ ...prev, steam_path: detectedPath }));
      toast('Steam path detected');
    } else {
      toast('Could not detect Steam installation');
    }
  };

  const handleManualBrowse = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select Steam Installation Directory',
      });
      if (selected) {
        const path = Array.isArray(selected) ? selected[0] : selected;
        update('steam_path', path);
        toast('Path updated');
      }
    } catch (e: any) {
      toast('Failed to open dialog');
    }
  };

  const handleConnectBackend = async () => {
    const connectId = crypto.randomUUID();
    setConnecting(true);
    try {
      console.log('[connect] Creating pending connection:', connectId);
      const res = await fetch('https://api.luadepot.dev/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connect_id: connectId }),
      });
      const data = await res.json();
      console.log('[connect] POST response:', res.status, data);

      if (!res.ok) {
        toast(`Connection failed: ${data.error || res.status}`);
        setConnecting(false);
        return;
      }

      const connectUrl = `https://luadepot.dev/connect?id=${connectId}`;
      console.log('[connect] Opening browser:', connectUrl);
      try {
        await openUrl(connectUrl);
      } catch (e) {
        console.log('[connect] openUrl failed, trying window.open:', e);
        window.open(connectUrl, '_blank');
      }

      toast('Browser opened. Complete the login to connect your account.');

      // Poll backend for completion
      let completed = false;
      for (let i = 0; i < 120 && !completed; i++) {
        await new Promise(r => setTimeout(r, 2000));
        try {
          const pollRes = await fetch(`https://api.luadepot.dev/connect/${connectId}`);
          const pollData = await pollRes.json();
          console.log(`[connect] Poll ${i}:`, pollData);
          if (pollData.status === 'completed' && pollData.token) {
            const updated = { ...settings, backend_token: pollData.token };
            setSettings(updated);
            await invoke('save_settings', { settings: updated });
            setSavedSettings(updated);
            setConnecting(false);
            toast('Account connected successfully!');
            completed = true;
          }
        } catch (e) {
          console.log('[connect] Poll error:', e);
        }
      }
      if (!completed) {
        setConnecting(false);
        toast('Connection timed out. Please try again.');
      }
    } catch (e) {
      console.error('[connect] Failed:', e);
      setConnecting(false);
      toast('Failed to start connection');
    }
  };

  const update = (field: keyof AppSettings, value: any) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const steamPathSub = detectedPath || 'Set path to your Steam installation';

  return (
    <div className="stg">
      <div className="stg-head">
        <h1 className="stg-title">Settings</h1>
        <p className="stg-subtitle">Manage your LuaDepot connection and local Steam configuration.</p>
      </div>

      {/* Connection */}
      <div className="stg-section">
        <div className="stg-section-label">Connection</div>
        <div className="stg-row">
          <div className="stg-row-icon"><HugeiconsIcon icon={CloudIcon} size={15} /></div>
          <div className="stg-row-text">
            <div className="stg-row-label">Backend Connection</div>
            <div className="stg-row-sub">
              {settings.backend_token ? 'Connected to LuaDepot' : 'Not connected'}
            </div>
          </div>
          <div className="stg-row-control">
            {settings.backend_token ? (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span className="stg-tag"><HugeiconsIcon icon={CheckIcon} size={11} /> Active</span>
                <button className="stg-action" onClick={async () => {
                  const updated = { ...settings, backend_token: '' };
                  setSettings(updated);
                  await invoke('save_settings', { settings: updated });
                  setSavedSettings(updated);
                  window.location.reload();
                }}>Sign Out</button>
              </div>
            ) : connecting ? (
              <span className="stg-tag"><HugeiconsIcon icon={Loading01Icon} size={11} /> Connecting...</span>
            ) : (
              <button className="stg-action stg-action--primary" onClick={handleConnectBackend}>
                <HugeiconsIcon icon={ZapIcon} size={12} /> Connect <HugeiconsIcon icon={ExternalLinkIcon} size={10} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Steam */}
      <div className="stg-section">
        <div className="stg-section-label">Steam</div>
        <div className="stg-row">
          <div className="stg-row-icon"><HugeiconsIcon icon={FolderOpenIcon} size={15} /></div>
          <div className="stg-row-text">
            <div className="stg-row-label">Steam Path</div>
            <div className="stg-row-sub" title={steamPathSub}>{steamPathSub}</div>
          </div>
          <div className="stg-row-control">
            <input
              className="stg-input"
              value={settings.steam_path}
              onChange={e => update('steam_path', e.target.value)}
              placeholder="/path/to/Steam"
            />
            <button className="stg-action" onClick={handleDetect}>
              <HugeiconsIcon icon={Refresh01Icon} size={12} /> Detect
            </button>
            <button className="stg-action" onClick={handleManualBrowse}>
              Browse
            </button>
          </div>
        </div>

        {isMac && (
          <div className="stg-row">
            <div className="stg-row-icon"><HugeiconsIcon icon={ZapIcon} size={15} /></div>
            <div className="stg-row-text">
              <div className="stg-row-label">CrossOver Mode</div>
              <div className="stg-row-sub">For Steam via CrossOver on macOS</div>
            </div>
            <div className="stg-row-control">
              <button
                className={`stg-toggle ${settings.crossover_mode ? 'stg-toggle--on' : ''}`}
                onClick={() => update('crossover_mode', !settings.crossover_mode)}
              >
                <span className="stg-toggle-dot" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Application */}
      <div className="stg-section">
        <div className="stg-section-label">Application</div>
        <div className="stg-row">
          <div className="stg-row-icon"><HugeiconsIcon icon={Download01Icon} size={15} /></div>
          <div className="stg-row-text">
            <div className="stg-row-label">Updates</div>
            <div className="stg-row-sub">
              {installed
                ? 'Update downloaded — restart to apply'
                : installing
                  ? installProgress?.total
                    ? `Downloading... ${Math.round((installProgress.downloaded / installProgress.total) * 100)}%`
                    : 'Downloading...'
                  : updateInfo
                    ? `v${updateInfo.current_version} → v${updateInfo.version}`
                    : 'Up to date'}
            </div>
          </div>
          <div className="stg-row-control">
            {installed ? (
              <button className="stg-action stg-action--primary" onClick={onRestart}>
                <HugeiconsIcon icon={Refresh01Icon} size={12} /> Restart
              </button>
            ) : installing ? (
              <span className="stg-tag"><HugeiconsIcon icon={Loading01Icon} size={11} className="icon-spinner" /> Installing</span>
            ) : updateInfo ? (
              <button className="stg-action stg-action--primary" onClick={onInstallUpdate}>
                <HugeiconsIcon icon={Download01Icon} size={12} /> Install v{updateInfo.version}
              </button>
            ) : (
              <button className="stg-action" onClick={onCheckUpdate}>
                <HugeiconsIcon icon={Refresh01Icon} size={12} /> Check
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="stg-foot">
        LuaDepot v0.1.0 — <span className="stg-link" onClick={() => openUrl('https://api.luadepot.dev')}>api.luadepot.dev</span>
      </div>

      {/* Unsaved changes dock */}
      <div className={`stg-savebar ${isDirty ? 'stg-savebar--visible' : ''}`}>
        <span className="stg-savebar-text">You have unsaved changes</span>
        <div className="stg-savebar-actions">
          <button className="stg-savebar-discard" onClick={handleDiscard} disabled={saving}>
            Discard
          </button>
          <button className="stg-savebar-save" onClick={handleSave} disabled={saving}>
            {saving ? <HugeiconsIcon icon={Loading01Icon} size={13} className="icon-spinner" /> : <HugeiconsIcon icon={CheckIcon} size={13} />}
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}