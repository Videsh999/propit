export type AssistantSource = {
  label: string;
  href: string;
  kind: "showcase" | "official";
};

export const SHOWCASE_NOTE = "PropIT showcase data. Prices, availability and market trends are illustrative.";

export const OFFICIAL_SOURCES = {
  rera: { label: "TG RERA project search", href: "https://rerait.telangana.gov.in/SearchList/Search", kind: "official" },
  planning: { label: "HMDA master plans", href: "https://www.hmda.gov.in/planning-2/", kind: "official" },
  registration: { label: "Telangana Registration & Stamps", href: "https://www.telangana.gov.in/departments/revenue-registration-and-stamps/", kind: "official" },
  land: { label: "Bhu Bharati citizen services", href: "https://www.bhubharati.telangana.gov.in/Citizen", kind: "official" },
  metro: { label: "Hyderabad Metro stations and services", href: "https://hmrl.co.in/services/", kind: "official" },
} satisfies Record<string, AssistantSource>;
