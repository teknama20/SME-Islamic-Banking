import { PRODUCTS } from "@/lib/products/catalog";
import type { ProductOption } from "./case-form";

/** Serializable product subset for client forms. */
export const productOptions: ProductOption[] = PRODUCTS.map((p) => ({
  code: p.code,
  name: p.name,
  nameUrdu: p.nameUrdu,
  summary: p.summary,
  fields: p.fields,
  repaymentOptions: p.repaymentOptions,
  maxTenorMonths: p.maxTenorMonths,
}));
