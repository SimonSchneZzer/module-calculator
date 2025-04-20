'use client';

import { useEffect, useState } from 'react';
import styles from './overview.module.css';

// Typ für die rohen Module-Objekte aus der API
interface RawModule {
  Modul: string;
  Lehrveranstaltungen: string[];
  dependentModules?: string[];
  Voraussetzung?: string[];
}

type Modul = {
  Modul: string;
  Lehrveranstaltungen: string[];
  dependentModules: string[];
};

type LehrveranstaltungEintrag = {
  lehrveranstaltung: string;
  modul: string;
  dependentModules: string[];
};

export default function LehrveranstaltungenPage() {
  const [moduleMap, setModuleMap] = useState<Map<string, Modul>>(new Map());
  const [gesperrteLVs, setGesperrteLVs] = useState<Set<string>>(new Set());
  const [eintraege, setEintraege] = useState<LehrveranstaltungEintrag[]>([]);
  const [suchbegriff, setSuchbegriff] = useState<string>('');
  const [nichtBestandeneLVs, setNichtBestandeneLVs] = useState<string[]>([]);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined' && window.localStorage.getItem('theme')) {
      return window.localStorage.getItem('theme') as 'light' | 'dark';
    }
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  });

  // 1) Daten laden & Map erstellen
  useEffect(() => {
    const fetchData = async () => {
      const res = await fetch('/api/modules');
      const raw: RawModule[] = await res.json();

      const map = new Map<string, Modul>();
      raw.forEach((m) => {
        const deps = (m.dependentModules ?? m.Voraussetzung) as string[];
        map.set(m.Modul, {
          Modul: m.Modul,
          Lehrveranstaltungen: m.Lehrveranstaltungen,
          dependentModules: deps,
        });
      });
      setModuleMap(map);

      const flat: LehrveranstaltungEintrag[] = [];
      map.forEach((mod) => {
        mod.Lehrveranstaltungen.forEach((lv) => {
          flat.push({
            lehrveranstaltung: lv,
            modul: mod.Modul,
            dependentModules: mod.dependentModules,
          });
        });
      });
      setEintraege(flat);
    };
    fetchData();
  }, []);

  // 2) Toggle Auswahl
  const toggleLvAuswahl = (lvName: string) => {
    setNichtBestandeneLVs((prev) =>
      prev.includes(lvName) ? prev.filter((l) => l !== lvName) : [...prev, lvName]
    );
  };

  // 3) Filter (Suche + entfernt ausgewählte)
  const gefiltert = eintraege.filter(
    (e) =>
      !nichtBestandeneLVs.includes(e.lehrveranstaltung) &&
      (e.lehrveranstaltung.toLowerCase().includes(suchbegriff.toLowerCase()) ||
        e.modul.toLowerCase().includes(suchbegriff.toLowerCase()))
  );

  // 4) Sperrlogik
  useEffect(() => {
    const basisModule = nichtBestandeneLVs
      .map((lv) => eintraege.find((e) => e.lehrveranstaltung === lv)?.modul)
      .filter((m): m is string => Boolean(m));

    const gesperrtModule = new Set<string>();
    const findDeps = (mods: string[]) => {
      mods.forEach((name) => {
        if (gesperrtModule.has(name)) return;
        gesperrtModule.add(name);
        const children = moduleMap.get(name)?.dependentModules ?? [];
        if (children.length) findDeps(children);
      });
    };
    findDeps(basisModule);

    const gesperrte = new Set(
      eintraege.filter((e) => gesperrtModule.has(e.modul)).map((e) => e.lehrveranstaltung)
    );
    setGesperrteLVs(gesperrte);
  }, [nichtBestandeneLVs, eintraege, moduleMap]);

  // 5) Theme-Switch
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    window.localStorage.setItem('theme', theme);
  }, [theme]);

  const SunIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="24" height="24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4V2m0 20v-2m8-8h2M2 12H4m13.657 7.657l1.414 1.414M4.929 4.929l1.414 1.414m0 12.728L4.929 19.071M19.071 4.929l-1.414 1.414M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
  const MoonIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="var(--foreground)" width="24" height="24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  );

  return (
    <main className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.heading}>Lehrveranstaltungen</h1>
        <button className={styles.themeToggle} onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
          {theme === 'light' ? <MoonIcon /> : <SunIcon />}
        </button>
      </div>

      <input
        type="text"
        placeholder="Suche..."
        value={suchbegriff}
        onChange={(e) => setSuchbegriff(e.target.value)}
        className={styles.searchInput}
      />

      <div className={styles.bubbles}>
        {nichtBestandeneLVs.map((lv, i) => {
          const modName = eintraege.find((e) => e.lehrveranstaltung === lv)?.modul;
          return (
            <span key={i} className={`${styles.bubble} bubble`} onClick={() => toggleLvAuswahl(lv)}>
              {lv}{modName ? ` (${modName})` : ''}
              <button className={`${styles.bubbleClose} bubbleClose`} onClick={(e) => { e.stopPropagation(); toggleLvAuswahl(lv); }}>
                &times;
              </button>
            </span>
          );
        })}
      </div>

      <ul className={styles.list}>
        {gefiltert.map((eintrag, idx) => (
          <li
            key={idx}
            className={`${styles.item} ${gesperrteLVs.has(eintrag.lehrveranstaltung) ? `${styles.blocked} blocked` : ''}`}
            onClick={() => toggleLvAuswahl(eintrag.lehrveranstaltung)}
          >
            <p><strong>{eintrag.lehrveranstaltung}</strong></p>
            <p>Modul: {eintrag.modul}</p>
            <p>
              Abhängige Module:{' '}
              {eintrag.dependentModules.length > 0 ? eintrag.dependentModules.join(', ') : 'Keine'}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}