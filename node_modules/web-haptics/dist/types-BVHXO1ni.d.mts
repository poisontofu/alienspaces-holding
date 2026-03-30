interface Vibration {
    duration: number;
    intensity?: number;
    delay?: number;
}
type HapticPattern = number[] | Vibration[];
interface HapticPreset {
    pattern: Vibration[];
}
type HapticInput = number | string | HapticPattern | HapticPreset;
interface TriggerOptions {
    intensity?: number;
}
interface WebHapticsOptions {
    debug?: boolean;
    showSwitch?: boolean;
}

export type { HapticInput as H, TriggerOptions as T, Vibration as V, WebHapticsOptions as W, HapticPattern as a, HapticPreset as b };
