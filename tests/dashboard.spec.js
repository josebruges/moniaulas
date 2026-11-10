const { test, expect } = require('@playwright/test');
const { EstudianteAgent } = require('./agents/EstudianteAgent');
const { MonitorAgent } = require('./agents/MonitorAgent');

test.describe('Dashboard — Agente Estudiante', () => {
  test('se registra, inicia sesión y usa el dashboard', async ({ page }) => {
    const estudiante = new EstudianteAgent(page);

    await estudiante.registrarse();
    await estudiante.verificarSesionActiva();
    await estudiante.cerrarSesion();
    await estudiante.iniciarSesion();
    await estudiante.verificarSesionActiva();

    await estudiante.verificarDashboard();
    const xpInicial = await estudiante.leerXp();
    await estudiante.verificarPermisosEstudiante();

    await estudiante.reservarMonitoria();
    await estudiante.verificarReservaEnInicio(1);
    await estudiante.publicarEnForo('¿Cómo se calcula la desviación estándar muestral?');
    await estudiante.resolverQuiz();
    await estudiante.resolverEscapeRoom();
    await estudiante.verificarCuenta();

    await estudiante.navegar('inicio');
    expect(await estudiante.leerXp()).toBeGreaterThan(xpInicial);
  });
});

test.describe('Dashboard — Agente Monitor', () => {
  test('se registra, inicia sesión y usa el dashboard', async ({ page }) => {
    const monitor = new MonitorAgent(page);

    await monitor.registrarse();
    await monitor.verificarSesionActiva();
    await monitor.cerrarSesion();
    await monitor.iniciarSesion();
    await monitor.verificarSesionActiva();

    await monitor.verificarDashboard();
    const xpInicial = await monitor.leerXp();
    await monitor.verificarPermisosMonitor();

    await monitor.publicarAula({ tema: 'Regresión lineal simple', salon: 'Bloque 4 - 203', cupos: 7 });
    await monitor.subirApunte({
      titulo: 'Punto de equilibrio',
      contenido: 'Es el nivel de ventas donde ingresos totales igualan costos totales.',
    });
    await monitor.publicarEnForo('Recordatorio: traigan calculadora a la monitoría de Estadística.');
    await monitor.verificarCuenta();

    await monitor.navegar('inicio');
    expect(await monitor.leerXp()).toBeGreaterThan(xpInicial);
  });
});

test.describe('Dashboard — Interacción Monitor ↔ Estudiante', () => {
  test('el monitor publica un aula y el estudiante la reserva y pregunta en el foro', async ({ page }) => {
    const monitor = new MonitorAgent(page);
    const estudiante = new EstudianteAgent(page);
    const tema = `Pruebas de hipótesis ${Date.now()}`;
    const pregunta = '¿Qué nivel de significancia usamos en el parcial?';

    await monitor.registrarse();
    await monitor.verificarSesionActiva();
    await monitor.publicarAula({ tema, salon: 'Bloque 2 - 101', cupos: 3 });
    await monitor.cerrarSesion();

    await estudiante.registrarse();
    await estudiante.verificarSesionActiva();
    await estudiante.reservarMonitoria({ tema, nota: 'Prueba t de Student' });
    await expect(page.locator('#aulasGridList > div', { hasText: tema })).toContainText('2 cupos');
    await estudiante.publicarEnForo(pregunta);
    await estudiante.cerrarSesion();

    await monitor.iniciarSesion();
    await monitor.verificarSesionActiva();
    await monitor.responderEnForo(pregunta, 'Usaremos α = 0.05 en todos los ejercicios.');
    await expect(
      page.locator('#forumThreadsList > div', { hasText: pregunta }).getByText('✅ Monitor Verificado')
    ).toBeVisible();
  });
});
