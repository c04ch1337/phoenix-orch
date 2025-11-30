declare module 'web-vitals' {
  export interface Metric {
    name: 'CLS' | 'FID' | 'LCP' | 'TTFB' | 'FCP';
    value: number;
    id: string;
    delta: number;
    navigationType: string | undefined;
  }

  export type ReportHandler = (metric: Metric) => void;

  export function onCLS(onReport: ReportHandler): void;
  export function onFID(onReport: ReportHandler): void;
  export function onLCP(onReport: ReportHandler): void;
  export function onTTFB(onReport: ReportHandler): void;
  export function onFCP(onReport: ReportHandler): void;
}

interface Performance {
  memory?: {
    jsHeapSizeLimit: number;
    totalJSHeapSize: number;
    usedJSHeapSize: number;
  };
}