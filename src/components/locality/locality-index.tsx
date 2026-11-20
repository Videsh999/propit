"use client";

import Link from "next/link";
import { useCustomer } from "@/components/auth/auth-provider";
import { useMemo, useRef, useState } from "react";
import { ChevronDown, MapPin, SlidersHorizontal } from "lucide-react";
import { Img } from "@/components/ui/img";
import { Button } from "@/components/ui/button";
import { formatCount, formatPrice, formatPriceSqft } from "@/lib/format";
import type { Locality } from "@/types";
import { cn } from "@/lib/utils";
import styles from "@/components/browse/browse.module.css";

export function LocalityIndex({ localities }: { localities: Locality[] }) {
  const { production } = useCustomer();
  const [query, setQuery] = useState("");
  const [corridor, setCorridor] = useState("");
  const [rate, setRate] = useState("");
  const [sort, setSort] = useState("inventory");
  const [shown, setShown] = useState(12);
  const [mobileFilters, setMobileFilters] = useState(false);
  const resultsRef = useRef<HTMLElement>(null);
  function showResults() {
    setMobileFilters(false);
    requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }));
  }
  const corridors = useMemo(() => [...new Set(localities.map((locality) => locality.corridor.split("·")[0].trim()))].sort(), [localities]);
  const matches = useMemo(() => localities.filter((locality) =>
    (!query.trim() || `${locality.name} ${locality.corridor}`.toLowerCase().includes(query.trim().toLowerCase()))
    && (!corridor || locality.corridor.split("·")[0].trim() === corridor)
    && (!rate || locality.avgPriceSqft <= Number(rate)),
  ).sort((a, b) => sort === "price_asc" ? a.avgPriceSqft - b.avgPriceSqft : sort === "price_desc" ? b.avgPriceSqft - a.avgPriceSqft
    : sort === "momentum" ? b.momentumPct - a.momentumPct : b.inventoryCount - a.inventoryCount), [localities, query, corridor, rate, sort]);
  function reset() { setQuery(""); setCorridor(""); setRate(""); setShown(12); }

  return <>
    <div className={styles.toolbar}>
      <p role="status" className={styles.count}><strong>{matches.length}</strong> {matches.length === 1 ? "locality" : "localities"}{corridor && ` · ${corridor} Hyderabad`}</p>
      <div className={styles.toolbarActions}>
        <Button className={styles.mobileToggle} size="sm" aria-expanded={mobileFilters} aria-controls="locality-filters" onClick={() => setMobileFilters(!mobileFilters)}><SlidersHorizontal size={14} /> Filters</Button>
        <div className={styles.sort}><select aria-label="Sort localities" value={sort} onChange={(event) => { setSort(event.target.value); setShown(12); }}><option value="inventory">Most properties</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option><option value="momentum">Price movement</option></select><ChevronDown size={14} aria-hidden="true" /></div>
      </div>
    </div>
    <div className={styles.layout}>
      <aside id="locality-filters" aria-label="Locality filters" className={cn(styles.sidebar, mobileFilters && styles.sidebarOpen)}>
        <div className={styles.sidebarHeader}><h2>Filters</h2><button type="button" className={styles.reset} onClick={reset}>Reset all</button></div>
        <div className={styles.fields}>
          <label className={styles.field}><span>Locality name</span><input type="search" aria-label="Locality name" placeholder="Find a neighbourhood" value={query} onChange={(event) => { setQuery(event.target.value); setShown(12); }} /></label>
          <label className={styles.field}><span>Hyderabad corridor</span><select aria-label="Hyderabad corridor" value={corridor} onChange={(event) => { setCorridor(event.target.value); setShown(12); }}><option value="">All corridors</option>{corridors.map((name) => <option key={name}>{name}</option>)}</select><ChevronDown size={13} aria-hidden="true" /></label>
          <label className={styles.field}><span>Average price per sq.ft</span><select aria-label="Average price per sq.ft" value={rate} onChange={(event) => { setRate(event.target.value); setShown(12); }}><option value="">Any price</option>{[6000, 10000, 15000].map((price) => <option key={price} value={price}>Up to ₹{price.toLocaleString("en-IN")}</option>)}</select><ChevronDown size={13} aria-hidden="true" /></label>
        </div>
        <p className={styles.notice}>{production ? "Price indicators are estimates based on the published catalog." : "Prices and movement are modelled from demo inventory."}</p>
        <Button variant="primary" className={cn(styles.mobileToggle, "mt-5 w-full")} onClick={showResults}>Show {matches.length} {matches.length === 1 ? "locality" : "localities"}</Button>
      </aside>
      <section ref={resultsRef} aria-label="Locality results" className={styles.results}>
        {matches.length ? <>
          <div className={styles.grid}>{matches.slice(0, shown).map((locality) => (
            <article key={locality.id} className={styles.item}>
              <Link href={`/locality/${locality.slug}`}>
                <Img src={locality.heroImage} alt="" className={styles.localityImage} sizes="(max-width: 540px) 95vw, (max-width: 1250px) 45vw, 28vw" />
                <div className={styles.localityHeading}><small>{locality.corridor}</small><h2>{locality.name}</h2></div>
              </Link>
              <p className={styles.summary}>{locality.summary}</p>
              <dl className={styles.stats}>
                <div><dt>Average price</dt><dd>{formatPriceSqft(locality.avgPriceSqft)}</dd></div>
                <div><dt>Median home</dt><dd>{formatPrice(locality.medianPrice)}</dd></div>
                <div><dt>Properties</dt><dd>{formatCount(locality.inventoryCount)}</dd></div>
                <div><dt>1-year movement</dt><dd>{locality.momentumPct > 0 ? "+" : ""}{locality.momentumPct}%</dd></div>
              </dl>
              <div className={styles.itemFooter}><Link href={`/locality/${locality.slug}`}>Locality details</Link><Link href={`/search?type=buy&locality=${locality.slug}`} aria-label={`View homes in ${locality.name}`}><MapPin size={13} aria-hidden="true" /> View homes</Link></div>
            </article>
          ))}</div>
          <p className={styles.notice}>Showing {Math.min(shown, matches.length)} of {matches.length} localities.</p>
          {shown < matches.length && <div className={styles.loadMore}><Button onClick={() => setShown(shown + 12)}>Show more localities</Button></div>}
        </> : <div className={styles.empty}><h2>No matching localities</h2><p>Try another name, corridor or price range.</p><Button onClick={reset}>Clear filters</Button></div>}
      </section>
    </div>
  </>;
}
