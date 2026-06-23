/**
 * i18n for the CRM — mirrors the marketing site (same languages, same useT
 * pattern). Each component owns a local dictionary (STRINGS) and calls
 * `const t = useT(STRINGS)` then `t('key')`. The chosen language persists in
 * localStorage and is shared with the website ('md_lang').
 */
import { createContext, useContext, useEffect, useState } from 'react';

export const LANGUAGES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { code: 'hinglish', label: 'Hinglish', native: 'Hinglish' },
  { code: 'gu', label: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'mr', label: 'Marathi', native: 'मराठी' },
  { code: 'mwr', label: 'Marwadi', native: 'मारवाड़ी' },
];

const STORAGE_KEY = 'md_lang';
const DEFAULT_LANG = 'hinglish';
const VALID = new Set(LANGUAGES.map((l) => l.code));

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    try { const s = localStorage.getItem(STORAGE_KEY); if (s && VALID.has(s)) return s; } catch { /* ignore */ }
    return DEFAULT_LANG;
  });

  const setLang = (next) => {
    setLangState(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* ignore */ }
  };

  useEffect(() => {
    document.documentElement.lang = lang === 'hinglish' ? 'hi' : lang;
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  return useContext(LanguageContext) || { lang: DEFAULT_LANG, setLang: () => {} };
}

// Component-local translator. Missing keys fall back to English, then the key.
// An intentionally empty string is respected (?? not ||).
export function useT(localDict) {
  const { lang } = useLang();
  return (key) => {
    const entry = localDict[key];
    if (!entry) return key;
    return entry[lang] ?? entry.en ?? key;
  };
}
