# Puerto App

Frontend React navegable y lógica de dominio, acompañado por `ARQUITECTURA-PUERTO.md` (modelo de datos, autenticación híbrida, servicios, permisos y navegación).

## Ejecutar

Requiere Node.js 24 y pnpm. Instalar con `pnpm install`; iniciar con `pnpm dev`; compilar con `pnpm build`. Los scripts usan el starter oficial Sites/Vinext y se conservan sus versiones y lockfile. En entornos que bloqueen scripts de dependencias, revisar la política local; no desactivar controles de seguridad para instalar.

Pruebas: `node --test lib/domain.test.ts`. Tipos: `pnpm exec tsc --noEmit`.

## Archivos principales

- `app/Puerto.tsx`: cuatro vistas y controles accesibles.
- `app/globals.css`: tokens y componentes claro/oscuro.
- `lib/domain.ts`: seed de seis cuentas, validación local, Fisher–Yates criptográfico, equipos balanceados con suplentes, Haversine, conjuntos máximos y cumpleaños.
- `lib/firebase.ts`: inicio con Google mediante Firebase Auth; toma configuración de variables `VITE_FIREBASE_*`.
- `lib/domain.test.ts`: pruebas de invariantes y límites.
- `app/layout.tsx`: idioma y metadatos.

## Alcance

El acceso se realiza exclusivamente con Google mediante Firebase Authentication. En el primer ingreso, cada cuenta debe completar “¿Quién sos?” y sólo puede elegir uno de los cinco miembros no administradores. Los perfiles, gastos y resultados de ruleta se sincronizan mediante Cloud Firestore. El tema visual queda guardado en el dispositivo.

La implementación real debe guardar las contraseñas con Argon2id, forzar el cambio de las claves iniciales, rotar sesiones y ejecutar OAuth en el backend con state, nonce y validación del subject. Los emails `.local` no son direcciones entregables y deben reemplazarse y verificarse antes de ofrecer recuperación por correo.

GPS: se solicita permiso explícito y la posición se muestra con OpenStreetMap, que recibe las coordenadas. No se envía al grupo. El botón para detenerlo limpia el watcher y la posición; los datos vencen tras 60 s. Puede continuar mientras la pestaña permanezca abierta, sujeto a las restricciones del navegador. No existe tracking garantizado en segundo plano.

Si sobran integrantes, se mantienen todos los equipos visibles y cada suplente se integra al equipo más pequeño, eligiendo al azar entre empates. Por ejemplo, cinco personas en equipos de tres generan dos equipos 3/2. Alertas de proximidad, cron, push y moderación persistente requieren implementar el backend descrito. El cliente nunca debe ser autoridad de permisos, identidad ni resultado en producción.

WebMCP: `puerto_sortear` usa la misma acción visible y valida entradas. Se registra sólo cuando document.modelContext está disponible; no se validó en un navegador compatible en esta entrega.

## Verificación

Ocho tests de dominio incluyen las seis cuentas por username/email, cumpleaños DD/MM, todas las combinaciones de exclusión para los tres modos, 20 iteraciones por caso válido, reparto equilibrado de suplentes, distancias 49/51 m, cadenas espaciales, datos vencidos, audiencias y cumpleaños locales. Compilación y chequeo TypeScript se ejecutan durante la entrega. No se realizaron pruebas visuales automatizadas ni integración con backend.
