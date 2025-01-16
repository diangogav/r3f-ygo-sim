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
