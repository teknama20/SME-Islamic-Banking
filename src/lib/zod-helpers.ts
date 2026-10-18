import { z } from "zod";

/** Strict checkbox/boolean parsing: only true, "true", "on", "1", "yes" are true. */
export const zBool = z.preprocess((v) => v === true || v === "true" || v === "on" || v === "1" || v === "yes", z.boolean());

/** Optional number: empty string → undefined. */
export const zOptNumber = z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : Number(v)), z.number().finite().optional());

/** Optional date: empty string → undefined. */
export const zOptDate = z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : new Date(String(v))), z.date().optional());
