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
