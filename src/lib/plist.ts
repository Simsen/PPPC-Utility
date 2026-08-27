import type { AppInfo, KnownApp } from './types';

export type PlistValue =
  | string
  | number
  | boolean
  | Date
  | PlistDict
  | PlistValue[];

export interface PlistDict {
  [key: string]: PlistValue;
}

/**
 * Parse an XML plist (Info.plist, .mobileconfig, or any other Apple plist
 * document) into a JS object tree. Handles nested dicts and arrays at any
 * depth — e.g. a .mobileconfig's `PayloadContent` array of payload dicts.
 */
export function parsePlistDocument(xmlString: string): PlistDict {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'text/xml');
  const plistNode = doc.querySelector('plist');
  if (!plistNode) throw new Error('Invalid plist: no plist element found');
  const rootDict = plistNode.querySelector('dict');
  if (!rootDict) throw new Error('Invalid plist: no root dict found');
  return parseDict(rootDict);
}

function parseDict(dictNode: Element): PlistDict {
  const result: PlistDict = {};
  const children = Array.from(dictNode.children);
  for (let i = 0; i < children.length; i += 2) {
    const keyNode = children[i];
    const valueNode = children[i + 1];
    if (keyNode && keyNode.tagName === 'key' && valueNode) {
      result[keyNode.textContent ?? ''] = parseValue(valueNode);
    }
  }
  return result;
}

function parseValue(node: Element): PlistValue {
  switch (node.tagName) {
    case 'string':
      return node.textContent ?? '';
    case 'integer':
      return parseInt(node.textContent ?? '0', 10);
    case 'real':
      return parseFloat(node.textContent ?? '0');
    case 'true':
      return true;
    case 'false':
      return false;
    case 'dict':
      return parseDict(node);
    case 'array':
      return Array.from(node.children).map((child) => parseValue(child));
    case 'data':
      return node.textContent ?? '';
    case 'date':
      return new Date(node.textContent ?? '');
    default:
      return node.textContent ?? '';
  }
}

/**
 * Extract AppInfo from raw plist XML.
 * Auto-fills codeRequirement when the bundleId matches one of the given
 * known apps.
 */
export function parsePlist(content: string, knownApps: KnownApp[]): AppInfo {
  try {
    const data = parsePlistDocument(content);
    const bundleId = data.CFBundleIdentifier;
    if (typeof bundleId !== 'string' || !bundleId) {
      throw new Error('No CFBundleIdentifier found in plist');
    }
    const rawDisplay = data.CFBundleDisplayName ?? data.CFBundleName ?? bundleId;
    const displayName = typeof rawDisplay === 'string' ? rawDisplay : bundleId;
    const knownApp = knownApps.find((a) => a.bundleId === bundleId);
    return {
      bundleId,
      displayName,
      codeRequirement: knownApp ? knownApp.codeRequirement : null,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error('Failed to parse plist: ' + msg);
  }
}
