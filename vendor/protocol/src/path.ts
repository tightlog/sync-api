const PARAM = '__param__';

function escapeRegExp(text: string): string {
  return text.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function pathPattern(build: (...params: string[]) => string): RegExp {
  const params = Array.from({ length: build.length }, () => PARAM);
  const source = build(...params)
    .split(PARAM)
    .map(escapeRegExp)
    .join('([^/]+)');
  return new RegExp(`^${source}$`);
}
