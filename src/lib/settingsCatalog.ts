import { PPPC_PERMISSIONS } from './permissions';
import { defaultCodeRequirement } from './codeRequirement';
import type {
  AppleEventReceiver,
  Authorization,
  AuthMode,
  ProfileSettings,
  SelectedApp,
} from './types';

/**
 * Build a Microsoft Intune Settings Catalog configuration-policy body for the
 * `com.apple.tcc.configuration-profile-policy` setting tree.
 *
 * The shape mirrors what Intune itself exports and what gilburns/Intune-PPPC-Utility
 * generates (`IntuneJSONGenerator.swift`) — including the `null` placeholders that
 * Graph schema lists for every instance/value template reference and audit rule.
 * Without those placeholders a downloaded JSON cannot be re-imported via Intune's
 * "Import policy" UI.
 *
 * POST target:
 *   POST /beta/deviceManagement/configurationPolicies
 *
 * Coverage notes (intentional omissions, to be revisited):
 *   - Per-app `_item_comment` (free-text, optional) is not modelled in the UI.
 *   - Per-app `_item_staticcode` (boolean, optional) is not modelled in the UI.
 *   - The alternative `_item_allowed` (boolean) permission form is not exposed —
 *     we emit `_item_authorization` for every service. Both forms are valid for
 *     Accessibility / BluetoothAlways / SystemPolicyAllFiles / DownloadsFolder /
 *     SysAdminFiles per gilburns; the authorization form is the more common one.
 */

const ROOT_KEY = 'com.apple.tcc.configuration-profile-policy';
const ROOT_SETTING_ID = `${ROOT_KEY}_${ROOT_KEY}`;
const SERVICES_ID = `${ROOT_KEY}_services`;

const TYPE_GROUP_COLL = '#microsoft.graph.deviceManagementConfigurationGroupSettingCollectionInstance';
const TYPE_CHOICE = '#microsoft.graph.deviceManagementConfigurationChoiceSettingInstance';
const TYPE_SIMPLE = '#microsoft.graph.deviceManagementConfigurationSimpleSettingInstance';
const TYPE_STRING_VALUE = '#microsoft.graph.deviceManagementConfigurationStringSettingValue';

/**
 * Authorization → choice-value numeric suffix.
 * Matches Microsoft's AuthorizationValue enum (and gilburns PPPCModels.swift):
 *   allow = 0, deny = 1, allowStandardUser = 2
 * (There is no `_3` — sending it produces a Graph 400 or a no-op policy.)
 */
const AUTH_SUFFIX: Record<Authorization, '0' | '1' | '2'> = {
  Allow: '0',
  Deny: '1',
  AllowStandardUserToSetSystemService: '2',
};

const IDENTIFIER_TYPE_SUFFIX = {
  bundleID: '0',
  path: '1',
} as const;

// ─── Type model ─────────────────────────────────────────────────────────────

type SettingInstance = GroupCollectionInstance | ChoiceInstance | SimpleStringInstance;

interface ValueWrapper {
  settingValueTemplateReference: null;
  children: SettingInstance[];
}

interface GroupCollectionInstance {
  '@odata.type': typeof TYPE_GROUP_COLL;
  settingDefinitionId: string;
  settingInstanceTemplateReference: null;
  auditRuleInformation: null;
  groupSettingCollectionValue: ValueWrapper[];
}

interface ChoiceInstance {
  '@odata.type': typeof TYPE_CHOICE;
  settingDefinitionId: string;
  settingInstanceTemplateReference: null;
  auditRuleInformation: null;
  choiceSettingValue: {
    settingValueTemplateReference: null;
    value: string;
    children: SettingInstance[];
  };
}

interface SimpleStringInstance {
  '@odata.type': typeof TYPE_SIMPLE;
  settingDefinitionId: string;
  settingInstanceTemplateReference: null;
  auditRuleInformation: null;
  simpleSettingValue: {
    '@odata.type': typeof TYPE_STRING_VALUE;
    settingValueTemplateReference: null;
    value: string;
  };
}

export interface SettingsCatalogPolicy {
  name: string;
  description: string;
  platforms: 'macOS';
  technologies: 'mdm,appleRemoteManagement';
  roleScopeTagIds: string[];
  templateReference: {
    templateId: '';
    templateFamily: 'none';
    templateDisplayName: null;
    templateDisplayVersion: null;
  };
  priorityMetaData: null;
  creationSource: null;
  settingCount: number;
  settings: Array<{
    id: string;
    settingInstance: SettingInstance;
  }>;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Lowercase identifier suffix Microsoft uses for each PPPC service.
 *
 * Microsoft's settingDefinitionId scheme lowercases the Apple TCC service name
 * verbatim — `SystemPolicyAllFiles` → `systempolicyallfiles`,
 * `ScreenCapture` → `screencapture`, etc. Confirmed against
 * gilburns PPPCServiceType.swift `jsonKey` (which is just `rawValue`) and
 * Microsoft's exported policy JSON.
 */
function serviceKey(tccService: string): string {
  return tccService.toLowerCase();
}

/** Clamp the requested Authorization to one macOS actually honours for this authMode. */
function effectiveAuthorization(mode: AuthMode, requested: Authorization): Authorization {
  switch (mode) {
    case 'standard':
      return requested;
    case 'denyOrStandardUser':
      return requested === 'Deny' ? 'Deny' : 'AllowStandardUserToSetSystemService';
    case 'denyOnly':
      return 'Deny';
  }
}

function valueWrapper(children: SettingInstance[]): ValueWrapper {
  return { settingValueTemplateReference: null, children };
}

function simple(settingDefinitionId: string, value: string): SimpleStringInstance {
  return {
    '@odata.type': TYPE_SIMPLE,
    settingDefinitionId,
    settingInstanceTemplateReference: null,
    auditRuleInformation: null,
    simpleSettingValue: {
      '@odata.type': TYPE_STRING_VALUE,
      settingValueTemplateReference: null,
      value,
    },
  };
}

function choice(settingDefinitionId: string, valueSuffix: string): ChoiceInstance {
  return {
    '@odata.type': TYPE_CHOICE,
    settingDefinitionId,
    settingInstanceTemplateReference: null,
    auditRuleInformation: null,
    choiceSettingValue: {
      settingValueTemplateReference: null,
      value: `${settingDefinitionId}_${valueSuffix}`,
      children: [],
    },
  };
}

function groupColl(
  settingDefinitionId: string,
  values: ValueWrapper[],
): GroupCollectionInstance {
  return {
    '@odata.type': TYPE_GROUP_COLL,
    settingDefinitionId,
    settingInstanceTemplateReference: null,
    auditRuleInformation: null,
    groupSettingCollectionValue: values,
  };
}

/** Field order matches gilburns/Intune-PPPC-Utility — cosmetic for Graph, but
 *  keeps our JSON visually consistent with Intune-exported policies. */
function appEntryChildren(
  serviceId: string,
  bundleId: string,
  codeRequirement: string,
  authorization: Authorization,
  receiver?: AppleEventReceiver,
): SettingInstance[] {
  const prefix = `${serviceId}_item`;
  const children: SettingInstance[] = [];

  if (receiver) {
    children.push(
      simple(
        `${prefix}_aereceivercoderequirement`,
        receiver.codeRequirement || defaultCodeRequirement(receiver.identifier),
      ),
      simple(`${prefix}_aereceiveridentifier`, receiver.identifier),
      choice(
        `${prefix}_aereceiveridentifiertype`,
        IDENTIFIER_TYPE_SUFFIX[receiver.identifierType],
      ),
    );
  }

  children.push(
    choice(`${prefix}_authorization`, AUTH_SUFFIX[authorization]),
    simple(`${prefix}_coderequirement`, codeRequirement),
    simple(`${prefix}_identifier`, bundleId),
    choice(`${prefix}_identifiertype`, IDENTIFIER_TYPE_SUFFIX.bundleID),
  );

  return children;
}

interface ServiceAppRow {
  bundleId: string;
  codeRequirement: string;
  authorization: Authorization;
  receiver?: AppleEventReceiver;
}

// ─── Main entry point ───────────────────────────────────────────────────────

/**
 * Build the Settings Catalog policy body for one logical profile.
 * Returns null when no service entries would be emitted.
 */
export function buildSettingsCatalogPolicy(
  apps: SelectedApp[],
  settings: ProfileSettings,
): SettingsCatalogPolicy | null {
  // service tccName -> rows
  const rowsByService = new Map<string, ServiceAppRow[]>();

  for (const item of apps) {
    for (const [permId, state] of Object.entries(item.permissions)) {
      if (!state.enabled) continue;
      const perm = PPPC_PERMISSIONS.find((p) => p.id === permId);
      if (!perm) continue;
      const codeReq = item.app.codeRequirement || defaultCodeRequirement(item.app.bundleId);

      if (perm.tccService === 'AppleEvents') {
        // Skip receivers with empty identifier — Graph rejects empty required
        // strings, and an AppleEvents entry without a target app is meaningless.
        const receivers = (state.receivers ?? []).filter((r) => r.identifier.trim() !== '');
        if (receivers.length === 0) continue;
        const list = rowsByService.get(perm.tccService) ?? [];
        for (const r of receivers) {
          list.push({
            bundleId: item.app.bundleId,
            codeRequirement: codeReq,
            authorization: r.authorization,
            receiver: r,
          });
        }
        rowsByService.set(perm.tccService, list);
        continue;
      }

      const list = rowsByService.get(perm.tccService) ?? [];
      list.push({
        bundleId: item.app.bundleId,
        codeRequirement: codeReq,
        authorization: effectiveAuthorization(perm.authMode, state.authorization),
      });
      rowsByService.set(perm.tccService, list);
    }
  }

  if (rowsByService.size === 0) return null;

  const serviceInstances: GroupCollectionInstance[] = [];
  for (const [tccName, rows] of rowsByService) {
    const serviceId = `${SERVICES_ID}_${serviceKey(tccName)}`;
    serviceInstances.push(
      groupColl(
        serviceId,
        rows.map((row) =>
          valueWrapper(
            appEntryChildren(
              serviceId,
              row.bundleId,
              row.codeRequirement,
              row.authorization,
              row.receiver,
            ),
          ),
        ),
      ),
    );
  }

  // Root tree: root group → single child = services container → service entries.
  const root: GroupCollectionInstance = groupColl(ROOT_SETTING_ID, [
    valueWrapper([groupColl(SERVICES_ID, [valueWrapper(serviceInstances)])]),
  ]);

  return {
    name: settings.payloadName || 'PPPC Configuration',
    description: settings.payloadDescription || '',
    platforms: 'macOS',
    technologies: 'mdm,appleRemoteManagement',
    roleScopeTagIds: settings.scopeTagIds.length > 0 ? settings.scopeTagIds : ['0'],
    templateReference: {
      templateId: '',
      templateFamily: 'none',
      templateDisplayName: null,
      templateDisplayVersion: null,
    },
    priorityMetaData: null,
    creationSource: null,
    settingCount: 1,
    settings: [
      {
        id: '0',
        settingInstance: root,
      },
    ],
  };
}

/** Convenience: stringify policy with stable indentation for preview/download. */
export function serializeSettingsCatalogPolicy(policy: SettingsCatalogPolicy): string {
  return JSON.stringify(policy, null, 4);
}
