import { useState, useRef, useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";
import { invoke } from "@tauri-apps/api/core";
import type { SteamAppInfo } from "@/types/steam";

import { isUnsupportedBrowser } from "./utils/isUnsupportedBrowser";
import useDebounce from "./hooks/useDebounce";
import SearchIcon from "./components/SearchIcon";
import LoadingIcon from "./components/LoadingIcon";

const buttonVariants = {
  initial: { x: 0, width: 100 },
  step1: { x: 0, width: 100 },
  step2: { x: -20, width: 140 },
};

const iconVariants = {
  hidden: { x: -50, opacity: 0 },
  visible: { x: 16, opacity: 1 },
};

interface GooeySearchBarProps {
  onResults: (results: SteamAppInfo[], query: string) => void;
  onPreview?: (appid: number) => void;
  setIsLoading: (loading: boolean) => void;
  isSearchPage?: boolean;
}

export function GooeySearchBar({
  onResults,
  onPreview,
  setIsLoading,
  isSearchPage = false,
}: GooeySearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [state, setState] = useState({
    step: 1,
    searchData: [] as SteamAppInfo[],
    searchText: "",
    isLoading: false,
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        if (!isSearchPage) {
          setState((prevState) => ({ ...prevState, step: 1 }));
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isSearchPage]);

  const debouncedSearchText = useDebounce(state.searchText, 500);
  const isUnsupported = useMemo(() => isUnsupportedBrowser(), []);

  const handleButtonClick = () => {
    setState((prevState) => ({ ...prevState, step: 2 }));
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setState((prevState) => ({ ...prevState, searchText: e.target.value }));
  };

  useEffect(() => {
    if (state.step === 2) {
      inputRef.current?.focus();
    } else {
      setState((prevState) => ({
        ...prevState,
        searchText: "",
        searchData: [],
        isLoading: false,
      }));
      onResults([], "");
    }
  }, [state.step]);

  useEffect(() => {
    let isCancelled = false;

    if (debouncedSearchText) {
      setState((prevState) => ({ ...prevState, isLoading: true }));
      setIsLoading(true);

      const fetchData = async () => {
        try {
          const results = await invoke<SteamAppInfo[]>("search_steam", {
            query: debouncedSearchText,
          });
          if (!isCancelled) {
            const topResults = results.slice(0, 5);
            setState((prevState) => ({
              ...prevState,
              searchData: isSearchPage ? [] : topResults,
              isLoading: false,
            }));
            setIsLoading(false);
            onResults(results, debouncedSearchText);
          }
        } catch {
          if (!isCancelled) {
            setState((prevState) => ({ ...prevState, isLoading: false }));
            setIsLoading(false);
          }
        }
      };
      fetchData();
    } else {
      setState((prevState) => ({
        ...prevState,
        searchData: [],
        isLoading: false,
      }));
      setIsLoading(false);
      onResults([], "");
    }

    return () => {
      isCancelled = true;
    };
  }, [debouncedSearchText]);

  return (
    <div
      ref={wrapperRef}
      className={clsx("gooey-search-wrapper", isUnsupported && "no-goo", "no-drag")}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="button-content">
        <motion.div
          className="button-content-inner"
          initial="initial"
          animate={state.step === 1 ? "step1" : "step2"}
          transition={{ duration: 0.75, type: "spring", bounce: 0.15 }}
        >
          <motion.div
            variants={buttonVariants}
            onClick={handleButtonClick}
            whileHover={{ scale: state.step === 2 ? 1 : 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="search-btn"
            role="button"
          >
            {state.step === 1 ? (
              <span className="search-text">Search</span>
            ) : (
              <input
                ref={inputRef}
                type="text"
                className="search-input"
                placeholder="Type to search..."
                aria-label="Search input"
                value={state.searchText}
                onChange={handleSearch}
              />
            )}
          </motion.div>

          <AnimatePresence mode="wait">
            {state.step === 2 && (
              <motion.div
                key="icon"
                className="separate-element"
                initial="hidden"
                animate="visible"
                exit="hidden"
                variants={iconVariants}
                transition={{
                  delay: 0.1,
                  duration: 0.85,
                  type: "spring",
                  bounce: 0.15,
                }}
              >
                {!state.isLoading ? (
                  <SearchIcon isUnsupported={isUnsupported} />
                ) : (
                  <LoadingIcon />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Search results dropdown — OUTSIDE the gooey filter */}
      <AnimatePresence>
        {state.step === 2 && state.searchData.length > 0 && (
          <motion.div
            className="gooey-search-results"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {state.searchData.map((item, index) => (
              <motion.div
                key={item.appid}
                className="gooey-search-result"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.2 }}
                onClick={() => onPreview?.(item.appid)}
              >
                <img
                  src={item.image_url}
                  alt=""
                  className="gooey-search-result-image"
                />
                <span className="gooey-search-result-name">{item.name}</span>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
