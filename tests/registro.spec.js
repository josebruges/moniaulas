const { test, expect } = require('@playwright/test');
const { EstudianteAgent } = require('./agents/EstudianteAgent');
const { MonitorAgent } = require('./agents/MonitorAgent');

test.describe('Registro de usuarios', () => {
  test('Agente Estudiante se registra y entra a la plataforma', async ({ page }) => {
    const estudiante = new EstudianteAgent(page);
    await estudiante.registrarse();
    await estudiante.verificarSesionActiva();
    await expect(page.locator('#bannerRoleBadge')).toHaveText('👨‍🎓 Estudiante');
  });

  test('Agente Monitor se registra y entra a la plataforma', async ({ page }) => {
    const monitor = new MonitorAgent(page);
    await monitor.registrarse();
    await monitor.verificarSesionActiva();
    await expect(page.locator('#bannerRoleBadge')).toHaveText('👨‍🏫 Monitor');
  });

  test('Agente Estudiante cierra sesión y vuelve a ingresar', async ({ page }) => {
    const estudiante = new EstudianteAgent(page);
    await estudiante.registrarse();
    await estudiante.verificarSesionActiva();
    await estudiante.cerrarSesion();
    await estudiante.iniciarSesion();
    await estudiante.verificarSesionActiva();
  });

  test('Agente Monitor no puede registrar un correo duplicado', async ({ page }) => {
    const monitor = new MonitorAgent(page);
    await monitor.registrarse();
    await monitor.verificarSesionActiva();
    await monitor.cerrarSesion();

    await monitor.irARegistro();
    await monitor.elegirRol();
    await monitor.llenarFormulario();
    await monitor.enviarRegistro();
    await expect(page.locator('#gateRegError')).toContainText('Este correo ya está registrado');
  });

  test('Registro rechaza contraseña de menos de 4 caracteres', async ({ page }) => {
    const estudiante = new EstudianteAgent(page, { password: '12' });
    await estudiante.registrarse();
    await expect(page.locator('#gateRegError')).toContainText('mínimo 4 caracteres');
    await expect(page.locator('#authGateModal')).toBeVisible();
  });
});
