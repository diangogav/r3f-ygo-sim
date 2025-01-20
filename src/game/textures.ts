export const textureSlot = "/images/slot.png";
export const textureHighlight = "/images/card-highlight.png";

export const textureCardFront = (code: number) =>
  getProxiedUrl(`https://images.ygoprodeck.com/images/cards/${code}.jpg`);

export const textureCardBack = getProxiedUrl(
  "https://ms.yugipedia.com//thumb/e/e5/Back-EN.png/800px-Back-EN.png",
);

function getProxiedUrl(url: string) {
  return `/api/proxy/${encodeURIComponent(url)}`;
}
