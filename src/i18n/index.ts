import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import yo from './locales/yo.json';
import ig from './locales/ig.json';
import ha from './locales/ha.json';
import pcm from './locales/pcm.json';

const resources = {
  en:  { translation: en },
  yo:  { translation: yo },
  ig:  { translation: ig },
  ha:  { translation: ha },
  pcm: { translation: pcm },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
