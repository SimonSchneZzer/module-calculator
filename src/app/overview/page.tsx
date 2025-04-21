'use client';

import { useEffect, useState } from 'react';
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

  // Theme logic (unverändert)
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

  // 1) Daten laden: Einträge + moduleDeps
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
        if (!(info.Modul in depsMap)) depsMap[info.Modul] = (info.dependentModules ?? info.Voraussetzung) as string[];
      });

      setEintraege(entries);
      setModuleDeps(depsMap);
    };
    fetchData();
  }, []);

  // 2) Toggle Auswahl
  const toggleLvAuswahl = (lvName: string) =>
    setNichtBestandeneLVs(prev =>
      prev.includes(lvName) ? prev.filter(l => l !== lvName) : [...prev, lvName]
    );

  // 3) Filter: Suche + entfernt ausgewählte
  const gefiltert = eintraege.filter(e =>
    !nichtBestandeneLVs.includes(e.lehrveranstaltung) &&
    (e.lehrveranstaltung.toLowerCase().includes(suchbegriff.toLowerCase()) ||
      e.modul.toLowerCase().includes(suchbegriff.toLowerCase()))
  );

  // 4) Sperrlogik mit Ausnahme für Geschwister im gleichen Semester
  useEffect(() => {
    // gescheiterte Einträge
    const failed = nichtBestandeneLVs
      .map(name => eintraege.find(e => e.lehrveranstaltung === name))
      .filter((e): e is LehrveranstaltungEintrag => Boolean(e));

    const blocked = new Set<string>();

    // 4a) Geschwister in demselben Modul, aber unterschiedlichem Semester
    failed.forEach(f => {
      eintraege.forEach(e => {
        if (
          e.modul === f.modul &&
          f.semester != null && e.semester != null &&
          e.semester !== f.semester
        ) {
          blocked.add(e.lehrveranstaltung);
        }
      });
    });

    // 4b) Kind-Module rekursiv
    const visitedMods = new Set<string>();
    const queue = failed.map(f => f.modul);
    while (queue.length) {
      const mod = queue.shift()!;
      (moduleDeps[mod] || []).forEach(child => {
        if (!visitedMods.has(child)) {
          visitedMods.add(child);
          queue.push(child);
        }
      });
    }
    // alle LVs dieser Module blocken
    eintraege.forEach(e => visitedMods.has(e.modul) && blocked.add(e.lehrveranstaltung));

    setGesperrteLVs(blocked);
  }, [nichtBestandeneLVs, eintraege, moduleDeps]);

  // 5) Sortierung: Blockierte zuerst, dann alphabetisch
  const sortedList = [...gefiltert].sort((a, b) => {
    const aB = gesperrteLVs.has(a.lehrveranstaltung) ? 1 : 0;
    const bB = gesperrteLVs.has(b.lehrveranstaltung) ? 1 : 0;
    if (bB - aB) return bB - aB;
    return a.lehrveranstaltung.localeCompare(b.lehrveranstaltung, 'de', { sensitivity: 'base' });
  });

  return (
    <>
      <div className={styles.searchContainer}>
        <input
          type="text" placeholder="Suche..."
          value={suchbegriff} onChange={e => setSuchbegriff(e.target.value)}
          className={styles.searchInput}
        />
        {suchbegriff ? (
          <button className={styles.clearButton}
            onClick={() => setSuchbegriff('')} aria-label="Suchfeld löschen">
            ×
          </button>
        ) : (
          <div className={styles.searchIcon} aria-hidden>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="20" height="20">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-4.35-4.35m2.1-5.65a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        )}
      </div>

      <div className={styles.bubbles}>
        {nichtBestandeneLVs.map((lv, i) => {
          const modName = eintraege.find(e => e.lehrveranstaltung === lv)?.modul;
          return (
            <span key={i} className={`${styles.bubble} bubble`} onClick={() => toggleLvAuswahl(lv)}>
              {lv}{modName ? ` (${modName})` : ''}
              <button className={`${styles.bubbleClose} bubbleClose`} onClick={e => { e.stopPropagation(); toggleLvAuswahl(lv); }}>
                ×
              </button>
            </span>
          );
        })}
      </div>

      <ul className={styles.list}>
        {sortedList.map((e, idx) => (
          <li key={idx} className={`${styles.item} ${gesperrteLVs.has(e.lehrveranstaltung) ? `${styles.blocked} blocked` : ''}`} onClick={() => toggleLvAuswahl(e.lehrveranstaltung)}>
            <p><strong>{e.lehrveranstaltung}</strong></p>
            <p>Modul: {e.modul}</p>
            <p>Abhängige Module: {e.dependentModules.length ? e.dependentModules.join(', ') : 'Keine'}</p>
          </li>
        ))}
      </ul>
    </>
  );
}
