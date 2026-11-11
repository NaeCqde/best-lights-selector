import { listDevices } from './list-devices.ts';
import { listInterfaces } from './list-interfaces.ts';

const USAGE = `Usage: best-lights-selector [command]

Commands:
  (none)           run the virtual Matter light
  list-devices     list the SwitchBot devices (deviceId for [lights.*] in config.toml)
  list-interfaces  list the network adapters (number for [matter].network_interface)
  help             show this message\n\nOptions:\n  -c, --config <path>   config file (default: ./config.toml)`;

// The first argument is the command unless it is an option (`--config <path>` alone runs the daemon).
const first = process.argv[2];
const command = first?.startsWith('-') && first !== 'help' && first !== '--help' && first !== '-h' ? undefined : first;

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
