import { networkInterfaces } from 'os';

// Bun on Windows returns non-ASCII adapter names (e.g. Japanese "イーサネット") as UTF-8 bytes
// read as Latin-1 (mojibake). matter.js looks adapters up by that same raw name, so we keep the
// raw name for it, but accept (and show) the readable name in config.toml.
function readableName(raw: string): string {
    // eslint-disable-next-line no-control-regex
    if (/^[\x00-\x7f]*$/.test(raw)) {
        return raw;
    }
    const fixed = Buffer.from(raw, 'latin1').toString('utf8');
    return fixed.includes('�') ? raw : fixed;
}

export type Adapter = {
    rawName: string; // name as returned by the OS API (what matter.js looks adapters up by)
    name: string; // readable name (as shown in Windows)
    index?: number; // interface number (IPv6 zone id, the "15" in "fe80::...%15")
    addresses: string[];
};

export function listAdapters(): Adapter[] {
    return Object.entries(networkInterfaces()).map(([rawName, infos]) => ({
        rawName,
        name: readableName(rawName),
        index: (infos ?? []).find((i) => i.family === 'IPv6' && i.scopeid > 0)?.scopeid,
        addresses: (infos ?? []).map((i) => i.address),
    }));
}

// Resolves the `network_interface` setting (interface number) to the adapter name the OS API
// (and matter.js) uses.
export function resolveNetworkInterface(index: number): string {
    const adapters = listAdapters();
    const found = adapters.find((a) => a.index === index);
    if (!found) {
        const available = adapters
            .filter((a) => a.index !== undefined)
            .map((a) => `${a.index}: ${a.name}`)
            .join(', ');
        throw new Error(
            `[ERROR] matter.network_interface ${index} not found. Available interface numbers: ${available}`,
        );
    }
    return found.rawName;
}
