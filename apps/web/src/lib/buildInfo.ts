declare const __APP_VERSION__: string | undefined;

/** Application version injected at build time by Vite (see vite.config.ts). */
export const APP_VERSION = typeof __APP_VERSION__ === 'string' && __APP_VERSION__ ? __APP_VERSION__ : '1.0.0';

export const APP_NAME = (import.meta.env.VITE_APP_NAME as string) || 'Office Inventory Maintenance System';
