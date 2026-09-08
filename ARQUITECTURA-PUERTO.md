# Puerto App — especificación implementable

## Alcance y decisiones

Grupo cerrado de seis cuentas. Denis es el administrador inicial; los otros cinco nombres de la interfaz son ejemplos reemplazables al provisionar las cuentas. Se entrega frontend React de demostración y diseño del backend. La demo no autentica personas, no transmite coordenadas, no envía push y no simula confirmaciones de lectura de terceros. Los mensajes y sorteos de la demo viven en memoria; las preferencias de apariencia pueden persistir en este dispositivo.

Stack propuesto para producción: React para web; API TypeScript, PostgreSQL, WebSocket para chat/eventos y worker de notificaciones con cola transaccional. Para tracking móvil continuo en segundo plano, cliente React Native con integración de ubicación del sistema operativo. Una web abierta puede usar watchPosition, pero no garantiza GPS cuando está cerrada o suspendida.

Decisiones donde la especificación no define comportamiento: los equipos son completos, de tamaño exacto 2 o 3; los sobrantes quedan explícitamente como suplentes, elegidos al azar en cada tirada. El grupo usa una zona IANA configurable (valor inicial America/Argentina/Buenos_Aires). Un cumpleaños del 29/02 se celebra sólo el 29/02; cualquier política alternativa debe configurarse. La proximidad exige distancia máxima entre cada par ≤ radio, evitando cadenas A–B–C donde A y C están lejos. Pueden existir encuentros superpuestos; se anuncian conjuntos máximos, nunca subgrupos de un encuentro mayor.

## 1. Modelo de datos

Todos los identificadores son UUID, los instantes timestamptz UTC y las fechas civiles date. FK con borrado restringido salvo política de retención explícita. El API obtiene actor y grupo de la sesión autenticada, nunca de un rol enviado por el cliente.

| Entidad | Campos y tipos | Relaciones / restricciones |
|---|---|---|
| Group | id uuid PK; name varchar(80); timezone varchar(64); proximity_radius_m integer default 50; expected_size smallint default 6; created_at timestamptz | Radio entre 10 y 500 m; zona IANA válida; seis membresías activas como invariante transaccional |
| User | id uuid PK; auth_subject text UNIQUE NOT NULL; group_id uuid FK; public_name varchar(40) NOT NULL; role enum(admin,member); bio varchar(280); birth_date date NULL; avatar_object_key text NULL; location_consent_at timestamptz NULL; location_revoked_at timestamptz NULL; active boolean; created_at timestamptz | UNIQUE(group_id, public_name); auth_subject, public_name y group_id inmutables vía trigger y API; fecha no futura; Denis se provisiona con role=admin por ID verificado |
| LocationLog | id uuid PK; user_id uuid FK; latitude double precision; longitude double precision; accuracy_m real; captured_at timestamptz; received_at timestamptz; sequence bigint | Latitud [-90,90], longitud [-180,180], accuracy ≥ 0; UNIQUE(user_id,sequence); índice(user_id,captured_at DESC); retención recomendada 24 h |
| ChatMessage | id uuid PK; group_id uuid FK; author_id uuid FK NULL; kind enum(text,proximity,birthday,roulette,moderation); body text; event_id uuid FK NULL; roulette_session_id uuid FK NULL; created_at timestamptz; edited_at timestamptz NULL; deleted_at timestamptz NULL; client_nonce uuid NULL | author requerido en text y NULL para sistema; cuerpo 1–4000 caracteres; UNIQUE(author_id,client_nonce); UNIQUE(event_id); texto escapado, sin HTML ejecutable |
| RouletteSession | id uuid PK; group_id uuid FK; created_by uuid FK; mode enum(teams2,teams3,single); eligible_user_ids uuid[]; excluded_user_ids uuid[]; teams jsonb; substitutes uuid[]; winner_id uuid FK NULL; algorithm_version text; created_at timestamptz; request_key uuid | Snapshot de miembros únicos y activos; elegibles/excluidos particionan la membresía; UNIQUE(group_id,created_by,request_key); equipos sin duplicados y sólo elegibles; single tiene un ganador |
| MessageRead | message_id uuid FK; user_id uuid FK; read_at timestamptz | PK(message_id,user_id); sólo se marca si ese usuario puede ver el mensaje; alternativa escalable: cursor de lectura por usuario |
| SystemEvent | id uuid PK; group_id uuid FK; type enum(proximity,birthday,roulette); dedupe_key text UNIQUE; payload jsonb; created_at timestamptz | Fuente canónica del evento, referencias de usuarios por ID |
| EventRecipient | event_id uuid FK; user_id uuid FK; channel enum(in_app,push,chat); priority enum(normal,high); read_at timestamptz NULL | PK(event_id,user_id,channel); determina audiencia, incluso dentro de la sala única |
| PushSubscription | id uuid PK; user_id uuid FK; platform enum(web,ios,android); encrypted_token text; enabled boolean; updated_at timestamptz | Sólo el propietario puede registrar/revocar; secretos nunca expuestos al grupo |
| Outbox | id uuid PK; event_id uuid FK; user_id uuid FK; channel enum; attempts integer; next_attempt_at timestamptz; delivered_at timestamptz NULL | UNIQUE(event_id,user_id,channel); reintentos con backoff; entrega push al menos una vez, presentación deduplicada por event_id |
| EncounterState | id uuid PK; group_id uuid FK; member_key text; state enum(candidate,active,ended); first_seen_at timestamptz; last_seen_at timestamptz; generation integer | UNIQUE(group_id,member_key); clave formada por IDs ordenados; persistencia para sobrevivir reinicios |
| AuditLog | id uuid PK; actor_id uuid FK; action text; subject_id uuid; before jsonb; after jsonb; created_at timestamptz | Registro de configuración, moderación y cambios administrativos; excluye tokens y GPS exacto |

La fecha de nacimiento completa sólo es visible al propietario y al worker de cumpleaños. El grupo recibe el día/mes y aviso de cumpleaños, no edad ni año. La lectura de GPS se limita a miembros activos del mismo grupo con ubicación compartida. Denis puede moderar mensajes y configurar el grupo, pero no editar identidad inmutable ni suplantar cuentas. Las credenciales y roles no se derivan de escribir «Denis» en un formulario. Alta cerrada mediante seis invitaciones únicas ligadas al proveedor de identidad; no hay registro público.

## 2. Arquitectura y navegación

```text
App
├─ AuthGate → inicio de sesión / invitación / sesión vencida
└─ GroupShell → encabezado, conectividad, saludo de cumpleaños
   ├─ Ruleta → modo, presencia, rueda, resultado y suplentes
   │  └─ Modal resultado → equipos/ganador, anuncio en chat
   ├─ Mapa → permiso, mapa de coordenadas recientes, miembros
   │  ├─ Modal miembro → precisión, última actualización
   │  └─ Modal consentimiento → compartir / revocar
   ├─ Chat → sala única, mensajes, eventos y lecturas
   │  └─ Modal lecturas / moderación (administrador)
   └─ Perfil → avatar, identidad bloqueada, bio, nacimiento
      ├─ Modal avatar → selección y recorte
      └─ Ajustes grupo (Denis) → radio, zona horaria, auditoría
```

Frontend → API autenticada → servicios de usuarios, ruleta y chat → PostgreSQL. Servicio de ubicación ingiere coordenadas → evaluador de encuentros → transacción evento + mensaje + destinatarios + outbox. Worker consume outbox para WebSocket y proveedor push. Scheduler evalúa cumpleaños y usa el mismo pipeline. No se crean dos eventos separados para chat y push.

API: GET /me, PATCH /me {bio,birthDate,avatar}; GET /group/members; PATCH /group/settings (admin); POST /roulette {mode,eligibleIds,requestKey}; GET /roulette/:id; POST /location-consent; DELETE /location-consent; POST /locations; GET /locations/latest; GET /chat?cursor=; POST /chat {body,clientNonce}; PUT /chat/:id/read; DELETE /chat/:id (admin); POST /push-subscriptions. WebSocket autenticado distribuye message.created, message.read, location.updated y event.created únicamente a destinatarios autorizados. Revalidar membresía en reconexión, revocación y cada escritura; paginar chat y resincronizar por cursor después de desconexión.

## 3. Servicios críticos

### Ruleta con filtros

```text
sortear(actor, mode, selectedIds, requestKey):
  autenticar actor; comprobar miembro activo
  transacción:
    devolver sesión existente si requestKey ya procesada
    bloquear snapshot de membresía activa del grupo
    rechazar IDs desconocidos, repetidos o ajenos al grupo
    pool = copia de selectedIds; excluded = miembros - pool
    size = single ? 1 : teams2 ? 2 : 3
    rechazar si pool.length < size
    Fisher–Yates(pool): para i=n-1..1 intercambiar i con randomInt(0,i)
    # randomInt criptográfico uniforme por rejection sampling
    single: winner=pool[0], teams=[], substitutes=[]
    equipos: formar floor(n/size) equipos; resto = substitutes
    persistir snapshot y resultado; no recalcular al terminar animación
    insertar evento, mensaje y outbox para el grupo (una vez)
  devolver resultado; cliente anima hacia ese resultado
```

En single, los no seleccionados como ganador siguen siendo participantes elegibles, no suplentes. No se eliminan del snapshot. La animación bloquea nuevos sorteos y cambios de presencia; respeta reduced-motion y usa vibración sólo donde existe. El servidor es autoridad en producción; crypto.getRandomValues en la demo prueba la lógica local sin garantías de auditoría remota.

### Proximidad

```text
ingest(location, authenticatedUser):
  comprobar consentimiento vigente, membresía y límites de frecuencia
  validar rangos, precisión y capturedAt (máximo 10 s en futuro)
  rechazar secuencias antiguas; no sustituir ubicación nueva con una vieja
  persistir y evaluar bajo lock por grupo

evaluate(group, now):
  puntos = última posición por usuario activo con consentimiento
  excluir puntos con edad > 60 s o accuracy > min(25 m, radio/2)
  # Los umbrales son valores iniciales configurables, no GPS infalible.
  distancia(a,b) = Haversine(a,b) en metros
  grafo: arista(a,b) si distancia(a,b) <= radio
  conjuntos = cliques máximos con tamaño >= 2
  # Con seis miembros, enumerar los 64 subconjuntos es suficiente.
  para cada conjunto:
    clave = IDs ordenados; exigir presencia continua 15 segundos
    si pasó candidate→active: crear evento sólo una vez por generación
    2 miembros:
      texto = "[A] y [B] están teniendo relaciones amorosas."
      audiencia push + chat = grupo menos los dos presentes
    3..5 miembros:
      texto = "[Lista] están juntos en [Ubicación/Punto]."
      audiencia push + chat = grupo menos los presentes
    6 miembros (y membresía completa del grupo = 6):
      texto = "El grupo está unido."
      audiencia push + chat = todo el grupo; prioridad alta
  marcar ended sólo tras 30 segundos de ausencia / salida
  ante expansión confirmada, terminar encuentro anterior y anunciar nuevo
  persistir evento + destinatarios + mensaje + outbox en una transacción
```

Evaluar también con temporizador para detectar caducidad aunque dejen de llegar posiciones. Una salida usa radio + 10 m para histéresis de un encuentro activo; nuevos encuentros siempre requieren ≤ radio. Revocación de consentimiento retira al usuario inmediatamente del mapa y del encuentro, sin esperar histéresis. Para evitar rebotes, una misma composición no se vuelve a anunciar durante cinco minutos; registrar el estado sin emitir otro evento. No inferir presencia de miembros sin permisos ni completar seis con posiciones antiguas. Una cadena A–B–C no constituye un trío si A y C exceden el radio.

El punto se obtiene por geocodificación inversa del centro del conjunto, con caché y timeout; fallback: «el punto compartido» si no hay nombre. Los textos se mantienen exactamente como solicita el brief; el mensaje de dos personas es una frase lúdica del grupo y no una afirmación verificada sobre actividad privada. Informarlo en el consentimiento de ubicación. La detección describe cercanía GPS estimada, no prueba una actividad.

### Cumpleaños, medianoche y recuperación

```text
scheduler cada minuto:
  para grupo con medianoche local alcanzada y día no procesado:
    fecha = fecha civil de now en group.timezone
    buscar usuarios activos cuyo día/mes de birthDate coincide
    para cada usuario:
      dedupeKey = birthday:groupId:userId:fecha
      transacción insert-if-absent:
        crear evento
        in_app para agasajado: "¡Feliz cumpleaños, [Usuario]!"
        push y banner de chat para todos los demás
        insertar outbox
    marcar día procesado dentro de transacción
```

El planificador apunta a 00:00 de la zona del grupo; el barrido por minuto recupera ejecuciones perdidas y usa fecha civil, no UTC. La primera ejecución tras una caída recupera días pendientes con límite operativo y evita push de felicitaciones vencidas; el banner del día sigue disponible. GET /me obtiene felicitación del día no vista y la muestra al iniciar sesión incluso si el usuario estaba offline a medianoche. Denis, 24 de agosto, es sólo el ejemplo del brief, no se asigna una fecha de nacimiento real sin confirmación. DST se resuelve con biblioteca de zonas IANA; un cambio de zona no duplica eventos para la misma fecha civil.

## 4. UI y contrato de integración

El frontend adjunto materializa las cuatro vistas con CSS de tokens claro/oscuro, avatares, listas tipo Ajustes, selector segmentado, rueda animada y tab bar inferior. Tema automático por prefers-color-scheme, con selector opcional. Tipografía 34/800 para títulos, 14.5/600 para filas, 12 para metadata; tarjetas de 26 px, filas de 18 px, iconos de 8 px. Los textos secundarios conservan los tokens solicitados; información esencial usa texto primario para mantener contraste.

La pestaña Mapa expone consentimiento y posición real del dispositivo cuando se autoriza. Las ubicaciones de otros usuarios permanecen pendientes de conexión. No se muestran coordenadas ficticias como si fueran seguimiento real. La pestaña Chat permite envíos locales y eventos de ruleta; lecturas reales requieren acknowledgements de otras sesiones. Perfil mantiene nombre inmutable y valida nacimiento. Los ajustes de Denis en la demo sólo configuran la sesión local.

En producción sustituir adaptador local por API: resultado de ruleta antes de animar, mensajes confirmados por servidor, reloj de servidor en timestamps, estado de envío con reintento por nonce, permisos GPS revocables y avatar subido mediante URL firmada con límites MIME/tamaño. Ningún cálculo del cliente concede permisos. WebSocket no garantiza push en segundo plano; se necesita proveedor de push con tokens por dispositivo.

## Validación y criterios de aceptación

- Ruleta: 0 elegibles bloquea todos los modos; 1 permite single; 5 en teams2 produce 2 equipos y 1 suplente; 5 en teams3 produce 1 equipo y 2 suplentes; excluidos jamás aparecen; no hay duplicados; reintento por requestKey devuelve idéntico resultado.
- Ubicación: pares a 49 m sí y a 51 m no para radio 50; exacto límite incluido; cadenas no forman tríos; seis frescos y consentidos activan unión; cinco más un dato vencido no; radio configurable; retiro inmediato por revocación; un evento por encuentro estable.
- Cumpleaños: medianoche local, fin de año, 29/02, DST, caída/reintento y dos usuarios el mismo día; felicitación al destinatario y aviso a los otros cinco, sin exponer año.
- Identidad: PATCH de nombre/rol rechazado; usuario ajeno no lee chat ni GPS; un miembro no modera ni cambia radio; Denis autorizado por sujeto autenticado, no por nombre enviado.
- Chat: contenido escapado, reconexión sin duplicados, recibos sólo de destinatarios, moderación auditada y eventos filtrados por audiencia.
- UI: teclado, foco visible, labels, estados vacíos, tema automático, reduced-motion, ancho móvil y zoom. Push/GPS en segundo plano se verifican en dispositivos reales al integrar backend y cliente nativo.

Los tests adjuntos verifican algoritmos puros; no constituyen una prueba de integración de servicios todavía no conectados.
