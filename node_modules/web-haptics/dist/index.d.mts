import { W as WebHapticsOptions, H as HapticInput, T as TriggerOptions } from './types-BVHXO1ni.mjs';
export { a as HapticPattern, b as HapticPreset, V as Vibration } from './types-BVHXO1ni.mjs';

var version = "0.0.6";

declare class WebHaptics {
    private hapticLabel;
    private domInitialized;
    private instanceId;
    private debug;
    private showSwitch;
    private rafId;
    private patternResolve;
    private audioCtx;
    private audioFilter;
    private audioGain;
    private audioBuffer;
    constructor(options?: WebHapticsOptions);
    static readonly isSupported: boolean;
    trigger(input?: HapticInput, options?: TriggerOptions): Promise<void>;
    cancel(): void;
    destroy(): void;
    setDebug(debug: boolean): void;
    setShowSwitch(show: boolean): void;
    private stopPattern;
    private runPattern;
    private playClick;
    private ensureAudio;
    private ensureDOM;
}

declare const defaultPatterns: {
    readonly success: {
        readonly pattern: [{
            readonly duration: 30;
            readonly intensity: 0.5;
        }, {
            readonly delay: 60;
            readonly duration: 40;
            readonly intensity: 1;
        }];
    };
    readonly warning: {
        readonly pattern: [{
            readonly duration: 40;
            readonly intensity: 0.8;
        }, {
            readonly delay: 100;
            readonly duration: 40;
            readonly intensity: 0.6;
        }];
    };
    readonly error: {
        readonly pattern: [{
            readonly duration: 40;
            readonly intensity: 0.9;
        }, {
            readonly delay: 40;
            readonly duration: 40;
            readonly intensity: 0.9;
        }, {
            readonly delay: 40;
            readonly duration: 40;
            readonly intensity: 0.9;
        }];
    };
    readonly light: {
        readonly pattern: [{
            readonly duration: 15;
            readonly intensity: 0.4;
        }];
    };
    readonly medium: {
        readonly pattern: [{
            readonly duration: 25;
            readonly intensity: 0.7;
        }];
    };
    readonly heavy: {
        readonly pattern: [{
            readonly duration: 35;
            readonly intensity: 1;
        }];
    };
    readonly soft: {
        readonly pattern: [{
            readonly duration: 40;
            readonly intensity: 0.5;
        }];
    };
    readonly rigid: {
        readonly pattern: [{
            readonly duration: 10;
            readonly intensity: 1;
        }];
    };
    readonly selection: {
        readonly pattern: [{
            readonly duration: 8;
            readonly intensity: 0.3;
        }];
    };
    readonly nudge: {
        readonly pattern: [{
            readonly duration: 80;
            readonly intensity: 0.8;
        }, {
            readonly delay: 80;
            readonly duration: 50;
            readonly intensity: 0.3;
        }];
    };
    readonly buzz: {
        readonly pattern: [{
            readonly duration: 1000;
            readonly intensity: 1;
        }];
    };
};

export { HapticInput, TriggerOptions, WebHaptics, WebHapticsOptions, defaultPatterns, version };
