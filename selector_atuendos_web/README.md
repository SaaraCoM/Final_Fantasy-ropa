# Selector de atuendos — sitio estático

## Ejecutar localmente

No abras `index.html` directamente con `file://`, porque algunos navegadores bloquean `fetch` local.

### Python

```bash
cd selector_atuendos_web
python -m http.server 8080
```

Abre `http://localhost:8080`.

### Node

```bash
npx serve .
```

## Cargar datos autorizados

1. Copia todas las imágenes dentro de `images/`, sin subcarpetas.
2. Edita `data/atuendos.json`.
3. Cada elemento debe incluir:

```json
{
  "id": "cloud_strife__atuendo_principal",
  "personaje": "Cloud Strife",
  "genero": "hombre",
  "origen": "Final Fantasy VII",
  "atuendo": "Atuendo principal",
  "archivo": "cloud_strife__atuendo_principal.webp",
  "pagina_personaje": "URL autorizada",
  "fuente_imagen": "URL autorizada",
  "licencia": "licencia verificada"
}
```

El archivo entregado no contiene registros de personajes porque no se obtuvo autorización para el rastreo automatizado de Fandom ni una licencia reutilizable individual para las imágenes.

## Modo local

`config.js` viene configurado con:

```js
mode: "local"
```

Las reservas se almacenan en `localStorage`. **Solo se comparten entre pestañas y ventanas del mismo navegador/perfil**. No sirven como persistencia multiusuario real.

## Activar Supabase

1. Crea un proyecto en Supabase.
2. Ejecuta `supabase_schema.sql` en el editor SQL.
3. En `config.js`, cambia:

```js
window.APP_CONFIG = {
  mode: "supabase",
  supabase: {
    url: "https://TU_PROYECTO.supabase.co",
    anonKey: "TU_CLAVE_ANON_PUBLICA",
    table: "outfit_reservations",
    pollIntervalMs: 5000
  }
};
```

4. Usa únicamente la clave `anon` pública. Nunca introduzcas la `service_role` en una web estática.
5. Publica la carpeta en Vercel, Netlify, GitHub Pages o cualquier servidor estático.

### Seguridad de liberación

El esquema entregado no concede acceso directo a la tabla. La aplicación usa tres funciones RPC con `security definer`:

- `list_outfit_reservations`: devuelve únicamente estado, alias y fecha.
- `reserve_outfit`: crea la reserva y deja que la clave primaria bloquee duplicados concurrentes.
- `release_outfit`: elimina solo cuando el código coincide.

La clave `release_code` no aparece en las lecturas públicas. Revisa periódicamente las políticas, los registros y los límites de uso del proyecto antes de publicar.

## Arquitectura

- `app.js`: interfaz, filtros y diálogos.
- `storage.js`: adaptadores de persistencia desacoplados.
- `config.js`: selección de modo y credenciales públicas.
- `data/atuendos.json`: catálogo.
- `images/`: copia plana de imágenes.

## Accesibilidad y responsive

La interfaz incluye enlace de salto, etiquetas explícitas, estados anunciados, diálogos nativos, foco visible, botones de al menos 44 px, soporte para reducción de movimiento y rejillas adaptativas para escritorio y móvil.

Generado: 2026-06-15T15:45:56+02:00
