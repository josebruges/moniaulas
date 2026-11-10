# 🤖 Pruebas de MoniAulas: Agente Estudiante y Agente Monitor

MoniAulas se prueba con **agentes**: robots que usan la app como lo haría una persona real.
Se registran, inician sesión y trabajan en el dashboard. Hay dos agentes:

| Agente | Qué hace |
|---|---|
| 👨‍🎓 **Estudiante** | Se registra, cierra sesión y vuelve a entrar, reserva una monitoría, publica en el foro, resuelve el Quiz y abre los 3 candados del Escape Room. |
| 👨‍🏫 **Monitor** | Se registra, inicia sesión, publica un aula, sube un apunte al cuadernillo, publica en el foro y responde a un estudiante con el sello verificado. |

> 📚 **Material para clase (Administración de Empresas):**
> [Guía paso a paso (.md)](docs/GUIA-PASO-A-PASO.md) ·
> [Guía en PDF](docs/GUIA-PASO-A-PASO.pdf) ·
> [Presentación (.pptx)](docs/MoniAulas-Presentacion.pptx)

Hay **dos formas** de ejecutarlos:

1. **Desde el navegador (sin instalar nada):** abres una URL y ves al robot trabajar en vivo.
2. **Con Playwright (para desarrolladores):** desde VS Code o la terminal, con video, capturas y traza.

---

## 1. Probar desde el navegador (URLs públicas)

| Probar como… | URL |
|---|---|
| 👨‍🎓 Estudiante | <https://moniaulas.vercel.app/qa/estudiante> |
| 👨‍🏫 Monitor | <https://moniaulas.vercel.app/qa/monitor> |
| Índice de pruebas | <https://moniaulas.vercel.app/qa/> |

Al abrir la URL, la prueba **arranca sola**:

- **Panel izquierdo:** la lista de pasos. ⏳ = en curso, ✅ = superado, ❌ = falló (debajo aparece el motivo).
- **Panel derecho:** la app real. El robot resalta en **naranja** cada botón o campo antes de usarlo.
- **Arriba:** el resultado final, por ejemplo `✅ 6 pruebas superadas en 25.3s`.

### Opciones

| Opción | Cómo | Para qué |
|---|---|---|
| Velocidad | Selector *Velocidad* o `?velocidad=lenta`, `normal` o `rapida` | `lenta` para presentaciones, `rapida` para verificar rápido. |
| No iniciar solo | `?auto=0` | Abre la página y espera a que pulses **▶ Ejecutar**. |
| Volver a ejecutar | Botón **↻ Volver a ejecutar** | Repite toda la prueba con usuarios nuevos. Si *Conservar datos* está desmarcado, borra el `localStorage` y recarga la página desde cero con la velocidad elegida. |
| Conservar datos | Casilla *Conservar datos* | Deja guardados en tu navegador los usuarios y contenidos que creó el robot. |

> **¿Ensucia mis datos?** No. Antes de empezar, el robot respalda el `localStorage` y el
> `sessionStorage` de MoniAulas, trabaja sobre una base limpia y al terminar restaura todo.
> Si cierras la pestaña a mitad de la prueba, los datos se restauran la próxima vez que abras
> cualquiera de las dos URLs.
>
> Ejemplo para una demo: <https://moniaulas.vercel.app/qa/monitor?velocidad=lenta>

### Qué valida cada URL

**`/qa/estudiante`**

1. El registro rechaza contraseñas de menos de 4 caracteres.
2. Se registra como estudiante y entra con el rol **👨‍🎓 Estudiante**.
3. Cierra sesión y vuelve a iniciar sesión con su correo y contraseña.
4. Usa el dashboard:
   - Ve su banner, su XP y sus misiones.
   - **No** ve las acciones de monitor (publicar aula, etc.).
   - Reserva una monitoría. Primero confirma que la app exige escribir el tema y luego la ve en *Mis Aulas Agendadas*.
   - Publica una pregunta en el foro.
   - Resuelve el Quiz y guarda la nota.
   - En el Escape Room, comprueba que un valor incorrecto no abre el candado y luego abre los 3 candados (`75`, `24`, `12`).
   - Revisa *Mi cuenta*.
5. Su XP aumentó.

**`/qa/monitor`**

1. Se registra como monitor y entra con el rol **👨‍🏫 Monitor Verificado**.
2. No puede volver a registrarse con el mismo correo.
3. Inicia sesión con su cuenta.
4. Usa el dashboard:
   - Ve las *Acciones Docentes* y el aviso *Respondes con Sello Verificado* en el foro.
   - Publica un aula. Primero confirma que la app exige todos los campos y luego verifica la tarjeta con tema, cupos y su nombre.
   - Sube un apunte al cuadernillo.
   - Publica en el foro.
   - Revisa *Mi cuenta*.
5. Un estudiante pregunta en el foro y el monitor responde. La respuesta aparece con **✅ Monitor Verificado**.
6. Su XP aumentó.

---

## 2. Probar con Playwright (desarrolladores)

### Requisitos

```bash
npm install
npx playwright install chromium
```

### Comandos

| Comando | Qué hace |
|---|---|
| `npm test` | Ejecuta toda la suite sin abrir el navegador (*headless*). |
| `npm run test:estudiante` | Ejecuta las pruebas del **Agente Estudiante** con el navegador visible y en cámara lenta. |
| `npm run test:monitor` | Ejecuta las pruebas del **Agente Monitor** con el navegador visible y en cámara lenta. |
| `npm run test:headed` | Ejecuta todas las pruebas con el navegador visible. |
| `npm run test:ui` | Abre el modo UI de Playwright para ir paso a paso. |
| `npm run report` | Abre el reporte HTML con video, capturas y traza de cada prueba. |

> `test:estudiante` y `test:monitor` filtran por nombre, así que la prueba de interacción
> *Monitor ↔ Estudiante* aparece en ambos.

Para probar contra producción en lugar del servidor local:

```bash
BASE_URL=https://moniaulas.vercel.app npm run test:estudiante
BASE_URL=https://moniaulas.vercel.app npm run test:monitor
```

### Desde VS Code

1. Instala la extensión recomendada **Playwright Test for VS Code** (`ms-playwright.playwright`).
   VS Code la sugiere al abrir el proyecto.
2. Abre el panel **Testing** (ícono del matraz 🧪). Aparecen `registro.spec.js`, `dashboard.spec.js` y `qa-runner.spec.js`.
3. Activa **Show browser** para ver el navegador y pulsa ▶ junto a la prueba que quieras:
   - `Dashboard — Agente Estudiante`: prueba como estudiante.
   - `Dashboard — Agente Monitor`: prueba como monitor.
4. Otra opción: **Terminal → Run Task…** y elige
   *MoniAulas: Agente Estudiante*, *MoniAulas: Agente Monitor* u otra de las tareas de `.vscode/tasks.json`.

Cada acción del agente es un `test.step` con nombre, por ejemplo `[monitor] Publicar aula "…"`.
Por eso en el reporte y en la traza ves exactamente en qué paso falló algo.

---

## Estructura

```text
tests/
  agents/
    UsuarioAgent.js      # Agente base: registro, login, navegación, foro, cuenta
    EstudianteAgent.js   # Reservas, Quiz, Escape Room, permisos de estudiante
    MonitorAgent.js      # Publicar aula, subir apunte, permisos de monitor
  registro.spec.js       # Registro, login, correo duplicado, contraseña corta
  dashboard.spec.js      # Estudiante, Monitor e interacción entre ambos
  qa-runner.spec.js      # Verifica que /qa/estudiante y /qa/monitor terminen en verde
qa/
  agentes.js             # Los mismos agentes, versión navegador (se usan en las URLs públicas)
  estudiante.html        # → /qa/estudiante
  monitor.html           # → /qa/monitor
  index.html             # → /qa/
```

Si cambias un flujo de la app, actualiza **ambas** versiones del agente:
`tests/agents/*.js` (Playwright) y `qa/agentes.js` (navegador).
Las dos usan los mismos selectores y los mismos nombres de pasos.
