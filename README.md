# Puerto App

Frontend React navegable y lógica de dominio, acompañado por `ARQUITECTURA-PUERTO.md` (modelo de datos, servicios, permisos y navegación).

## Ejecutar

Requiere Node.js 24 y pnpm. Instalar con `pnpm install`; iniciar con `pnpm dev`; compilar con `pnpm build`. Los scripts usan el starter oficial Sites/Vinext y se conservan sus versiones y lockfile. En entornos que bloqueen scripts de dependencias, revisar la política local; no desactivar controles de seguridad para instalar.

Pruebas: `node --test lib/domain.test.ts`. Tipos: `pnpm exec tsc --noEmit`.

## Archivos principales

- `app/Puerto.tsx`: cuatro vistas y controles accesibles.
- `app/globals.css`: tokens y componentes claro/oscuro.
- `lib/domain.ts`: Fisher–Yates criptográfico, Haversine, conjuntos máximos y cumpleaños.
- `lib/domain.test.ts`: pruebas de invariantes y límites.
- `app/layout.tsx`: idioma y metadatos.

## Alcance

La demo usa la identidad local de Denis para mostrar permisos. No es autenticación de usuario; la privacidad de Sites protege el acceso a la demo, no implementa las seis cuentas del producto. Los cinco nombres restantes son ejemplos. Ruleta, chat, bio, avatar y ajustes viven en memoria y se reinician al recargar. Sólo el tema se guarda en localStorage. No ingresar datos sensibles en una demostración.

GPS: se solicita permiso explícito y la posición se muestra con OpenStreetMap, que recibe las coordenadas. No se envía al grupo. El botón para detenerlo limpia el watcher y la posición; los datos vencen tras 60 s. Puede continuar mientras la pestaña permanezca abierta, sujeto a las restricciones del navegador. No existe tracking garantizado en segundo plano.

Los sorteos agregan eventos al chat local. Mensajes de terceros, recibos de lectura remotos, alertas de proximidad, cron, push y moderación persistente requieren implementar el backend descrito. El cliente nunca debe ser autoridad de permisos ni del resultado en producción.

WebMCP: `puerto_sortear` usa la misma acción visible y valida entradas. Se registra sólo cuando document.modelContext está disponible; no se validó en un navegador compatible en esta entrega.

## Verificación

Cinco tests de dominio incluyen todas las combinaciones de exclusión para los tres modos, 20 iteraciones por caso válido, distancias 49/51 m, cadenas espaciales, datos vencidos, audiencias y cumpleaños locales. Compilación y chequeo TypeScript se ejecutan durante la entrega. No se realizaron pruebas visuales automatizadas ni integración con backend.
