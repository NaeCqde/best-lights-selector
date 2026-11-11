import { pickLight } from './selector.ts';
import { getPower, setPower } from './switchbot.ts';
import type { Config } from './types.ts';

// Turn on only the light picked for the current time (and turn the others off),
// or turn every light off.
export async function applyPower(config: Config, on: boolean): Promise<void> {
    const target = on ? pickLight(config) : null;
    if (on && !target) {
        console.warn(
            '[WARN] No schedule matches the current time and default_light is not set; nothing to turn on',
        );
    }

    // Each device is its own request; run them in parallel.
    const jobs = config.lights.flatMap((light) =>
        light.deviceIds.map(async (deviceId) => {
            if (light.id === target) {
                console.info(`[INFO] Turning ON light "${light.id}" (${deviceId})`);
                await setPower(config.switchbot, deviceId, true);
                return;
            }

            // Only bother turning others off if they're on. null = state unknown (e.g. IR light),
            // in which case send OFF anyway.
            const power = await getPower(config.switchbot, deviceId);
            if (power === false) {
                return;
            }
            console.info(`[INFO] Turning OFF light "${light.id}" (${deviceId})`);
            await setPower(config.switchbot, deviceId, false);
        }),
    );

    // Let every device finish before reporting, then fail if any did.
    const results = await Promise.allSettled(jobs);
    const failed = results.filter((r) => r.status === 'rejected');
    for (const f of failed) {
        console.error(f.reason);
    }
    if (failed.length > 0) {
        throw new Error(`[ERROR] ${failed.length} of ${results.length} light requests failed`);
    }
}

// Whether the real lights already match what applyPower(config, on) would produce.
// Devices whose state can't be read (null) are not counted as a mismatch.
export async function isInSync(config: Config, on: boolean): Promise<boolean> {
    const target = on ? pickLight(config) : null;

    const checks = await Promise.all(
        config.lights.flatMap((light) =>
            light.deviceIds.map(async (deviceId) => {
                const want = light.id === target;
                const power = await getPower(config.switchbot, deviceId);
                const ok = power === null || power === want;
                if (!ok) {
                    console.info(
                        `[INFO] Out of sync: light "${light.id}" (${deviceId}) is ${power ? 'ON' : 'OFF'}, expected ${want ? 'ON' : 'OFF'}`,
                    );
                }
                return ok;
            }),
        ),
    );
    return checks.every(Boolean);
}
