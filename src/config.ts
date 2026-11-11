import { parse } from 'smol-toml';

import { resolveNetworkInterface } from './network.ts';
import type { Config, Light, MatterConfig, Schedule, SwitchBotConfig } from './types.ts';

const DEFAULT_CONFIG_PATH = 'config.toml';

function entriesOf(raw: unknown): [string, any][] {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return [];
    }
    return Object.entries(raw as Record<string, unknown>);
}

function parseTime(value: unknown, key: string): number {
    const match = typeof value === 'string' ? /^(\d{1,2}):(\d{2})$/.exec(value) : null;
    const hour = match ? Number(match[1]) : NaN;
    const minute = match ? Number(match[2]) : NaN;
    // 24:00 is accepted as "end of day"
    const valid = (hour >= 0 && hour <= 23 && minute <= 59) || (hour === 24 && minute === 0);
    if (!valid) {
        throw new Error(`[ERROR] ${key} must be a time like "18:00" (HH:MM, 00:00-24:00)`);
    }
    return hour * 60 + minute;
}

function parseSwitchBot(raw: any): SwitchBotConfig {
    if (!raw || typeof raw.token !== 'string' || typeof raw.secret !== 'string') {
        throw new Error('[ERROR] config.toml must have [switchbot] with "token" and "secret"');
    }
    if (!raw.token || !raw.secret) {
        throw new Error('[ERROR] [switchbot] "token" and "secret" must not be empty');
    }
    return { token: raw.token, secret: raw.secret };
}

function parseMatter(raw: any): MatterConfig {
    const port = Number(raw?.port ?? 5540);
    const passcode = Number(raw?.passcode ?? 20202021);
    const discriminator = Number(raw?.discriminator ?? 3840);

    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error('[ERROR] matter.port must be an integer between 1 and 65535');
    }
    // Matter spec: passcode 1..99999998 excluding a few trivially guessable values
    if (!Number.isInteger(passcode) || passcode < 1 || passcode > 99999998) {
        throw new Error('[ERROR] matter.passcode must be an integer between 1 and 99999998');
    }
    if (!Number.isInteger(discriminator) || discriminator < 0 || discriminator > 4095) {
        throw new Error('[ERROR] matter.discriminator must be an integer between 0 and 4095');
    }

    // Interface number (see `bun run list-interfaces`); 0 or omitted = all adapters
    const networkInterfaceSetting = raw?.network_interface ?? 0;
    if (!Number.isInteger(networkInterfaceSetting) || networkInterfaceSetting < 0) {
        throw new Error(
            '[ERROR] matter.network_interface must be an interface number (see "bun run list-interfaces"), or 0 for all adapters',
        );
    }
    const networkInterface =
        networkInterfaceSetting > 0 ? resolveNetworkInterface(networkInterfaceSetting) : '';

    const logLevel = raw?.log_level ?? 'info';
    if (!['debug', 'info', 'warn', 'error'].includes(logLevel)) {
        throw new Error('[ERROR] matter.log_level must be one of "debug", "info", "warn", "error"');
    }

    return {
        name: typeof raw?.name === 'string' && raw.name ? raw.name : 'Best Light',
        port,
        networkInterface,
        logLevel,
        passcode,
        discriminator,
        storagePath:
            typeof raw?.storage_path === 'string' && raw.storage_path
                ? raw.storage_path
                : '.matter-storage',
    };
}

function parseLights(raw: unknown): Light[] {
    const entries = entriesOf(raw);
    if (entries.length === 0) {
        throw new Error('[ERROR] config.toml must have at least one entry under [lights], e.g. [lights.living]');
    }
    return entries.map(([id, l]) => {
        // device_id accepts a single string or an array of strings
        const deviceIds: unknown[] = Array.isArray(l?.device_id) ? l.device_id : [l?.device_id];
        if (
            deviceIds.length === 0 ||
            deviceIds.some((d) => typeof d !== 'string' || !d)
        ) {
            throw new Error(
                `[ERROR] lights.${id}.device_id must be a non-empty string or a non-empty array of strings`,
            );
        }
        return { id, deviceIds: deviceIds as string[] };
    });
}

function parseSchedules(raw: unknown, lights: Light[]): Schedule[] {
    const entries = entriesOf(raw);
    return entries.map(([key, s]) => {
        const start = parseTime(s?.start, `schedules.${key}.start`);
        const end = parseTime(s?.end, `schedules.${key}.end`);
        if (start === end) {
            throw new Error(`[ERROR] schedules.${key}: start and end must differ`);
        }
        if (typeof s.light !== 'string' || !lights.some((l) => l.id === s.light)) {
            throw new Error(
                `[ERROR] schedules.${key}.light must be one of the [lights.<id>] keys: ` +
                    lights.map((l) => l.id).join(', '),
            );
        }
        return { start, end, startText: s.start, endText: s.end, light: s.light };
    });
}

export async function loadConfig(path: string = resolveConfigPath()): Promise<Config> {
    const file = Bun.file(path);
    if (!(await file.exists())) {
        throw new Error(`[ERROR] Config file not found: ${path}`);
    }

    const raw = parse(await file.text()) as any;

    const switchbot = parseSwitchBot(raw.switchbot);
    const matter = parseMatter(raw.matter);
    const lights = parseLights(raw.lights);
    const schedules = parseSchedules(raw.schedules, lights);

    const defaultLight = typeof raw.default_light === 'string' ? raw.default_light : '';
    if (defaultLight && !lights.some((l) => l.id === defaultLight)) {
        throw new Error(
            `[ERROR] default_light "${defaultLight}" is not one of the [lights.<id>] keys`,
        );
    }

    return { switchbot, matter, lights, schedules, defaultLight };
}

// Config is TOML-only — default path or an explicit path as the first CLI argument.
function resolveConfigPath(): string {
    return process.argv[2] ?? DEFAULT_CONFIG_PATH;
}
