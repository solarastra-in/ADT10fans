// Vercel serverless entry. The server is bundled into a single file by `npm run build`
// (see build:server); importing that file keeps Node's ESM loader happy on Vercel.
// @ts-ignore: generated at build time
import handler from '../dist-server/vercel.mjs';

export default handler;
