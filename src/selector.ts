import type { Config, Schedule } from './types.ts';

function minutesOfDay(date: Date): number {
    return date.getHours() * 60 + date.getMinutes();
}

function inWindow(schedule: Schedule, minutes: number): boolean {
    const { start, end } = schedule;
    // start > end means the window wraps past midnight (e.g. 18:00 -> 06:00)
    return start < end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
}

// Calls onChange(newLightId) whenever the light picked for the current time changes (e.g. at
// 06:00 / 18:00). Polling instead of one long timer keeps it correct across PC sleep and clock
// changes. Returns a function that stops watching.
export function watchSchedule(
    config: Config,
    onChange: (light: string | null) => void,
    options: { intervalMs?: number; now?: () => Date } = {},
): () => void {
    const { intervalMs = 15_000, now = () => new Date() } = options;
    let current = pickLight(config, now());

    const timer = setInterval(() => {
        const next = pickLight(config, now());
        if (next !== current) {
            current = next;
            onChange(next);
        }
    }, intervalMs);

    return () => clearInterval(timer);
}

// Light id to turn on right now, or null when no schedule/default applies.
// Earlier [schedules.*] entries win when windows overlap.
export function pickLight(config: Config, now: Date = new Date()): string | null {
    const minutes = minutesOfDay(now);
    const schedule = config.schedules.find((s) => inWindow(s, minutes));
    return schedule?.light ?? (config.defaultLight || null);
}
