import crypto from 'crypto';

import type { SwitchBotConfig } from './types.ts';

// SwitchBot Cloud API (OpenAPI v1.1) client.
// https://github.com/OpenWonderLabs/SwitchBotAPI

const BASE_URL = 'https://api.switch-bot.com/v1.1';

type ApiResponse<T> = {
    statusCode: number;
    message: string;
    body?: T;
};

function signedHeaders(config: SwitchBotConfig): Record<string, string> {
    const t = Date.now().toString();
    const nonce = crypto.randomUUID();
    const sign = crypto
        .createHmac('sha256', config.secret)
        .update(Buffer.from(config.token + t + nonce, 'utf-8'))
        .digest('base64');
    return {
        Authorization: config.token,
        sign,
        t,
        nonce,
        'Content-Type': 'application/json; charset=utf8',
    };
}

async function request<T>(
    config: SwitchBotConfig,
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
): Promise<T> {
    const response = await fetch(BASE_URL + path, {
        method,
        headers: signedHeaders(config),
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) {
        throw new Error(
            `[ERROR] SwitchBot ${method} ${path}: ${response.status} ${response.statusText}`,
        );
    }
    const json = (await response.json()) as ApiResponse<T>;
    if (json.statusCode !== 100) {
        throw new Error(`[ERROR] SwitchBot ${method} ${path}: ${json.message}`);
    }
    return json.body as T;
}

export type DeviceList = {
    deviceList: { deviceId: string; deviceName: string; deviceType: string }[];
    infraredRemoteList: { deviceId: string; deviceName: string; remoteType: string }[];
};

export function getDevices(config: SwitchBotConfig): Promise<DeviceList> {
    return request<DeviceList>(config, 'GET', '/devices');
}

// Returns true/false when the device reports its power state, null when it doesn't
// (e.g. infrared remote lights have no status) or the lookup fails.
export async function getPower(config: SwitchBotConfig, deviceId: string): Promise<boolean | null> {
    try {
        const status = await request<{ power?: string }>(
            config,
            'GET',
            `/devices/${deviceId}/status`,
        );
        if (status?.power === 'on') return true;
        if (status?.power === 'off') return false;
        return null;
    } catch {
        return null;
    }
}

export async function setPower(
    config: SwitchBotConfig,
    deviceId: string,
    on: boolean,
): Promise<void> {
    await request(config, 'POST', `/devices/${deviceId}/commands`, {
        command: on ? 'turnOn' : 'turnOff',
        parameter: 'default',
        commandType: 'command',
    });
}
