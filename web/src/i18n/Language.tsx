import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
type Language = "en" | "es";
const Context = createContext<{
  language: Language;
  setLanguage: (value: Language) => void;
  t: (en: string, es: string) => string;
} | null>(null);
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    try {
      return localStorage.getItem("terra-language") === "es" ? "es" : "en";
    } catch {
      return "en";
    }
  });
  useEffect(() => {
    document.documentElement.lang = language;
    try {
      localStorage.setItem("terra-language", language);
    } catch {
      /* Storage is optional. */
    }
  }, [language]);
  return (
    <Context.Provider
      value={{
        language,
        setLanguage,
        t: (en, es) => (language === "es" ? es : en),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useLanguage() {
  const value = useContext(Context);
  if (!value) throw new Error("LanguageProvider required");
  return value;
}
