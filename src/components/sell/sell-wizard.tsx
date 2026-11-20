"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useCustomer } from "@/components/auth/auth-provider";
import { Check, ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { PropitMap } from "@/components/map/propit-map";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { useSuggest } from "@/lib/hooks/use-suggest";
import { AMENITIES } from "@/lib/data/developers";
import { formatPrice, formatRent, formatPriceSqft, propertyTypeLabel } from "@/lib/format";
import type { Locality, PropertyType } from "@/types";
import { cn } from "@/lib/utils";

type LocalityLite = Pick<Locality, "slug" | "name" | "center" | "boundary" | "avgPriceSqft">;

const TYPES: PropertyType[] = ["apartment", "villa", "independent_house", "penthouse", "plot", "commercial"];
const STEPS = ["Listing", "Location", "Details", "Price", "Review"] as const;

interface Draft {
  listingType: "buy" | "rent";
  propertyType: PropertyType;
  localitySlug: string;
  address: string;
  location: { lat: number; lng: number } | null;
  bedrooms: number;
  bathrooms: number;
  parking: number;
  areaSqft: string;
  amenities: string[];
  price: string;
  title: string;
  description: string;
  contactName: string;
  contactPhone: string;
}

const EMPTY: Draft = {
  listingType: "buy",
  propertyType: "apartment",
  localitySlug: "",
  address: "",
  location: null,
  bedrooms: 3,
  bathrooms: 3,
  parking: 1,
  areaSqft: "",
  amenities: [],
  price: "",
  title: "",
  description: "",
  contactName: "",
  contactPhone: "",
};

export function SellWizard({ localities }: { localities: LocalityLite[] }) {
  const customer = useCustomer();
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const reference = useRef<{ body: string; id: string } | null>(null);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [submitted, setSubmitted] = useState(false);
  const [placeQuery, setPlaceQuery] = useState("");
  const { data: places } = useSuggest(placeQuery);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const locality = localities.find((l) => l.slug === draft.localitySlug);
  const area = Number(draft.areaSqft) || 0;
  const price = Number(draft.price) || 0;
  const perSqft = area > 0 && price > 0 ? price / area : 0;

  // Guidance, not gatekeeping — tell the seller how their ask compares.
  const guidance = useMemo(() => {
    if (!locality || !perSqft || draft.listingType === "rent") return null;
    const delta = ((perSqft - locality.avgPriceSqft) / locality.avgPriceSqft) * 100;
    if (Math.abs(delta) < 8) return { tone: "ok" as const, text: `In line with ${locality.name} (${formatPriceSqft(locality.avgPriceSqft)} average).` };
    if (delta > 0) return { tone: "high" as const, text: `About ${Math.round(delta)}% above the ${locality.name} average of ${formatPriceSqft(locality.avgPriceSqft)}. Priced high sells slowly.` };
    return { tone: "low" as const, text: `About ${Math.round(-delta)}% below the ${locality.name} average of ${formatPriceSqft(locality.avgPriceSqft)}.` };
  }, [locality, perSqft, draft.listingType]);

  const errors = useMemo(() => {
    const e: Partial<Record<keyof Draft | "step", string>> = {};
    if (step >= 1 && !draft.localitySlug) e.localitySlug = "Pick the locality.";
    if (step >= 1 && !draft.location) e.location = "Place the pin on the map.";
    if (step >= 1 && draft.address.trim().length < 5) e.address = "Enter the property address.";
    if (step >= 2 && (!area || area < 100)) e.areaSqft = "Enter the built-up area in sq.ft.";
    if (step >= 3 && !price) e.price = "Enter your asking price.";
    if (step >= 4 && !draft.title.trim()) e.title = "Give the listing a title.";
    if (step >= 4 && !draft.contactName.trim()) e.contactName = "We need a name for enquiries.";
    if (step >= 4 && !/^(?:\+?91)?[6-9]\d{9}$/.test(draft.contactPhone.replace(/[\s-]/g, ""))) e.contactPhone = "Enter a valid Indian mobile number.";
    return e;
  }, [step, draft, area, price]);

  const canAdvance =
    (step === 0) ||
    (step === 1 && !!draft.localitySlug && !!draft.location && draft.address.trim().length >= 5) ||
    (step === 2 && Number.isFinite(area) && area >= 100 && area <= 1_000_000) ||
    (step === 3 && Number.isFinite(price) && price > 0 && price <= 1e12) ||
    (step === 4 && Object.keys(errors).length === 0);

  const mapPoints = draft.location
    ? [{ id: "draft", lat: draft.location.lat, lng: draft.location.lng, price: price || 0, bedrooms: draft.bedrooms, type: draft.propertyType }]
    : [];

  async function submit() {
    if (busy || !canAdvance) return;
    setBusy(true); setSubmitError(null);
    try {
      const body = JSON.stringify(draft);
      if (reference.current?.body !== body) reference.current = { body, id: crypto.randomUUID() };
      const response = await fetch("/api/listings", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": reference.current.id }, body, signal: AbortSignal.timeout(15_000) });
      const data = await response.json();
      if (!response.ok) { setSubmitError(data.error ?? "We couldn’t submit your listing. Please try again."); return; }
      setSubmissionId(data.id); setSubmitted(true);
    } catch { setSubmitError("We couldn’t reach the server. Your listing has not been confirmed; please retry."); }
    finally { setBusy(false); }
  }

  if (customer.configured && (customer.loading || !customer.user)) return <div className="mx-auto max-w-xl px-5 py-20"><h1 className="display text-[40px]">List your property.</h1><p className="mt-4 text-base text-muted">{customer.loading ? "Checking your account…" : "Sign in first so your listing is securely linked to your account."}</p>{!customer.loading && <Link href="/login?next=/sell" className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-accent px-5 font-semibold text-accent-ink">Sign in to list a property</Link>}</div>;

  if (submitted) {
    return (
      <div className="mx-auto max-w-[640px] px-5 py-24 text-center md:px-8">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[var(--accent-wash)] text-accent">
          <Check size={24} strokeWidth={2} />
        </span>
        <h1 className="display mt-6 text-[36px] text-ink">Listing submitted.</h1>
        <p className="mx-auto mt-3 max-w-[46ch] text-[15px] leading-relaxed text-muted">
          Your listing is saved securely for review. It will appear to buyers only after the property details and documents have been checked.
        </p>
        <p className="mt-3 break-all text-sm text-muted">Reference: {submissionId}</p>
        <Button variant="secondary" size="lg" className="mt-6" onClick={() => { setDraft(EMPTY); setStep(0); setSubmitted(false); }}>
          List another
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1240px] px-5 py-14 md:px-8">
      <header>
        <p className="eyebrow mb-2">Sell or rent</p>
        <h1 className="display text-[40px] leading-tight text-ink md:text-[52px]">
          Put it exactly where it is.
        </h1>
        <p className="mt-3 max-w-[54ch] text-[15px] leading-relaxed text-muted">
          Buyers on PropIT search by distance from their office and their child&apos;s school. A pin in
          the right place matters more than any description.
        </p>
      </header>

      <ol className="mt-10 flex flex-wrap items-center gap-x-1 gap-y-2 border-b border-line pb-4">
        {STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-1">
            <button
              onClick={() => i < step && setStep(i)}
              disabled={i > step}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] transition-colors",
                i === step ? "bg-inverse text-[var(--ink-inverse)]" : i < step ? "text-muted hover:text-ink" : "text-faint",
              )}
            >
              <span className={cn("tnum grid h-4 w-4 place-items-center rounded-full text-[10px]", i < step ? "bg-[var(--accent)] text-[var(--accent-ink)]" : "")}>
                {i < step ? <Check size={9} strokeWidth={3} /> : i + 1}
              </span>
              {s}
            </button>
            {i < STEPS.length - 1 && <ChevronRight size={12} className="text-faint" />}
          </li>
        ))}
      </ol>

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0 space-y-7">
          {step === 0 && (
            <>
              <Field label="What are you listing?">
                <div className="flex gap-1.5">
                  {(["buy", "rent"] as const).map((t) => (
                    <Chip key={t} active={draft.listingType === t} onClick={() => set("listingType", t)}>
                      {t === "buy" ? "For sale" : "For rent"}
                    </Chip>
                  ))}
                </div>
              </Field>
              <Field label="Property type">
                <div className="flex flex-wrap gap-1.5">
                  {TYPES.map((t) => (
                    <Chip key={t} active={draft.propertyType === t} onClick={() => set("propertyType", t)}>
                      {propertyTypeLabel(t)}
                    </Chip>
                  ))}
                </div>
              </Field>
            </>
          )}

          {step === 1 && (
            <>
              <Field label="Locality" error={errors.localitySlug}>
                <select
                  value={draft.localitySlug}
                  onChange={(e) => {
                    set("localitySlug", e.target.value);
                    const l = localities.find((x) => x.slug === e.target.value);
                    if (l && !draft.location) set("location", l.center);
                  }}
                  className="h-11 w-full rounded-[var(--r-sm)] border border-line bg-raised px-3 text-[15px] text-ink outline-none focus:border-[var(--accent-line)]"
                >
                  <option value="">Choose a locality…</option>
                  {localities.map((l) => (
                    <option key={l.slug} value={l.slug}>{l.name}</option>
                  ))}
                </select>
              </Field>

              <Field label="Find the exact spot" hint="Search a landmark, then drag the pin if needed.">
                <input
                  value={placeQuery}
                  onChange={(e) => setPlaceQuery(e.target.value)}
                  placeholder="e.g. Inorbit Mall, Durgam Cheruvu…"
                  className="h-11 w-full rounded-[var(--r-sm)] border border-line bg-raised px-3 text-[15px] text-ink outline-none placeholder:text-faint focus:border-[var(--accent-line)]"
                />
                {placeQuery.length > 1 && (places?.suggestions ?? []).filter((s) => s.location).length > 0 && (
                  <ul className="mt-2 max-h-48 overflow-y-auto rounded-[var(--r-sm)] border border-line">
                    {(places?.suggestions ?? []).filter((s) => s.location).slice(0, 6).map((s) => (
                      <li key={s.id}>
                        <button
                          onClick={() => { set("location", s.location!); set("address", s.label); setPlaceQuery(""); }}
                          className="block w-full px-3 py-2 text-left transition-colors hover:bg-sunk"
                        >
                          <span className="block truncate text-[13px] text-ink">{s.label}</span>
                          <span className="block truncate text-[11px] text-faint">{s.sublabel}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Field>

              <Field label="Address as buyers will see it">
                <input
                  value={draft.address}
                  onChange={(e) => set("address", e.target.value)}
                  placeholder="Tower / street, landmark"
                  className="h-11 w-full rounded-[var(--r-sm)] border border-line bg-raised px-3 text-[15px] text-ink outline-none placeholder:text-faint focus:border-[var(--accent-line)]"
                />
              </Field>

              {errors.location && <p className="text-[13px] text-[var(--data-clay)]">{errors.location}</p>}
            </>
          )}

          {step === 2 && (
            <>
              <Field label="Built-up area (sq.ft)" error={errors.areaSqft}>
                <input
                  type="number" min={100} value={draft.areaSqft}
                  onChange={(e) => set("areaSqft", e.target.value)}
                  placeholder="1850"
                  className="tnum h-11 w-full rounded-[var(--r-sm)] border border-line bg-raised px-3 text-[15px] text-ink outline-none placeholder:text-faint focus:border-[var(--accent-line)]"
                />
              </Field>
              <div className="grid gap-5 sm:grid-cols-3">
                <Counter label="Bedrooms" value={draft.bedrooms} onChange={(v) => set("bedrooms", v)} max={8} />
                <Counter label="Bathrooms" value={draft.bathrooms} onChange={(v) => set("bathrooms", v)} max={8} />
                <Counter label="Parking" value={draft.parking} onChange={(v) => set("parking", v)} max={6} />
              </div>
              <Field label="Amenities">
                <div className="flex flex-wrap gap-1.5">
                  {AMENITIES.map((a) => (
                    <Chip
                      key={a.slug}
                      active={draft.amenities.includes(a.slug)}
                      onClick={() =>
                        set("amenities", draft.amenities.includes(a.slug)
                          ? draft.amenities.filter((x) => x !== a.slug)
                          : [...draft.amenities, a.slug])
                      }
                    >
                      {a.name}
                    </Chip>
                  ))}
                </div>
              </Field>
            </>
          )}

          {step === 3 && (
            <>
              <Field
                label={draft.listingType === "rent" ? "Monthly rent (₹)" : "Asking price (₹)"}
                error={errors.price}
                hint="Enter the full number, e.g. 14500000 for ₹1.45 Cr."
              >
                <input
                  type="number" min={0} value={draft.price}
                  onChange={(e) => set("price", e.target.value)}
                  placeholder={draft.listingType === "rent" ? "45000" : "14500000"}
                  className="tnum h-11 w-full rounded-[var(--r-sm)] border border-line bg-raised px-3 text-[15px] text-ink outline-none placeholder:text-faint focus:border-[var(--accent-line)]"
                />
              </Field>
              {price > 0 && (
                <div className="rounded-[var(--r-md)] border border-line bg-sunk p-4">
                  <p className="tnum text-[15px] text-ink">
                    {draft.listingType === "rent" ? formatRent(price) : formatPrice(price)}
                    {draft.listingType === "buy" && perSqft > 0 && <span className="ml-2 text-[13px] text-muted">{formatPriceSqft(perSqft)}</span>}
                  </p>
                  {guidance && (
                    <p className={cn("mt-2 text-[13px] leading-relaxed", guidance.tone === "high" ? "text-[var(--data-clay)]" : "text-muted")}>
                      {guidance.text}
                    </p>
                  )}
                  <p className="mt-2 text-[11px] text-faint">
                    PropIT&apos;s locality averages are estimates modelled from listed inventory, not a valuation.
                  </p>
                </div>
              )}
            </>
          )}

          {step === 4 && (
            <>
              <Field label="Listing title" error={errors.title}>
                <input
                  value={draft.title}
                  onChange={(e) => set("title", e.target.value)}
                  placeholder={`${draft.bedrooms} BHK ${propertyTypeLabel(draft.propertyType)} in ${locality?.name ?? "Hyderabad"}`}
                  className="h-11 w-full rounded-[var(--r-sm)] border border-line bg-raised px-3 text-[15px] text-ink outline-none placeholder:text-faint focus:border-[var(--accent-line)]"
                />
              </Field>
              <Field label="Description">
                <textarea
                  value={draft.description}
                  onChange={(e) => set("description", e.target.value)}
                  rows={5}
                  placeholder="What would you want to know if you were buying it?"
                  className="w-full resize-y rounded-[var(--r-sm)] border border-line bg-raised p-3 text-[15px] leading-relaxed text-ink outline-none placeholder:text-faint focus:border-[var(--accent-line)]"
                />
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Your name" error={errors.contactName}>
                  <input
                    value={draft.contactName}
                    onChange={(e) => set("contactName", e.target.value)}
                    className="h-11 w-full rounded-[var(--r-sm)] border border-line bg-raised px-3 text-[15px] text-ink outline-none focus:border-[var(--accent-line)]"
                  />
                </Field>
                <Field label="Phone" error={errors.contactPhone}>
                  <input
                    value={draft.contactPhone}
                    onChange={(e) => set("contactPhone", e.target.value)}
                    inputMode="tel"
                    placeholder="+91 …"
                    className="tnum h-11 w-full rounded-[var(--r-sm)] border border-line bg-raised px-3 text-[15px] text-ink outline-none placeholder:text-faint focus:border-[var(--accent-line)]"
                  />
                </Field>
              </div>
            </>
          )}

          {submitError && <p role="alert" className="text-sm text-clay">{submitError}</p>}
          {!customer.configured && <p className="text-sm text-muted">This form is a preview. Listing submissions open when the live service is connected.</p>}
          <div className="flex items-center gap-2 border-t border-line pt-6">
            {step > 0 && (
              <Button variant="ghost" size="md" className="gap-1.5" onClick={() => setStep(step - 1)}>
                <ChevronLeft size={15} strokeWidth={1.75} />
                Back
              </Button>
            )}
            <Button
              variant="primary"
              size="md"
              className="ml-auto gap-1.5"
              disabled={!canAdvance || busy || (step === STEPS.length - 1 && !customer.configured)}
              onClick={() => (step === STEPS.length - 1 ? void submit() : setStep(step + 1))}
            >
              {step === STEPS.length - 1 ? busy ? "Submitting…" : "Submit for review" : "Continue"}
              {step < STEPS.length - 1 && <ChevronRight size={15} strokeWidth={1.75} />}
            </Button>
          </div>
        </div>

        <aside className="lg:sticky lg:top-[92px] lg:h-fit">
          <div className="overflow-hidden rounded-[var(--r-lg)] border border-line" style={{ height: 320 }}>
            <PropitMap compact points={mapPoints} localities={locality ? [locality] : localities} />
          </div>
          <div className="mt-3 flex items-start gap-2 text-[12px] leading-relaxed text-faint">
            <MapPin size={13} strokeWidth={1.75} className="mt-0.5 shrink-0" />
            {draft.location
              ? `Pinned at ${draft.location.lat.toFixed(4)}, ${draft.location.lng.toFixed(4)}${draft.address ? ` — ${draft.address}` : ""}.`
              : "Pick a locality and search a landmark to place your listing."}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Field({
  label, hint, error, children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[13px] font-medium text-ink">{label}</label>
      {hint && <p className="mb-1.5 text-[12px] text-faint">{hint}</p>}
      {children}
      {error && <p className="mt-1.5 text-[12px] text-[var(--data-clay)]">{error}</p>}
    </div>
  );
}

function Counter({
  label, value, onChange, max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  max: number;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[13px] font-medium text-ink">{label}</label>
      <div className="flex h-11 items-center justify-between rounded-[var(--r-sm)] border border-line bg-raised px-2">
        <button
          onClick={() => onChange(Math.max(0, value - 1))}
          className="grid h-7 w-7 place-items-center rounded-[var(--r-sm)] text-muted hover:bg-sunk hover:text-ink"
          aria-label={`Fewer ${label}`}
        >
          −
        </button>
        <span className="tnum text-[15px] text-ink">{value}</span>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          className="grid h-7 w-7 place-items-center rounded-[var(--r-sm)] text-muted hover:bg-sunk hover:text-ink"
          aria-label={`More ${label}`}
        >
          +
        </button>
      </div>
    </div>
  );
}
