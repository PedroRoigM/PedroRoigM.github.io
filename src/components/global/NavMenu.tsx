/**
 * NavMenu — Sticky navigation with monogram, top-level links and language
 * switcher, with a hamburger panel on small screens.
 *
 * Replaces the previous pure-Astro Nav. The previous Nav pushed the section
 * links and language switcher into a single flex row that overflowed the
 * viewport on phones (the ES/EN toggle bumped the page wider than the
 * viewport, which made horizontal scroll appear across every section).
 *
 * Link targets (top-level pages, not in-page anchors):
 *   - Home (`/` or `/en/`) — placeholder personal page
 *   - TFG (`/f1` or `/en/f1`) — F1 multi-agent system portfolio
 *   - Contacto (`#contact`) — anchor in the footer (rendered on every page)
 *
 * Layout strategy:
 *   - Desktop (≥900 px):  brand | top-level links (inline) | language switcher
 *   - Mobile  (<900 px):  brand | hamburger button; the button opens a
 *                         full-width dropdown panel that holds both the
 *                         top-level links and the language switcher
 *
 * State: `open` (boolean) toggled by the hamburger button, the backdrop,
 * and any nav link click (so the dropdown closes after navigation).
 */
import { useEffect, useState } from 'react';
import LanguageSwitcher from './LanguageSwitcher';

interface NavLink {
  label: string;
  href: string;
}

interface Props {
  locale: 'es' | 'en';
}

export default function NavMenu({ locale }: Props) {
  const links: NavLink[] = locale === 'es'
    ? [
        { label: 'Home', href: '/' },
        { label: 'TFG', href: '/f1' },
        { label: 'Contacto', href: '#contact' },
      ]
    : [
        { label: 'Home', href: '/en/' },
        { label: 'TFG', href: '/en/f1' },
        { label: 'Contact', href: '#contact' },
      ];

  const [open, setOpen] = useState(false);

  // Close the dropdown with Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Lock body scroll while the panel is open on mobile.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const homeHref = locale === 'es' ? '/' : '/en/';

  return (
    <>
      <nav className="nav" aria-label="Primary navigation">
        <div className="nav__inner">
          <a
            href={homeHref}
            className="nav__brand"
            aria-label="Pedro Roig Morera — Home"
            onClick={() => setOpen(false)}
          >
            <span className="nav__brand-mark">PR</span>
            <span className="nav__brand-text">Pedro Roig Morera</span>
          </a>

          {/* Desktop links — hidden below 900 px (the hamburger carries
              the same content on mobile). */}
          <ul className="nav__links">
            {links.map((s) => (
              <li key={s.href}>
                <a href={s.href} className="nav__link">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>

          <div className="nav__actions">
            <LanguageSwitcher />
            <button
              type="button"
              className="nav__burger"
              aria-label={open ? 'Close menu' : 'Open menu'}
              aria-expanded={open}
              aria-controls="nav-menu-panel"
              onClick={() => setOpen((v) => !v)}
            >
              <span className={`nav__burger-line ${open ? 'is-x-top' : ''}`} />
              <span className={`nav__burger-line ${open ? 'is-x-mid' : ''}`} />
              <span className={`nav__burger-line ${open ? 'is-x-bot' : ''}`} />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile dropdown panel — only rendered when open. Sits beneath
          the sticky nav as an absolutely-positioned overlay, scrollable
          if the content exceeds the viewport height. */}
      <div
        id="nav-menu-panel"
        className={`nav-panel ${open ? 'is-open' : ''}`}
        aria-hidden={!open}
      >
        <ul className="nav-panel__links">
          {links.map((s) => (
            <li key={s.href}>
              <a
                href={s.href}
                className="nav-panel__link"
                onClick={() => setOpen(false)}
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="nav-panel__lang">
          <LanguageSwitcher />
        </div>
      </div>

      {/* Invisible click-catcher behind the panel to close on outside click. */}
      {open && (
        <button
          type="button"
          className="nav-panel__scrim"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        />
      )}

      <style>{`
        .nav {
          position: sticky;
          top: 0;
          z-index: 60;
          background: rgba(11, 12, 16, 0.94);
          backdrop-filter: blur(16px) saturate(140%);
          -webkit-backdrop-filter: blur(16px) saturate(140%);
          border-bottom: 1px solid var(--color-border-strong);
        }

        .nav__inner {
          max-width: var(--max-width);
          margin: 0 auto;
          padding: var(--space-3) var(--space-5);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-5);
        }

        .nav__brand {
          display: inline-flex;
          align-items: center;
          gap: var(--space-3);
          font-family: var(--font-display);
          font-weight: 600;
          color: var(--color-fg);
          transition: opacity var(--motion-duration-short) var(--motion-ease-out);
          flex-shrink: 0;
          text-decoration: none;
        }
        .nav__brand:hover { opacity: 0.8; }

        .nav__brand-mark {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          background: var(--color-brand);
          color: var(--ink);
          border-radius: var(--radius-sm);
          font-size: var(--text-sm);
          font-weight: 700;
          letter-spacing: var(--tracking-tight);
        }

        .nav__brand-text {
          font-size: var(--text-sm);
          letter-spacing: var(--tracking-snug);
        }

        /* ---- Desktop nav links (≥900 px) ---------------------------------- */
        .nav__links {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          align-items: center;
          gap: var(--space-5);
        }

        .nav__link {
          font-family: var(--font-display);
          font-size: var(--text-xs);
          text-transform: uppercase;
          letter-spacing: var(--tracking-widest);
          color: var(--color-fg-muted);
          transition: color var(--motion-duration-short) var(--motion-ease-out);
          position: relative;
          text-decoration: none;
        }
        .nav__link::after {
          content: '';
          position: absolute;
          left: 0;
          bottom: -4px;
          width: 0;
          height: 1px;
          background: var(--color-brand);
          transition: width var(--motion-duration-short) var(--motion-ease-out);
        }
        .nav__link:hover { color: var(--color-fg); }
        .nav__link:hover::after { width: 100%; }

        /* ---- Right side: language + burger -------------------------------- */
        .nav__actions {
          display: inline-flex;
          align-items: center;
          gap: var(--space-3);
          flex-shrink: 0;
        }

        .nav__burger {
          display: none;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          padding: 0;
          background: transparent;
          border: 1px solid var(--rule);
          border-radius: var(--radius-sm);
          cursor: pointer;
          position: relative;
          color: var(--color-fg);
          transition: border-color var(--motion-duration-short) var(--motion-ease-out);
        }
        .nav__burger:hover { border-color: var(--rule-strong); }

        .nav__burger-line {
          position: absolute;
          left: 9px;
          right: 9px;
          height: 2px;
          background: currentColor;
          border-radius: 2px;
          transition:
            transform 220ms var(--motion-ease-out),
            opacity 180ms var(--motion-ease-out),
            top 220ms var(--motion-ease-out);
        }
        /* Closed state: three stacked lines at 12 / 19 / 26 px.
           The :not(.is-x-*) selector has higher specificity (0,2,1) than
           the per-child :nth-child(N) alone (0,1,1), which makes the X
           rules below win on open without needing !important. */
        .nav__burger-line:not(.is-x-top):not(.is-x-mid):not(.is-x-bot):nth-child(1) {
          top: 12px;
        }
        .nav__burger-line:not(.is-x-top):not(.is-x-mid):not(.is-x-bot):nth-child(2) {
          top: 19px;
        }
        .nav__burger-line:not(.is-x-top):not(.is-x-mid):not(.is-x-bot):nth-child(3) {
          top: 26px;
        }
        /* X transformation when open. The is-x modifiers raise
           specificity past the closed-state rules, and these open
           rules are listed AFTER them so source order wins any ties. */
        .nav__burger-line.is-x-top {
          top: 19px;
          transform: rotate(45deg);
        }
        .nav__burger-line.is-x-mid {
          opacity: 0;
        }
        .nav__burger-line.is-x-bot {
          top: 19px;
          transform: rotate(-45deg);
        }

        /* ---- Responsive: collapse to hamburger below 900 px --------------- */
        @media (max-width: 900px) {
          .nav__links { display: none; }
          .nav__burger { display: inline-flex; }
          .nav__brand-text { display: none; }
          /* 2026-09-22: the language switcher lives in the hamburger panel
             only. Hiding it in the header on mobile avoids showing it
             twice (header + panel). */
          .nav__actions .lang-switcher { display: none; }
        }

        /* ---- Mobile dropdown panel ---------------------------------------- */
        .nav-panel {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 55;
          padding: calc(var(--space-12) + var(--space-3)) var(--space-5) var(--space-8);
          background: rgba(11, 12, 16, 0.98);
          backdrop-filter: blur(16px) saturate(140%);
          -webkit-backdrop-filter: blur(16px) saturate(140%);
          border-bottom: 1px solid var(--color-border-strong);
          display: flex;
          flex-direction: column;
          gap: var(--space-6);
          transform: translateY(-100%);
          opacity: 0;
          pointer-events: none;
          transition:
            transform 280ms var(--motion-ease-out),
            opacity 220ms var(--motion-ease-out);
          max-height: 100vh;
          overflow-y: auto;
        }
        .nav-panel.is-open {
          transform: translateY(0);
          opacity: 1;
          pointer-events: auto;
        }

        .nav-panel__links {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }
        .nav-panel__link {
          display: block;
          padding: var(--space-4) var(--space-3);
          font-family: var(--font-display);
          font-size: var(--text-lg);
          font-weight: 500;
          color: var(--color-fg);
          text-decoration: none;
          border-bottom: 1px solid var(--rule);
          transition: color var(--motion-duration-short) var(--motion-ease-out);
        }
        .nav-panel__link:hover { color: var(--color-brand); }

        .nav-panel__lang {
          display: flex;
          justify-content: center;
          padding-top: var(--space-4);
        }

        /* Click-catcher for outside clicks */
        .nav-panel__scrim {
          position: fixed;
          inset: 0;
          z-index: 54;
          background: transparent;
          border: 0;
          cursor: default;
        }

        /* On desktop the hamburger / panel are dormant */
        @media (min-width: 901px) {
          .nav-panel { display: none; }
          .nav-panel__scrim { display: none; }
        }
      `}</style>
    </>
  );
}
