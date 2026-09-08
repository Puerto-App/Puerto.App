import test from 'node:test';
import assert from 'node:assert/strict';
import {
  draw,
  meters,
  proximityGroups,
  proximityEvent,
  birthdayMatches,
  type Point,
  SEED_ACCOUNTS,
  verifyDemoCredentials,
  isValidBirthday,
  splitExpense,
} from './domain.ts';
const ids = ['Denis', 'Drizza', 'Castro', 'Alan', 'Maxi', 'Alca'];
test('Ruleta: cada tamaño y filtro conserva exactamente los elegibles', () => {
  for (let mask = 0; mask < 64; mask++)
    for (const mode of ['teams2', 'teams3', 'single'] as const) {
      const pool = ids.filter((_, i) => mask & (1 << i)),
        min = mode === 'single' ? 1 : mode === 'teams2' ? 2 : 3;
      if (pool.length < min) {
        assert.throws(() => draw(pool, mode));
        continue;
      }
      for (let run = 0; run < 20; run++) {
        const r = draw(pool, mode);
        assert.deepEqual(r.eligible, pool);
        if (mode === 'single') {
          assert.ok(pool.includes(r.winner!));
          assert.equal(r.substitutes.length, 0);
          assert.equal(r.substituteAssignments.length, 0);
        } else {
          assert.deepEqual(r.teams.flat().sort(), [...pool].sort());
          assert.equal(new Set(r.teams.flat()).size, pool.length);
          assert.deepEqual(
            r.substituteAssignments.map((a) => a.member).sort(),
            [...r.substitutes].sort(),
          );
          assert.ok(
            Math.max(...r.teams.map((t) => t.length)) -
              Math.min(...r.teams.map((t) => t.length)) <=
              1,
          );
        }
      }
    }
  assert.throws(() => draw(['a', 'a'], 'single'));
});
test('Con cinco personas para equipos de tres se muestran dos equipos 3/2', () => {
  const sequence = [0, 0, 0, 0, 0, 1];
  const r = draw(ids.slice(0, 5), 'teams3', () => sequence.shift() ?? 0);
  assert.equal(r.teams.length, 2);
  assert.deepEqual(r.teams.map((t) => t.length).sort(), [2, 3]);
  assert.equal(r.substitutes.length, 1);
  assert.equal(r.substituteAssignments[0].member, r.substitutes[0]);
  assert.ok(
    r.teams[r.substituteAssignments[0].teamIndex].includes(r.substitutes[0]),
  );
});
test('Las seis cuentas iniciales ingresan por username o email', () => {
  assert.equal(SEED_ACCOUNTS.length, 6);
  for (const account of SEED_ACCOUNTS) {
    assert.equal(
      verifyDemoCredentials(
        SEED_ACCOUNTS,
        account.username.toUpperCase(),
        account.password,
      )?.id,
      account.id,
    );
    assert.equal(
      verifyDemoCredentials(
        SEED_ACCOUNTS,
        account.email.toUpperCase(),
        account.password,
      )?.id,
      account.id,
    );
    assert.equal(
      verifyDemoCredentials(SEED_ACCOUNTS, account.username, 'incorrecta'),
      null,
    );
  }
  assert.equal(
    SEED_ACCOUNTS.filter((account) => account.role === 'admin')
      .map((account) => account.id)
      .join(),
    'denis',
  );
});
test('Cumpleaños DD/MM valida calendario', () => {
  for (const account of SEED_ACCOUNTS)
    assert.equal(isValidBirthday(account.birthday), true);
  assert.equal(isValidBirthday('29/02'), true);
  for (const value of ['30/02', '31/04', '00/12', '01/13', '1/1'])
    assert.equal(isValidBirthday(value), false);
});
test('Gastos se dividen en centavos y el pagador no se debe a sí mismo', () => {
  assert.deepEqual(splitExpense(10000, 'denis', ['denis', 'drizza', 'alan']), [
    { debtorId: 'drizza', amountCents: 3333, paidAt: null },
    { debtorId: 'alan', amountCents: 3333, paidAt: null },
  ]);
  assert.deepEqual(splitExpense(100, 'denis', ['denis']), []);
  assert.throws(() => splitExpense(0, 'denis', ['denis']));
  assert.throws(() => splitExpense(100, 'denis', ['drizza']));
});
const now = 100000;
const point = (id: string, m: number, extra: Partial<Point> = {}): Point => ({
  id,
  lat: ((m / 6371000) * 180) / Math.PI,
  lng: 0,
  accuracy: 5,
  at: now,
  consent: true,
  ...extra,
});
test('Haversine y radio: 49m entra, 51m sale; cadena no es trío', () => {
  assert.ok(Math.abs(meters(point('a', 0), point('b', 49)) - 49) < 0.001);
  assert.deepEqual(proximityGroups([point('a', 0), point('b', 49)], 50, now), [
    ['a', 'b'],
  ]);
  assert.deepEqual(
    proximityGroups([point('a', 0), point('b', 51)], 50, now),
    [],
  );
  assert.deepEqual(
    proximityGroups([point('a', 0), point('b', 40), point('c', 80)], 50, now),
    [
      ['a', 'b'],
      ['b', 'c'],
    ],
  );
});
test('Datos vencidos, sin consentimiento y GPS impreciso quedan excluidos', () => {
  for (const extra of [
    { at: now - 60001 },
    { consent: false },
    { accuracy: 30 },
    { lat: NaN },
    { at: now + 1 },
  ])
    assert.deepEqual(
      proximityGroups([point('a', 0), point('b', 1, extra)], 50, now),
      [],
    );
});
test('Seis juntos forman un único encuentro; audiencias correctas', () => {
  assert.equal(
    proximityGroups(
      ids.map((id, i) => point(id, i)),
      50,
      now,
    )[0].length,
    6,
  );
  assert.deepEqual(
    proximityEvent(ids.slice(0, 2), ids).recipients,
    ids.slice(2),
  );
  assert.equal(proximityEvent(ids, ids).text, 'El grupo está unido.');
  assert.equal(proximityEvent(ids, ids).priority, 'high');
  assert.equal(proximityEvent(ids.slice(0, 4), ids).recipients.length, 2);
});
test('Cumpleaños usa día local y respeta 29/02', () => {
  assert.equal(
    birthdayMatches(
      '1990-08-24',
      new Date('2026-08-24T02:59:00Z'),
      'America/Argentina/Buenos_Aires',
    ),
    false,
  );
  assert.equal(
    birthdayMatches(
      '1990-08-24',
      new Date('2026-08-24T03:00:00Z'),
      'America/Argentina/Buenos_Aires',
    ),
    true,
  );
  assert.equal(
    birthdayMatches(
      '2000-02-29',
      new Date('2028-02-29T12:00:00Z'),
      'America/Argentina/Buenos_Aires',
    ),
    true,
  );
  assert.equal(
    birthdayMatches(
      '2000-02-29',
      new Date('2027-02-28T12:00:00Z'),
      'America/Argentina/Buenos_Aires',
    ),
    false,
  );
});
