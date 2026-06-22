import { useState, useRef, useEffect } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Message01Icon, Cancel01Icon } from '@hugeicons/core-free-icons';
import { invoke } from '@tauri-apps/api/core';

interface FeedbackWidgetProps {
  open: boolean;
  onClose: () => void;
}

const CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'bug', label: 'Bug Report' },
  { value: 'feature', label: 'Feature Request' },
];

export default function FeedbackWidget({ open, onClose }: FeedbackWidgetProps) {
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('general');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [userName, setUserName] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => textareaRef.current?.focus(), 100);
      // Get user name from token
      invoke<{ backend_token: string }>('get_settings').then((s) => {
        if (s.backend_token) {
          try {
            const payload = JSON.parse(atob(s.backend_token.split('.')[1]));
            setUserName(payload.username || payload.name || '');
          } catch {}
        }
      }).catch(() => {});
    } else {
      setMessage('');
      setCategory('general');
      setSubmitted(false);
      setDropdownOpen(false);
    }
  }, [open]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setLoading(true);
    try {
      let token = '';
      try {
        const settings = await invoke<{ backend_token: string }>('get_settings');
        token = settings.backend_token || '';
      } catch {}
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      await fetch('https://luadepot-admin.vercel.app/api/feedback/public', {
        method: 'POST',
        headers,
        body: JSON.stringify({ message: message.trim(), category, platform: 'app' }),
      });
      setSubmitted(true);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div ref={ref} className="fb-popover">
      {submitted ? (
        <div className="fb-success">
          <HugeiconsIcon icon={Message01Icon} size={20} color="#16a34a" />
          <span className="fb-success-text">Feedback sent. Thank you!</span>
          <button onClick={onClose} className="fb-success-close">Done</button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="fb-form">
          <div className="fb-header">
            <div className="flex flex-col">
              <span className="fb-title">Send Feedback</span>
              {userName && <span className="fb-subtitle">as {userName}</span>}
            </div>
            <button type="button" onClick={onClose} className="fb-close">
              <HugeiconsIcon icon={Cancel01Icon} size={13} />
            </button>
          </div>

          <div className="fb-select-wrap">
            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="fb-select"
            >
              {CATEGORIES.find(c => c.value === category)?.label}
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none" className="fb-select-arrow">
                <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {dropdownOpen && (
              <div className="fb-dropdown">
                {CATEGORIES.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => { setCategory(c.value); setDropdownOpen(false); }}
                    className={`fb-dropdown-item${category === c.value ? ' active' : ''}`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="What's on your mind?"
            rows={3}
            className="fb-textarea"
          />

          <button
            type="submit"
            disabled={loading || !message.trim()}
            className="fb-submit"
          >
            {loading ? 'Sending...' : 'Submit'}
          </button>
        </form>
      )}
    </div>
  );
}
