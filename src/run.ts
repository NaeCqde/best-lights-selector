import { Endpoint, Environment, Logger, LogLevel, ServerNode, VendorId } from '@matter/main';
import { OnOffLightDevice } from '@matter/main/devices';

import { loadConfig } from './config.ts';
import { applyPower, isInSync } from './lights.ts';
import { watchSchedule } from './selector.ts';

const config = await loadConfig();

Logger.level = {
    debug: LogLevel.DEBUG,
    info: LogLevel.INFO,
    warn: LogLevel.WARN,
    error: LogLevel.ERROR,
}[config.matter.logLevel];
Environment.default.vars.set('storage.path', config.matter.storagePath);
if (config.matter.networkInterface) {
    // Only advertise (mDNS) on this adapter, so Home is not given addresses of e.g. VPN adapters
    Environment.default.vars.set('mdns.networkInterface', config.matter.networkInterface);
}

const server = await ServerNode.create({
    id: 'best-lights-selector',
    network: { port: config.matter.port },
    commissioning: {
        passcode: config.matter.passcode,
        discriminator: config.matter.discriminator,
    },
    productDescription: {
        name: config.matter.name,
        deviceType: OnOffLightDevice.deviceType,
    },
    basicInformation: {
        vendorName: 'best-lights-selector',
        vendorId: VendorId(0xfff1), // test vendor id
        nodeLabel: config.matter.name,
        productName: 'Best Lights Selector',
        productLabel: config.matter.name,
        productId: 0x8000,
        serialNumber: 'BLS-0001',
        uniqueId: 'best-lights-selector-1',
    },
});

const light = new Endpoint(OnOffLightDevice, { id: 'light' });
await server.add(light);

// Commands from Home are applied one at a time, in order.
let queue: Promise<void> = Promise.resolve();
let reverting = false;
// The state Home last saw (matter.js persists it across restarts)
let lastApplied = light.state.onOff.onOff;

light.events.onOff.onOff$Changed.on((on) => {
    if (reverting) {
        reverting = false;
        return;
    }

    queue = queue.then(async () => {
        console.info(`[INFO] Home requested: ${on ? 'ON' : 'OFF'}`);
        try {
            await applyPower(config, on);
            lastApplied = on;
        } catch (error) {
            console.error(error);
            // Keep Home in sync with reality if SwitchBot failed
            reverting = true;
            await light.set({ onOff: { onOff: lastApplied } });
        }
    });
});

await server.start();

// On startup, the real lights may have drifted from the state Home still shows (e.g. they were
// switched by hand while this was not running). The stored Matter state is what Home has cached,
// so bring the real lights back in line with it.
queue = queue.then(async () => {
    // Not paired yet (e.g. first start / fresh storage): there is no state in Home to match,
    // and the default OFF must not switch off lights that are on.
    if (!server.lifecycle.isCommissioned) {
        console.info('[INFO] Startup: not paired with Home yet; leaving the lights as they are');
        return;
    }

    const homeState = lastApplied ? 'ON' : 'OFF';
    try {
        if (await isInSync(config, lastApplied)) {
            console.info(`[INFO] Startup: lights already match Home state (${homeState})`);
            return;
        }
        console.info(`[INFO] Startup: syncing lights to Home state (${homeState})`);
        await applyPower(config, lastApplied);
    } catch (error) {
        console.error(error);
    }
});

// When the schedule moves on to another light (e.g. at 06:00 / 18:00) while Home's light is ON,
// switch to the light for the new time slot.
watchSchedule(config, (lightId) => {
    queue = queue.then(async () => {
        if (!light.state.onOff.onOff) {
            return;
        }
        console.info(
            `[INFO] Schedule changed to light "${lightId ?? '(none)'}" while ON; switching lights`,
        );
        try {
            await applyPower(config, true);
        } catch (error) {
            console.error(error);
        }
    });
});

console.info(`[INFO] "${config.matter.name}" is running (Matter port ${config.matter.port})`);
