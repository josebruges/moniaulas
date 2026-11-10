const { expect } = require('@playwright/test');
const { UsuarioAgent, uid } = require('./UsuarioAgent');

class EstudianteAgent extends UsuarioAgent {
  /** @param {import('@playwright/test').Page} page */
  constructor(page, perfil = {}) {
    const id = uid();
    super(page, {
      rol: 'estudiante',
      nombre: 'Laura Estudiante',
      email: `laura.est${id}@unimagdalena.edu.co`,
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
      await expect(this.page.locator('#monitorFastActionsCard')).toBeHidden();
      await this.navegar('monitorias');
      await expect(this.page.locator('#btnPublishAulaHeader')).toBeHidden();
      await this.navegar('foro');
      await expect(this.page.locator('#forumRoleNotice')).toHaveText('👨‍🎓 Modo Participación Estudiantil');
    });
  }

  /**
   * Reserva un cupo en una monitoría. Si se indica `tema`, busca la tarjeta con ese texto.
   * @param {{ tema?: string, nota?: string }} [opts]
   */
  async reservarMonitoria({ tema, nota = 'Ejercicios de conciliación bancaria' } = {}) {
    await this.paso(`Reservar monitoría${tema ? ` "${tema}"` : ''}`, async () => {
      await this.navegar('monitorias');
      const tarjetas = this.page.locator('#aulasGridList > div');
      const tarjeta = tema ? tarjetas.filter({ hasText: tema }).first() : tarjetas.first();
      await tarjeta.getByRole('button', { name: /Reservar Cupo/ }).click();
      await expect(this.page.locator('#reserveModal')).toBeVisible();

      // Validación: no deja confirmar sin tema
      await this.page.locator('#reserveModal').getByRole('button', { name: 'Confirmar (2 Clics)' }).click();
      await this.esperarToast('Escribe el tema o ejercicio a reforzar');

      await this.page.locator('#reserveTopicNote').pressSequentially(nota, { delay: 15 });
      await this.page.locator('#reserveModal').getByRole('button', { name: 'Confirmar (2 Clics)' }).click();
      await expect(this.page.locator('#reserveModal')).toBeHidden();
      await this.esperarToast('Reserva confirmada');
      await expect(tarjeta.getByRole('button', { name: /Cupo Reservado/ })).toBeDisabled();
    });
  }

  async verificarReservaEnInicio(cantidad = 1) {
    await this.paso('Ver la reserva en "Mis Aulas Agendadas"', async () => {
      await this.navegar('inicio');
      await expect(this.page.locator('#kpiBookings')).toHaveText(String(cantidad));
      await expect(this.page.locator('#userBookedMonitoriasList > div')).toHaveCount(cantidad);
    });
  }

  async resolverQuiz() {
    await this.paso('Resolver el Quiz completo', async () => {
      await this.navegar('retos');
      await this.page.locator('#btnChall-quiz').click();
      const finalizar = this.page.locator('#quizFinishBtn');
      const siguiente = this.page.locator('#quizNextBtn');
      for (let i = 0; i < 20; i++) {
        await this.page.locator('#qbtn-0').click();
        await expect(this.page.locator('#quizFeedbackBox')).toBeVisible();
        if (await finalizar.isVisible()) break;
        await siguiente.click();
      }
      await finalizar.click();
      await this.esperarToast(/Nota final .* guardada/);
    });
  }

  async resolverEscapeRoom() {
    await this.paso('Abrir los 3 candados del Escape Room', async () => {
      await this.navegar('retos');
      await this.page.locator('#btnChall-escape').click();
      await expect(this.page.locator('#subView-escape')).toBeVisible();

      await this.page.locator('#lockInput1').fill('10');
      await this.page.locator('button[onclick="solveLock(1, 75)"]').click();
      await this.esperarToast('Cálculo incorrecto para el Candado #1');

      for (const [n, v] of [[1, 75], [2, 24], [3, 12]]) {
        await this.page.locator(`#lockInput${n}`).fill(String(v));
        await this.page.locator(`button[onclick="solveLock(${n}, ${v})"]`).click();
      }
      await this.esperarToast('Bóveda Contable desbloqueada');
      await this.navegar('inicio');
      await expect(this.page.locator('#kpiEscape')).toHaveText('3/3');
    });
  }
}

module.exports = { EstudianteAgent };
