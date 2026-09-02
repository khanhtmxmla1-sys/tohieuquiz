const schemePattern = /^[a-z][a-z\d+.-]*:/i;
const externalUrlPattern = /^https?:\/\/[^\s/]+/i;
const unsafeCharactersPattern = /[\u0000-\u001f\u007f\\\s]/;

export const isSafeCompetitionUrl = (value: string): boolean => {
  const url = value.trim();

  if (!url || url.startsWith('//') || unsafeCharactersPattern.test(url)) return false;
  if (externalUrlPattern.test(url)) return true;
  if (schemePattern.test(url)) return false;

  return url.startsWith('/') || url.startsWith('./') || url.startsWith('../');
};

export const isSafeCompetitionMarkdownUrl = isSafeCompetitionUrl;

export const isExternalCompetitionUrl = (value: string): boolean => (
  isSafeCompetitionUrl(value) && externalUrlPattern.test(value.trim())
);

export const containsRawHtmlLikeTag = (line: string): boolean => /<\s*\/?\s*[a-z][^>]*>/i.test(line);

