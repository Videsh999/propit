import type { Poi, PoiCategory } from "@/types";
import { LOCALITIES, HYDERABAD } from "./localities";
import { mulberry32, hashString, slugify } from "@/lib/utils";

interface RealPoi {
  name: string;
  category: PoiCategory;
  subcategory: string;
  lat: number;
  lng: number;
  rating?: number;
}

/** Named, real, verified places. Coordinates are actual. */
const REAL: RealPoi[] = [
  // Airport & rail
  { name: "Rajiv Gandhi International Airport", category: "airport", subcategory: "International", lat: 17.2403, lng: 78.4294, rating: 4.6 },
  { name: "Secunderabad Junction", category: "railway", subcategory: "Terminal", lat: 17.4339, lng: 78.5012, rating: 4.2 },
  { name: "Hyderabad Deccan (Nampally)", category: "railway", subcategory: "Terminal", lat: 17.3878, lng: 78.4676, rating: 4.1 },
  { name: "Lingampally Railway Station", category: "railway", subcategory: "MMTS", lat: 17.4869, lng: 78.3169, rating: 3.9 },
  { name: "Hitec City MMTS", category: "railway", subcategory: "MMTS", lat: 17.449, lng: 78.38, rating: 3.8 },

  // Metro
  { name: "Raidurg Metro Station", category: "metro", subcategory: "Blue Line", lat: 17.438, lng: 78.383, rating: 4.4 },
  { name: "Hitec City Metro Station", category: "metro", subcategory: "Blue Line", lat: 17.4487, lng: 78.3866, rating: 4.4 },
  { name: "Durgam Cheruvu Metro Station", category: "metro", subcategory: "Blue Line", lat: 17.4416, lng: 78.3906, rating: 4.5 },
  { name: "Madhapur Metro Station", category: "metro", subcategory: "Blue Line", lat: 17.4479, lng: 78.3934, rating: 4.3 },
  { name: "Ameerpet Metro Interchange", category: "metro", subcategory: "Interchange", lat: 17.4374, lng: 78.4487, rating: 4.3 },
  { name: "Miyapur Metro Station", category: "metro", subcategory: "Red Line", lat: 17.4966, lng: 78.3583, rating: 4.2 },
  { name: "KPHB Colony Metro Station", category: "metro", subcategory: "Red Line", lat: 17.4936, lng: 78.3936, rating: 4.2 },
  { name: "Nagole Metro Station", category: "metro", subcategory: "Blue Line", lat: 17.3724, lng: 78.5583, rating: 4.1 },
  { name: "Uppal Metro Station", category: "metro", subcategory: "Blue Line", lat: 17.4001, lng: 78.5586, rating: 4.1 },
  { name: "LB Nagar Metro Station", category: "metro", subcategory: "Red Line", lat: 17.3512, lng: 78.5516, rating: 4.2 },
  { name: "Punjagutta Metro Station", category: "metro", subcategory: "Blue Line", lat: 17.4268, lng: 78.4525, rating: 4.2 },
  { name: "Begumpet Metro Station", category: "metro", subcategory: "Red Line", lat: 17.4442, lng: 78.4645, rating: 4.1 },
  { name: "Jubilee Hills Check Post Metro", category: "metro", subcategory: "Blue Line", lat: 17.4308, lng: 78.4045, rating: 4.3 },

  // Office hubs
  { name: "Financial District", category: "office_hub", subcategory: "Banking & Consulting", lat: 17.4155, lng: 78.341, rating: 4.5 },
  { name: "Mindspace IT Park", category: "office_hub", subcategory: "IT SEZ", lat: 17.4356, lng: 78.3838, rating: 4.4 },
  { name: "Hitec City Cyber Towers", category: "office_hub", subcategory: "IT Park", lat: 17.4478, lng: 78.3823, rating: 4.4 },
  { name: "Microsoft India Development Center", category: "office_hub", subcategory: "Corporate Campus", lat: 17.4241, lng: 78.3487, rating: 4.6 },
  { name: "Amazon Hyderabad Campus", category: "office_hub", subcategory: "Corporate Campus", lat: 17.4232, lng: 78.3413, rating: 4.5 },
  { name: "Wipro Circle Gachibowli", category: "office_hub", subcategory: "IT Park", lat: 17.4293, lng: 78.3486, rating: 4.3 },
  { name: "Infosys Pocharam Campus", category: "office_hub", subcategory: "Corporate Campus", lat: 17.4265, lng: 78.6154, rating: 4.5 },
  { name: "TCS Adibatla", category: "office_hub", subcategory: "Corporate Campus", lat: 17.2356, lng: 78.5691, rating: 4.4 },
  { name: "Genome Valley", category: "office_hub", subcategory: "Life Sciences", lat: 17.5589, lng: 78.5342, rating: 4.3 },

  // Schools
  { name: "Oakridge International School", category: "school", subcategory: "IB · International", lat: 17.4419, lng: 78.3341, rating: 4.4 },
  { name: "Chirec International School", category: "school", subcategory: "IB · International", lat: 17.4642, lng: 78.3616, rating: 4.5 },
  { name: "Sancta Maria International School", category: "school", subcategory: "IB · International", lat: 17.4701, lng: 78.3271, rating: 4.4 },
  { name: "Delhi Public School Nacharam", category: "school", subcategory: "CBSE", lat: 17.4256, lng: 78.5563, rating: 4.3 },
  { name: "Delhi Public School Khajaguda", category: "school", subcategory: "CBSE", lat: 17.4185, lng: 78.3684, rating: 4.3 },
  { name: "Glendale Academy", category: "school", subcategory: "IB · International", lat: 17.3341, lng: 78.4179, rating: 4.4 },
  { name: "Meridian School Banjara Hills", category: "school", subcategory: "CBSE", lat: 17.4159, lng: 78.4396, rating: 4.2 },
  { name: "Indus International School", category: "school", subcategory: "IB · International", lat: 17.5241, lng: 78.2718, rating: 4.4 },
  { name: "Johnson Grammar School", category: "school", subcategory: "ICSE", lat: 17.4536, lng: 78.5342, rating: 4.2 },
  { name: "Phoenix Greens International", category: "school", subcategory: "Cambridge", lat: 17.4229, lng: 78.3311, rating: 4.3 },

  // Hospitals
  { name: "AIG Hospitals Gachibowli", category: "hospital", subcategory: "Multi-speciality", lat: 17.434, lng: 78.351, rating: 4.6 },
  { name: "Continental Hospitals", category: "hospital", subcategory: "Multi-speciality", lat: 17.418, lng: 78.339, rating: 4.5 },
  { name: "Apollo Hospitals Jubilee Hills", category: "hospital", subcategory: "Multi-speciality", lat: 17.4176, lng: 78.4127, rating: 4.5 },
  { name: "KIMS Hospitals Secunderabad", category: "hospital", subcategory: "Multi-speciality", lat: 17.4394, lng: 78.4844, rating: 4.4 },
  { name: "Care Hospitals Banjara Hills", category: "hospital", subcategory: "Multi-speciality", lat: 17.4142, lng: 78.4429, rating: 4.4 },
  { name: "Yashoda Hospitals Somajiguda", category: "hospital", subcategory: "Multi-speciality", lat: 17.4258, lng: 78.4588, rating: 4.4 },
  { name: "Rainbow Children's Hospital", category: "hospital", subcategory: "Paediatric", lat: 17.4325, lng: 78.4032, rating: 4.5 },
  { name: "Sunshine Hospitals Gachibowli", category: "hospital", subcategory: "Orthopaedic", lat: 17.4441, lng: 78.3489, rating: 4.3 },

  // Malls & retail
  { name: "Inorbit Mall Madhapur", category: "mall", subcategory: "Shopping Mall", lat: 17.4348, lng: 78.386, rating: 4.4 },
  { name: "Sarath City Capital Mall", category: "mall", subcategory: "Shopping Mall", lat: 17.462, lng: 78.354, rating: 4.5 },
  { name: "IKEA Hyderabad", category: "mall", subcategory: "Home & Furniture", lat: 17.4245, lng: 78.343, rating: 4.4 },
  { name: "GVK One Mall", category: "mall", subcategory: "Shopping Mall", lat: 17.4212, lng: 78.4483, rating: 4.3 },
  { name: "Forum Sujana Mall", category: "mall", subcategory: "Shopping Mall", lat: 17.4881, lng: 78.3903, rating: 4.3 },
  { name: "Nexus Hyderabad Mall", category: "mall", subcategory: "Shopping Mall", lat: 17.4562, lng: 78.3661, rating: 4.2 },

  // Parks & lakes
  { name: "KBR National Park", category: "park", subcategory: "National Park", lat: 17.418, lng: 78.418, rating: 4.6 },
  { name: "Durgam Cheruvu Lake", category: "park", subcategory: "Lake & Promenade", lat: 17.44, lng: 78.386, rating: 4.5 },
  { name: "Botanical Garden Kondapur", category: "park", subcategory: "Botanical Garden", lat: 17.4646, lng: 78.3593, rating: 4.4 },
  { name: "Osman Sagar (Gandipet)", category: "park", subcategory: "Reservoir", lat: 17.372, lng: 78.314, rating: 4.5 },
  { name: "Himayat Sagar", category: "park", subcategory: "Reservoir", lat: 17.3335, lng: 78.3421, rating: 4.4 },
  { name: "Lumbini Park", category: "park", subcategory: "City Park", lat: 17.4108, lng: 78.4707, rating: 4.3 },
  { name: "Sanjeevaiah Park", category: "park", subcategory: "City Park", lat: 17.4374, lng: 78.4712, rating: 4.3 },

  // Sport
  { name: "Rajiv Gandhi International Cricket Stadium", category: "stadium", subcategory: "Cricket", lat: 17.4064, lng: 78.5504, rating: 4.5 },
  { name: "Gachibowli Athletic Stadium", category: "stadium", subcategory: "Athletics & Multi-sport", lat: 17.431, lng: 78.348, rating: 4.4 },
  { name: "Gachibowli Indoor Stadium", category: "stadium", subcategory: "Indoor Arena", lat: 17.4302, lng: 78.3454, rating: 4.4 },
  { name: "Lal Bahadur Shastri Stadium", category: "stadium", subcategory: "Cricket", lat: 17.3866, lng: 78.4783, rating: 4.2 },
  { name: "Hyderabad Golf Association", category: "stadium", subcategory: "Golf Course", lat: 17.3701, lng: 78.4749, rating: 4.5 },

  // Temples & landmarks
  { name: "Birla Mandir", category: "temple", subcategory: "Temple", lat: 17.4062, lng: 78.4691, rating: 4.6 },
  { name: "Chilkur Balaji Temple", category: "temple", subcategory: "Temple", lat: 17.3549, lng: 78.2733, rating: 4.6 },
  { name: "Peddamma Temple Jubilee Hills", category: "temple", subcategory: "Temple", lat: 17.4238, lng: 78.4067, rating: 4.5 },
];

const NEIGHBOURHOOD_TEMPLATES: {
  category: PoiCategory;
  subcategory: string;
  count: number;
  names: string[];
}[] = [
  { category: "school", subcategory: "CBSE", count: 2, names: ["Vidya Bharati School", "Sri Chaitanya School", "Narayana e-Techno School", "Kendriya Vidyalaya", "St. Ann's High School"] },
  { category: "hospital", subcategory: "Clinic & Diagnostics", count: 1, names: ["Apollo Clinic", "Medplus Diagnostics", "Aster Prime Clinic", "Lotus Multi-speciality"] },
  { category: "gym", subcategory: "Fitness", count: 1, names: ["Cult.fit", "Gold's Gym", "Anytime Fitness", "Snap Fitness"] },
  { category: "restaurant", subcategory: "Dining", count: 2, names: ["Barbeque Nation", "Paradise Biryani", "Chutneys", "Ulavacharu", "Bawarchi", "AB's Absolute Barbecues"] },
  { category: "park", subcategory: "Neighbourhood Park", count: 1, names: ["Colony Park", "Central Green", "Community Park"] },
  { category: "mall", subcategory: "Retail & Supermarket", count: 1, names: ["More Supermarket", "Ratnadeep Super Market", "Vijetha Supermarket", "DMart"] },
];

function makePois(): Poi[] {
  const out: Poi[] = REAL.map((r, i) => ({
    id: `poi_real_${i}_${slugify(r.name)}`,
    cityId: HYDERABAD.id,
    name: r.name,
    category: r.category,
    subcategory: r.subcategory,
    location: { lat: r.lat, lng: r.lng },
    rating: r.rating ?? null,
    verified: true,
  }));

  // Neighbourhood-level amenity coverage so "What's nearby" is never empty.
  for (const loc of LOCALITIES) {
    const rnd = mulberry32(hashString("poi" + loc.slug));
    for (const tpl of NEIGHBOURHOOD_TEMPLATES) {
      // Draw without replacement — two identical names in one locality reads as a bug.
      const pool = [...tpl.names].sort(() => rnd() - 0.5);
      for (let k = 0; k < Math.min(tpl.count, pool.length); k++) {
        const nameBase = pool[k];
        const r = 0.35 + rnd() * 1.5;
        const a = rnd() * Math.PI * 2;
        const latR = r / 110.574;
        const lngR = r / (111.32 * Math.cos((loc.center.lat * Math.PI) / 180));
        out.push({
          id: `poi_${loc.slug}_${tpl.category}_${k}`,
          cityId: HYDERABAD.id,
          name: `${nameBase}, ${loc.name}`,
          category: tpl.category,
          subcategory: tpl.subcategory,
          location: {
            lat: loc.center.lat + latR * Math.sin(a),
            lng: loc.center.lng + lngR * Math.cos(a),
          },
          rating: Math.round((3.6 + rnd() * 1.1) * 10) / 10,
          verified: false,
        });
      }
    }
  }
  return out;
}

export const POIS: Poi[] = makePois();

export const POI_CATEGORY_LABEL: Record<PoiCategory, string> = {
  metro: "Metro",
  school: "Schools",
  hospital: "Hospitals",
  office_hub: "Office hubs",
  mall: "Shopping",
  park: "Parks & lakes",
  stadium: "Sports",
  airport: "Airport",
  railway: "Railway",
  restaurant: "Restaurants",
  gym: "Gyms",
  temple: "Temples",
};

export const POI_CATEGORY_SINGULAR: Record<PoiCategory, string> = {
  metro: "Metro station",
  school: "School",
  hospital: "Hospital",
  office_hub: "Office hub",
  mall: "Shopping mall",
  park: "Park",
  stadium: "Sports venue",
  airport: "Airport",
  railway: "Railway station",
  restaurant: "Restaurant",
  gym: "Gym",
  temple: "Temple",
};
