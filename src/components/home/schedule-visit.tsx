"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Img } from "@/components/ui/img";
import { Reveal } from "@/components/ui/reveal";
import { cn } from "@/lib/utils";

const MODES = [
  { value: "site", label: "Site visit", hint: "Meet at the property" },
  { value: "video", label: "Video tour", hint: "Walked through on a call" },
  { value: "call", label: "Call me back", hint: "Talk it over first" },
] as const;

const SLOTS = [
  { value: "morning", label: "Morning", hint: "9am – 12pm" },
  { value: "afternoon", label: "Afternoon", hint: "12pm – 4pm" },
  { value: "evening", label: "Evening", hint: "4pm – 8pm" },
] as const;

type Fields = Record<string, string>;

interface Done {
  id: string;
  date: string;
  slot: string;
  mode: string;
  subject: { label: string } | null;
}

/**
 * Book a viewing.
 *
 * Five decisions, not a lead-capture form: who you are, how to reach you, how
 * you want to see it, and when. No budget, no "property type", no marketing
 * consent — every field here is one the person on the other end would have to
 * ask for anyway, and nothing is collected because it might be useful later.
 *
 * Validation is the server's, surfaced per field. The confirmation states
 * plainly that nothing is dispatched yet, because a booking screen that implies
 * someone is on their way when no one is would be the worst kind of lie this
 * product could tell.
 */
export function ScheduleVisit({ heroImage, propertySlug, initialMode = "site" }: {
  heroImage?: string;
  propertySlug?: string;
  initialMode?: (typeof MODES)[number]["value"];
}) {
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Fields>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);

  const [mode, setMode] = useState<(typeof MODES)[number]["value"]>(initialMode);
  const [slot, setSlot] = useState<(typeof SLOTS)[number]["value"]>("morning");

  const today = new Date().toISOString().slice(0, 10);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setFields({});
    setFormError(null);

    const data = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          phone: data.get("phone"),
          email: data.get("email") || "",
          note: data.get("note") || "",
          date: data.get("date"),
          mode,
          slot,
          propertySlug,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setFields(json.fields ?? {});
        setFormError(json.fields ? null : (json.error ?? "That didn't go through."));
        return;
      }
      setDone(json as Done);
    } catch {
      setFormError("We couldn't reach the server. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={propertySlug ? "mt-4 border-t border-line pt-4" : "border-t border-line bg-sunk px-5 py-20 md:px-8 md:py-24"}>
      <div className={propertySlug ? undefined : "mx-auto grid max-w-[1440px] items-stretch gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16"}>
        {/* The place you'd be standing in */}
        {heroImage && <Reveal>
          {/* On a phone the photograph is context, not the subject — a banner
              above the form rather than half the screen before it. */}
          <div className="relative h-[200px] overflow-hidden rounded-[var(--r-lg)] border border-line sm:h-[260px] lg:h-full lg:min-h-[340px]">
            <Img
              src={heroImage}
              alt=""
              seed="schedule-visit"
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="h-full w-full"
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[rgba(11,41,35,0.82)] to-transparent p-6 pt-20">
              <p className="eyebrow text-[var(--data-brass)]">Hyderabad · Site visits</p>
              <p className="mt-2 max-w-[28ch] text-[16px] leading-snug text-white md:text-[18px]">
                Photographs decide the shortlist. Standing there decides the home.
              </p>
            </div>
          </div>
        </Reveal>}

        <Reveal delay={0.06}>
          <div className="flex h-full flex-col justify-center">
            {!propertySlug && <p className="eyebrow mb-3">Schedule a viewing</p>}
            <h2 className="display text-[32px] leading-[1.05] text-ink md:text-[42px]">
              {propertySlug ? "Request a viewing or callback" : "See it for yourself."}
            </h2>

            {done ? (
              <Confirmation done={done} onReset={() => setDone(null)} />
            ) : (
              <>
                <p className="mt-4 max-w-[46ch] text-[16px] leading-relaxed text-muted">
                  Pick a day that works. We&apos;ll confirm the address and the exact time before
                  you travel.
                </p>

                <form onSubmit={submit} className="mt-8 space-y-6" noValidate>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Your name" name="name" error={fields.name}>
                      <input
                        name="name"
                        autoComplete="name"
                        placeholder="Ananya Rao"
                        className={inputCls(!!fields.name)}
                      />
                    </Field>
                    <Field label="Mobile" name="phone" error={fields.phone}>
                      <input
                        name="phone"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="98765 43210"
                        className={inputCls(!!fields.phone)}
                      />
                    </Field>
                  </div>

                  <Field label="Email" name="email" optional error={fields.email}>
                    <input
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      className={inputCls(!!fields.email)}
                    />
                  </Field>

                  <Choice
                    legend="How would you like to see it?"
                    options={MODES}
                    value={mode}
                    onChange={setMode}
                  />

                  <div className={cn("grid gap-4", !propertySlug && "sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)]")}>
                    <Field label="Date" name="date" error={fields.date}>
                      <input
                        name="date"
                        type="date"
                        min={today}
                        defaultValue={today}
                        className={inputCls(!!fields.date)}
                      />
                    </Field>
                    <Choice legend="Time" options={SLOTS} value={slot} onChange={setSlot} compact />
                  </div>

                  <Field label="Anything we should know?" name="note" optional>
                    <textarea
                      name="note"
                      rows={2}
                      placeholder="Localities you're weighing up, budget, who's coming along…"
                      className={cn(inputCls(false), "h-auto resize-none py-2.5")}
                    />
                  </Field>

                  {formError && (
                    <p role="alert" className="text-[13px] text-[var(--data-clay)]">
                      {formError}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                    <button
                      type="submit"
                      disabled={busy}
                      className="inline-flex h-12 items-center gap-2 rounded-[var(--r-pill)] bg-accent px-6 text-[15px] font-medium text-[var(--accent-ink)] transition-colors duration-[160ms] hover:bg-accent-hover disabled:opacity-70"
                    >
                      {busy && <Loader2 size={15} className="animate-spin" />}
                      {busy ? "Requesting…" : "Request this viewing"}
                    </button>
                    <p className="max-w-[34ch] text-[12px] leading-relaxed text-faint">
                      Your number is used to confirm this viewing and nothing else.
                    </p>
                  </div>
                </form>
              </>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Confirmation({ done, onReset }: { done: Done; onReset: () => void }) {
  const when = new Date(`${done.date}T00:00:00`).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const slot = SLOTS.find((s) => s.value === done.slot);
  const mode = MODES.find((m) => m.value === done.mode);

  return (
    <div className="mt-6 rounded-[var(--r-lg)] border border-[var(--accent-line)] bg-[var(--accent-wash)] p-6">
      <span className="grid h-9 w-9 place-items-center rounded-full bg-accent text-[var(--accent-ink)]">
        <Check size={17} strokeWidth={2.25} />
      </span>
      <p className="mt-4 text-[17px] font-medium text-ink">
        {mode?.label} requested for {when}.
      </p>
      <p className="tnum mt-1.5 text-[14px] text-muted">
        {slot?.label}, {slot?.hint} · Reference {done.id}
      </p>

      {/* The one thing this screen must not do is imply someone is on their way. */}
      <p className="mt-4 max-w-[44ch] border-t border-[var(--accent-line)] pt-4 text-[13px] leading-relaxed text-muted">
        PropIT is in development, so this request is recorded but not yet sent to anyone. When
        bookings go live it will reach the listing team and you&apos;ll get a confirmation on your
        mobile.
      </p>

      <button
        onClick={onReset}
        className="mt-4 text-[14px] text-accent underline decoration-[var(--accent-line)] underline-offset-4 transition-colors hover:text-ink"
      >
        Request another viewing
      </button>
    </div>
  );
}

function inputCls(invalid: boolean) {
  return cn(
    "h-11 w-full rounded-[var(--r-pill)] border bg-raised px-3.5 text-[15px] text-ink outline-none transition-colors duration-[160ms] placeholder:text-faint",
    invalid
      ? "border-[var(--data-clay)]"
      : "border-line focus:border-[var(--accent)]",
  );
}

function Field({
  label,
  name,
  children,
  error,
  optional,
}: {
  label: string;
  name: string;
  children: React.ReactNode;
  error?: string;
  optional?: boolean;
}) {
  return (
    <label htmlFor={name} className="block">
      <span className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-medium text-ink">{label}</span>
        {optional && <span className="eyebrow">Optional</span>}
      </span>
      {children}
      {error && (
        <span role="alert" className="mt-1.5 block text-[12px] text-[var(--data-clay)]">
          {error}
        </span>
      )}
    </label>
  );
}

/**
 * A radio group that looks like a row of choices.
 *
 * Real radio inputs underneath, so arrow keys move between options and a
 * screen reader announces the group and the count — which a row of styled
 * buttons would not.
 */
function Choice<T extends string>({
  legend,
  options,
  value,
  onChange,
  compact,
}: {
  legend: string;
  options: readonly { value: T; label: string; hint: string }[];
  value: T;
  onChange: (v: T) => void;
  compact?: boolean;
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-[13px] font-medium text-ink">{legend}</legend>
      <div className={cn("grid gap-2", compact ? "grid-cols-3" : "sm:grid-cols-3")}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <label
              key={o.value}
              className={cn(
                "cursor-pointer rounded-[var(--r-md)] border px-3 py-2.5 transition-colors duration-[160ms]",
                on
                  ? "border-[var(--accent)] bg-[var(--accent-wash)]"
                  : "border-line bg-raised hover:border-line-strong",
              )}
            >
              <input
                type="radio"
                name={legend}
                value={o.value}
                checked={on}
                onChange={() => onChange(o.value)}
                className="sr-only"
              />
              <span
                className={cn(
                  "block text-[14px] font-medium",
                  on ? "text-accent" : "text-ink",
                )}
              >
                {o.label}
              </span>
              <span className="tnum mt-0.5 block text-[12px] text-faint">{o.hint}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
