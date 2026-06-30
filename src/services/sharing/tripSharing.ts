export const SHARE_INVITE_PARAM = 'invite';

export function normalizeShareCode(value: string): string {
  const fromUrl = extractShareCodeFromUrl(value);
  if (fromUrl === '') {
    return '';
  }
  return (fromUrl ?? value).replace(/\s+/g, '').toUpperCase();
}

export function buildShareInviteLink(code: string, baseHref = currentBaseHref()): string {
  const normalizedCode = normalizeShareCode(code);
  const url = new URL(baseHref);
  url.searchParams.set(SHARE_INVITE_PARAM, normalizedCode);
  return url.toString();
}

export function readShareCodeFromLocation(locationLike = currentLocationHref()): string {
  return locationLike ? normalizeShareCode(locationLike) : '';
}

function extractShareCodeFromUrl(value: string): string | null {
  if (!/^[a-z][a-z\d+\-.]*:\/\//i.test(value) && !value.startsWith('?')) {
    return null;
  }

  try {
    const url = new URL(value, currentBaseHref());
    return url.searchParams.get(SHARE_INVITE_PARAM) ?? '';
  } catch {
    return null;
  }
}

function currentBaseHref(): string {
  const maybeLocation = globalThis.location;
  return maybeLocation?.origin ? `${maybeLocation.origin}${maybeLocation.pathname}` : 'https://roadtrip.local/';
}

function currentLocationHref(): string {
  return globalThis.location?.href ?? '';
}
