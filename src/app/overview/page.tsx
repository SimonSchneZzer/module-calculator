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

  // Theme: statischer Default, Anpassung im useEffect
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // einmalige Initialisierung des Themes (nur im Browser)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem('theme');
      if (stored === 'light' || stored === 'dark') {
        setTheme(stored);
      } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        setTheme('dark');
      }
    }
  }, []);

  // Theme switch Effect: setzt data-theme und speichert in localStorage
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('theme', theme);
    }
  }, [theme]);

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

  // 4) Sperrlogik: nur Kind-Module blocken, Geschwister bleiben verfügbar
  useEffect(() => {
    const basisModules = nichtBestandeneLVs
      .map((lv) => eintraege.find((e) => e.lehrveranstaltung === lv)?.modul)
      .filter((m): m is string => Boolean(m));

    const startChildren = basisModules.flatMap(
      (modName) => moduleMap.get(modName)?.dependentModules || []
    );

    const gesperrtModule = new Set<string>();
    const findDeps = (mods: string[]) => {
      mods.forEach((name) => {
        if (gesperrtModule.has(name)) return;
        gesperrtModule.add(name);
        const children = moduleMap.get(name)?.dependentModules ?? [];
        if (children.length) findDeps(children);
      });
    };
    findDeps(startChildren);

    const gesperrte = new Set(
      eintraege
        .filter((e) => gesperrtModule.has(e.modul))
        .map((e) => e.lehrveranstaltung)
    );
    setGesperrteLVs(gesperrte);
  }, [nichtBestandeneLVs, eintraege, moduleMap]);

  // 5) Sortierung: Blockierte LV oben, dann alphabetisch
  const sortedList = [...gefiltert].sort((a, b) => {
    const aBlocked = gesperrteLVs.has(a.lehrveranstaltung) ? 1 : 0;
    const bBlocked = gesperrteLVs.has(b.lehrveranstaltung) ? 1 : 0;
    if (bBlocked - aBlocked !== 0) {
      return bBlocked - aBlocked;
    }
    return a.lehrveranstaltung.localeCompare(b.lehrveranstaltung, 'de', { sensitivity: 'base' });
  });

  return (
    <>
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
            <span
              key={i}
              className={`${styles.bubble} bubble`}
              onClick={() => toggleLvAuswahl(lv)}
            >
              {lv}
              {modName ? ` (${modName})` : ''}
              <button
                className={`${styles.bubbleClose} bubbleClose`}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleLvAuswahl(lv);
                }}
              >
                &times;
              </button>
            </span>
          );
        })}
      </div>

      <ul className={styles.list}>
        {sortedList.map((eintrag, idx) => (
          <li
            key={idx}
            className={`${styles.item} ${
              gesperrteLVs.has(eintrag.lehrveranstaltung) ? `${styles.blocked} blocked` : ''
            }`}
            onClick={() => toggleLvAuswahl(eintrag.lehrveranstaltung)}
          >
            <p>
              <strong>{eintrag.lehrveranstaltung}</strong>
            </p>
            <p>Modul: {eintrag.modul}</p>
            <p>
              Abhängige Module:{' '}
              {eintrag.dependentModules.length > 0
                ? eintrag.dependentModules.join(', ')
                : 'Keine'}
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}
