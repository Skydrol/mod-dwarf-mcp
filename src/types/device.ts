export interface DeviceInfo {
  firmwareVersion: string | null;
  controllerVersion: string | null;
  os: {
    name: string | null;
    version: string | null;
  };
  kernel: string;
  architecture: string | null;
  counts: {
    lv2Plugins: number;
    userPedalboards: number;
    factoryPedalboards: number;
    userLv2Bundles: number;
    systemLv2Bundles: number;
  };
}
