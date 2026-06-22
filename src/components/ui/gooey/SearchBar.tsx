import { useState, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { SteamAppInfo } from "@/types/steam";
import useDebounce from "./hooks/useDebounce";

interface SearchBarProps {
  onResults: (results: SteamAppInfo[], query: string) => void;
  onPreview?: (appid: number) => void;
  setIsLoading: (loading: boolean) => void;
  isSearchPage?: boolean;
}

export function SearchBar({ onResults, onPreview, setIsLoading, isSearchPage = false }: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SteamAppInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const debouncedQuery = useDebounce(query, 500);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!debouncedQuery) {
      setResults([]);
      setLoading(false);
      setIsLoading(false);
      onResults([], "");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setIsLoading(true);

    invoke<SteamAppInfo[]>("search_steam", { query: debouncedQuery })
      .then((res) => {
        if (cancelled) return;
        const top = res.slice(0, 8);
        setResults(isSearchPage ? [] : top);
        setLoading(false);
        setIsLoading(false);
        onResults(res, debouncedQuery);
      })
      .catch(() => {
        if (!cancelled) {
          setLoading(false);
          setIsLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [debouncedQuery]);

  const showDropdown = !isSearchPage && focused && (results.length > 0 || loading);

  return (
    <div ref={wrapperRef} className="searchbar no-drag" style={{ position: "relative" }}>
      <div className={`searchbar-input-wrap${focused ? " focused" : ""}`}>
        <svg className="searchbar-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          className="searchbar-input"
          placeholder="Search games..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          aria-label="Search games"
        />
        {loading && (
          <svg className="searchbar-spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        )}
        {query && !loading && (
          <button className="searchbar-clear" onClick={() => { setQuery(""); inputRef.current?.focus(); }} aria-label="Clear search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18" />
              <path d="M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="searchbar-dropdown">
          {loading && results.length === 0 && (
            <div className="searchbar-empty">Searching...</div>
          )}
          {!loading && results.length === 0 && query && (
            <div className="searchbar-empty">No results found</div>
          )}
          {results.map((item) => (
            <button
              key={item.appid}
              className="searchbar-result"
              onClick={() => {
                onPreview?.(item.appid);
                setFocused(false);
              }}
            >
              <img src={item.image_url} alt="" className="searchbar-result-img" />
              <span className="searchbar-result-name">{item.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
