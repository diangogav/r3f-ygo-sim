import imageLoader from "next/dist/shared/lib/image-loader";

export const textureSlot = "/images/slot.png";
export const textureHighlight = "/images/card-highlight.png";

export const textureCardFront = (code: number) =>
  getProxiedUrl(`https://images.ygoprodeck.com/images/cards/${code}.jpg`);

export const textureCardBack = getProxiedUrl(
  "https://ms.yugipedia.com//thumb/e/e5/Back-EN.png/800px-Back-EN.png",
);

function getProxiedUrl(url: string) {
  return imageLoader({
    src: url,
    width: 1080,
    config: process.env.__NEXT_IMAGE_OPTS as any,
  });
}

// console.log(process.env.__NEXT_IMAGE_OPTS);

// function getWidths(param, width, sizes) {
//   let { deviceSizes, allSizes } = param;
//   if (sizes) {
//       // Find all the "vw" percent sizes used in the sizes prop
//       const viewportWidthRe = /(^|\s)(1?\d?\d)vw/g;
//       const percentSizes = [];
//       for(let match; match = viewportWidthRe.exec(sizes); match){
//           percentSizes.push(parseInt(match[2]));
//       }
//       if (percentSizes.length) {
//           const smallestRatio = Math.min(...percentSizes) * 0.01;
//           return {
//               widths: allSizes.filter((s)=>s >= deviceSizes[0] * smallestRatio),
//               kind: 'w'
//           };
//       }
//       return {
//           widths: allSizes,
//           kind: 'w'
//       };
//   }
//   if (typeof width !== 'number') {
//       return {
//           widths: deviceSizes,
//           kind: 'w'
//       };
//   }
//   const widths = [
//       ...new Set(// > This means that most OLED screens that say they are 3x resolution,
//       // > are actually 3x in the green color, but only 1.5x in the red and
//       // > blue colors. Showing a 3x resolution image in the app vs a 2x
//       // > resolution image will be visually the same, though the 3x image
//       // > takes significantly more data. Even true 3x resolution screens are
//       // > wasteful as the human eye cannot see that level of detail without
//       // > something like a magnifying glass.
//       // https://blog.twitter.com/engineering/en_us/topics/infrastructure/2019/capping-image-fidelity-on-ultra-high-resolution-devices.html
//       [
//           width,
//           width * 2 /*, width * 3*/
//       ].map((w)=>allSizes.find((p)=>p >= w) || allSizes[allSizes.length - 1]))
//   ];
//   return {
//       widths,
//       kind: 'x'
//   };
// }
