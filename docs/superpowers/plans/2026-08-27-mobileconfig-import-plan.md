# Import Existing PPPC mobileconfig → Settings Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user load an existing PPPC `.mobileconfig` profile and have it fully populate the Build workspace (apps, permissions, AppleEvents receivers, profile metadata), ready to export as an Intune Settings Catalog policy.

**Architecture:** A new pure-function parser (`src/lib/mobileconfigImport.ts`) turns mobileconfig XML into the app's existing `SelectedApp[]`/`ProfileSettings` state shape, reusing the existing plist-parsing and app-entry-construction helpers. A new `ImportProfile` component drives the parser from a drop zone; `App.tsx` wires its result into state (replacing the current workspace, with a confirmation when there's something to lose) and switches the output format to Settings Catalog. The existing `generateProfiles` → `buildSettingsCatalogPolicy` pipeline then produces the Settings Catalog JSON with no changes.

**Tech Stack:** React 19 + TypeScript (strict, `verbatimModuleSyntax`) + Vite 6, client-side only (no backend). Introduces Vitest + jsdom as dev-only test tooling — this repo currently has no test runner at all.

## Global Constraints

- All parsing happens entirely client-side in the browser — no network calls, no server (matches the app's existing "processes all data locally" guarantee, stated in `src/App.tsx`'s footer).
- TypeScript strict mode applies repo-wide: `strict`, `verbatimModuleSyntax` (use `import type` / inline `type` modifiers for type-only imports), `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch` (see `tsconfig.app.json`).
- `npm run build` (`tsc -b && vite build`) must pass after every task — this is the project's only existing CI-equivalent gate today.
- Only `.mobileconfig` import is in scope. Importing a Settings Catalog JSON (the reverse direction) is explicitly out of scope.
- Existing behavior of `parsePlist`, `generateMobileconfig`, and `buildSettingsCatalogPolicy` must not change for any existing caller — this plan only adds a shared helper and a new export, never changes existing signatures or output.
- Design source of truth: `docs/superpowers/specs/2026-08-27-mobileconfig-import-design.md`.

---

## Task 1: Test tooling + shared `defaultCodeRequirement` helper

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`
- Create: `src/lib/codeRequirement.ts`
- Create: `src/lib/codeRequirement.test.ts`
- Modify: `src/lib/mobileconfig.ts:1-10,46-48`
- Modify: `src/lib/settingsCatalog.ts:1-8,147-149`

**Interfaces:**
- Produces: `export function defaultCodeRequirement(bundleId: string): string` in `src/lib/codeRequirement.ts` — consumed by `mobileconfig.ts`, `settingsCatalog.ts` (this task), and `mobileconfigImport.ts` (Task 3).

This repo has zero test infrastructure today (no test runner in `package.json`, no `*.test.*` files anywhere). Since Task 3 is a pure-function parser with many branches that deserve real unit tests, this task installs Vitest (already a natural fit — same author/config surface as the existing Vite 6 setup) with jsdom (needed because `plist.ts` uses the browser `DOMParser` API, which Node doesn't provide natively). It also extracts `defaultCodeRequirement`, which is currently duplicated verbatim in `mobileconfig.ts` and `settingsCatalog.ts`, into a shared module — otherwise Task 3 would add a third copy.

- [ ] **Step 1: Install Vitest and jsdom**

Run: `npm install -D vitest jsdom`
Expected: `package.json` gains `vitest` and `jsdom` under `devDependencies`.

- [ ] **Step 2: Wire Vitest into the existing Vite config**

Edit `vite.config.ts` — replace the whole file:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

const base = process.env.VITE_BASE ?? '/';

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
  },
});
```

(`vitest/config`'s `defineConfig` is a drop-in replacement for `vite`'s that also type-checks the `test` key — no other config file needed.)

- [ ] **Step 3: Add a `test` script**

Edit `package.json` — change:

```json
  "scripts": {
    "build": "tsc -b && vite build"
  },
```

to:

```json
  "scripts": {
    "build": "tsc -b && vite build",
    "test": "vitest run"
  },
```

- [ ] **Step 4: Write the failing test**

Create `src/lib/codeRequirement.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { defaultCodeRequirement } from './codeRequirement';

describe('defaultCodeRequirement', () => {
  it('builds an anchor-apple-generic requirement for the given bundle ID', () => {
    expect(defaultCodeRequirement('com.example.app')).toBe(
      'identifier "com.example.app" and anchor apple generic',
    );
  });
});
```

- [ ] **Step 5: Run it, verify it fails**

Run: `npx vitest run src/lib/codeRequirement.test.ts`
Expected: FAIL — cannot find module `./codeRequirement`.

- [ ] **Step 6: Implement the helper**

Create `src/lib/codeRequirement.ts`:

```ts
/** Default Apple code-requirement string for an app identified only by bundle ID. */
export function defaultCodeRequirement(bundleId: string): string {
  return `identifier "${bundleId}" and anchor apple generic`;
}
```

- [ ] **Step 7: Run it, verify it passes**

Run: `npx vitest run src/lib/codeRequirement.test.ts`
Expected: PASS.

- [ ] **Step 8: Point `mobileconfig.ts` at the shared helper**

Edit `src/lib/mobileconfig.ts` — change the import block:

```ts
import { PPPC_PERMISSIONS } from './permissions';
import { escapeXml } from './xml';
import { generateRandomUUID } from './uuid';
import type {
  AppleEventReceiver,
  Authorization,
  AuthMode,
  ProfileSettings,
  SelectedApp,
} from './types';
```

to:

```ts
import { PPPC_PERMISSIONS } from './permissions';
import { escapeXml } from './xml';
import { generateRandomUUID } from './uuid';
import { defaultCodeRequirement } from './codeRequirement';
import type {
  AppleEventReceiver,
  Authorization,
  AuthMode,
  ProfileSettings,
  SelectedApp,
} from './types';
```

and delete the now-duplicate local function:

```ts
function defaultCodeRequirement(bundleId: string): string {
  return `identifier "${bundleId}" and anchor apple generic`;
}
```

- [ ] **Step 9: Point `settingsCatalog.ts` at the shared helper**

Edit `src/lib/settingsCatalog.ts` — change the import block:

```ts
import { PPPC_PERMISSIONS } from './permissions';
import type {
  AppleEventReceiver,
  Authorization,
  AuthMode,
  ProfileSettings,
  SelectedApp,
} from './types';
```

to:

```ts
import { PPPC_PERMISSIONS } from './permissions';
import { defaultCodeRequirement } from './codeRequirement';
import type {
  AppleEventReceiver,
  Authorization,
  AuthMode,
  ProfileSettings,
  SelectedApp,
} from './types';
```

and delete the now-duplicate local function:

```ts
function defaultCodeRequirement(bundleId: string): string {
  return `identifier "${bundleId}" and anchor apple generic`;
}
```

- [ ] **Step 10: Full regression check**

Run: `npm run build`
Expected: succeeds with no type errors (confirms both generator files still compile correctly against the shared helper).

- [ ] **Step 11: Commit**

```bash
git add package.json package-lock.json vite.config.ts src/lib/codeRequirement.ts src/lib/codeRequirement.test.ts src/lib/mobileconfig.ts src/lib/settingsCatalog.ts
git commit -m "test: add Vitest tooling; dedupe defaultCodeRequirement into shared helper"
```

---

## Task 2: Export a full-document plist parser

**Files:**
- Modify: `src/lib/plist.ts` (full rewrite)
- Create: `src/lib/plist.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `export type PlistValue = string | number | boolean | Date | PlistDict | PlistValue[]`, `export interface PlistDict { [key: string]: PlistValue }`, `export function parsePlistDocument(xmlString: string): PlistDict` in `src/lib/plist.ts` — consumed by `mobileconfigImport.ts` (Task 3).

`plist.ts` already parses nested dicts and arrays recursively (`parseValue` handles `'dict'` and `'array'` cases) — the only gap is that the entry point (`parsePlistXml`) isn't exported and its types aren't exported either. This task exports the existing parsing entry point under a clearer name (`parsePlistDocument`) and exports its types, without changing any parsing behavior. `parsePlist` (used by the existing `.zip`/`Info.plist` import flow) is rewritten to call it, with no behavior change — verified by a regression test.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/plist.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parsePlist, parsePlistDocument } from './plist';

const INFO_PLIST = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleIdentifier</key>
    <string>com.example.app</string>
    <key>CFBundleDisplayName</key>
    <string>Example App</string>
</dict>
</plist>`;

const NESTED_PLIST = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>PayloadContent</key>
    <array>
        <dict>
            <key>PayloadType</key>
            <string>com.apple.TCC.configuration-profile-policy</string>
            <key>Services</key>
            <dict>
                <key>Camera</key>
                <array>
                    <dict>
                        <key>Identifier</key>
                        <string>com.example.app</string>
                        <key>Authorization</key>
                        <string>Deny</string>
                    </dict>
                </array>
            </dict>
        </dict>
    </array>
    <key>PayloadDisplayName</key>
    <string>Example Profile</string>
</dict>
</plist>`;

describe('parsePlist', () => {
  it('extracts bundle ID and display name from a flat Info.plist', () => {
    const info = parsePlist(INFO_PLIST, []);
    expect(info.bundleId).toBe('com.example.app');
    expect(info.displayName).toBe('Example App');
  });
});

describe('parsePlistDocument', () => {
  it('parses nested arrays of dicts, e.g. a mobileconfig PayloadContent tree', () => {
    const doc = parsePlistDocument(NESTED_PLIST);
    expect(doc.PayloadDisplayName).toBe('Example Profile');

    const content = doc.PayloadContent;
    expect(Array.isArray(content)).toBe(true);
    const payload = (content as unknown[])[0] as Record<string, unknown>;
    expect(payload.PayloadType).toBe('com.apple.TCC.configuration-profile-policy');

    const services = payload.Services as Record<string, unknown>;
    const cameraEntries = services.Camera as unknown[];
    expect(cameraEntries).toHaveLength(1);
    expect((cameraEntries[0] as Record<string, unknown>).Authorization).toBe('Deny');
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/lib/plist.test.ts`
Expected: FAIL — `parsePlistDocument` is not exported from `./plist`.

- [ ] **Step 3: Rewrite `plist.ts`**

Replace the entire contents of `src/lib/plist.ts`:

```ts
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
```

- [ ] **Step 4: Run it, verify it passes**

Run: `npx vitest run src/lib/plist.test.ts`
Expected: PASS (both tests).

- [ ] **Step 5: Full regression check**

Run: `npm run build`
Expected: succeeds — confirms `files.ts` (the only other caller of `parsePlist`) still compiles and behaves identically.

- [ ] **Step 6: Commit**

```bash
git add src/lib/plist.ts src/lib/plist.test.ts
git commit -m "refactor: export parsePlistDocument for full-tree plist parsing"
```

---

## Task 3: Build the mobileconfig importer — standard services

**Files:**
- Create: `src/lib/mobileconfigImport.ts`
- Create: `src/lib/mobileconfigImport.test.ts`

**Interfaces:**
- Consumes: `parsePlistDocument`, `PlistDict`, `PlistValue` (`./plist`, Task 2); `defaultCodeRequirement` (`./codeRequirement`, Task 1); `PPPC_PERMISSIONS` (`./permissions`); `makeAppEntry` (`./state`); `generateRandomUUID` (`./uuid`); `AppInfo`, `Authorization`, `KnownApp`, `PermissionsState`, `ProfileSettings`, `SelectedApp` (`./types`).
- Produces: `export interface MobileconfigImportResult { apps: SelectedApp[]; settings: ProfileSettings; warnings: string[] }` and `export function importMobileconfig(xmlString: string, knownApps: KnownApp[], nextIdStart: number): MobileconfigImportResult` in `src/lib/mobileconfigImport.ts` — consumed by `ImportProfile.tsx` (Task 6).

This task covers everything except AppleEvents (Task 4 adds that): payload discovery, profile-settings extraction, standard-service mapping, code-requirement default-collapsing, known-app display-name lookup, and the warning/failure paths for unsupported services, path identifiers, and unrecognized authorization values.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/mobileconfigImport.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { importMobileconfig } from './mobileconfigImport';
import { defaultCodeRequirement } from './codeRequirement';
import type { KnownApp } from './types';

function entryDict(fields: Record<string, string>): string {
  const kv = Object.entries(fields)
    .map(
      ([k, v]) =>
        `                        <key>${k}</key>\n                        <string>${v}</string>`,
    )
    .join('\n');
  return `                    <dict>\n${kv}\n                    </dict>`;
}

function serviceArray(service: string, entries: string[]): string {
  return `                <key>${service}</key>\n                <array>\n${entries.join('\n')}\n                </array>`;
}

function profileXml(servicesXml: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>PayloadContent</key>
    <array>
        <dict>
            <key>PayloadType</key>
            <string>com.apple.TCC.configuration-profile-policy</string>
            <key>Services</key>
            <dict>
${servicesXml}
            </dict>
        </dict>
    </array>
    <key>PayloadOrganization</key>
    <string>Acme Corp</string>
    <key>PayloadDisplayName</key>
    <string>Acme PPPC</string>
    <key>PayloadIdentifier</key>
    <string>acme.pppc.profile</string>
    <key>PayloadDescription</key>
    <string>Managed by Acme IT</string>
</dict>
</plist>`;
}

const NON_PPPC_PROFILE = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>PayloadContent</key>
    <array>
        <dict>
            <key>PayloadType</key>
            <string>com.apple.wifi.managed</string>
        </dict>
    </array>
</dict>
</plist>`;

const KNOWN_APPS: KnownApp[] = [
  {
    bundleId: 'com.example.app',
    displayName: 'Example App',
    codeRequirement: defaultCodeRequirement('com.example.app'),
  },
];

describe('importMobileconfig', () => {
  it('throws when the profile has no PPPC payload', () => {
    expect(() => importMobileconfig(NON_PPPC_PROFILE, [], 1)).toThrow(
      'No PPPC payload found in this profile.',
    );
  });

  it('imports a single app with one enabled standard permission and profile settings', () => {
    const xml = profileXml(
      serviceArray('Camera', [
        entryDict({
          Identifier: 'com.example.app',
          IdentifierType: 'bundleID',
          Authorization: 'Deny',
          CodeRequirement: defaultCodeRequirement('com.example.app'),
        }),
      ]),
    );

    const result = importMobileconfig(xml, KNOWN_APPS, 1);

    expect(result.warnings).toEqual([]);
    expect(result.apps).toHaveLength(1);
    const app = result.apps[0];
    expect(app.app.bundleId).toBe('com.example.app');
    expect(app.app.displayName).toBe('Example App');
    expect(app.app.codeRequirement).toBeNull();
    expect(app.isKnownApp).toBe(true);
    expect(app.permissions.camera.enabled).toBe(true);
    expect(app.permissions.camera.authorization).toBe('Deny');

    expect(result.settings).toEqual({
      organization: 'Acme Corp',
      payloadName: 'Acme PPPC',
      payloadIdentifier: 'acme.pppc.profile',
      payloadDescription: 'Managed by Acme IT',
      scopeTagIds: ['0'],
      deploymentChannel: 'deviceChannel',
    });
  });

  it('keeps an explicit non-default code requirement', () => {
    const customReq =
      'identifier "com.example.app" and anchor apple generic and certificate leaf[subject.CN] = "Example"';
    const xml = profileXml(
      serviceArray('Camera', [
        entryDict({
          Identifier: 'com.example.app',
          IdentifierType: 'bundleID',
          Authorization: 'Deny',
          CodeRequirement: customReq,
        }),
      ]),
    );

    const result = importMobileconfig(xml, [], 1);
    expect(result.apps[0].app.codeRequirement).toBe(customReq);
  });

  it('falls back to the bundle ID as display name when the app is not known', () => {
    const xml = profileXml(
      serviceArray('Camera', [
        entryDict({
          Identifier: 'com.example.app',
          IdentifierType: 'bundleID',
          Authorization: 'Deny',
        }),
      ]),
    );

    const result = importMobileconfig(xml, [], 1);
    expect(result.apps[0].app.displayName).toBe('com.example.app');
    expect(result.apps[0].isKnownApp).toBe(false);
  });

  it('skips an unsupported TCC service and records a warning', () => {
    const xml = profileXml(
      [
        serviceArray('SomeFutureService', [
          entryDict({
            Identifier: 'com.example.app',
            IdentifierType: 'bundleID',
            Authorization: 'Allow',
          }),
        ]),
        serviceArray('Microphone', [
          entryDict({
            Identifier: 'com.example.app',
            IdentifierType: 'bundleID',
            Authorization: 'Deny',
          }),
        ]),
      ].join('\n'),
    );

    const result = importMobileconfig(xml, [], 1);
    expect(result.apps).toHaveLength(1);
    expect(result.warnings.some((w) => w.includes('SomeFutureService'))).toBe(true);
  });

  it('skips a path-identified entry and records a warning', () => {
    const xml = profileXml(
      [
        serviceArray('Camera', [
          entryDict({
            Identifier: '/Applications/Foo.app',
            IdentifierType: 'path',
            Authorization: 'Deny',
          }),
        ]),
        serviceArray('Microphone', [
          entryDict({
            Identifier: 'com.example.app',
            IdentifierType: 'bundleID',
            Authorization: 'Deny',
          }),
        ]),
      ].join('\n'),
    );

    const result = importMobileconfig(xml, [], 1);
    expect(result.apps).toHaveLength(1);
    expect(result.warnings.some((w) => w.includes('path identifier'))).toBe(true);
  });

  it('skips an entry with an unrecognized Authorization value and records a warning', () => {
    const xml = profileXml(
      [
        serviceArray('Camera', [
          entryDict({
            Identifier: 'com.example.app',
            IdentifierType: 'bundleID',
            Authorization: 'Maybe',
          }),
        ]),
        serviceArray('Microphone', [
          entryDict({
            Identifier: 'com.example.app',
            IdentifierType: 'bundleID',
            Authorization: 'Deny',
          }),
        ]),
      ].join('\n'),
    );

    const result = importMobileconfig(xml, [], 1);
    expect(result.apps).toHaveLength(1);
    expect(result.warnings.some((w) => w.includes('Maybe'))).toBe(true);
  });

  it('throws when every entry is skipped', () => {
    const xml = profileXml(
      serviceArray('SomeFutureService', [
        entryDict({
          Identifier: 'com.example.app',
          IdentifierType: 'bundleID',
          Authorization: 'Allow',
        }),
      ]),
    );

    expect(() => importMobileconfig(xml, [], 1)).toThrow(
      'This profile has no importable PPPC entries.',
    );
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/lib/mobileconfigImport.test.ts`
Expected: FAIL — cannot find module `./mobileconfigImport`.

- [ ] **Step 3: Implement the importer (standard services only)**

Create `src/lib/mobileconfigImport.ts`:

```ts
import { defaultCodeRequirement } from './codeRequirement';
import { PPPC_PERMISSIONS } from './permissions';
import { parsePlistDocument, type PlistDict, type PlistValue } from './plist';
import { makeAppEntry } from './state';
import { generateRandomUUID } from './uuid';
import type {
  AppInfo,
  Authorization,
  KnownApp,
  PermissionsState,
  ProfileSettings,
  SelectedApp,
} from './types';

const PPPC_PAYLOAD_TYPE = 'com.apple.TCC.configuration-profile-policy';

const VALID_AUTHORIZATIONS: Authorization[] = [
  'Allow',
  'Deny',
  'AllowStandardUserToSetSystemService',
];

export interface MobileconfigImportResult {
  apps: SelectedApp[];
  settings: ProfileSettings;
  warnings: string[];
}

function asString(v: PlistValue | undefined): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function asDict(v: PlistValue | undefined): PlistDict | undefined {
  return typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)
    ? v
    : undefined;
}

function asArray(v: PlistValue | undefined): PlistValue[] | undefined {
  return Array.isArray(v) ? v : undefined;
}

interface AppOverlay {
  codeRequirement: string | null;
  standard: Partial<Record<string, { enabled: true; authorization: Authorization }>>;
}

function extractSettings(root: PlistDict): ProfileSettings {
  return {
    organization: asString(root.PayloadOrganization) ?? '',
    payloadName: asString(root.PayloadDisplayName) ?? '',
    payloadIdentifier: asString(root.PayloadIdentifier) ?? generateRandomUUID(),
    payloadDescription: asString(root.PayloadDescription) ?? '',
    scopeTagIds: ['0'],
    deploymentChannel: 'deviceChannel',
  };
}

function findPppcPayload(root: PlistDict): PlistDict {
  const payloadContent = asArray(root.PayloadContent) ?? [];
  for (const item of payloadContent) {
    const dict = asDict(item);
    if (dict && asString(dict.PayloadType) === PPPC_PAYLOAD_TYPE) return dict;
  }
  throw new Error('No PPPC payload found in this profile.');
}

/**
 * Parse an existing PPPC .mobileconfig document into the app/permission
 * state this tool already knows how to render and export. Entries this
 * tool can't represent (unsupported services, path-based identifiers,
 * unrecognized authorization values) are skipped and reported as warnings
 * rather than failing the whole import.
 */
export function importMobileconfig(
  xmlString: string,
  knownApps: KnownApp[],
  nextIdStart: number,
): MobileconfigImportResult {
  const root = parsePlistDocument(xmlString);
  const pppcPayload = findPppcPayload(root);
  const servicesDict = asDict(pppcPayload.Services) ?? {};
  const warnings: string[] = [];
  const overlays = new Map<string, AppOverlay>();

  function overlayFor(bundleId: string): AppOverlay {
    let overlay = overlays.get(bundleId);
    if (!overlay) {
      overlay = { codeRequirement: null, standard: {} };
      overlays.set(bundleId, overlay);
    }
    return overlay;
  }

  function applyCodeRequirement(bundleId: string, codeReq: string | undefined) {
    if (!codeReq) return;
    const overlay = overlayFor(bundleId);
    if (overlay.codeRequirement !== null) return;
    overlay.codeRequirement =
      codeReq === defaultCodeRequirement(bundleId) ? null : codeReq;
  }

  for (const [tccService, rawEntries] of Object.entries(servicesDict)) {
    const entries = asArray(rawEntries) ?? [];
    const perm = PPPC_PERMISSIONS.find((p) => p.tccService === tccService);
    if (!perm) {
      if (entries.length > 0) {
        warnings.push(`Unsupported service "${tccService}" skipped.`);
      }
      continue;
    }

    for (const rawEntry of entries) {
      const entry = asDict(rawEntry);
      if (!entry) continue;

      const bundleId = asString(entry.Identifier);
      const identifierType = asString(entry.IdentifierType);
      if (!bundleId) {
        warnings.push(`Entry for "${tccService}" has no Identifier — skipped.`);
        continue;
      }
      if (identifierType !== 'bundleID') {
        warnings.push(
          `"${bundleId}" uses a path identifier for "${tccService}", which this tool doesn't support — skipped.`,
        );
        continue;
      }

      applyCodeRequirement(bundleId, asString(entry.CodeRequirement));

      const authRaw = asString(entry.Authorization);
      if (!authRaw || !VALID_AUTHORIZATIONS.includes(authRaw as Authorization)) {
        warnings.push(
          `Unrecognized authorization "${authRaw ?? ''}" for ${tccService} (bundle ${bundleId}) skipped.`,
        );
        continue;
      }

      overlayFor(bundleId).standard[perm.id] = {
        enabled: true,
        authorization: authRaw as Authorization,
      };
    }
  }

  if (overlays.size === 0) {
    throw new Error('This profile has no importable PPPC entries.');
  }

  const bundleIds = Array.from(overlays.keys());
  const apps: SelectedApp[] = bundleIds.map((bundleId, index) => {
    const overlay = overlays.get(bundleId)!;
    const known = knownApps.find((a) => a.bundleId === bundleId);
    const appInfo: AppInfo = {
      bundleId,
      displayName: known?.displayName ?? bundleId,
      codeRequirement: overlay.codeRequirement,
    };
    const entry = makeAppEntry(appInfo, nextIdStart + index, index === 0, !!known);

    const permissions: PermissionsState = { ...entry.permissions };
    for (const [permId, change] of Object.entries(overlay.standard)) {
      if (change) permissions[permId] = { ...permissions[permId], ...change };
    }

    return { ...entry, permissions };
  });

  return { apps, settings: extractSettings(root), warnings };
}
```

- [ ] **Step 4: Run it, verify it passes**

Run: `npx vitest run src/lib/mobileconfigImport.test.ts`
Expected: PASS (all 8 tests).

- [ ] **Step 5: Full regression check**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/lib/mobileconfigImport.ts src/lib/mobileconfigImport.test.ts
git commit -m "feat: parse standard PPPC services from an imported mobileconfig"
```

---

## Task 4: Extend the importer — AppleEvents receivers

**Files:**
- Modify: `src/lib/mobileconfigImport.ts`
- Modify: `src/lib/mobileconfigImport.test.ts`

**Interfaces:**
- Consumes: `AppleEventReceiver` (`./types`, newly needed in this file).
- Produces: no new exports — `automation` permission entries in `MobileconfigImportResult.apps[].permissions` now carry populated `receivers[]` when the source profile has AppleEvents entries.

Under Task 3's implementation, an `AppleEvents` service key still matches the `automation` permission (its `tccService` is `'AppleEvents'`), so entries fall through the generic "standard" path: `automation.enabled` gets set correctly, but the receiver-specific fields (`AEReceiverIdentifier` etc.) are silently ignored and `receivers` stays empty. This task adds the dedicated branch that builds `receivers[]` instead.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/mobileconfigImport.test.ts` (after the closing `});` of the existing `describe('importMobileconfig', ...)` block):

```ts

describe('importMobileconfig — AppleEvents', () => {
  it('groups an AppleEvents entry into the automation permission receivers', () => {
    const xml = profileXml(
      serviceArray('AppleEvents', [
        entryDict({
          Identifier: 'com.example.app',
          IdentifierType: 'bundleID',
          CodeRequirement: defaultCodeRequirement('com.example.app'),
          AEReceiverIdentifier: 'com.example.target',
          AEReceiverIdentifierType: 'bundleID',
          AEReceiverCodeRequirement: defaultCodeRequirement('com.example.target'),
          Authorization: 'Allow',
        }),
      ]),
    );

    const result = importMobileconfig(xml, [], 1);
    expect(result.apps).toHaveLength(1);
    const automation = result.apps[0].permissions.automation;
    expect(automation.enabled).toBe(true);
    expect(automation.receivers).toEqual([
      {
        identifier: 'com.example.target',
        identifierType: 'bundleID',
        codeRequirement: defaultCodeRequirement('com.example.target'),
        authorization: 'Allow',
      },
    ]);
  });

  it('groups multiple receivers for the same sender', () => {
    const xml = profileXml(
      serviceArray('AppleEvents', [
        entryDict({
          Identifier: 'com.example.app',
          IdentifierType: 'bundleID',
          AEReceiverIdentifier: 'com.example.target-a',
          AEReceiverIdentifierType: 'bundleID',
          Authorization: 'Allow',
        }),
        entryDict({
          Identifier: 'com.example.app',
          IdentifierType: 'bundleID',
          AEReceiverIdentifier: 'com.example.target-b',
          AEReceiverIdentifierType: 'bundleID',
          Authorization: 'Deny',
        }),
      ]),
    );

    const result = importMobileconfig(xml, [], 1);
    expect(result.apps).toHaveLength(1);
    expect(result.apps[0].permissions.automation.receivers).toHaveLength(2);
  });

  it('skips an AppleEvents entry with an invalid receiver and records a warning', () => {
    const xml = profileXml(
      [
        serviceArray('AppleEvents', [
          entryDict({
            Identifier: 'com.example.app',
            IdentifierType: 'bundleID',
            Authorization: 'Allow',
          }),
        ]),
        serviceArray('Microphone', [
          entryDict({
            Identifier: 'com.example.app',
            IdentifierType: 'bundleID',
            Authorization: 'Deny',
          }),
        ]),
      ].join('\n'),
    );

    const result = importMobileconfig(xml, [], 1);
    expect(result.apps[0].permissions.automation.receivers).toEqual([]);
    expect(result.warnings.some((w) => w.includes('invalid receiver'))).toBe(true);
  });

  it('skips an AppleEvents entry with an unrecognized receiver authorization', () => {
    const xml = profileXml(
      [
        serviceArray('AppleEvents', [
          entryDict({
            Identifier: 'com.example.app',
            IdentifierType: 'bundleID',
            AEReceiverIdentifier: 'com.example.target',
            AEReceiverIdentifierType: 'bundleID',
            Authorization: 'Maybe',
          }),
        ]),
        serviceArray('Microphone', [
          entryDict({
            Identifier: 'com.example.app',
            IdentifierType: 'bundleID',
            Authorization: 'Deny',
          }),
        ]),
      ].join('\n'),
    );

    const result = importMobileconfig(xml, [], 1);
    expect(result.apps[0].permissions.automation.receivers).toEqual([]);
    expect(result.warnings.some((w) => w.includes('Maybe'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run src/lib/mobileconfigImport.test.ts`
Expected: FAIL on the 4 new tests (receivers stay empty because the current code never populates them).

- [ ] **Step 3: Add the AppleEvents branch**

Edit `src/lib/mobileconfigImport.ts` — add `AppleEventReceiver` to the type import:

```ts
import type {
  AppInfo,
  Authorization,
  KnownApp,
  PermissionsState,
  ProfileSettings,
  SelectedApp,
} from './types';
```

becomes:

```ts
import type {
  AppInfo,
  AppleEventReceiver,
  Authorization,
  KnownApp,
  PermissionsState,
  ProfileSettings,
  SelectedApp,
} from './types';
```

Add a `receivers` field to `AppOverlay`:

```ts
interface AppOverlay {
  codeRequirement: string | null;
  standard: Partial<Record<string, { enabled: true; authorization: Authorization }>>;
}
```

becomes:

```ts
interface AppOverlay {
  codeRequirement: string | null;
  standard: Partial<Record<string, { enabled: true; authorization: Authorization }>>;
  receivers: Partial<Record<string, AppleEventReceiver[]>>;
}
```

Update the `overlayFor` initializer:

```ts
      overlay = { codeRequirement: null, standard: {} };
```

becomes:

```ts
      overlay = { codeRequirement: null, standard: {}, receivers: {} };
```

Insert the AppleEvents branch between `applyCodeRequirement(...)` and the existing generic `authRaw` handling:

```ts
      applyCodeRequirement(bundleId, asString(entry.CodeRequirement));

      const authRaw = asString(entry.Authorization);
```

becomes:

```ts
      applyCodeRequirement(bundleId, asString(entry.CodeRequirement));

      if (perm.tccService === 'AppleEvents') {
        const receiverId = asString(entry.AEReceiverIdentifier);
        const receiverTypeRaw = asString(entry.AEReceiverIdentifierType);
        const receiverAuthRaw = asString(entry.Authorization);

        if (
          !receiverId ||
          (receiverTypeRaw !== 'bundleID' && receiverTypeRaw !== 'path')
        ) {
          warnings.push(
            `AppleEvents entry for "${bundleId}" has an invalid receiver — skipped.`,
          );
          continue;
        }
        if (
          !receiverAuthRaw ||
          !VALID_AUTHORIZATIONS.includes(receiverAuthRaw as Authorization)
        ) {
          warnings.push(
            `Unrecognized authorization "${receiverAuthRaw ?? ''}" for AppleEvents (bundle ${bundleId}) skipped.`,
          );
          continue;
        }

        const overlay = overlayFor(bundleId);
        const list = overlay.receivers[perm.id] ?? [];
        list.push({
          identifier: receiverId,
          identifierType: receiverTypeRaw as 'bundleID' | 'path',
          codeRequirement:
            asString(entry.AEReceiverCodeRequirement) ||
            defaultCodeRequirement(receiverId),
          authorization: receiverAuthRaw as Authorization,
        });
        overlay.receivers[perm.id] = list;
        continue;
      }

      const authRaw = asString(entry.Authorization);
```

Finally, merge receivers into each app's permissions in the apps-building loop:

```ts
    const permissions: PermissionsState = { ...entry.permissions };
    for (const [permId, change] of Object.entries(overlay.standard)) {
      if (change) permissions[permId] = { ...permissions[permId], ...change };
    }

    return { ...entry, permissions };
```

becomes:

```ts
    const permissions: PermissionsState = { ...entry.permissions };
    for (const [permId, change] of Object.entries(overlay.standard)) {
      if (change) permissions[permId] = { ...permissions[permId], ...change };
    }
    for (const [permId, receivers] of Object.entries(overlay.receivers)) {
      if (receivers) {
        permissions[permId] = { ...permissions[permId], enabled: true, receivers };
      }
    }

    return { ...entry, permissions };
```

- [ ] **Step 4: Run it, verify it passes**

Run: `npx vitest run src/lib/mobileconfigImport.test.ts`
Expected: PASS (all 12 tests — the 8 from Task 3 plus the 4 new ones).

- [ ] **Step 5: Full regression check**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/lib/mobileconfigImport.ts src/lib/mobileconfigImport.test.ts
git commit -m "feat: group imported AppleEvents entries into receiver lists"
```

---

## Task 5: Add a 'warn' toast kind

**Files:**
- Modify: `src/components/Toast.tsx` (full rewrite)

**Interfaces:**
- Produces: `export type ToastKind = 'ok' | 'err' | 'warn'` in `src/components/Toast.tsx` — consumed by `App.tsx` (Task 7).

The import feature needs to report a **partial** success ("imported, but N entries were skipped") without it auto-vanishing like a plain success toast, and without looking like an outright failure. This adds a third toast kind reusing the app's existing `--warning` theme token (already used in `DeploymentPanel.tsx` and `XmlHighlight.tsx` — this is not a new color, just a new place it's applied) and makes the message area preserve line breaks so a multi-line warning list is readable.

There's no component-test setup in this repo (no React Testing Library) and adding one is out of scope for a three-line visual change — this task is verified by the type-check build, and visually in Task 7's end-to-end check where a real "warn" toast is triggered by a partial import.

- [ ] **Step 1: Rewrite `Toast.tsx`**

Replace the entire contents of `src/components/Toast.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

export type ToastKind = 'ok' | 'err' | 'warn';

interface Props {
  toast: { kind: ToastKind; message: string } | null;
  onDismiss: () => void;
}

/** Lightweight toast pinned to the bottom-right. Auto-dismisses success toasts;
 *  error and warning toasts stay until the user dismisses them. */
export function Toast({ toast, onDismiss }: Props) {
  const [visible, setVisible] = useState(false);

  // Keep the latest onDismiss in a ref so the auto-dismiss effect doesn't
  // re-subscribe (and reset its timer) on every parent render — the parent
  // re-creates the inline `() => setToast(null)` closure every time.
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (!toast) {
      setVisible(false);
      return;
    }
    setVisible(true);
    if (toast.kind === 'ok') {
      let dismissTimer: ReturnType<typeof setTimeout> | undefined;
      const hideTimer = setTimeout(() => {
        setVisible(false);
        dismissTimer = setTimeout(() => onDismissRef.current(), 200);
      }, 3500);
      return () => {
        clearTimeout(hideTimer);
        if (dismissTimer) clearTimeout(dismissTimer);
      };
    }
  }, [toast]);

  if (!toast) return null;

  const isErr = toast.kind === 'err';
  const isWarn = toast.kind === 'warn';
  return (
    <div
      className={`fixed bottom-6 right-6 z-[60] flex items-start gap-3 max-w-md px-4 py-3 rounded-md border bg-card shadow-[var(--shadow-lift)] transition-all duration-200 ${
        isErr ? 'border-destructive/40' : isWarn ? 'border-warning/40' : 'border-primary/30'
      } ${visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}
    >
      {isErr ? (
        <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
      ) : isWarn ? (
        <AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
      ) : (
        <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
      )}
      <div className="text-sm flex-1 min-w-0 whitespace-pre-line">{toast.message}</div>
      <button
        type="button"
        onClick={onDismiss}
        className="text-muted-foreground hover:text-foreground p-0.5"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npm run build`
Expected: succeeds (no other file references `ToastKind` yet, so this compiles standalone).

- [ ] **Step 3: Commit**

```bash
git add src/components/Toast.tsx
git commit -m "feat: add a persistent warn toast kind for partial-success messages"
```

---

## Task 6: Build the `ImportProfile` drop-zone component

**Files:**
- Create: `src/components/ImportProfile.tsx`

**Interfaces:**
- Consumes: `importMobileconfig`, `MobileconfigImportResult` (`@/lib/mobileconfigImport`, Task 3/4); `KnownApp` (`@/lib/types`); `Card`, `CardHeader`, `CardBody` (`./Card`); `cn` (`@/lib/cn`).
- Produces: `export function ImportProfile(props: { knownApps: KnownApp[]; nextId: number; onImported: (result: MobileconfigImportResult) => void }): JSX.Element` — consumed by `App.tsx` (Task 7).

This mirrors the existing `AppInput.tsx` drop-zone structure and styling exactly (same drag/drop markup, same error-box pattern) so it looks native to the rest of the Build step. Unlike `AppInput`, parsing happens synchronously inside this component (no async processing needed beyond reading the file's text), and on success it hands the caller a ready `MobileconfigImportResult` rather than a single `AppInfo` — replacing the whole workspace is `App.tsx`'s job (Task 7), not this component's.

There's no component-test setup in this repo; this task is verified by the type-check build. Full behavior (including the drop zone actually rendering in the app and reacting to a real file) is verified in Task 7's end-to-end check, once it's wired into `App.tsx`.

- [ ] **Step 1: Create the component**

Create `src/components/ImportProfile.tsx`:

```tsx
import { useRef, useState, type DragEvent } from 'react';
import { Upload, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardBody } from './Card';
import { importMobileconfig, type MobileconfigImportResult } from '@/lib/mobileconfigImport';
import type { KnownApp } from '@/lib/types';
import { cn } from '@/lib/cn';

interface Props {
  knownApps: KnownApp[];
  nextId: number;
  onImported: (result: MobileconfigImportResult) => void;
}

export function ImportProfile({ knownApps, nextId, onImported }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      const text = await file.text();
      const result = importMobileconfig(text, knownApps, nextId);
      onImported(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    void handleFile(e.dataTransfer.files[0]);
  }

  return (
    <Card>
      <CardHeader
        icon={<Upload className="w-4 h-4" />}
        title="Import Existing Profile"
        subtitle="Load a PPPC .mobileconfig and convert it to Settings Catalog"
      />
      <CardBody>
        <label
          className={cn(
            'relative flex flex-col items-center justify-center p-6 rounded-md border-2 border-dashed border-border bg-background/40 cursor-pointer transition',
            dragOver && 'border-primary bg-primary/5',
          )}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".mobileconfig"
            className="sr-only"
            onChange={(e) => {
              void handleFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <Upload className="w-8 h-8 text-muted-foreground mb-2" />
          <p className="text-sm">
            Drag & drop a{' '}
            <span className="text-primary font-medium">.mobileconfig</span> file
          </p>
          <p className="text-xs text-muted-foreground">
            Replaces your current apps and profile settings
          </p>
        </label>

        {error && (
          <div className="mt-4 flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/ImportProfile.tsx
git commit -m "feat: add ImportProfile drop-zone component"
```

---

## Task 7: Wire the importer into `App.tsx`

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `ImportProfile` (`./components/ImportProfile`, Task 6); `MobileconfigImportResult` (`./lib/mobileconfigImport`, Task 3/4); `ToastKind` (`./components/Toast`, Task 5).

This is the integration point: replacing the workspace (with a confirmation when there's something to lose), switching to Settings Catalog format, bumping the `nextId` counter past the imported apps' IDs, and reporting the outcome via toast. This task's own verification IS the feature's end-to-end test — no code changes to verify in isolation beyond the build, since `App.tsx`'s job is purely wiring.

- [ ] **Step 1: Add imports**

Edit `src/App.tsx` — change:

```tsx
import { AppInput } from './components/AppInput';
import { AppCard } from './components/AppCard';
```

to:

```tsx
import { AppInput } from './components/AppInput';
import { ImportProfile } from './components/ImportProfile';
import { AppCard } from './components/AppCard';
```

and change:

```tsx
import { generateProfiles } from './lib/profiles';
import { generateRandomUUID } from './lib/uuid';
```

to:

```tsx
import { generateProfiles } from './lib/profiles';
import type { MobileconfigImportResult } from './lib/mobileconfigImport';
import type { ToastKind } from './components/Toast';
import { generateRandomUUID } from './lib/uuid';
```

- [ ] **Step 2: Widen the toast state type**

Edit `src/App.tsx` — change:

```tsx
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; message: string } | null>(null);
```

to:

```tsx
  const [toast, setToast] = useState<{ kind: ToastKind; message: string } | null>(null);
```

- [ ] **Step 3: Add the import handler**

Edit `src/App.tsx` — insert a new function immediately after `handleAppDetected` (right before `function updateApp(id: number, ...`):

```tsx
  function handleImportedProfile(result: MobileconfigImportResult) {
    if (selectedApps.length > 0) {
      const proceed = window.confirm(
        `This will replace your current ${selectedApps.length} app${selectedApps.length === 1 ? '' : 's'} and profile settings. Continue?`,
      );
      if (!proceed) return;
    }

    setSelectedApps(result.apps);
    setSettings(result.settings);
    setNextId(Math.max(...result.apps.map((a) => a.id)) + 1);
    setFormat('settingsCatalog');
    setError(null);

    const appCount = `${result.apps.length} app${result.apps.length === 1 ? '' : 's'}`;
    const profileLabel = result.settings.payloadName || 'the profile';
    if (result.warnings.length === 0) {
      setToast({ kind: 'ok', message: `Imported ${appCount} from ${profileLabel}.` });
    } else {
      const warningCount = `${result.warnings.length} item${result.warnings.length === 1 ? '' : 's'}`;
      setToast({
        kind: 'warn',
        message: `Imported ${appCount} from ${profileLabel}, ${warningCount} skipped:\n${result.warnings.join('\n')}`,
      });
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
```

- [ ] **Step 4: Render the drop zone**

Edit `src/App.tsx` — change:

```tsx
                  <AppInput
                    knownApps={knownApps}
                    onAppDetected={handleAppDetected}
                    onError={setError}
                    error={error}
                    onClearError={() => setError(null)}
                    alreadySelectedBundleIds={alreadySelectedBundleIds}
                  />

                  {selectedApps.length > 0 && (
```

to:

```tsx
                  <AppInput
                    knownApps={knownApps}
                    onAppDetected={handleAppDetected}
                    onError={setError}
                    error={error}
                    onClearError={() => setError(null)}
                    alreadySelectedBundleIds={alreadySelectedBundleIds}
                  />

                  <ImportProfile
                    knownApps={knownApps}
                    nextId={nextId}
                    onImported={handleImportedProfile}
                  />

                  {selectedApps.length > 0 && (
```

- [ ] **Step 5: Type-check**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 6: Full test suite**

Run: `npm test`
Expected: all 15 tests pass (1 from Task 1, 2 from Task 2, 12 from Tasks 3–4).

- [ ] **Step 7: Manual end-to-end verification in the browser**

This is the feature's real acceptance test — there is no automated coverage for the React wiring itself.

1. Start the dev server: `npx vite`
2. Build a small profile manually: add an app via "Select Application" (upload an `Info.plist` or pick a known app), enable 2–3 permissions including Automation (Apple Events) with at least one receiver.
3. Switch format to "Classic" and note the generated `.mobileconfig` in the Preview panel; download it.
4. Refresh the page (clean workspace).
5. In "Import Existing Profile", drop the `.mobileconfig` file downloaded in step 3.
   - Expect: the app list repopulates with the same app, same permissions enabled with the same authorizations, the same Apple Events receiver, and format auto-switches to "Settings Catalog".
   - Expect: an "ok" toast (green, auto-dismissing) reporting the import, since a self-generated profile shouldn't produce warnings.
6. Compare the resulting Settings Catalog JSON in the Preview panel against what the same app/permission state would have produced before re-importing (spot-check a couple of `settingDefinitionId`/`value` pairs) — confirm they match.
7. Build a *second* app in the workspace (so it's non-empty), then import the same file again.
   - Expect: a `window.confirm` dialog naming the current app count before replacing.
8. Hand-edit the downloaded `.mobileconfig` to change one service's `<key>Authorization</key>` value to something invalid (e.g. `Sometimes`), save, and re-import it.
   - Expect: a "warn" toast (amber, persists until dismissed) listing the skipped entry, and the rest of the profile still imports.
9. Try importing a completely unrelated `.mobileconfig` (e.g. a Wi-Fi profile with no PPPC payload), or a non-plist text file renamed to `.mobileconfig`.
   - Expect: an "err" toast, and the workspace is left untouched.

- [ ] **Step 8: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire mobileconfig import into the Build workspace"
```

---

## Self-Review Notes

- **Spec coverage:** UI entry point (Task 6/7), replace-with-confirm behavior (Task 7 Step 3), auto-switch to Settings Catalog (Task 7 Step 3), display-name known-apps lookup (Task 3), skip+warn for unsupported services/path identifiers/bad authorization values (Tasks 3–4), AppleEvents receiver grouping (Task 4), profile-settings extraction (Task 3), total-failure guards (Task 3) — all covered.
- **Type consistency checked:** `MobileconfigImportResult` (Task 3) fields (`apps`, `settings`, `warnings`) match usage in Task 6 (`ImportProfile`) and Task 7 (`App.tsx`); `ToastKind` (Task 5) matches the widened `toast` state type in Task 7; `importMobileconfig(xmlString, knownApps, nextIdStart)` signature (Task 3) matches every call site (tests in Tasks 3–4, `ImportProfile.tsx` in Task 6).
- **No placeholders:** every step above contains complete, real code — no TBD/TODO markers, no "add appropriate handling" steps.
