type SeoBody = Record<string, unknown>;

const TEXT_FIELDS = [
  'metaTitle',
  'metaDescription',
  'canonicalUrl',
  'ogTitle',
  'ogDescription',
  'ogImage',
  'imageAlt',
  'coverAlt',
] as const;

export function seoData(body: SeoBody, options?: { coverAlt?: boolean }) {
  const data: Record<string, string | boolean | null> = {};
  for (const field of TEXT_FIELDS) {
    if (field === 'coverAlt' && !options?.coverAlt) continue;
    if (field === 'imageAlt' && options?.coverAlt) continue;
    if (body[field] !== undefined) {
      const value = body[field];
      data[field] = value === null || value === '' ? null : String(value).trim();
    }
  }
  if (body.robotsIndex !== undefined) data.robotsIndex = Boolean(body.robotsIndex);
  if (body.robotsFollow !== undefined) data.robotsFollow = Boolean(body.robotsFollow);
  return data;
}
