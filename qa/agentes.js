/*
 * Robot QA de MoniAulas que corre en el navegador.
 * Replica los agentes Playwright (tests/agents/*) para poder ejecutarlos
 * desde una URL pública: carga la app en un iframe del mismo origen y la
 * maneja como lo haría un usuario real, registrando cada paso.
 */
(function () {
  'use strict';

  const SNAPSHOT_KEY = 'moniaulas_qa_snapshot';
  const VELOCIDADES = {
    lenta: { tecla: 45, pausa: 700 },
    normal: { tecla: 22, pausa: 350 },
    rapida: { tecla: 0, pausa: 60 },
  };

  const params = new URLSearchParams(location.search);
  const ROL = document.body.dataset.rol;
  let vel = VELOCIDADES[params.get('velocidad')] || VELOCIDADES.normal;

  const $ = (sel) => document.querySelector(sel);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const uid = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`;

  // ---------------------------------------------------------------
  // Respaldo del almacenamiento (la app comparte origen con el runner)
  // ---------------------------------------------------------------
  function volcar(storage) {
    const out = {};
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k !== SNAPSHOT_KEY) out[k] = storage.getItem(k);
    }
    return out;
  }

  /** Borra localStorage/sessionStorage dejando solo el respaldo de los datos reales del usuario. */
  function respaldarYLimpiar() {
    // Si ya existe un respaldo (p. ej. venimos de "Volver a ejecutar"), se conserva el original.
    const snap = localStorage.getItem(SNAPSHOT_KEY)
      || JSON.stringify({ local: volcar(localStorage), session: volcar(sessionStorage) });
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem(SNAPSHOT_KEY, snap);
  }

  function restaurar() {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return false;
    const snap = JSON.parse(raw);
    localStorage.clear();
    sessionStorage.clear();
    Object.entries(snap.local).forEach(([k, v]) => localStorage.setItem(k, v));
    Object.entries(snap.session).forEach(([k, v]) => sessionStorage.setItem(k, v));
    return true;
  }

  // ---------------------------------------------------------------
  // Bitácora visual de pasos
  // ---------------------------------------------------------------
  const lista = $('#qaSteps');
  let contador = { ok: 0, fail: 0 };
  let nivelActual = 0;

  function nuevoPaso(titulo, nivel) {
    const li = document.createElement('li');
    li.className = `qa-step nivel-${nivel} running`;
    li.innerHTML = '<span class="icono">⏳</span><span class="titulo"></span><span class="tiempo"></span>';
    li.querySelector('.titulo').textContent = titulo;
    lista.appendChild(li);
    li.scrollIntoView({ block: 'nearest' });
    return li;
  }

  async function paso(titulo, fn) {
    const li = nuevoPaso(titulo, nivelActual);
    const t0 = performance.now();
    nivelActual++;
    try {
      const r = await fn();
      li.classList.replace('running', 'ok');
      li.querySelector('.icono').textContent = '✅';
      if (nivelActual === 1) contador.ok++;
      return r;
    } catch (e) {
      li.classList.replace('running', 'fail');
      li.querySelector('.icono').textContent = '❌';
      if (!e.mostrado) {
        const err = document.createElement('div');
        err.className = 'error';
        err.textContent = e.message;
        li.appendChild(err);
        e.mostrado = true;
      }
      if (nivelActual === 1) contador.fail++;
      throw e;
    } finally {
      nivelActual--;
      li.querySelector('.tiempo').textContent = `${((performance.now() - t0) / 1000).toFixed(1)}s`;
    }
  }

  // ---------------------------------------------------------------
  // "Driver" mínimo sobre el iframe (equivalente a Playwright)
  // ---------------------------------------------------------------
  const frame = $('#appFrame');
  const doc = () => frame.contentDocument;
  const win = () => frame.contentWindow;

  function visible(el) {
    if (!el || !el.isConnected) return false;
    const st = win().getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'hidden') return false;
    return el.getClientRects().length > 0;
  }

  async function esperar(cond, descripcion, timeout = 6000) {
    const fin = Date.now() + timeout;
    while (Date.now() < fin) {
      try {
        const r = await cond();
        if (r) return r;
      } catch (_) { /* reintentar */ }
      await sleep(60);
    }
    throw new Error(`Tiempo agotado esperando: ${descripcion}`);
  }

  const q = (sel) => doc().querySelector(sel);
  const loc = (sel) => esperar(() => (visible(q(sel)) ? q(sel) : null), `${sel} visible`);

  function resaltar(el) {
    el.scrollIntoView({ block: 'center', behavior: 'instant' });
    const prev = el.style.outline;
    el.style.outline = '3px solid #f59e0b';
    el.style.outlineOffset = '2px';
    setTimeout(() => { el.style.outline = prev; }, Math.max(400, vel.pausa));
  }

  async function click(target) {
    const el = typeof target === 'string' ? await loc(target) : target;
    if (!el) throw new Error('Elemento a clicar no encontrado');
    resaltar(el);
    await sleep(vel.pausa / 2);
    el.click();
    await sleep(vel.pausa / 2);
  }

  async function escribir(sel, texto) {
    const el = await loc(sel);
    resaltar(el);
    el.focus();
    el.value = '';
    for (const ch of texto) {
      el.value += ch;
      el.dispatchEvent(new (win().Event)('input', { bubbles: true }));
      if (vel.tecla) await sleep(vel.tecla);
    }
    el.dispatchEvent(new (win().Event)('change', { bubbles: true }));
  }

  async function elegir(sel, valor) {
    const el = await loc(sel);
    resaltar(el);
    el.value = valor;
    el.dispatchEvent(new (win().Event)('change', { bubbles: true }));
    await sleep(vel.pausa / 3);
  }

  const texto = (sel) => (q(sel)?.textContent || '').trim();

  const expectVisible = (sel) => esperar(() => visible(q(sel)), `${sel} visible`);
  const expectOculto = (sel) => esperar(() => !visible(q(sel)), `${sel} oculto`);
  const expectTexto = (sel, esperado) =>
    esperar(() => texto(sel) === esperado, `${sel} = "${esperado}" (actual: "${texto(sel)}")`);
  const expectContiene = (sel, parcial) =>
    esperar(
      () => (parcial instanceof RegExp ? parcial.test(texto(sel)) : texto(sel).includes(parcial)),
      `${sel} contiene "${parcial}" (actual: "${texto(sel).slice(0, 80)}")`
    );

  const porTexto = (sel, contiene) =>
    [...doc().querySelectorAll(sel)].find((el) => el.textContent.includes(contiene));

  // ---------------------------------------------------------------
  // Agentes (misma API que tests/agents/*.js)
  // ---------------------------------------------------------------
  class UsuarioAgent {
    constructor(perfil) {
      this.perfil = perfil;
    }

    paso(titulo, fn) {
      return paso(`[${this.perfil.rol}] ${titulo}`, fn);
    }

    async abrirApp() {
      await this.paso('Abrir MoniAulas', async () => {
        await new Promise((resolve) => {
          frame.onload = resolve;
          frame.src = `/index.html?qa=${uid()}`;
        });
        await esperar(() => typeof win().navigateApp === 'function', 'app cargada');
        await expectVisible('#authGateModal');
      });
    }

    async irARegistro() {
      await this.paso('Ir a la pestaña de registro', async () => {
        await click('#gateTabBtn-register');
        await expectVisible('#gateForm-register');
      });
    }

    async elegirRol() {
      await this.paso(`Elegir rol "${this.perfil.rol}"`, () => click(`#btnRegRole-${this.perfil.rol}`));
    }

    async llenarFormulario() {
      const { nombre, email, carrera, password } = this.perfil;
      await this.paso(`Llenar formulario (${email})`, async () => {
        await escribir('#regName', nombre);
        await escribir('#regEmail', email);
        await escribir('#regCareer', carrera);
        await escribir('#regPass', password);
      });
    }

    async enviarRegistro() {
      await this.paso('Enviar registro', () => click('#gateForm-register button[type="submit"]'));
    }

    async registrarse() {
      await this.abrirApp();
      await this.irARegistro();
      await this.elegirRol();
      await this.llenarFormulario();
      await this.enviarRegistro();
    }

    async verificarSesionActiva() {
      await this.paso('Verificar sesión activa', async () => {
        await expectOculto('#authGateModal');
        await expectTexto('#activeUserNameText', this.perfil.nombre);
        await expectTexto('#activeUserRoleBadge', this.textoBadgeEsperado);
      });
    }

    async cerrarSesion() {
      await this.paso('Cerrar sesión', async () => {
        await click('[title="Cerrar Sesión Segura"]');
        await expectVisible('#authGateModal');
      });
    }

    async iniciarSesion() {
      await this.paso(`Iniciar sesión (${this.perfil.email})`, async () => {
        await click('#gateTabBtn-login');
        await escribir('#gateLoginEmail', this.perfil.email);
        await escribir('#gateLoginPass', this.perfil.password);
        await click('#gateForm-login button[type="submit"]');
      });
    }

    async navegar(seccion) {
      await this.paso(`Navegar a "${seccion}"`, async () => {
        const pc = q(`#pcNav-${seccion}`);
        await click(visible(pc) ? pc : `#mNav-${seccion}`);
        await expectVisible(`#view-${seccion}`);
      });
    }

    leerXp() {
      return parseInt(texto('#bannerXpNumber'), 10);
    }

    esperarToast(msg) {
      return expectContiene('#toastMessage', msg);
    }

    async verificarDashboard() {
      await this.paso('Verificar dashboard de inicio', async () => {
        await expectVisible('#view-inicio');
        await expectTexto('#bannerUserName', this.perfil.nombre);
        await expectContiene('#bannerXpNumber', 'XP');
        await expectVisible('#missionsListContainer button');
      });
    }

    async publicarEnForo(pregunta, materia = 'Estadística') {
      await this.paso('Publicar pregunta en el foro', async () => {
        await this.navegar('foro');
        await elegir('#newThreadSubject', materia);
        await escribir('#newThreadInput', pregunta);
        await click('#view-foro button[onclick="publishNewForumThread()"]');
        await this.esperarToast('Pregunta publicada en el Foro');
        await expectContiene('#forumThreadsList > div:first-child', pregunta);
      });
    }

    async responderEnForo(textoHilo, respuesta) {
      await this.paso('Responder un hilo del foro', async () => {
        await this.navegar('foro');
        const hilo = await esperar(() => porTexto('#forumThreadsList > div', textoHilo), `hilo "${textoHilo}"`);
        await escribir(`#${hilo.querySelector('input[id^="repInp-"]').id}`, respuesta);
        await click(hilo.querySelector('button[onclick^="replyThread"]'));
        await this.esperarToast('Respuesta publicada');
        await esperar(
          () => porTexto('#forumThreadsList > div', textoHilo)?.textContent.includes(respuesta),
          'respuesta visible en el hilo'
        );
      });
    }

    async verificarCuenta() {
      await this.paso('Revisar "Mi cuenta"', async () => {
        await this.navegar('cuenta');
        await expectTexto('#accNameText', this.perfil.nombre);
        await expectContiene('#accEmailText', this.perfil.email);
      });
    }
  }

  class EstudianteAgent extends UsuarioAgent {
    constructor(perfil = {}) {
      super({
        rol: 'estudiante',
        nombre: 'Laura Estudiante',
        email: `laura.est${uid()}@unimagdalena.edu.co`,
        carrera: 'Contaduría · V Semestre',
        password: 'clave1234',
        ...perfil,
      });
    }

    get textoBadgeEsperado() {
      return '👨‍🎓 Estudiante';
    }

    async verificarPermisosEstudiante() {
      await this.paso('Verificar que NO ve acciones de monitor', async () => {
        await expectOculto('#monitorFastActionsCard');
        await this.navegar('monitorias');
        await expectOculto('#btnPublishAulaHeader');
        await this.navegar('foro');
        await expectTexto('#forumRoleNotice', '👨‍🎓 Modo Participación Estudiantil');
      });
    }

    async reservarMonitoria({ tema, nota = 'Ejercicios de conciliación bancaria' } = {}) {
      await this.paso(`Reservar monitoría${tema ? ` "${tema}"` : ''}`, async () => {
        await this.navegar('monitorias');
        const buscar = () => (tema ? porTexto('#aulasGridList > div', tema) : q('#aulasGridList > div'));
        const tarjeta = await esperar(buscar, 'tarjeta de aula');
        await click(tarjeta.querySelector('button[onclick^="openReserveModal"]'));
        await expectVisible('#reserveModal');

        const confirmar = '#reserveModal button[onclick="confirmAulaBooking()"]';
        await click(confirmar);
        await this.esperarToast('Escribe el tema o ejercicio a reforzar');

        await escribir('#reserveTopicNote', nota);
        await click(confirmar);
        await expectOculto('#reserveModal');
        await this.esperarToast('Reserva confirmada');
        await esperar(() => buscar()?.querySelector('button[disabled]'), 'botón "Cupo Reservado"');
      });
    }

    async verificarReservaEnInicio(cantidad = 1) {
      await this.paso('Ver la reserva en "Mis Aulas Agendadas"', async () => {
        await this.navegar('inicio');
        await expectTexto('#kpiBookings', String(cantidad));
        await esperar(
          () => doc().querySelectorAll('#userBookedMonitoriasList > div').length === cantidad,
          `${cantidad} reserva(s) listadas`
        );
      });
    }

    async resolverQuiz() {
      await this.paso('Resolver el Quiz completo', async () => {
        await this.navegar('retos');
        await click('#btnChall-quiz');
        for (let i = 0; i < 20; i++) {
          await click('#qbtn-0');
          await expectVisible('#quizFeedbackBox');
          if (visible(q('#quizFinishBtn'))) break;
          await click('#quizNextBtn');
        }
        await click('#quizFinishBtn');
        await this.esperarToast(/Nota final .* guardada/);
      });
    }

    async resolverEscapeRoom() {
      await this.paso('Abrir los 3 candados del Escape Room', async () => {
        await this.navegar('retos');
        await click('#btnChall-escape');
        await expectVisible('#subView-escape');

        await escribir('#lockInput1', '10');
        await click('button[onclick="solveLock(1, 75)"]');
        await this.esperarToast('Cálculo incorrecto para el Candado #1');

        for (const [n, v] of [[1, 75], [2, 24], [3, 12]]) {
          await escribir(`#lockInput${n}`, String(v));
          await click(`button[onclick="solveLock(${n}, ${v})"]`);
        }
        await this.esperarToast('Bóveda Contable desbloqueada');
        await this.navegar('inicio');
        await expectTexto('#kpiEscape', '3/3');
      });
    }
  }

  class MonitorAgent extends UsuarioAgent {
    constructor(perfil = {}) {
      super({
        rol: 'monitor',
        nombre: 'Carlos Monitor',
        email: `carlos.mon${uid()}@unimagdalena.edu.co`,
        carrera: 'Economía · IX Semestre',
        password: 'monitor2026',
        ...perfil,
      });
    }

    get textoBadgeEsperado() {
      return '👨‍🏫 Monitor Verificado';
    }

    async verificarPermisosMonitor() {
      await this.paso('Verificar acciones rápidas de monitor', async () => {
        await expectVisible('#monitorFastActionsCard');
        await this.navegar('foro');
        await expectTexto('#forumRoleNotice', '✅ Respondes con Sello Verificado');
      });
    }

    async publicarAula({ tema, salon, materia = 'Estadística', turno = 'Tarde', cupos = 5, horario = 'Hoy 3:00 PM - 4:30 PM' }) {
      await this.paso(`Publicar aula "${tema}"`, async () => {
        await this.navegar('monitorias');
        await click('#btnPublishAulaHeader');
        await expectVisible('#publishAulaModal');

        const publicar = '#publishAulaModal button[onclick="saveNewAulaPublish()"]';
        await click(publicar);
        await this.esperarToast('Completa todos los campos del salón');

        await elegir('#paSubject', materia);
        await escribir('#paTopic', tema);
        await escribir('#paAula', salon);
        await elegir('#paShift', turno);
        await escribir('#paSpots', String(cupos));
        await escribir('#paHour', horario);
        await click(publicar);

        await expectOculto('#publishAulaModal');
        await this.esperarToast(`Salón ${salon} publicado por ${this.perfil.nombre}`);
        const primera = '#aulasGridList > div:first-child';
        await expectContiene(primera, tema);
        await expectContiene(primera, `${cupos} cupos`);
        await expectContiene(primera, this.perfil.nombre);
      });
    }

    async subirApunte({ titulo, contenido, materia = 'Costos y Presupuestos', formula = 'CT = CF + CV' }) {
      await this.paso(`Subir apunte "${titulo}" al cuadernillo`, async () => {
        await this.navegar('cuadernillo');
        await click('#btnUploadNoteHeader');
        await expectVisible('#uploadNoteModal');
        await elegir('#unSubject', materia);
        await escribir('#unTitle', titulo);
        await escribir('#unContent', contenido);
        await escribir('#unFormula', formula);
        await click('#uploadNoteModal button[onclick="saveNewNoteUpload()"]');
        await expectOculto('#uploadNoteModal');
        await this.esperarToast(`Apunte "${titulo}" publicado`);
        await expectContiene('#notesGridList', titulo);
      });
    }
  }

  // ---------------------------------------------------------------
  // Escenarios (equivalentes a tests/registro.spec.js + tests/dashboard.spec.js)
  // ---------------------------------------------------------------
  function assert(cond, msg) {
    if (!cond) throw new Error(msg);
  }

  const ESCENARIOS = {
    async estudiante() {
      const estudiante = new EstudianteAgent();

      await paso('Registro rechaza contraseña de menos de 4 caracteres', async () => {
        const corto = new EstudianteAgent({ password: '12' });
        await corto.registrarse();
        await expectContiene('#gateRegError', 'mínimo 4 caracteres');
        await expectVisible('#authGateModal');
      });

      await paso('Se registra como estudiante', async () => {
        await estudiante.registrarse();
        await estudiante.verificarSesionActiva();
        await expectTexto('#bannerRoleBadge', '👨‍🎓 Estudiante');
      });

      await paso('Cierra sesión y vuelve a iniciar sesión', async () => {
        await estudiante.cerrarSesion();
        await estudiante.iniciarSesion();
        await estudiante.verificarSesionActiva();
      });

      let xpInicial = 0;
      await paso('Usa el dashboard', async () => {
        await estudiante.verificarDashboard();
        xpInicial = estudiante.leerXp();
        await estudiante.verificarPermisosEstudiante();
        await estudiante.reservarMonitoria();
        await estudiante.verificarReservaEnInicio(1);
        await estudiante.publicarEnForo('¿Cómo se calcula la desviación estándar muestral?');
        await estudiante.resolverQuiz();
        await estudiante.resolverEscapeRoom();
        await estudiante.verificarCuenta();
      });

      await paso('Su XP aumentó tras usar el dashboard', async () => {
        await estudiante.navegar('inicio');
        const xp = estudiante.leerXp();
        assert(xp > xpInicial, `XP final (${xp}) debería ser mayor que la inicial (${xpInicial})`);
      });
    },

    async monitor() {
      const monitor = new MonitorAgent();

      await paso('Se registra como monitor', async () => {
        await monitor.registrarse();
        await monitor.verificarSesionActiva();
        await expectTexto('#bannerRoleBadge', '👨‍🏫 Monitor');
      });

      await paso('No puede registrar un correo duplicado', async () => {
        await monitor.cerrarSesion();
        await monitor.irARegistro();
        await monitor.elegirRol();
        await monitor.llenarFormulario();
        await monitor.enviarRegistro();
        await expectContiene('#gateRegError', 'Este correo ya está registrado');
      });

      await paso('Inicia sesión con su cuenta', async () => {
        await monitor.iniciarSesion();
        await monitor.verificarSesionActiva();
      });

      let xpInicial = 0;
      await paso('Usa el dashboard', async () => {
        await monitor.verificarDashboard();
        xpInicial = monitor.leerXp();
        await monitor.verificarPermisosMonitor();
        await monitor.publicarAula({ tema: 'Regresión lineal simple', salon: 'Bloque 4 - 203', cupos: 7 });
        await monitor.subirApunte({
          titulo: 'Punto de equilibrio',
          contenido: 'Es el nivel de ventas donde ingresos totales igualan costos totales.',
        });
        await monitor.publicarEnForo('Recordatorio: traigan calculadora a la monitoría de Estadística.');
        await monitor.verificarCuenta();
      });

      await paso('Responde con sello verificado a un estudiante', async () => {
        const pregunta = '¿Qué nivel de significancia usamos en el parcial?';
        const estudiante = new EstudianteAgent();
        await monitor.cerrarSesion();
        await estudiante.irARegistro();
        await estudiante.elegirRol();
        await estudiante.llenarFormulario();
        await estudiante.enviarRegistro();
        await estudiante.verificarSesionActiva();
        await estudiante.publicarEnForo(pregunta);
        await estudiante.cerrarSesion();

        await monitor.iniciarSesion();
        await monitor.verificarSesionActiva();
        await monitor.responderEnForo(pregunta, 'Usaremos α = 0.05 en todos los ejercicios.');
        await esperar(
          () => porTexto('#forumThreadsList > div', pregunta)?.textContent.includes('✅ Monitor Verificado'),
          'sello "Monitor Verificado" en la respuesta'
        );
      });

      await paso('Su XP aumentó tras usar el dashboard', async () => {
        await monitor.navegar('inicio');
        const xp = monitor.leerXp();
        assert(xp > xpInicial, `XP final (${xp}) debería ser mayor que la inicial (${xpInicial})`);
      });
    },
  };

  // ---------------------------------------------------------------
  // Orquestación
  // ---------------------------------------------------------------
  const btn = $('#qaRun');
  const estado = $('#qaStatus');
  const selVel = $('#qaSpeed');
  selVel.value = params.get('velocidad') in VELOCIDADES ? params.get('velocidad') : 'normal';
  selVel.addEventListener('change', () => { vel = VELOCIDADES[selVel.value]; });

  function setEstado(clase, msg) {
    estado.className = `estado ${clase}`;
    estado.textContent = msg;
  }

  async function ejecutar() {
    btn.disabled = true;
    lista.innerHTML = '';
    contador = { ok: 0, fail: 0 };
    setEstado('running', `Ejecutando agente ${ROL}…`);
    document.title = `⏳ QA ${ROL} — MoniAulas`;
    const t0 = performance.now();
    respaldarYLimpiar();
    try {
      await ESCENARIOS[ROL]();
      setEstado('ok', `✅ ${contador.ok} pruebas superadas en ${((performance.now() - t0) / 1000).toFixed(1)}s`);
      document.title = `✅ QA ${ROL} — MoniAulas`;
      document.body.dataset.resultado = 'ok';
    } catch (e) {
      setEstado('fail', `❌ ${contador.ok} superadas, 1 falló: ${e.message}`);
      document.title = `❌ QA ${ROL} — MoniAulas`;
      document.body.dataset.resultado = 'fail';
      console.error(e);
    } finally {
      if ($('#qaKeep').checked) localStorage.removeItem(SNAPSHOT_KEY);
      else restaurar();
      yaEjecuto = true;
      btn.disabled = false;
      btn.textContent = '↻ Volver a ejecutar';
    }
  }

  /**
   * "Volver a ejecutar" sin "Conservar datos": borra el localStorage y recarga la página
   * completa con la velocidad elegida. Recargar es necesario porque la app también guarda
   * su memoria en `window.name` del iframe, que sobrevive a recargar solo el iframe.
   */
  function reiniciarDesdeCero() {
    btn.disabled = true;
    setEstado('running', 'Borrando datos y recargando…');
    respaldarYLimpiar();
    const url = new URL(location.href);
    url.searchParams.set('velocidad', selVel.value);
    url.searchParams.set('reinicio', '1');
    url.searchParams.delete('auto');
    location.replace(url.toString());
  }

  let yaEjecuto = false;
  btn.addEventListener('click', () => {
    if (yaEjecuto && !$('#qaKeep').checked) reiniciarDesdeCero();
    else ejecutar();
  });

  if (params.get('reinicio') === '1') {
    // Venimos de "Volver a ejecutar": el almacenamiento ya está limpio y el respaldo intacto.
    // Se quita la marca de la URL para que un F5 posterior restaure los datos con normalidad.
    const url = new URL(location.href);
    url.searchParams.delete('reinicio');
    history.replaceState(null, '', url.toString());
    ejecutar();
  } else {
    // Si una corrida anterior se interrumpió, devolver los datos reales del usuario.
    restaurar();
    if (params.get('auto') !== '0') ejecutar();
  }
})();
