export function parseChainTime(value: string): number {
  const normalized = /(?:Z|[+-]\d\d:\d\d)$/.test(value) ? value : `${value}Z`;
  const parsed = Date.parse(normalized);
  if (!Number.isFinite(parsed)) throw new Error(`invalid chain timestamp: ${value}`);
  return parsed;
}

export function parseAssetAmount(value: unknown): number {
  const amount = Number.parseFloat(String(value ?? '0').split(' ')[0] ?? '0');
  if (!Number.isFinite(amount) || amount < 0) throw new Error(`invalid asset: ${String(value)}`);
  return amount;
}
