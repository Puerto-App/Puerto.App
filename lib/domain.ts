export type Mode = 'teams3' | 'teams2' | 'single';
export type Draw = {
  mode: Mode;
  eligible: string[];
  teams: string[][];
  substitutes: string[];
  winner: string | null;
};
export function randomInt(max: number): number {
  if (!Number.isInteger(max) || max < 1 || max > 0x100000000)
    throw new Error('Rango inválido');
  const limit = Math.floor(0x100000000 / max) * max,
    buffer = new Uint32Array(1);
  do {
    crypto.getRandomValues(buffer);
  } while (buffer[0] >= limit);
  return buffer[0] % max;
}
export function draw(ids: string[], mode: Mode, rng = randomInt): Draw {
  if (!['teams3', 'teams2', 'single'].includes(mode))
    throw new Error('Modo inválido');
  if (new Set(ids).size !== ids.length)
    throw new Error('Participantes duplicados');
  const size = mode === 'single' ? 1 : mode === 'teams2' ? 2 : 3;
  if (ids.length < size)
    throw new Error(
      `Activá al menos ${size} integrante${size === 1 ? '' : 's'}.`,
    );
  const pool = [...ids];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = rng(i + 1);
    if (!Number.isInteger(j) || j < 0 || j > i) throw new Error('RNG inválido');
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  if (mode === 'single')
    return {
      mode,
      eligible: [...ids],
      teams: [],
      substitutes: [],
      winner: pool[0],
    };
  const count = Math.floor(pool.length / size),
    teams = Array.from({ length: count }, (_, i) =>
      pool.slice(i * size, (i + 1) * size),
    );
  return {
    mode,
    eligible: [...ids],
    teams,
    substitutes: pool.slice(count * size),
    winner: null,
  };
}
export type Point = {
  id: string;
  lat: number;
  lng: number;
  accuracy: number;
  at: number;
  consent: boolean;
};
export function meters(
  a: Pick<Point, 'lat' | 'lng'>,
  b: Pick<Point, 'lat' | 'lng'>,
): number {
  const rad = Math.PI / 180,
    dlat = (b.lat - a.lat) * rad,
    dlng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dlng / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}
export function proximityGroups(
  points: Point[],
  radius: number,
  now: number,
): string[][] {
  if (radius < 10 || radius > 500 || !Number.isFinite(radius))
    throw new Error('Radio inválido');
  const latest = new Map<string, Point>();
  for (const p of points)
    if (!latest.has(p.id) || latest.get(p.id)!.at < p.at) latest.set(p.id, p);
  const valid = [...latest.values()].filter(
    (p) =>
      p.consent &&
      Number.isFinite(p.lat) &&
      Number.isFinite(p.lng) &&
      Math.abs(p.lat) <= 90 &&
      Math.abs(p.lng) <= 180 &&
      p.at <= now &&
      now - p.at <= 60000 &&
      p.accuracy >= 0 &&
      p.accuracy <= Math.min(25, radius / 2),
  );
  if (valid.length > 6) throw new Error('El grupo admite seis integrantes');
  const sets: string[][] = [];
  for (let mask = 1; mask < 2 ** valid.length; mask++) {
    const part = valid.filter((_, i) => mask & (1 << i));
    if (
      part.length >= 2 &&
      part.every((a, i) =>
        part.slice(i + 1).every((b) => meters(a, b) <= radius),
      )
    )
      sets.push(part.map((p) => p.id).sort());
  }
  return sets.filter(
    (a) =>
      !sets.some((b) => b.length > a.length && a.every((id) => b.includes(id))),
  );
}
export function proximityEvent(
  ids: string[],
  members: string[],
  place = 'el punto compartido',
) {
  if (
    ids.length < 2 ||
    ids.length > 6 ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !members.includes(id))
  )
    throw new Error('Encuentro inválido');
  const all = ids.length === 6 && members.length === 6;
  const text = all
    ? 'El grupo está unido.'
    : ids.length === 2
      ? `${ids[0]} y ${ids[1]} están teniendo relaciones amorosas.`
      : `${ids.join(', ')} están juntos en ${place}.`;
  return {
    text,
    recipients: all ? [...members] : members.filter((id) => !ids.includes(id)),
    priority: all ? 'high' : 'normal',
  };
}
export function birthdayMatches(
  birthDate: string,
  now: Date,
  timeZone: string,
): boolean {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  return (
    birthDate.slice(5) ===
    `${parts.find((p) => p.type === 'month')!.value}-${parts.find((p) => p.type === 'day')!.value}`
  );
}
