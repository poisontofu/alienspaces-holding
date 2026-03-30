import { W as WebHapticsOptions, H as HapticInput, T as TriggerOptions } from '../types-BVHXO1ni.mjs';

declare function useWebHaptics(options?: WebHapticsOptions): {
    trigger: (input?: HapticInput, options?: TriggerOptions) => Promise<void> | undefined;
    cancel: () => void | undefined;
    isSupported: boolean;
};

export { useWebHaptics };
