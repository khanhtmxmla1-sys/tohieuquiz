export const PRODUCTION_ORIGINS = Object.freeze({
  site: 'https://www.thtohieu.com',
  apex: 'https://thtohieu.com',
  api: 'https://api.thtohieu.com',
  parent: 'https://phuhuynh.thtohieu.com',
});

const TARGET_NAMES = Object.keys(PRODUCTION_ORIGINS);

export function assertProductionTarget(raw, target) {
  if (!TARGET_NAMES.includes(target)) {
    throw new Error(`Unknown production smoke target: ${target}`);
  }

  const rawText = String(raw || '');
  const canonicalOrigin = PRODUCTION_ORIGINS[target];
  if (rawText !== rawText.trim() || (rawText !== canonicalOrigin && rawText !== `${canonicalOrigin}/`)) {
    throw new Error(`Unapproved production smoke target for ${target}.`);
  }
  let url;
  try {
    url = new URL(rawText);
  } catch {
    throw new Error(`Unapproved production smoke target for ${target}.`);
  }

  if (
    url.origin !== canonicalOrigin
    || url.pathname !== '/'
    || url.username
    || url.password
    || url.search
    || url.hash
  ) {
    throw new Error(`Unapproved production smoke target for ${target}.`);
  }

  return url.origin;
}
