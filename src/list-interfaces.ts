import { listAdapters } from './network.ts';

// Lists the network adapters; put the number ("no.") of the one Home should use into
// [matter].network_interface in config.toml.
console.info('[INFO] Network adapters:');
for (const adapter of listAdapters()) {
    const index = adapter.index !== undefined ? `no. ${adapter.index}` : 'no. -';
    console.info(`  ${adapter.name} (${index})`);
    for (const address of adapter.addresses) {
        console.info(`    ${address}`);
    }
}
