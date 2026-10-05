import {staticFile} from 'remotion';

declare const __BAYMAX_ASSETS__: Record<string, string> | undefined;
// The standalone HTML embeds assets; Studio continues using its public folder.
export const assetFile = (path: string) =>
  typeof __BAYMAX_ASSETS__ !== 'undefined' && __BAYMAX_ASSETS__[path]
    ? __BAYMAX_ASSETS__[path]
    : staticFile(path);
