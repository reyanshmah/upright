/** Set from package.json in next.config.mjs; "dev" under vitest. */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";
/** Changes on every build (commit SHA on Vercel); names the offline cache. */
export const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";
