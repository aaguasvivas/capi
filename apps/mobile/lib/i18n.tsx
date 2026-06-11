import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { dictionaries, type Lang, type Strings } from "@capi/i18n";

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  s: Strings;
}

const I18nContext = createContext<I18nCtx>({
  lang: "es",
  setLang: () => {},
  s: dictionaries.es,
});

const STORAGE_KEY = "capi_lang";

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangRaw] = useState<Lang>("es");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === "en" || stored === "es") setLangRaw(stored);
    });
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangRaw(l);
    AsyncStorage.setItem(STORAGE_KEY, l);
  }, []);

  const s = dictionaries[lang];

  return (
    <I18nContext.Provider value={{ lang, setLang, s }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
