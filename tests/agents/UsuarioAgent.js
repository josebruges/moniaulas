const { test, expect } = require('@playwright/test');

/**
 * Agente base: simula a un usuario real que interactúa con MoniAulas
 * (puerta de acceso + dashboard). Cada acción se registra como `test.step`
 * para que se vea paso a paso en VS Code / reporte HTML.
 */
class UsuarioAgent {
  /**
   * @param {import('@playwright/test').Page} page
   * @param {{ rol: 'estudiante' | 'monitor', nombre: string, email: string, carrera: string, password: string }} perfil
   */
  constructor(page, perfil) {
    this.page = page;
    this.perfil = perfil;
  }

  /** @template T @param {string} titulo @param {() => Promise<T>} fn */
  paso(titulo, fn) {
    return test.step(`[${this.perfil.rol}] ${titulo}`, fn);
  }

  // ---------- Puerta de acceso ----------
  async abrirApp() {
    await this.paso('Abrir MoniAulas', async () => {
      await this.page.goto('/');
      await expect(this.page.locator('#authGateModal')).toBeVisible();
    });
  }

  async irARegistro() {
    await this.paso('Ir a la pestaña de registro', async () => {
      await this.page.locator('#gateTabBtn-register').click();
      await expect(this.page.locator('#gateForm-register')).toBeVisible();
    });
  }

  async elegirRol() {
    await this.paso(`Elegir rol "${this.perfil.rol}"`, async () => {
      await this.page.locator(`#btnRegRole-${this.perfil.rol}`).click();
    });
  }

  async llenarFormulario() {
    const { nombre, email, carrera, password } = this.perfil;
    await this.paso(`Llenar formulario (${email})`, async () => {
      await this.page.locator('#regName').pressSequentially(nombre, { delay: 30 });
      await this.page.locator('#regEmail').pressSequentially(email, { delay: 30 });
      await this.page.locator('#regCareer').pressSequentially(carrera, { delay: 30 });
      await this.page.locator('#regPass').pressSequentially(password, { delay: 30 });
    });
  }

  async enviarRegistro() {
    await this.paso('Enviar registro', async () => {
      await this.page.locator('#gateForm-register button[type="submit"]').click();
    });
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
      await expect(this.page.locator('#authGateModal')).toBeHidden();
      await expect(this.page.locator('#activeUserNameText')).toHaveText(this.perfil.nombre);
      await expect(this.page.locator('#activeUserRoleBadge')).toHaveText(this.textoBadgeEsperado);
    });
  }

  async cerrarSesion() {
    await this.paso('Cerrar sesión', async () => {
      await this.page.getByTitle('Cerrar Sesión Segura').click();
      await expect(this.page.locator('#authGateModal')).toBeVisible();
    });
  }

  async iniciarSesion() {
    await this.paso(`Iniciar sesión (${this.perfil.email})`, async () => {
      await this.page.locator('#gateTabBtn-login').click();
      // La app precarga el último correo usado al cerrar sesión.
      await this.page.locator('#gateLoginEmail').clear();
      await this.page.locator('#gateLoginEmail').pressSequentially(this.perfil.email, { delay: 20 });
      await this.page.locator('#gateLoginPass').clear();
      await this.page.locator('#gateLoginPass').pressSequentially(this.perfil.password, { delay: 20 });
      await this.page.locator('#gateForm-login button[type="submit"]').click();
    });
  }

  // ---------- Dashboard ----------
  /** @param {'inicio'|'monitorias'|'cuadernillo'|'foro'|'retos'|'evidencias'|'cuenta'} seccion */
  async navegar(seccion) {
    await this.paso(`Navegar a "${seccion}"`, async () => {
      // La app usa menú lateral (PC) o barra inferior (móvil) según el viewport.
      const pc = this.page.locator(`#pcNav-${seccion}`);
      const boton = (await pc.isVisible()) ? pc : this.page.locator(`#mNav-${seccion}`);
      await boton.click();
      await expect(this.page.locator(`#view-${seccion}`)).toBeVisible();
    });
  }

  async leerXp() {
    const txt = await this.page.locator('#bannerXpNumber').innerText();
    return parseInt(txt, 10);
  }

  /** @param {string|RegExp} mensaje */
  async esperarToast(mensaje) {
    await expect(this.page.locator('#toastMessage')).toContainText(mensaje);
  }

  async verificarDashboard() {
    await this.paso('Verificar dashboard de inicio', async () => {
      await expect(this.page.locator('#view-inicio')).toBeVisible();
      await expect(this.page.locator('#bannerUserName')).toHaveText(this.perfil.nombre);
      await expect(this.page.locator('#bannerXpNumber')).toContainText('XP');
      await expect(this.page.locator('#missionsListContainer button').first()).toBeVisible();
    });
  }

  /** @param {string} pregunta */
  async publicarEnForo(pregunta, materia = 'Estadística') {
    await this.paso('Publicar pregunta en el foro', async () => {
      await this.navegar('foro');
      await this.page.locator('#newThreadSubject').selectOption(materia);
      await this.page.locator('#newThreadInput').pressSequentially(pregunta, { delay: 15 });
      await this.page.locator('#view-foro button[onclick="publishNewForumThread()"]').click();
      await this.esperarToast('Pregunta publicada en el Foro');
      await expect(this.page.locator('#forumThreadsList > div').first()).toContainText(pregunta);
    });
  }

  /** @param {string} textoHilo @param {string} respuesta */
  async responderEnForo(textoHilo, respuesta) {
    await this.paso('Responder un hilo del foro', async () => {
      await this.navegar('foro');
      const hilo = this.page.locator('#forumThreadsList > div', { hasText: textoHilo }).first();
      await hilo.locator('input[id^="repInp-"]').pressSequentially(respuesta, { delay: 15 });
      await hilo.getByRole('button', { name: 'Responder' }).click();
      await this.esperarToast('Respuesta publicada');
      await expect(
        this.page.locator('#forumThreadsList > div', { hasText: textoHilo }).first()
      ).toContainText(respuesta);
    });
  }

  async verificarCuenta() {
    await this.paso('Revisar "Mi cuenta"', async () => {
      await this.navegar('cuenta');
      await expect(this.page.locator('#accNameText')).toHaveText(this.perfil.nombre);
      await expect(this.page.locator('#accEmailText')).toContainText(this.perfil.email);
    });
  }

  /** @returns {string} */
  get textoBadgeEsperado() {
    throw new Error('Implementar en el agente concreto');
  }
}

const uid = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`;

module.exports = { UsuarioAgent, uid };
