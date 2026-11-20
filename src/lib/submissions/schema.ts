import { calendarDate } from "@/lib/date";
import { z } from "zod";
import { latLngSchema, listingTypeSchema, propertyTypeSchema } from "@/lib/api/schema";
export const indianPhone = z.string().trim().max(20).transform(value => value.replace(/[\s-]/g, "")).refine(value => /^(?:\+?91)?[6-9]\d{9}$/.test(value), "Enter a valid Indian mobile number.");
export const meetingSchema = z.object({
  name: z.string().trim().min(2, "Tell us your name.").max(80), phone: indianPhone,
  email: z.union([z.string().trim().email().max(254), z.literal("")]).optional(),
  mode: z.enum(["site", "video", "call"]), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(calendarDate, "Pick a valid date."),
  slot: z.enum(["morning", "afternoon", "evening"]), note: z.string().trim().max(500).optional(),
  propertySlug: z.string().max(120).optional(), projectSlug: z.string().max(120).optional(),
}).refine(value => !(value.propertySlug && value.projectSlug), { message: "Choose a property or a project.", path: ["propertySlug"] });
export const listingSubmissionSchema = z.object({
  listingType: listingTypeSchema, propertyType: propertyTypeSchema, localitySlug: z.string().min(1).max(120),
  address: z.string().trim().min(5).max(500), location: latLngSchema,
  bedrooms: z.number().int().min(0).max(20), bathrooms: z.number().int().min(0).max(30), parking: z.number().int().min(0).max(30),
  areaSqft: z.coerce.number().min(100).max(1_000_000), price: z.coerce.number().positive().max(1e12),
  amenities: z.array(z.string().max(60)).max(30), title: z.string().trim().min(5).max(150), description: z.string().trim().max(5000),
  contactName: z.string().trim().min(2).max(80), contactPhone: indianPhone,
});
