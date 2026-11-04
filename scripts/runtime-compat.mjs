/** Supported engine versions and native TS compatibility. No external dependencies. */
export function parseVersion(version) {
  const m = String(version).replace(/^v/, "").match(/^(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3] || 0) };
}
export function supported(version) {
  const v = typeof version === "string" ? parseVersion(version) : version;
  if (!v) return false;
  return (v.major === 22 && v.minor >= 13) ||
    (v.major === 23 && v.minor >= 6) || v.major >= 24;
}
export function needsTypeStripFlag(version) {
  const v = typeof version === "string" ? parseVersion(version) : version;
  if (!v || !supported(v)) return false;
  return v.major === 22 && v.minor < 18;
}
