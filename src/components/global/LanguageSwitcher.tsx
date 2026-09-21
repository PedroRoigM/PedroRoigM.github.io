/**
 * LanguageSwitcher — Toggle ES/EN con persistencia en localStorage.
 * Client island. Persiste la elección y navega a la ruta equivalente.
 */
import { useEffect, useState } from 'react';

const LOCALES = [
  { code: 'es', label: 'ES' },
  { code: 'en', label: 'EN' },
] as const;

type LocaleCode = (typeof LOCALES)[number]['code'];

function getCurrentLocale(): LocaleCode {
  if (typeof window === 'undefined') return 'es';
  const path = window.location.pathname;
  if (path.startsWith('/en')) return 'en';
  return 'es';
}

function getEquivalentPath(targetLocale: LocaleCode): string {
  if (typeof window === 'undefined') return '/';
  const currentPath = window.location.pathname;
  // Quitar prefijo de locale actual
  let stripped = currentPath;
  if (currentPath.startsWith('/en')) {
    stripped = currentPath.replace(/^\/en/, '') || '/';
  } else {
    stripped = currentPath === '/' ? '/' : currentPath;
  }
  return targetLocale === 'es' ? stripped : `/en${stripped === '/' ? '' : stripped}`;
}

export default function LanguageSwitcher() {
  const [current, setCurrent] = useState<LocaleCode>('es');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const fromPath = getCurrentLocale();
    const fromStorage = localStorage.getItem('preferred-locale') as LocaleCode | null;
    const initial = fromStorage ?? fromPath;
    setCurrent(initial);
    setMounted(true);
  }, []);

  function handleSwitch(target: LocaleCode) {
    if (target === current) return;
    localStorage.setItem('preferred-locale', target);
    const newPath = getEquivalentPath(target);
    window.location.href = newPath;
  }

  if (!mounted) return null;

  return (
    <div className="lang-switcher" role="group" aria-label="Language selector">
      {LOCALES.map((locale) => (
        <button
          key={locale.code}
          onClick={() => handleSwitch(locale.code)}
          aria-pressed={current === locale.code}
          className={`lang-switcher__btn ${current === locale.code ? 'is-active' : ''}`}
        >
          {locale.label}
        </button>
      ))}
      <style>{`
        .lang-switcher {
          display: inline-flex;
          gap: var(--space-1);
          padding: var(--space-1);
          background: var(--ink-2);
          border: var(--border-thin);
          border-radius: var(--radius-md);
        }
        .lang-switcher__btn {
          padding: var(--space-1) var(--space-3);
          font-family: var(--font-display);
          font-size: var(--text-xs);
          font-weight: 600;
          letter-spacing: var(--tracking-wide);
          color: var(--color-fg-muted);
          background: transparent;
          border-radius: var(--radius-sm);
          transition: all var(--motion-duration-short) var(--motion-ease-out);
          text-transform: uppercase;
        }
        .lang-switcher__btn:hover {
          color: var(--color-fg);
        }
        .lang-switcher__btn.is-active {
          color: var(--ink);
          background: var(--color-brand);
        }
      `}</style>
    </div>
  );
}
