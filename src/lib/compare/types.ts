import type { Property } from "@/types";

export type CompareCandidate = Pick<Property,
  "id" | "title" | "listingType" | "price" | "rentMonthly" | "builtupAreaSqft"
> & { locality: string; image?: string };
