'use client';

import { Mali } from 'next/font/google';
import styles from './footer.module.css';

export function Footer() {
  return (
    <footer className={styles.footer}>
      <p className={styles.disclaimer}>
        Hinweis: Diese Übersicht könnte Fehler enthalten. Bitte überprüfen Sie die Angaben bei Bedarf.
      </p>
    <p className={styles.contact}>
      Simon Schnetzer &ndash; <a href="mailto:simsch2002@gmail.com">simsch2002@gmail.com</a>
    </p>
    </footer>
  );
}