const { expect } = require('@playwright/test');
const { UsuarioAgent, uid } = require('./UsuarioAgent');

class MonitorAgent extends UsuarioAgent {
  /** @param {import('@playwright/test').Page} page */
  constructor(page, perfil = {}) {
    const id = uid();
    super(page, {
      rol: 'monitor',
      nombre: 'Carlos Monitor',
      email: `carlos.mon${id}@unimagdalena.edu.co`,
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
      await expect(this.page.locator('#monitorFastActionsCard')).toBeVisible();
      await this.navegar('foro');
      await expect(this.page.locator('#forumRoleNotice')).toHaveText('✅ Respondes con Sello Verificado');
    });
  }

  /**
   * @param {{ tema: string, salon: string, materia?: string, turno?: 'Mañana'|'Tarde'|'Noche', cupos?: number, horario?: string }} aula
   */
  async publicarAula({ tema, salon, materia = 'Estadística', turno = 'Tarde', cupos = 5, horario = 'Hoy 3:00 PM - 4:30 PM' }) {
    await this.paso(`Publicar aula "${tema}"`, async () => {
      await this.navegar('monitorias');
      await this.page.locator('#btnPublishAulaHeader').click();
      await expect(this.page.locator('#publishAulaModal')).toBeVisible();

      // Validación: campos obligatorios
      await this.page.locator('#publishAulaModal').getByRole('button', { name: 'Publicar Aula' }).click();
      await this.esperarToast('Completa todos los campos del salón');

      await this.page.locator('#paSubject').selectOption(materia);
      await this.page.locator('#paTopic').pressSequentially(tema, { delay: 15 });
      await this.page.locator('#paAula').pressSequentially(salon, { delay: 15 });
      await this.page.locator('#paShift').selectOption(turno);
      await this.page.locator('#paSpots').fill(String(cupos));
      await this.page.locator('#paHour').pressSequentially(horario, { delay: 10 });
      await this.page.locator('#publishAulaModal').getByRole('button', { name: 'Publicar Aula' }).click();

      await expect(this.page.locator('#publishAulaModal')).toBeHidden();
      await this.esperarToast(`Salón ${salon} publicado por ${this.perfil.nombre}`);
      const tarjeta = this.page.locator('#aulasGridList > div').first();
      await expect(tarjeta).toContainText(tema);
      await expect(tarjeta).toContainText(`${cupos} cupos`);
      await expect(tarjeta).toContainText(this.perfil.nombre);
    });
  }

  /** @param {{ titulo: string, contenido: string, materia?: string, formula?: string }} apunte */
  async subirApunte({ titulo, contenido, materia = 'Costos y Presupuestos', formula = 'CT = CF + CV' }) {
    await this.paso(`Subir apunte "${titulo}" al cuadernillo`, async () => {
      await this.navegar('cuadernillo');
      await this.page.locator('#btnUploadNoteHeader').click();
      await expect(this.page.locator('#uploadNoteModal')).toBeVisible();
      await this.page.locator('#unSubject').selectOption(materia);
      await this.page.locator('#unTitle').pressSequentially(titulo, { delay: 15 });
      await this.page.locator('#unContent').pressSequentially(contenido, { delay: 5 });
      await this.page.locator('#unFormula').fill(formula);
      await this.page.locator('#uploadNoteModal').getByRole('button', { name: 'Guardar en Cuadernillo' }).click();
      await expect(this.page.locator('#uploadNoteModal')).toBeHidden();
      await this.esperarToast(`Apunte "${titulo}" publicado`);
      await expect(this.page.locator('#notesGridList')).toContainText(titulo);
    });
  }
}

module.exports = { MonitorAgent };
