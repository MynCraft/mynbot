export const SUPPORTED_VERSIONS = [
  '1.21.1',
] as const;

export const DEFAULT_VERSION = SUPPORTED_VERSIONS[0];

export const SUPPORTED_VERSION_SET = new Set<string>(SUPPORTED_VERSIONS);
