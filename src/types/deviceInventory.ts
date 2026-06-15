export interface DeviceInventory {
  generatedAt: string;
  device: {
    firmware: string | null;
    os: string | null;
    kernel: string | null;
  };
  plugins: DeviceInventoryPlugin[];
}

export interface DeviceInventoryPlugin {
  uri: string;
  name: string;
  category: string | null;
  audioInputs: number;
  audioOutputs: number;
  controlPorts: DeviceInventoryControlPort[];
}

export interface DeviceInventoryControlPort {
  symbol: string;
  name: string | null;
  minimum: number | null;
  maximum: number | null;
  default: number | null;
  unit: string | null;
}
