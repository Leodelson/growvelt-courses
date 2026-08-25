export type PaystackCallbackSearchParams = {
  reference?: string | string[];
  trxref?: string | string[];
};

const ORDER_REFERENCE_PATTERN = /^GL-[A-F0-9]{32}$/;

function valuesOf(value: string | string[] | undefined) {
  return value === undefined ? [] : Array.isArray(value) ? value : [value];
}

export function resolvePaystackCallbackReference(searchParams: PaystackCallbackSearchParams) {
  const supplied = [...valuesOf(searchParams.reference), ...valuesOf(searchParams.trxref)];
  if (supplied.length === 0 || supplied.some((value) => !ORDER_REFERENCE_PATTERN.test(value))) return null;

  const references = new Set(supplied);
  return references.size === 1 ? supplied[0] : null;
}
