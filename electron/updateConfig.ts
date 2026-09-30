import fs from 'node:fs';
import path from 'node:path';
import { toRecord } from '../shared/record';

// electron-builder strips `build` from packaged package.json. The installed
// app must detect the generated resource, not the development-only setting.
export function hasConfiguredUpdateFeed({ isPackaged, resourcesPath, packageInfo, existsSync = fs.existsSync }: {readonly isPackaged: boolean; readonly resourcesPath: string; readonly packageInfo?: unknown; readonly existsSync?: typeof fs.existsSync}) {
  return isPackaged
    ? !!resourcesPath && existsSync(path.join(resourcesPath, 'app-update.yml'))
    : !!toRecord(toRecord(packageInfo)?.['build'])?.['publish'];
}
