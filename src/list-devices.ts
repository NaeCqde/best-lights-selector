import { loadConfig } from './config.ts';
import { getDevices } from './switchbot.ts';

/** `best-lights-selector list-devices`: lists the SwitchBot devices (for `device_id` in [lights.*]). */
export async function listDevices(): Promise<void> {
    const config = await loadConfig();
    const { deviceList, infraredRemoteList } = await getDevices(config.switchbot);

    console.info('[INFO] Physical devices:');
    for (const device of deviceList) {
        console.info(`  ${device.deviceName} (${device.deviceType}) - deviceId: ${device.deviceId}`);
    }

    console.info('\n[INFO] Infrared remote devices:');
    for (const remote of infraredRemoteList ?? []) {
        console.info(`  ${remote.deviceName} (${remote.remoteType}) - deviceId: ${remote.deviceId}`);
    }
}
