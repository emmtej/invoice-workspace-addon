import type { CardActionSpec, SettingsCogView } from './models';

const SETTINGS_ICON_URL =
  'https://www.gstatic.com/images/icons/material/system/1x/settings_black_24dp.png';

export function toSettingsCogView(action: CardActionSpec): SettingsCogView {
  return {
    label: 'Settings',
    altText: 'Open settings',
    iconUrl: SETTINGS_ICON_URL,
    action,
  };
}
