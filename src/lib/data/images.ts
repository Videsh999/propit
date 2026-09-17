const U = (id: string, w = 1200) =>
  `https://images.unsplash.com/${id}?w=${w}&q=80&auto=format&fit=crop`;

/**
 * Exteriors — contemporary apartment blocks and villas.
 *
 * Curated by eye, not collected. The pool this replaced was assembling homes
 * from whatever an "architecture" search returned: a log cabin in a pine
 * forest was standing in for a Jubilee Hills apartment, a Manhattan street for
 * Gopanpally, and a house under snow for a city that does not get any. Four
 * interiors were in here too, so a listing's lead image could be its kitchen.
 *
 * Nothing here can be the actual building — this is development data — but a
 * placeholder should at least be a home, of roughly this kind, in roughly this
 * climate. Anything wrong enough to notice undermines every real number on the
 * page beside it.
 */
export const EXTERIOR_POOL = [
  "photo-1486406146926-c627a92ad1ab",
  "photo-1545324418-cc1a3fa10c00",
  "photo-1580587771525-78b9dba3b914",
  "photo-1613490493576-7fde63acd811",
  "photo-1600585154340-be6161a56a0c",
  "photo-1512917774080-9991f1c4c750",
  "photo-1564013799919-ab600027ffc6",
  "photo-1600596542815-ffad4c1539a9",
  "photo-1600047509807-ba8f99d2cdde",
  "photo-1600566753190-17f0baa2a6c3",
];

/**
 * Interiors — rooms, at the scale and finish these listings describe.
 */
export const INTERIOR_POOL = [
  "photo-1600607687939-ce8a6c25118c",
  "photo-1600566753086-00f18fb6b3ea",
  "photo-1502672260266-1c1ef2d93688",
  "photo-1560448204-e02f11c3d0e2",
  "photo-1493809842364-78817add7ffb",
  "photo-1554995207-c18c203602cb",
  "photo-1600573472550-8090b5e0745e",
  "photo-1600121848594-d8644e57abab",
  "photo-1522708323590-d24dbb6b0267",
  "photo-1600210492486-724fe5c67fb0",
  "photo-1616594039964-ae9021a400a0",
  "photo-1615874959474-d609969a20ed",
  "photo-1594026112284-02bb6f3352fe",
  "photo-1560185007-cde436f6a4d0",
  "photo-1600585152220-90363fe7e115",
  "photo-1616486338812-3dadae4b4ace",
  "photo-1512918728675-ed5a9ecdebfd",
];

export const ROOM_TAGS = [
  "Exterior",
  "Living room",
  "Kitchen",
  "Primary bedroom",
  "Balcony view",
  "Bathroom",
  "Clubhouse",
];

export function imageSet(seed: number, count: number): { url: string; roomTag: string }[] {
  const out: { url: string; roomTag: string }[] = [];
  const ext = EXTERIOR_POOL[seed % EXTERIOR_POOL.length];
  out.push({ url: U(ext), roomTag: "Exterior" });
  for (let i = 1; i < count; i++) {
    const id = INTERIOR_POOL[(seed * 7 + i * 13) % INTERIOR_POOL.length];
    out.push({ url: U(id), roomTag: ROOM_TAGS[i % ROOM_TAGS.length] });
  }
  return out;
}

export function heroImage(seed: number): string {
  return U(EXTERIOR_POOL[seed % EXTERIOR_POOL.length], 1600);
}
