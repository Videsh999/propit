"use client";

import { useId, useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import styles from "./locality-filter.module.css";

export interface LocalityOption { slug: string; name: string; count?: number }

export function LocalityFilter({ items, value, onChange, countLabel = "homes" }: {
  items: LocalityOption[];
  value: string;
  onChange: (slug: string) => void;
  countLabel?: string;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const visible = useMemo(() => items.filter(({ name }) => name.toLowerCase().includes(query.trim().toLowerCase())), [items, query]);
  return (
    <section className={styles.section} aria-labelledby={id}>
      <div className={styles.heading}>
        <h3 id={id}>Localities</h3>
        <button type="button" onClick={() => { setQuery(""); onChange(""); }} aria-pressed={!value}>All areas</button>
      </div>
      <label className={styles.search}>
        <Search size={14} aria-hidden="true" />
        <input type="search" aria-label="Find a locality" placeholder="Find a locality" value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      <div className={styles.options} role="group" aria-label="Choose a locality">
        {visible.map(({ slug, name, count }) => (
          <button key={slug} type="button" aria-pressed={value === slug} onClick={() => onChange(slug)} title={name}
            aria-label={`${name}${count === undefined ? "" : `, ${count} ${count === 1 ? countLabel === "homes" ? "home" : "project" : countLabel}`}`}>
            <span>{name}</span>
            {value === slug ? <Check size={13} aria-hidden="true" /> : count !== undefined && <small>{count}</small>}
          </button>
        ))}
      </div>
      {visible.length === 0 && <p className={styles.empty}>No matching locality. Try another name.</p>}
    </section>
  );
}
