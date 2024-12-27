export function parseYdkeUrl(ydke: string) {
  if (!ydke.startsWith("ydke://")) {
    throw new Error("Unrecognized URL protocol");
  }
  var components = ydke.slice("ydke://".length).split("!");
  if (components.length < 3) {
    throw new Error("Missing ydke URL component");
  }
  return {
    main: base64ToPasscodes(components[0]),
    extra: base64ToPasscodes(components[1]),
    side: base64ToPasscodes(components[2]),
  };
}

function base64ToPasscodes(base64: string) {
  return new Uint32Array(Uint8Array.from(base64ToBytes(base64)).buffer);
}

function base64ToBytes(base64: string) {
  const binString = atob(base64);
  return Uint8Array.from(binString, (m) => m.codePointAt(0)!);
}
