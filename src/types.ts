export type SwitchBotConfig = {
    token: string;
    secret: string;
};

export type MatterConfig = {
    // Name shown in Home app
    name: string;
    port: number;
    // Network adapter (resolved from its interface number) to advertise on. Empty = all adapters.
    networkInterface: string;
    // matter.js log verbosity
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    passcode: number;
    discriminator: number;
    // Where the Matter fabric/commissioning data is persisted (relative to the cwd)
    storagePath: string;
};

// A "light" is one or more SwitchBot devices that are always switched together.
export type Light = {
    id: string;
    deviceIds: string[];
};

// Local time-of-day window [start, end). Minutes since 00:00. start > end wraps past midnight.
export type Schedule = {
    start: number;
    end: number;
    startText: string;
    endText: string;
    light: string; // Light.id
};

export type Config = {
    switchbot: SwitchBotConfig;
    matter: MatterConfig;
    lights: Light[];
    schedules: Schedule[];
    // Light used when no schedule matches the current time. Empty = do nothing on ON.
    defaultLight: string;
};
