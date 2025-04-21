'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

// Icon Components
const SunIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="24" height="24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4V2m0 20v-2m8-8h2M2 12H4m13.657 7.657l1.414 1.414M4.929 4.929l1.414 1.414m0 12.728L4.929 19.071M19.071 4.929l-1.414 1.414M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
);
const MoonIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="var(--foreground)" width="24" height="24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
);

export function ThemeHeader() {
    // Dynamic title based on current path
    const pathname = usePathname();
    let title = 'Lehrveranstaltungen';
    if (pathname === '/overview') {
        title = 'Übersicht';
    } else if (pathname === '/') {
        title = 'Startseite';
    } else if (pathname.startsWith('/module/')) {
        const moduleName = pathname.split('/module/')[1];
        title = `Modul: ${moduleName}`;
    }

    // Theme logic
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

    return (
        <header className="header">
            <h1 className="heading">{title}</h1>
            <button className="themeToggle" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            >
                {theme === 'light' ? <MoonIcon /> : <SunIcon />}
            </button>
        </header>
    );
}
