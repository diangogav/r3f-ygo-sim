export function delay(ms: number) {
  return new Promise<void>((ful) => setTimeout(() => ful(), ms));
}
