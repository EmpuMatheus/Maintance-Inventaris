import { XMLParser } from 'fast-xml-parser';

/**
 * Generic XML parsing helpers shared by the ONVIF (SOAP) and Hikvision ISAPI
 * clients. Namespace prefixes are removed so callers can address nodes by their
 * local name regardless of the device's chosen prefix.
 */

export const XML_PARSER_OPTIONS = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  parseTagValue: false,
  trimValues: true,
  textNodeName: '#text',
} as const;

const parser = new XMLParser(XML_PARSER_OPTIONS);

/** Parses an XML document into a plain object, namespace prefixes removed. */
export function parseXml(xml: string): Record<string, unknown> {
  return parser.parse(xml) as Record<string, unknown>;
}

/** Reads a value that may be a primitive or a `{ '#text': value }` object. */
export function textOf(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object') {
    const inner = (value as Record<string, unknown>)['#text'];
    if (inner !== undefined) return textOf(inner);
    const attr = (value as Record<string, unknown>)['@_xaddr'] ?? (value as Record<string, unknown>)['@_token'];
    if (attr !== undefined) return textOf(attr);
  }
  return null;
}

/** Reads an XML attribute (`@_name`) from a parsed node. */
export function attrOf(value: unknown, name: string): string | null {
  if (!value || typeof value !== 'object') return null;
  const attr = (value as Record<string, unknown>)[`@_${name}`];
  return attr === undefined ? null : textOf(attr);
}

/** Normalises a possibly-single node into an array. */
export function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

/** Escapes text for safe inclusion inside an XML element. */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
