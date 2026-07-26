# Fase 12 — Acceso

Contrato para quien implemente el backend de acceso. **El frontend ya está
construido y espera exactamente estos tres endpoints.** Mientras no existan, la
interfaz los detecta ausentes y esconde la funcionalidad sola — nada se rompe.

---

## La decisión: acceso, no login

Oppy hoy no pide cuenta ni contraseña, y **eso no es una omisión**. Está escrito
en el código y en los docs: cada paso extra antes de ver el valor es gente que
abandona, y el valor de Oppy solo se ve del otro lado del formulario.

Pero hay un problema real que no se puede dejar así: **el `userId` vive solo en
`localStorage`**. Si la persona limpia el navegador, cambia de teléfono o usa una
computadora prestada, su perfil desaparece y no hay forma de volver. Para María
—que puede estar usando la máquina de un cibercafé— eso es perder todo su
trabajo sin aviso.

Entonces la respuesta no es poner un login adelante. Es esto:

> **Nunca se bloquea el onboarding.** La persona usa Oppy primero. Recién
> después de ver sus resultados se le ofrece guardar el acceso.

Y sin contraseña. Se manda un **código de 6 dígitos al contacto que la persona
ya dejó** para las notificaciones, por el mismo Zavu que ya está integrado.

Por qué así y no email + contraseña:

- **Una contraseña más es una barrera más** para el usuario de referencia de este
  producto: alguien de 55 años que ya siente que las plataformas son complicadas.
- **No hay contraseñas que guardar**, así que no hay hashes que proteger, ni
  "olvidé mi contraseña", ni fuga posible.
- **Reusa infraestructura que ya existe**: Zavu, el contacto del perfil y el
  consentimiento. No entra ningún servicio nuevo.

---

## Los tres endpoints

Base: `${VITE_API_URL}/api`

### 1. Capacidad — `GET /auth/estado`

Lo primero que llama el frontend, una sola vez al arrancar.

```jsonc
{ "disponible": true, "canal": "email" }   // 200
```

**Mientras no exista, devolver 404 es la respuesta correcta**: el frontend lo
interpreta como "el acceso todavía no está" y esconde toda la funcionalidad. No
hace falta ningún flag ni variable de entorno.

### 2. Pedir código — `POST /auth/codigo`

```jsonc
// entrada
{ "contacto": "maria@correo.com" }         // email o telefono internacional

// salida
{ "enviado": true, "expiraEn": 600 }       // 202, segundos de vigencia
```

**Siempre responder 202, exista el contacto o no.** Si se responde 404 cuando no
existe, cualquiera puede averiguar quién está registrado probando correos. La
respuesta no debe permitir distinguir los dos casos.

Límite sugerido: 3 pedidos por contacto cada 15 minutos.

### 3. Canjear código — `POST /auth/sesion`

```jsonc
// entrada
{ "contacto": "maria@correo.com", "codigo": "483920" }

// salida
{ "perfil": { /* el mismo objeto de GET /profiles/:id */ } }   // 200
```

Errores: `400` código inválido o vencido · `429` demasiados intentos.

El frontend guarda `perfil.id` en `localStorage` bajo `oppy.userId` — la misma
clave de siempre — y sigue funcionando igual que antes. **No hay token, no hay
cookie, no hay header de sesión.**

---

## Lo que hace falta del lado de la base

Una tabla. Nada más:

```sql
CREATE TABLE IF NOT EXISTS codigos_acceso (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Hash, nunca el codigo en claro: quien lea la base no debe poder entrar
  -- a la cuenta de nadie.
  codigo_hash TEXT NOT NULL,
  intentos    INTEGER NOT NULL DEFAULT 0,
  expira_en   TIMESTAMPTZ NOT NULL,
  usado_en    TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_codigos_vigentes
  ON codigos_acceso (user_id, expira_en DESC);
```

El envío reusa `services/notifications/zavu.js` tal cual: `enviarNotificacion`
ya devuelve un resultado normalizado y nunca lanza.

---

## Reglas que no se negocian

- **Nunca bloquear el onboarding.** Si aparece una pantalla de acceso antes de
  que la persona vea una oportunidad, el cambio está mal hecho.
- **El código se guarda hasheado y vence.** 10 minutos y 5 intentos es
  suficiente.
- **`POST /auth/codigo` no revela si el contacto existe.**
- **Sin consentimiento no se manda nada.** Si `acepta_notificaciones` es `false`,
  el canal no está habilitado para esa persona — ni para avisos ni para acceso.
- **No se pide contraseña, ni CV, ni documento.** Oppy guarda el mínimo
  indispensable y eso es parte de la propuesta.

---

## Qué está construido y qué no

**Está completo, de punta a punta.**

| | |
|---|---|
| Detección de capacidad, pantalla de acceso, ingreso del código, errores y reenvío | ✅ `frontend/src/pages/Acceso.jsx` |
| Bloque *Volver a entrar* en **Mi perfil**, con formulario de contacto | ✅ `frontend/src/pages/Perfil.jsx` |
| Los tres endpoints | ✅ `backend/src/routes/auth.js` |
| Tabla `codigos_acceso` con RLS | ✅ `backend/src/db/schema.sql` |
| Generación, hash y verificación del código | ✅ `backend/src/services/auth/codigo.js` |
| Cambiar el contacto de un perfil ya creado | ✅ `PATCH /profiles/:id/contacto` |

### El cuarto endpoint

`profiles.js` no tenía forma de agregar un correo o un teléfono a un perfil que
ya existe, y sin eso quien pasó el onboarding sin dejar contacto no podía
habilitar el acceso después — su única salida era *Empezar de cero*, que borra el
perfil. Justo lo que esto venía a evitar.

```jsonc
// PATCH /profiles/:id/contacto
{ "email": "maria@correo.com", "telefono": null, "aceptaNotificaciones": true }
```

Rige la misma regla que el resto del contacto: el consentimiento queda registrado
en `consents` con su fecha, y aceptar avisos sin dejar ningún contacto se
rechaza con 400 — sería una fila marcada como notificable sin destinatario.

---

## Cómo se prueba

El código se guarda hasheado, así que **no se puede leer de la base**: para
probar el flujo completo hay que recibirlo de verdad.

- **Con la clave `zv_test_…`** (`isTestMode`), Zavu acepta el envío sin gastar
  saldo ni entregar. Sirve para ejercitar el flujo sin costo.
- **Con la clave `zv_live_…`**, el código llega de verdad al correo o al
  teléfono. Es lo que hay que usar en el demo.

Las dos están en `backend/.env`; se cambia cuál está comentada.

Lo que se verifica sin enviar nada:

```bash
npm test          # 64 pruebas — incluye hash, vigencia, intentos y validacion
```

### Reglas verificadas por prueba

| Regla | Dónde |
|---|---|
| El código nunca queda en claro, ni siquiera hasheado sin sal | `unit.test.js` |
| Un hash corrupto en la base responde "no", no 500 | `unit.test.js` |
| El mensaje no lleva enlaces | `unit.test.js` |
| `POST /auth/codigo` responde igual exista el contacto o no | `api.test.js` |
| Un código que no son 6 dígitos se rechaza antes de tocar la base | `api.test.js` |
| Aceptar avisos sin contacto se rechaza | `api.test.js` |

El frontend vive en `frontend/src/hooks/useAcceso.jsx` y
`frontend/src/pages/Acceso.jsx`. **No toca ningún archivo del backend**, así que
implementar esto no va a chocar con nada.
