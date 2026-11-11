import { listDevices } from './list-devices.ts';
import { listInterfaces } from './list-interfaces.ts';

const USAGE = `Usage: best-lights-selector [command]

Commands:
  (none)           run the virtual Matter light
  list-devices     list the SwitchBot devices (deviceId for [lights.*] in config.toml)
  list-interfaces  list the network adapters (number for [matter].network_interface)
  help             show this message`;

const command = process.argv[2];

switch (command) {
    case undefined:
        await import('./run.ts');
        break;
    case 'list-devices':
        await listDevices();
        break;
    case 'list-interfaces':
        listInterfaces();
        break;
    case 'help':
    case '--help':
    case '-h':
        console.info(USAGE);
        break;
    default:
        console.error(`Unknown command: ${command}\n\n${USAGE}`);
        process.exit(1);
}
