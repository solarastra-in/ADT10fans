import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ar } from './i18n/ar';
import { hi } from './i18n/hi';
import { ur } from './i18n/ur';

/**
 * Translations without a library. The English text is the key: t('Pick your Dream XI').
 * Other languages map English -> translation; anything missing falls back to English.
 * Placeholders use {name}: t('{n} fans', { n: 12 }).
 */
export type Lang = 'en' | 'ar' | 'hi' | 'ur';
export const LANGUAGES: { code: Lang; label: string; native: string; dir: 'ltr' | 'rtl' }[] = [
  { code: 'en', label: 'English', native: 'English', dir: 'ltr' },
  { code: 'ar', label: 'Arabic', native: 'العربية', dir: 'rtl' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी', dir: 'ltr' },
  { code: 'ur', label: 'Urdu', native: 'اردو', dir: 'rtl' },
];
const DICTS: Record<Exclude<Lang, 'en'>, Record<string, string>> = { ar, hi, ur };
const KEY = 't10_lang';

function initialLang(): Lang {
  try {
    const saved = window.localStorage.getItem(KEY) as Lang | null;
    if (saved && LANGUAGES.some(l => l.code === saved)) return saved;
  } catch {
    /* ignore */
  }
  const nav = (typeof navigator !== 'undefined' ? navigator.language || '' : '').slice(0, 2) as Lang;
  return LANGUAGES.some(l => l.code === nav) ? nav : 'en';
}

export type TFunc = (text: string, vars?: Record<string, string | number>) => string;

interface Ctx {
  lang: Lang;
  dir: 'ltr' | 'rtl';
  setLang: (l: Lang) => void;
  t: TFunc;
  /** Locale for dates and numbers. */
  locale: string;
}

const fill = (s: string, vars?: Record<string, string | number>) => (vars ? s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? String(vars[k]) : m)) : s);

export function translate(lang: Lang, text: string, vars?: Record<string, string | number>) {
  const dict = lang === 'en' ? undefined : DICTS[lang];
  return fill((dict && dict[text]) || text, vars);
}

const LanguageContext = createContext<Ctx>({ lang: 'en', dir: 'ltr', setLang: () => undefined, t: fill, locale: 'en-GB' });

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const meta = LANGUAGES.find(l => l.code === lang)!;
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = meta.dir;
  }, [lang, meta.dir]);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      window.localStorage.setItem(KEY, l);
    } catch {
      /* ignore */
    }
  }, []);
  const value = useMemo<Ctx>(
    () => ({ lang, dir: meta.dir, setLang, t: (text, vars) => translate(lang, text, vars), locale: { en: 'en-GB', ar: 'ar-AE', hi: 'hi-IN', ur: 'ur-PK' }[lang] }),
    [lang, meta.dir, setLang],
  );
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export const useI18n = () => useContext(LanguageContext);
export const useT = () => useContext(LanguageContext).t;
