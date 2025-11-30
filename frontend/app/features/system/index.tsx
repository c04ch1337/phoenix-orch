import CoreTempComponent from './components/CoreTemp';
import ResourceVectorComponent from './components/ResourceVector';
import StorageEncComponent from './components/StorageEnc';
import UptimeDisplayComponent from './components/UptimeDisplay';
import PhoenixContextPanelComponent from './components/PhoenixContextPanel';

// Re-export components with consistent names
export const CoreTemp = CoreTempComponent;
export const ResourceVector = ResourceVectorComponent;
export const StorageEnc = StorageEncComponent;
export const UptimeDisplay = UptimeDisplayComponent;
export const PhoenixContextPanel = PhoenixContextPanelComponent;

// Export interface for SystemTelemetry
export interface SystemTelemetry {
  cpu: number;
  gpu: number;
  memory: number;
  network: number;
  thermal: number;
}

// Default export
export default {
  CoreTemp,
  ResourceVector,
  StorageEnc,
  UptimeDisplay,
  PhoenixContextPanel
};