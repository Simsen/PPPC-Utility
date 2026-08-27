/** Default Apple code-requirement string for an app identified only by bundle ID. */
export function defaultCodeRequirement(bundleId: string): string {
  return `identifier "${bundleId}" and anchor apple generic`;
}
