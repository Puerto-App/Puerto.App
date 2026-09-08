'use client';

import { useState, useEffect, useRef, type FormEvent } from 'react';
import {
  Anchor,
  CircleDot,
  MapPin,
  MessageCircle,
  UserRound,
  Sparkles,
  Shuffle,
  Users,
  ArrowUp,
  ShieldCheck,
  ChevronRight,
  LocateFixed,
  Check,
  SunMoon,
  Cake,
  Navigation,
  Trash2,
  CheckCheck,
  LogIn,
  Link2,
  Unlink,
  KeyRound,
  Mail,
  LogOut,
  DollarSign,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { NativeSelect } from '@/components/ui/native-select';
import {
  draw,
  type Mode,
  type Draw,
  type SeedAccount as Account,
  SEED_ACCOUNTS,
  verifyDemoCredentials,
  isValidBirthday,
  splitExpense,
} from '@/lib/domain';

const seedAccounts: Account[] = SEED_ACCOUNTS.map((account) => ({
  ...account,
}));
const members = seedAccounts.map((account) => account.displayName);
const colors = [
  '#0A84FF',
  '#5E5CE6',
  '#137EBC',
  '#3678D8',
  '#007AFF',
  '#2864BA',
];
type Expense = {
  id: string;
  concept: string;
  amountCents: number;
  payerId: string;
  participantIds: string[];
  at: Date;
  shares: ReturnType<typeof splitExpense>;
};
const titles = {
  ruleta: [
    'Que decida la suerte.',
    'Elegí quiénes juegan. El resto, dejáselo a la ruleta.',
  ],
  mapa: [
    'Cerca, aunque sea lejos.',
    'Tu ubicación se comparte sólo cuando vos lo decidís.',
  ],
  gastos: [
    'Las cuentas, claras.',
    'Registrá gastos y dejá que Puerto haga las cuentas.',
  ],
  perfil: ['Este sos vos.', 'Tu lugar en Puerto. A tu manera.'],
};
function Avatar({
  name,
  large = false,
  src,
  online = false,
}: {
  name: string;
  large?: boolean;
  src?: string;
  online?: boolean;
}) {
  return (
    <span
      className={`avatar ${large ? 'large-avatar' : ''} ${online ? 'online' : ''}`}
    >
      {src ? <img src={src} alt={`Avatar de ${name}`} /> : name[0]}
    </span>
  );
}
function Result({ result }: { result: Draw }) {
  return (
    <div className="result-block">
      {result.winner ? (
        <div className="winner">
          <Sparkles />
          <strong>{result.winner}</strong>
          <span>La suerte te eligió</span>
        </div>
      ) : (
        result.teams.map((team, i) => (
          <div className="team" key={i}>
            <small>Equipo {i + 1}</small>
            <strong>{team.join(' · ')}</strong>
            {result.substituteAssignments.some(
              (assignment) => assignment.teamIndex === i,
            ) && (
              <span className="substitute-note">
                +{' '}
                {result.substituteAssignments
                  .filter((assignment) => assignment.teamIndex === i)
                  .map((assignment) => assignment.member)
                  .join(', ')}{' '}
                como suplente
              </span>
            )}
          </div>
        ))
      )}
      {result.substitutes.length > 0 && (
        <p className="reserve">
          <strong>Suplentes asignados:</strong>{' '}
          {result.substituteAssignments
            .map(
              (assignment) =>
                `${assignment.member} → Equipo ${assignment.teamIndex + 1}`,
            )
            .join(' · ')}
        </p>
      )}
    </div>
  );
}
export default function Puerto() {
  const [accounts, setAccounts] = useState(seedAccounts);
  const [currentUser, setCurrentUser] = useState<Account | null>(null);
  const [loginIdentity, setLoginIdentity] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginStatus, setLoginStatus] = useState('');
  const [linkedGoogle, setLinkedGoogle] = useState(false);
  const [linkedApple, setLinkedApple] = useState(false);
  const [tab, setTab] = useState<keyof typeof titles>('ruleta');
  const [selected, setSelected] = useState(members),
    [mode, setMode] = useState<Mode>('teams3');
  const [spinning, setSpinning] = useState(false),
    [rotation, setRotation] = useState(0),
    [result, setResult] = useState<Draw | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]),
    [expenseConcept, setExpenseConcept] = useState(''),
    [expenseAmount, setExpenseAmount] = useState(''),
    [expensePayer, setExpensePayer] = useState('denis'),
    [expensePeople, setExpensePeople] = useState(members);
  const [bio, setBio] = useState(''),
    [aiBio, setAiBio] = useState(''),
    [birth, setBirth] = useState('24/08'),
    [username, setUsername] = useState('Denis'),
    [newPassword, setNewPassword] = useState(''),
    [avatar, setAvatar] = useState(''),
    [profileStatus, setProfileStatus] = useState('');
  const [theme, setTheme] = useState('system'),
    [radius, setRadius] = useState(50),
    [timezone, setTimezone] = useState('America/Argentina/Buenos_Aires');
  const [gps, setGps] = useState<{
      lat: number;
      lng: number;
      accuracy: number;
      at: number;
    } | null>(null),
    [sharing, setSharing] = useState(false),
    [geoStatus, setGeoStatus] = useState('Ubicación desactivada'),
    [consentOpen, setConsentOpen] = useState(false);
  const [notice, setNotice] = useState(''),
    [now, setNow] = useState(Date.now());
  const watch = useRef<number | null>(null),
    generation = useRef(0),
    spinLock = useRef(false),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    sendLock = useRef(false);
  const actionRef = useRef<(m?: Mode, ids?: string[]) => Promise<Draw>>(null);
  useEffect(() => {
    const clock = setInterval(() => setNow(Date.now()), 10000);
    return () => {
      clearInterval(clock);
      if (timer.current) clearTimeout(timer.current);
      if (watch.current !== null)
        navigator.geolocation.clearWatch(watch.current);
    };
  }, []);
  useEffect(() => {
    try {
      const value = localStorage.getItem('puerto-theme');
      if (value && ['light', 'dark', 'system'].includes(value)) setTheme(value);
    } catch {}
  }, []);
  useEffect(() => {
    if (theme === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('puerto-theme', theme);
    } catch {}
  }, [theme]);
  const currentGps = gps && now - gps.at <= 60000 ? gps : null;
  const size = mode === 'single' ? 1 : mode === 'teams2' ? 2 : 3;
  const enough = selected.length >= size;
  function addResult(r: Draw) {
    const body = r.winner
      ? `La ruleta eligió a ${r.winner}.`
      : r.teams
          .map((team, i) => `Equipo ${i + 1}: ${team.join(', ')}`)
          .join(' · ') +
        (r.substituteAssignments.length
          ? ` · Suplentes: ${r.substituteAssignments.map((assignment) => `${assignment.member} al equipo ${assignment.teamIndex + 1}`).join(', ')}`
          : '');
    setNotice(`Resultado listo: ${body}`);
  }
  async function spin(
    nextMode: Mode = mode,
    ids: string[] = selected,
  ): Promise<Draw> {
    if (spinLock.current) throw new Error('Hay una tirada en curso.');
    if (ids.some((id) => !members.includes(id)))
      throw new Error('Integrante desconocido.');
    const r = draw(ids, nextMode);
    spinLock.current = true;
    setSpinning(true);
    setResult(null);
    setMode(nextMode);
    setSelected(ids);
    const focus = r.winner ?? r.teams[0][0],
      index = ids.indexOf(focus),
      target = 360 - ((index + 0.5) * 360) / ids.length;
    setRotation((previous) => Math.ceil(previous / 360) * 360 + 1440 + target);
    return new Promise((resolve) => {
      timer.current = setTimeout(
        () => {
          setResult(r);
          addResult(r);
          setSpinning(false);
          spinLock.current = false;
          navigator.vibrate?.([35, 25, 60]);
          resolve(r);
        },
        matchMedia('(prefers-reduced-motion: reduce)').matches ? 50 : 2600,
      );
    });
  }
  actionRef.current = spin;
  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (tool: object, options: object) => void | Promise<void>;
        };
      }
    ).modelContext;
    if (!context) return;
    const lifecycle = new AbortController();
    Promise.resolve(
      context.registerTool(
        {
          name: 'puerto_sortear',
          title: 'Sortear integrantes',
          description:
            'Completa una tirada local y agrega su resultado al chat de demostración.',
          inputSchema: {
            type: 'object',
            properties: {
              mode: { type: 'string', enum: ['teams2', 'teams3', 'single'] },
              members: {
                type: 'array',
                items: { type: 'string', enum: members },
                uniqueItems: true,
                minItems: 1,
                maxItems: 6,
              },
            },
            required: ['mode', 'members'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false },
          execute: async (input: unknown) => {
            const value = input as { mode: Mode; members: string[] };
            if (
              !value ||
              typeof value !== 'object' ||
              Object.keys(value).some(
                (k) => !['mode', 'members'].includes(k),
              ) ||
              !Array.isArray(value.members) ||
              value.members.some((x) => typeof x !== 'string') ||
              !['teams2', 'teams3', 'single'].includes(value.mode)
            )
              throw new Error('Parámetros inválidos');
            setTab('ruleta');
            return actionRef.current!(value.mode, value.members);
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => {});
    return () => lifecycle.abort();
  }, []);
  function stopSharing() {
    generation.current++;
    if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
    watch.current = null;
    setSharing(false);
    setGps(null);
    setGeoStatus('Ubicación desactivada');
  }
  function startSharing() {
    setConsentOpen(false);
    if (!navigator.geolocation) {
      setGeoStatus('Este navegador no ofrece ubicación.');
      return;
    }
    stopSharing();
    const token = generation.current;
    setSharing(true);
    setGeoStatus('Buscando tu ubicación…');
    watch.current = navigator.geolocation.watchPosition(
      (p) => {
        if (token !== generation.current) return;
        setGps({
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          accuracy: p.coords.accuracy,
          at: p.timestamp,
        });
        setNow(Date.now());
        setGeoStatus('Ubicación activa en este dispositivo');
      },
      (error) => {
        if (token !== generation.current) return;
        stopSharing();
        setGeoStatus(
          error.code === 1
            ? 'Permiso denegado. Podés habilitarlo en los ajustes del navegador.'
            : error.code === 3
              ? 'La ubicación tardó demasiado. Volvé a intentarlo.'
              : 'No pudimos obtener tu ubicación. Volvé a intentarlo.',
        );
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
  }
  function saveProfile(e: FormEvent) {
    e.preventDefault();
    if (!currentUser) return;
    if (!/^[A-Za-z0-9._-]{3,24}$/.test(username)) {
      setProfileStatus(
        'El usuario debe tener entre 3 y 24 caracteres válidos.',
      );
      return;
    }
    if (
      accounts.some(
        (account) =>
          account.id !== currentUser.id &&
          account.username.toLowerCase() === username.toLowerCase(),
      )
    ) {
      setProfileStatus('Ese nombre de usuario ya está en uso.');
      return;
    }
    if (!isValidBirthday(birth)) {
      setProfileStatus('Ingresá un cumpleaños válido con formato DD/MM.');
      return;
    }
    if (newPassword && newPassword.length < 10) {
      setProfileStatus(
        'La nueva contraseña debe tener al menos 10 caracteres.',
      );
      return;
    }
    const updated = {
      ...currentUser,
      username,
      birthday: birth,
      password: newPassword || currentUser.password,
    };
    setAccounts((previous) =>
      previous.map((account) =>
        account.id === updated.id ? updated : account,
      ),
    );
    setCurrentUser(updated);
    setNewPassword('');
    setProfileStatus('Perfil actualizado en esta sesión de demostración.');
  }

  function signIn(e: FormEvent) {
    e.preventDefault();
    const account = verifyDemoCredentials(
      accounts,
      loginIdentity,
      loginPassword,
    );
    if (!account) {
      setLoginStatus('Usuario, correo o contraseña incorrectos.');
      return;
    }
    setCurrentUser(account);
    setUsername(account.username);
    setBirth(account.birthday);
    setLoginPassword('');
    setLoginStatus('');
  }
  async function chooseAvatar(file?: File) {
    if (!file) return;
    if (
      !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
      file.size > 2 * 1024 * 1024
    ) {
      setProfileStatus('Elegí una imagen JPG, PNG o WebP de hasta 2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAvatar(String(reader.result));
      setProfileStatus('Avatar actualizado en esta sesión.');
    };
    reader.readAsDataURL(file);
  }
  if (!currentUser) {
    return (
      <main className="auth-shell">
        <section className="auth-card" aria-labelledby="login-title">
          <div className="auth-brand">
            <img
              className="brand-logo"
              src="/puerto-app-logo.png"
              alt="Puerto App"
            />
            <strong>
              puerto<span>app</span>
            </strong>
          </div>
          <div className="auth-copy">
            <p className="eyebrow">GRUPO CERRADO</p>
            <h1 id="login-title">Volvé al puerto.</h1>
            <p>Ingresá con tu usuario o correo vinculado.</p>
          </div>
          <form className="auth-form" onSubmit={signIn}>
            <label htmlFor="login-identity">Usuario o correo electrónico</label>
            <div className="input-with-icon">
              <Mail size={17} aria-hidden="true" />
              <input
                id="login-identity"
                value={loginIdentity}
                onChange={(e) => setLoginIdentity(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
            <label htmlFor="login-password">Contraseña</label>
            <div className="input-with-icon">
              <KeyRound size={17} aria-hidden="true" />
              <input
                id="login-password"
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <button className="primary" type="submit">
              <LogIn size={18} aria-hidden="true" />
              Ingresar
            </button>
            <p className="form-status" role="alert">
              {loginStatus}
            </p>
          </form>
          <div className="auth-divider">
            <span>o continuá con</span>
          </div>
          <div className="social-buttons">
            <button
              type="button"
              onClick={() =>
                setLoginStatus(
                  'Google OAuth requiere configurar el cliente y su callback en el backend de producción.',
                )
              }
            >
              <span className="provider-g">G</span>Google
            </button>
            <button
              type="button"
              onClick={() =>
                setLoginStatus(
                  'Sign in with Apple requiere Services ID, clave privada y dominio verificado.',
                )
              }
            >
              <span className="provider-apple" aria-hidden="true">
                ●
              </span>
              Apple
            </button>
          </div>
          <p className="demo-note">
            <ShieldCheck size={15} aria-hidden="true" /> Demo privada: las
            credenciales iniciales se validan sólo en este navegador. Google y
            Apple muestran el flujo pendiente de configuración.
          </p>
        </section>
      </main>
    );
  }
  return (
    <main className="app-shell">
      <header className="brand">
        <img
          className="brand-logo"
          src="/puerto-app-logo.png"
          alt="Puerto App"
        />
        <strong>
          puerto<span>app</span>
        </strong>
        <button
          className="logout-button"
          onClick={() => {
            stopSharing();
            setCurrentUser(null);
            setLoginIdentity('');
          }}
        >
          <LogOut size={15} aria-hidden="true" />
          Salir
        </button>
      </header>
      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as keyof typeof titles)}
        className="main-tabs"
      >
        <div className="page-heading">
          <div>
            <p className="eyebrow">EL GRUPO, EN UN SOLO LUGAR</p>
            <h1>{titles[tab][0]}</h1>
            <p>{titles[tab][1]}</p>
          </div>
          <div className="group-pill">
            <Users size={16} aria-hidden="true" />6 integrantes
          </div>
        </div>
        <div className="profile-rail" aria-label="Perfiles del grupo">
          {seedAccounts.map((account) => (
            <button
              type="button"
              key={account.id}
              onClick={() => setTab('perfil')}
              aria-label={`Ver perfil de ${account.displayName}`}
            >
              <Avatar
                name={account.displayName}
                online={account.id === currentUser.id}
              />
              <span>{account.displayName}</span>
            </button>
          ))}
        </div>
        <TabsContent value="ruleta">
          <div className="roulette-grid">
            <section className="card wheel-card">
              <div className="section-heading">
                <h2>
                  <CircleDot size={18} aria-hidden="true" />
                  Ruleta del grupo
                </h2>
                <span className="small-badge">Una nueva tirada</span>
              </div>
              <RadioGroup
                aria-label="Modo de sorteo"
                value={mode}
                onValueChange={(value) => {
                  if (!spinning) setMode(value as Mode);
                }}
                disabled={spinning}
                className="segments mode-controls"
              >
                {(
                  [
                    ['teams3', 'Equipos de 3'],
                    ['teams2', 'Equipos de 2'],
                    ['single', 'Una persona'],
                  ] as const
                ).map(([value, label]) => (
                  <label className={mode === value ? 'chosen' : ''} key={value}>
                    <RadioGroupItem value={value} aria-label={label} />
                    <span>{label}</span>
                  </label>
                ))}
              </RadioGroup>
              <div className="wheel-zone" aria-hidden="true">
                <div className="pointer" />
                <div
                  className="wheel"
                  style={{
                    transform: `rotate(${rotation}deg)`,
                    background: selected.length
                      ? `conic-gradient(${selected.map((_, i) => `${colors[i]} ${(i * 360) / selected.length}deg ${((i + 1) * 360) / selected.length}deg`).join(',')})`
                      : 'var(--segment)',
                  }}
                >
                  {selected.map((name, i) => {
                    const angle = ((i + 0.5) * 360) / selected.length;
                    return (
                      <span
                        key={name}
                        className="wheel-name"
                        style={{
                          transform: `rotate(${angle}deg) translateY(-106px) rotate(-${angle}deg)`,
                        }}
                      >
                        {name}
                      </span>
                    );
                  })}
                  <div className="wheel-center">
                    <Anchor size={30} />
                  </div>
                </div>
              </div>
              <button
                className="primary"
                disabled={!enough || spinning}
                onClick={() => void spin().catch((e) => setNotice(e.message))}
              >
                <Shuffle size={18} aria-hidden="true" />
                {spinning ? 'La suerte está girando…' : 'Girar la ruleta'}
              </button>
              <p className="footnote" role="status">
                {!enough
                  ? `Activá al menos ${size} integrante${size === 1 ? '' : 's'}.`
                  : mode === 'single'
                    ? `${selected.length} participantes · una persona elegida`
                    : `${Math.floor(selected.length / size)} equipo${Math.floor(selected.length / size) > 1 ? 's' : ''} de ${size}${selected.length % size ? ` · ${selected.length % size} suplente${selected.length % size > 1 ? 's' : ''}` : ''}`}
              </p>
              {result && (
                <div aria-live="polite">
                  <Result result={result} />
                  <p className="footnote">
                    <Check size={12} className="inline" /> Resultado agregado al
                    chat local
                  </p>
                </div>
              )}
            </section>
            <aside>
              <section className="card presence-card">
                <div className="section-heading">
                  <h2>¿Quiénes están?</h2>
                  <span className="count">{selected.length}/6</span>
                </div>
                <p className="support">Sólo participan los que actives.</p>
                <div className="member-list">
                  {members.map((name) => (
                    <div className="member-row" key={name}>
                      <Avatar
                        name={name}
                        src={
                          name === currentUser.displayName ? avatar : undefined
                        }
                        online={name === currentUser.displayName}
                      />
                      <div>
                        <strong>
                          {name}
                          {name === currentUser.displayName ? ' (vos)' : ''}
                        </strong>
                        <small>
                          {selected.includes(name)
                            ? 'Participa en la tirada'
                            : 'Fuera de esta tirada'}
                        </small>
                      </div>
                      <Switch
                        disabled={spinning}
                        aria-label={`Incluir a ${name}`}
                        checked={selected.includes(name)}
                        onCheckedChange={(on) =>
                          setSelected(
                            on
                              ? members.filter(
                                  (n) => selected.includes(n) || n === name,
                                )
                              : selected.filter((n) => n !== name),
                          )
                        }
                      />
                    </div>
                  ))}
                </div>
              </section>
              <div className="tip">
                <Sparkles size={20} aria-hidden="true" />
                <div>
                  <strong>Todos tienen la misma chance</strong>
                  <p>Cada tirada empieza de cero.</p>
                </div>
              </div>
              <p className="footnote">
                Grupo cerrado: Denis, Drizza, Castro, Alan, Maxi y Alca.
              </p>
            </aside>
          </div>
        </TabsContent>
        <TabsContent value="mapa">
          <div className="roulette-grid">
            <section className="card map-card">
              <div className="section-heading">
                <h2>
                  <MapPin size={18} />
                  Ubicaciones
                </h2>
                <span className="count">{currentGps ? 1 : 0}/6 visibles</span>
              </div>
              <div className="map-surface">
                {currentGps ? (
                  <iframe
                    title="Mapa de tu ubicación actual en OpenStreetMap"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${currentGps.lng - 0.006},${currentGps.lat - 0.004},${currentGps.lng + 0.006},${currentGps.lat + 0.004}&layer=mapnik&marker=${currentGps.lat},${currentGps.lng}`}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="empty-state">
                    <span className="empty-icon">
                      <Navigation size={36} />
                    </span>
                    <h2>
                      {sharing
                        ? 'Buscando una señal reciente'
                        : 'Tu ubicación, bajo tu control'}
                    </h2>
                    <p>Activá tu ubicación para verla en el mapa.</p>
                  </div>
                )}
              </div>
              <p className="support" role="status">
                {geoStatus}
                {gps && !currentGps ? ' · La última posición venció.' : ''}
              </p>
              {currentGps && (
                <p className="support">
                  Precisión ±{Math.round(currentGps.accuracy)} m ·{' '}
                  {new Date(currentGps.at).toLocaleTimeString('es-AR')}
                </p>
              )}
              {sharing ? (
                <button className="secondary-button" onClick={stopSharing}>
                  Dejar de compartir
                </button>
              ) : (
                <Dialog open={consentOpen} onOpenChange={setConsentOpen}>
                  <DialogTrigger className="primary">
                    <LocateFixed size={18} />
                    Activar mi ubicación
                  </DialogTrigger>
                  <DialogContent
                    showCloseButton={false}
                    className="puerto-dialog"
                  >
                    <DialogTitle>Vos decidís cuándo compartir</DialogTitle>
                    <DialogDescription>
                      Esta demo muestra tu GPS en OpenStreetMap, que recibe las
                      coordenadas para dibujar el mapa. No las envía al grupo.
                      Podés desactivarlo en cualquier momento.
                    </DialogDescription>
                    <p>
                      En la app conectada, compartir ubicación permite anunciar
                      encuentros. Para dos personas, el grupo verá la frase
                      lúdica «están teniendo relaciones amorosas».
                    </p>
                    <button className="primary" onClick={startSharing}>
                      Permitir ubicación en la demo
                    </button>
                    <DialogClose className="secondary-button">
                      Ahora no
                    </DialogClose>
                  </DialogContent>
                </Dialog>
              )}
            </section>
            <aside>
              <section className="card">
                <div className="section-heading">
                  <h2>El grupo</h2>
                  <span className="small-badge">Radio: {radius} m</span>
                </div>
                {members.map((name) => (
                  <div className="member-row" key={name}>
                    <Avatar
                      name={name}
                      online={name === currentUser.displayName}
                    />
                    <div>
                      <strong>{name}</strong>
                      <small>
                        {name === currentUser.displayName && currentGps
                          ? 'Ubicación local activa'
                          : 'Sin ubicación compartida'}
                      </small>
                    </div>
                    <MapPin size={16} color="var(--secondary)" />
                  </div>
                ))}
              </section>
              <div className="tip">
                <ShieldCheck size={23} />
                <div>
                  <strong>Sólo mientras vos quieras</strong>
                  <p>
                    Las ubicaciones del grupo requieren conectar el servicio en
                    tiempo real.
                  </p>
                </div>
              </div>
            </aside>
          </div>
        </TabsContent>
        <TabsContent value="gastos">
          <div className="expenses-grid">
            <form
              className="card expense-form"
              onSubmit={(event) => {
                event.preventDefault();
                const amountCents = Math.round(
                  Number(expenseAmount.replace(',', '.')) * 100,
                );
                try {
                  const shares = splitExpense(
                    amountCents,
                    expensePayer,
                    expensePeople,
                  );
                  setExpenses((previous) => [
                    {
                      id: crypto.randomUUID(),
                      concept: expenseConcept.trim(),
                      amountCents,
                      payerId: expensePayer,
                      participantIds: expensePeople,
                      at: new Date(),
                      shares,
                    },
                    ...previous,
                  ]);
                  setExpenseConcept('');
                  setExpenseAmount('');
                  setNotice('Gasto creado.');
                } catch (error) {
                  setNotice(
                    error instanceof Error
                      ? error.message
                      : 'No se pudo crear el gasto.',
                  );
                }
              }}
            >
              <div className="section-heading">
                <h2>
                  <DollarSign size={18} />
                  Nuevo gasto
                </h2>
                <span className="small-badge">División exacta</span>
              </div>
              <label htmlFor="concept">Concepto</label>
              <input
                id="concept"
                value={expenseConcept}
                onChange={(e) => setExpenseConcept(e.target.value)}
                maxLength={140}
                required
                placeholder="Gomitas"
              />
              <label htmlFor="amount">Monto total</label>
              <input
                id="amount"
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(e.target.value)}
                inputMode="decimal"
                required
                placeholder="10000"
              />
              <label htmlFor="payer">¿Quién pagó?</label>
              <NativeSelect
                id="payer"
                value={expensePayer}
                onChange={(e) => setExpensePayer(e.target.value)}
              >
                {seedAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.displayName}
                  </option>
                ))}
              </NativeSelect>
              <p className="support">Participaron</p>
              {seedAccounts.map((account) => (
                <div className="member-row" key={account.id}>
                  <Avatar name={account.displayName} />
                  <strong>{account.displayName}</strong>
                  <Switch
                    aria-label={`Incluir a ${account.displayName} en el gasto`}
                    checked={expensePeople.includes(account.id)}
                    onCheckedChange={(checked) =>
                      setExpensePeople((current) =>
                        checked
                          ? [...new Set([...current, account.id])]
                          : current.filter((id) => id !== account.id),
                      )
                    }
                  />
                </div>
              ))}
              <button className="primary" type="submit">
                Registrar gasto
              </button>
            </form>
            <section className="card expense-history">
              <div className="section-heading">
                <h2>Historial</h2>
                <span className="count">{expenses.length}</span>
              </div>
              {expenses.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-icon">
                    <DollarSign size={36} />
                  </span>
                  <h2>Sin gastos todavía</h2>
                  <p>
                    El primer gasto aparece acá y deja sus deudas registradas.
                  </p>
                </div>
              ) : (
                expenses.map((expense) => (
                  <article className="expense-card" key={expense.id}>
                    <strong>{expense.concept}</strong>
                    <span>
                      ${(expense.amountCents / 100).toLocaleString('es-AR')}
                    </span>
                    <small>
                      Pagó{' '}
                      {
                        seedAccounts.find(
                          (account) => account.id === expense.payerId,
                        )?.displayName
                      }
                    </small>
                    {expense.shares.map((share) => (
                      <div className="debt-line" key={share.debtorId}>
                        <span>
                          {
                            seedAccounts.find(
                              (account) => account.id === share.debtorId,
                            )?.displayName
                          }{' '}
                          debe $
                          {(share.amountCents / 100).toLocaleString('es-AR')}
                        </span>
                        {share.paidAt ? (
                          <small>Pagado</small>
                        ) : currentUser.id === expense.payerId ? (
                          <button
                            type="button"
                            onClick={() =>
                              setExpenses((all) =>
                                all.map((item) =>
                                  item.id !== expense.id
                                    ? item
                                    : {
                                        ...item,
                                        shares: item.shares.map((itemShare) =>
                                          itemShare.debtorId === share.debtorId
                                            ? {
                                                ...itemShare,
                                                paidAt:
                                                  new Date().toISOString(),
                                              }
                                            : itemShare,
                                        ),
                                      },
                                ),
                              )
                            }
                          >
                            Marcar pagado
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </article>
                ))
              )}
            </section>
          </div>
        </TabsContent>
        <TabsContent value="perfil">
          <div className="profile-grid">
            <section className="card profile-summary">
              <Avatar
                name={currentUser.displayName}
                large
                src={avatar}
                online
              />
              <h2>{currentUser.displayName}</h2>
              <span className="admin-badge">
                <ShieldCheck size={13} />
                {currentUser.role === 'admin' ? 'Administrador' : 'Miembro'}
              </span>
              <p>{bio || 'Todavía no agregaste una descripción.'}</p>
              <label className="upload-label">
                Cambiar avatar
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => void chooseAvatar(e.target.files?.[0])}
                />
              </label>
              <small>JPG, PNG o WebP · hasta 2 MB</small>
            </section>
            <div>
              <form className="card profile-form" onSubmit={saveProfile}>
                <h2>Tu perfil</h2>
                <label htmlFor="identity">Nombre de usuario</label>
                <div className="locked-field editable-field">
                  <input
                    id="identity"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    required
                  />
                  <UserRound size={17} />
                </div>
                <p className="support">
                  Podés cambiarlo; tu identidad interna y tus mensajes siguen
                  siendo los mismos.
                </p>
                <label htmlFor="bio">Descripción / Bio</label>
                <textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={280}
                  placeholder="Algo que diga un poco de vos"
                  rows={3}
                />
                <small className="char-count">{bio.length}/280</small>
                <label htmlFor="ai-bio">Descripción IA</label>
                <textarea
                  id="ai-bio"
                  value={aiBio}
                  onChange={(e) => setAiBio(e.target.value)}
                  readOnly={currentUser.role !== 'admin'}
                  maxLength={280}
                  placeholder={
                    currentUser.role === 'admin'
                      ? 'Descripción asistida para el perfil'
                      : 'Sólo Denis puede editar esta descripción'
                  }
                  rows={2}
                />
                <p className="support">
                  {currentUser.role === 'admin'
                    ? 'Como administrador, podés editar esta descripción.'
                    : 'Sólo el administrador puede modificarla.'}
                </p>
                <label htmlFor="birth">Cumpleaños (DD/MM)</label>
                <input
                  id="birth"
                  type="text"
                  value={birth}
                  inputMode="numeric"
                  pattern="[0-9]{2}/[0-9]{2}"
                  placeholder="24/08"
                  onChange={(e) => setBirth(e.target.value)}
                />
                <p className="support">
                  <Cake size={13} className="inline" /> Para que el grupo se
                  acuerde de tu día. Tu año es privado.
                </p>
                <label htmlFor="new-password">Nueva contraseña</label>
                <input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={10}
                  autoComplete="new-password"
                  placeholder="Dejala vacía para conservarla"
                />
                <p className="support">
                  Mínimo 10 caracteres. En producción se guarda con hash
                  Argon2id.
                </p>
                <button className="primary" type="submit">
                  Guardar perfil
                </button>
                <p role="status" className="support">
                  {profileStatus}
                </p>
              </form>
              <section className="card settings-card">
                <h2>Ajustes</h2>
                <div className="linked-account">
                  <span className="provider-g">G</span>
                  <div>
                    <strong>Google</strong>
                    <small>
                      {linkedGoogle ? 'Vinculada en esta demo' : 'No vinculada'}
                    </small>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLinkedGoogle((value) => !value)}
                  >
                    {linkedGoogle ? (
                      <>
                        <Unlink size={15} />
                        Desvincular
                      </>
                    ) : (
                      <>
                        <Link2 size={15} />
                        Vincular
                      </>
                    )}
                  </button>
                </div>
                <div className="linked-account">
                  <span className="provider-apple" aria-hidden="true">
                    ●
                  </span>
                  <div>
                    <strong>Apple</strong>
                    <small>
                      {linkedApple ? 'Vinculada en esta demo' : 'No vinculada'}
                    </small>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLinkedApple((value) => !value)}
                  >
                    {linkedApple ? (
                      <>
                        <Unlink size={15} />
                        Desvincular
                      </>
                    ) : (
                      <>
                        <Link2 size={15} />
                        Vincular
                      </>
                    )}
                  </button>
                </div>
                <div className="setting-row">
                  <span className="setting-icon purple">
                    <SunMoon size={17} />
                  </span>
                  <label htmlFor="theme">Apariencia</label>
                  <NativeSelect
                    id="theme"
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                  >
                    <option value="system">Automática</option>
                    <option value="light">Clara</option>
                    <option value="dark">Oscura</option>
                  </NativeSelect>
                </div>
                {currentUser.role === 'admin' && (
                  <Dialog>
                    <DialogTrigger className="setting-row setting-trigger">
                      <span className="setting-icon blue">
                        <ShieldCheck size={17} />
                      </span>
                      <span>Configuración del grupo</span>
                      <ChevronRight size={18} />
                    </DialogTrigger>
                    <DialogContent
                      showCloseButton={false}
                      className="puerto-dialog"
                    >
                      <DialogTitle>Configuración del grupo</DialogTitle>
                      <DialogDescription>
                        Acceso de Denis, administrador. Los cambios afectan esta
                        demo local.
                      </DialogDescription>
                      <label htmlFor="radius">
                        Radio de proximidad (10–500 m)
                      </label>
                      <input
                        id="radius"
                        type="number"
                        min={10}
                        max={500}
                        value={radius}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          if (Number.isInteger(n) && n >= 10 && n <= 500)
                            setRadius(n);
                        }}
                      />
                      <label htmlFor="timezone">Zona horaria del grupo</label>
                      <NativeSelect
                        id="timezone"
                        value={timezone}
                        onChange={(e) => setTimezone(e.target.value)}
                      >
                        <option value="America/Argentina/Buenos_Aires">
                          Buenos Aires
                        </option>
                        <option value="America/Montevideo">Montevideo</option>
                        <option value="Europe/Madrid">Madrid</option>
                      </NativeSelect>
                      <p>
                        Cumpleaños a las 00:00 de esta zona. El cron y las
                        notificaciones se ejecutarán al conectar el backend.
                      </p>
                      <DialogClose className="primary">Listo</DialogClose>
                    </DialogContent>
                  </Dialog>
                )}
              </section>
            </div>
          </div>
        </TabsContent>
        <TabsList className="tabbar" aria-label="Navegación principal">
          {(
            [
              { value: 'ruleta', label: 'Ruleta', Icon: CircleDot },
              { value: 'mapa', label: 'Mapa', Icon: MapPin },
              { value: 'gastos', label: 'Gastos', Icon: DollarSign },
              { value: 'perfil', label: 'Perfil', Icon: UserRound },
            ] as const
          ).map(({ value, label, Icon }) => (
            <TabsTrigger
              value={value}
              className={tab === value ? 'active' : ''}
              key={value}
            >
              <Icon aria-hidden="true" size={21} />
              <span>{label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div role="status" className="footnote">
        {notice}
      </div>
    </main>
  );
}
