import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { translator, type Language, type Translator } from '../../shared/localization';
export type { Language } from '../../shared/localization';
type LocaleState = { language: Language; setLanguage: (language: Language) => void; t: Translator };
const LocaleContext = createContext<LocaleState>(null!);
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('dkkf.language');
      if (saved === 'en' || saved === 'mn') return saved;
    } catch {}
    return 'ko';
  });
  useEffect(() => {
    document.documentElement.lang = language;
    try {
      localStorage.setItem('dkkf.language', language);
    } catch {}
  }, [language]);
  const t = useMemo(() => translator(language), [language]);
  return (
    <LocaleContext.Provider value={{ language, setLanguage, t }}>{children}</LocaleContext.Provider>
  );
}
export const useLanguage = () => useContext(LocaleContext);
export const useI18n = () => useLanguage().t;
