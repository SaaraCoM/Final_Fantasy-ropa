# Informe final — Dataset y selector de atuendos de Final Fantasy

## Resultado ejecutivo

La recopilación automatizada se **detuvo antes de rastrear la paginación y antes de descargar imágenes**. La decisión se tomó para respetar las restricciones solicitadas por el usuario: no eludir condiciones del sitio, no descargar contenido cuando la licencia lo prohíba o no esté determinada y no afirmar cobertura completa sin recorrer toda la paginación.

Las condiciones de uso de Fandom consultadas el 2026-06-15 prohíben expresamente el scraping, el uso de robots o aplicaciones de recuperación para extraer o indexar contenido y la explotación automatizada. La documentación de copyright de Fandom también indica que las imágenes no se publican automáticamente bajo CC BY-SA. Por tanto, no existe base suficiente para generar legalmente el ZIP de imágenes desde esa fuente sin autorización expresa y revisión de licencia por imagen.

## Métricas de recopilación

| Métrica | Resultado |
|---|---:|
| Páginas revisadas | 1 página inicial de categoría, solo para comprobar alcance y condiciones |
| Paginaciones recorridas | 0 |
| Subcategorías recorridas | 0 |
| Personajes únicos validados | 0 |
| Hombres validados | 0 |
| Mujeres validadas | 0 |
| Pendientes de revisión | 1 incidencia global de autorización/licencia |
| Atuendos | 0 |
| Imágenes descargadas | 0 |
| Imágenes descartadas tras descarga | 0 |

## Imágenes descartadas y motivos

No se descargaron imágenes; por tanto, no hubo descarte posterior por resolución, duplicidad, pose, fan art o composición. La fuente completa quedó excluida preventivamente por:

1. Prohibición contractual de scraping y robots de extracción/indexación.
2. Licencia de imágenes no determinada automáticamente.
3. Imposibilidad de verificar de forma masiva permisos de redistribución individual sin autorización adicional.

## Entregables generados

### `final_fantasy_atuendos.zip`

Contiene la estructura solicitada, manifiesto vacío válido (`[]`), CSV de fuentes, CSV de revisión manual y documentación. Las carpetas `hombre/` y `mujer/` no contienen imágenes de personajes.

### `selector_atuendos_web.zip`

Sitio estático funcional con:

- Diseño responsive de fantasía genérica.
- Filtros por género, juego, disponibilidad y búsqueda por personaje.
- Tarjetas con máscara roja y estado `OCUPADO`.
- Reserva con nombre/alias.
- Código de liberación.
- Adaptador local con `localStorage`.
- Adaptador preparado para Supabase.
- Esquema SQL y README de despliegue.
- Catálogo vacío y mensaje transparente hasta que se aporten imágenes autorizadas.

## Validaciones realizadas

- Estructura de carpetas y archivos.
- JSON válido.
- CSV con cabeceras esperadas.
- Ausencia de IDs repetidos en el catálogo entregado.
- Ausencia de referencias a archivos de imagen inexistentes.
- Pruebas de lógica de reserva, bloqueo, rechazo de segunda reserva y liberación mediante código con datos temporales de QA no incluidos en el dataset.
- Renderizado mediante Chromium real con datos temporales de QA inyectados solo durante la prueba.
- Escritorio validado a 1440 × 1000 px.
- Móvil validado a 390 × 844 px, sin desbordamiento horizontal.
- Resultados QA: 2 tarjetas renderizadas, búsqueda correcta, filtro de género correcto, filtro de disponibilidad correcto, código de 10 caracteres generado, máscara `OCUPADO` mostrada, doble selección bloqueada, código incorrecto rechazado y liberación correcta.

## Errores y limitaciones

- No se pudo cumplir la recopilación completa ni la descarga de imágenes sin contravenir las condiciones de uso de Fandom y la exigencia de licencia verificable.
- La aplicación no puede mostrar tarjetas reales hasta recibir un catálogo y archivos de imagen autorizados.
- El modo `localStorage` no comparte reservas entre dispositivos o navegadores.
- Para uso compartido real debe activarse Supabase y endurecer la liberación con la RPC documentada.

## Fuentes jurídicas y técnicas consultadas

- https://www.fandom.com/terms-of-use
- https://community.fandom.com/wiki/Copyright
- https://finalfantasy.fandom.com/es/wiki/Categor%C3%ADa:Personajes

## Fecha y hora de recopilación

2026-06-15T15:45:56+02:00 (Europe/Madrid)
