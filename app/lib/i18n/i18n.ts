import enTranslations from "./en.json";

export type Locale = "en";

export const defaultLocale: Locale = "en";
export const locales: Locale[] = ["en"];

export const translations = {
  en: enTranslations,
};

export function getTranslations(locale: Locale = defaultLocale) {
  return translations[locale] || translations[defaultLocale];
}

export function t(key: string, params?: Record<string, string>, locale: Locale = defaultLocale) {
  const trans = getTranslations(locale);
  const keys = key.split(".");
  
  let value: any = trans;
  for (const k of keys) {
    if (value && typeof value === "object" && k in value) {
      value = value[k];
    } else {
      return key; // Return key if translation not found
    }
  }
  
  if (typeof value !== "string") {
    return key;
  }
  
  // Replace parameters
  if (params) {
    return Object.entries(params).reduce(
      (str, [param, replacement]) => str.replace(`{${param}}`, replacement),
      value
    );
  }
  
  return value;
}