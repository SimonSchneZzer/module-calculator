'use client';

import { useEffect, useState, useRef } from 'react';
import styles from './overview.module.css';

// RawModule aus der API
interface RawModule {
  Modul: string;
  dependentModules?: string[];
  Voraussetzung?: string[];
  semester?: number;
}

// Jeder Eintrag kennt jetzt auch das Semester
interface LehrveranstaltungEintrag {
  lehrveranstaltung: string;
  modul: string;
  dependentModules: string[];
  semester?: number;
}

export default function LehrveranstaltungenPage() {
  const [eintraege, setEintraege] = useState<LehrveranstaltungEintrag[]>([]);
  const [moduleDeps, setModuleDeps] = useState<Record<string, string[]>>({});
  const [gesperrteLVs, setGesperrteLVs] = useState<Set<string>>(new Set());
  const [suchbegriff, setSuchbegriff] = useState<string>('');
  const [nichtBestandeneLVs, setNichtBestandeneLVs] = useState<string[]>([]);
  const [selectedSemesters, setSelectedSemesters] = useState<number[]>([]);
  const [semOpen, setSemOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Theme Logic (unverändert, siehe vorher)
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark') setTheme(stored);
    else if (window.matchMedia('(prefers-color-scheme: dark)').matches) setTheme('dark');
  }, []);
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (typeof window !== 'undefined') localStorage.setItem('theme', theme);
  }, [theme]);

  // Outside click → schließt Semester‑Modal
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setSemOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // 1) Daten laden
  useEffect(() => {
    const fetchData = async () => {
      const res = await fetch('/api/modules');
      const raw: Record<string, RawModule> = await res.json();

      const entries: LehrveranstaltungEintrag[] = [];
      const depsMap: Record<string, string[]> = {};
      Object.entries(raw).forEach(([lvName, info]) => {
        entries.push({
          lehrveranstaltung: lvName,
          modul: info.Modul,
          dependentModules: (info.dependentModules ?? info.Voraussetzung) as string[],
          semester: info.semester,
        });
        if (!(info.Modul in depsMap)) {
          depsMap[info.Modul] = (info.dependentModules ?? info.Voraussetzung) as string[];
        }
      });
      setEintraege(entries);
      setModuleDeps(depsMap);
    };
    fetchData();
  }, []);

  // 2) Toggle Auswahl
  const toggleLvAuswahl = (lv: string) =>
    setNichtBestandeneLVs(prev =>
      prev.includes(lv) ? prev.filter(x => x !== lv) : [...prev, lv]
    );

  // Semester‑Optionen ermitteln
  const semesterOptions = Array.from(
    new Set(eintraege.map(e => e.semester).filter((s): s is number => typeof s === 'number'))
  ).sort((a, b) => a - b);

  // 4) Sperrlogik (unverändert)
  useEffect(() => {
    const failed = nichtBestandeneLVs
      .map(name => eintraege.find(e => e.lehrveranstaltung === name))
      .filter((e): e is LehrveranstaltungEintrag => !!e);

    const blocked = new Set<string>();
    // Geschwister in anderem Semester sperren
    failed.forEach(f => {
      eintraege.forEach(e => {
        if (
          e.modul === f.modul &&
          f.semester != null &&
          e.semester != null &&
          e.semester !== f.semester
        ) {
          blocked.add(e.lehrveranstaltung);
        }
      });
    });
    // Kind‑Module rekursiv
    const visited = new Set<string>();
    const queue = failed.map(f => f.modul);
    while (queue.length) {
      const mod = queue.shift()!;
      (moduleDeps[mod] ?? []).forEach(child => {
        if (!visited.has(child)) {
          visited.add(child);
          queue.push(child);
        }
      });
    }
    eintraege.forEach(e => visited.has(e.modul) && blocked.add(e.lehrveranstaltung));
    setGesperrteLVs(blocked);
  }, [nichtBestandeneLVs, eintraege, moduleDeps]);

  // 5) Filter + Sortierung
  const gefiltert = eintraege.filter(e =>
    !nichtBestandeneLVs.includes(e.lehrveranstaltung) &&
    (e.lehrveranstaltung.toLowerCase().includes(suchbegriff.toLowerCase()) ||
      e.modul.toLowerCase().includes(suchbegriff.toLowerCase())) &&
    (selectedSemesters.length === 0 || (e.semester != null && selectedSemesters.includes(e.semester)))
  );

  const sortedList = [...gefiltert].sort((a, b) => {
    // a) gesperrt oben
    const aB = gesperrteLVs.has(a.lehrveranstaltung) ? 1 : 0;
    const bB = gesperrteLVs.has(b.lehrveranstaltung) ? 1 : 0;
    if (bB - aB) return bB - aB;
    // b) nach Semester
    const semA = a.semester ?? Number.MAX_SAFE_INTEGER;
    const semB = b.semester ?? Number.MAX_SAFE_INTEGER;
    if (semA !== semB) return semA - semB;
    // c) dann alphabetisch
    return a.lehrveranstaltung.localeCompare(b.lehrveranstaltung, 'de', { sensitivity: 'base' });
  });

  // 6) Gruppieren nach Semester
  const grouped = sortedList.reduce((acc, curr) => {
    const key = curr.semester ?? 0;
    if (!acc[key]) acc[key] = [];
    acc[key].push(curr);
    return acc;
  }, {} as Record<number, LehrveranstaltungEintrag[]>);

  return (
    <>
      <p>Wähle die Fächer aus, die du nicht geschafft hast, um alle Kurse rekursiv angezeigt zu bekommen, die du dadurch nicht besuchen darfst.</p>
      {/* Suchfeld + Filter-Button nebeneinander */}
      <div className={styles.searchFilterWrapper}>
        <div className={styles.searchContainer}>
          <input
            type="text"
            placeholder="Suche..."
            value={suchbegriff}
            onChange={e => setSuchbegriff(e.target.value)}
            className={styles.searchInput}
          />
          {suchbegriff ? (
            <button
              className={styles.clearButton}
              onClick={() => setSuchbegriff('')}
              aria-label="Löschen"
            >×</button>
          ) : (
            <div className={styles.searchIcon} aria-hidden>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="20" height="20">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m2.1-5.65a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          )}
        </div>
        <button
          className={styles.filterButton}
          onClick={() => setSemOpen(true)}
        >
          {selectedSemesters.length
            ? `Semester: ${selectedSemesters.join(', ')}`
            : 'Alle Semester'}
        </button>
      </div>

      <div className={styles.bubbles}>
        {nichtBestandeneLVs.map((lv, i) => {
          const modName = eintraege.find(e => e.lehrveranstaltung === lv)?.modul;
          return (
            <span
              key={i}
              className={`${styles.bubble} bubble`}
              onClick={() => toggleLvAuswahl(lv)}
            >
              {lv}{modName ? ` (${modName})` : ''}
              <button
                className={`${styles.bubbleClose} bubbleClose`}
                onClick={e => {
                  e.stopPropagation();
                  toggleLvAuswahl(lv);
                }}
              >
                ×
              </button>
            </span>
          );
        })}
      </div>

      {/* Modal für Semester */}
      {semOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalWindow} ref={dropdownRef}>
            <h2 className={styles.modalTitle}>Semester auswählen</h2>
            <div className={styles.dropdownMenu}>
              {semesterOptions.map(s => (
                <label key={s} className={styles.dropdownItem}>
                  <input
                    type="checkbox"
                    checked={selectedSemesters.includes(s)}
                    onChange={() =>
                      setSelectedSemesters(prev =>
                        prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
                      )
                    }
                  />
                  Semester {s}
                </label>
              ))}
            </div>
            <button
              className={styles.modalClose}
              onClick={() => setSemOpen(false)}
            >Schließen</button>
          </div>
        </div>
      )}

      {/* Ausgabe pro Semester-Gruppe */}
      {Object.keys(grouped)
        .sort((a, b) => Number(a) - Number(b))
        .map(key => (
          <section key={key}>
            {Number(key) !== 0 && (
              <h2 className={styles.semesterHeading}>Semester {key}</h2>
            )}
            <ul className={styles.list}>
              {grouped[Number(key)].map((e, i) => (
                <li
                  key={i}
                  className={`${styles.item} ${gesperrteLVs.has(e.lehrveranstaltung) ? `${styles.blocked} blocked` : ''
                    }`}
                  onClick={() => toggleLvAuswahl(e.lehrveranstaltung)}
                >
                  <p><strong>{e.lehrveranstaltung}</strong></p>
                  <p>Modul: {e.modul}</p>
                  <p>
                    Abhängige Module:{' '}
                    {e.dependentModules.length ? e.dependentModules.join(', ') : 'Keine'}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ))}
    </>
  );
}