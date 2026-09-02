export type StartupSettings = {
  defaultView: 'preview' | 'edit' | 'split';
  startupMode: 'empty' | 'blank' | 'restore';
  rememberFolder: boolean;
};

export const defaultStartupSettings: StartupSettings = { defaultView: 'split', startupMode: 'empty', rememberFolder: false };

export function normalizeStartupSettings(value: unknown): StartupSettings {
  const input = value && typeof value === 'object' ? value as Partial<StartupSettings> : {};
  return {
    defaultView: ['preview', 'edit', 'split'].includes(input.defaultView || '') ? input.defaultView! : 'split',
    startupMode: ['empty', 'blank', 'restore'].includes(input.startupMode || '') ? input.startupMode! : 'empty',
    rememberFolder: input.rememberFolder === true,
  };
}

export function readStartupSettings(storage: Pick<Storage, 'getItem'>): StartupSettings {
  try { return normalizeStartupSettings(JSON.parse(storage.getItem('qingyue-startup-settings') || '{}')); }
  catch { return { ...defaultStartupSettings }; }
}
