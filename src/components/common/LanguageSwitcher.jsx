/**
 * Language dropdown — shows the native language names. Drops into auth pages
 * and the topbar. Persists via LanguageContext.
 */
import { LANGUAGES, useLang } from '../../i18n/LanguageContext';

export default function LanguageSwitcher({ style }) {
  const { lang, setLang } = useLang();
  return (
    <select
      className="input"
      value={lang}
      onChange={(e) => setLang(e.target.value)}
      aria-label="Language"
      style={{ width: 'auto', padding: '6px 28px 6px 10px', fontSize: 13, cursor: 'pointer', ...style }}
    >
      {LANGUAGES.map((l) => (
        <option key={l.code} value={l.code}>🌐 {l.native}</option>
      ))}
    </select>
  );
}
