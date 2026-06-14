export function canonicalGraphRef(value: string): string {
  return value
    .trim()
    .replace(/^(?:\/graph\/|graph\/)/, "")
    .replace(/^\//, "");
}

export function uiGraphRef(value: string): string {
  return `/graph/${canonicalGraphRef(value)}`;
}

export function uiGraphInstancePath(instance: string): string {
  return `/graph/${canonicalGraphRef(instance)}`;
}

export function graphEdgeKey(source: string, target: string): string {
  return `${canonicalGraphRef(source)}->${canonicalGraphRef(target)}`;
}
