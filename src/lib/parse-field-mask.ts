import { OcgLocation, OcgLocPos } from "ocgcore-wasm";

export function parseFieldMask(mask: number) {
  type OcgLoc = Omit<OcgLocPos, "position">;
  function parseFieldMaskPlayer(
    m: number,
    controller: 0 | 1,
    places: OcgLoc[],
  ) {
    for (let i = 0; i < 7; i++) {
      // 5 mm, 2 em
      if ((m & 1) === 0) {
        places.push({ controller, location: OcgLocation.MZONE, sequence: i });
      }
      m >>= 1;
    }
    m >>= 1;
    for (let i = 0; i < 8; i++) {
      // 5 st, 1 fs, 2 p
      if ((m & 1) === 0) {
        places.push({ controller, location: OcgLocation.SZONE, sequence: i });
      }
      m >>= 1;
    }
  }
  const places: OcgLoc[] = [];
  parseFieldMaskPlayer(mask & 0xffff, 0, places);
  parseFieldMaskPlayer(mask >> 16, 1, places);
  return places;
}

export const fieldMaskMapping = {
  "0m0": 1 << 0x00,
  "0m1": 1 << 0x01,
  "0m2": 1 << 0x02,
  "0m3": 1 << 0x03,
  "0m4": 1 << 0x04,
  "0e0": 1 << 0x05,
  "0e1": 1 << 0x06,
  "0s0": 1 << 0x08,
  "0s1": 1 << 0x09,
  "0s2": 1 << 0x0a,
  "0s3": 1 << 0x0b,
  "0s4": 1 << 0x0c,
  "0fs": 1 << 0x0d,
  "0p0": 1 << 0x0e,
  "0p1": 1 << 0x0f,
  "1m0": 1 << 0x10,
  "1m1": 1 << 0x11,
  "1m2": 1 << 0x12,
  "1m3": 1 << 0x13,
  "1m4": 1 << 0x14,
  "1e0": 1 << 0x15,
  "1e1": 1 << 0x16,
  "1s0": 1 << 0x18,
  "1s1": 1 << 0x19,
  "1s2": 1 << 0x1a,
  "1s3": 1 << 0x1b,
  "1s4": 1 << 0x1c,
  "1fs": 1 << 0x1d,
  "1p0": 1 << 0x1e,
  "1p1": 1 << 0x1f,
};
