const { test, expect } = require('@playwright/test');

// Verifica que las URLs públicas del robot QA (qa/estudiante y qa/monitor) terminen en verde.
for (const rol of ['estudiante', 'monitor']) {
  test(`Robot QA web: agente ${rol} termina sin fallos`, async ({ page }) => {
    await page.goto(`/qa/${rol}?velocidad=rapida`);
    await expect(page.locator('body')).toHaveAttribute('data-resultado', /ok|fail/, { timeout: 90_000 });
    await expect(page.locator('#qaStatus')).toHaveClass(/ok/);
    await expect(page.locator('.qa-step.fail')).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('moniaulas_qa_snapshot'))).toBeNull();
  });
}

test('Robot QA web: "Volver a ejecutar" sin conservar datos borra el localStorage y recarga con la velocidad elegida', async ({ page }) => {
  // Dato "real" del usuario que nunca debe perderse.
  await page.goto('/qa/');
  await page.evaluate(() => localStorage.setItem('dato_real_usuario', 'intacto'));

  await page.goto('/qa/estudiante');
  await expect(page.locator('body')).toHaveAttribute('data-resultado', 'ok', { timeout: 90_000 });
  const memoriaIframeAntes = await page.evaluate(() => document.getElementById('appFrame').contentWindow.name.length);
  expect(memoriaIframeAntes).toBeGreaterThan(0);

  await page.locator('#qaSpeed').selectOption('rapida');
  const recarga = page.waitForEvent('load');
  await page.locator('#qaRun').click();
  await recarga;

  await expect(page).toHaveURL(/velocidad=rapida/);
  await expect(page).not.toHaveURL(/reinicio=/);
  await expect(page.locator('#qaSpeed')).toHaveValue('rapida');
  await expect(page.locator('body')).toHaveAttribute('data-resultado', 'ok', { timeout: 90_000 });
  await expect(page.locator('.qa-step.fail')).toHaveCount(0);

  const final = await page.evaluate(() => ({
    dato: localStorage.getItem('dato_real_usuario'),
    snapshot: localStorage.getItem('moniaulas_qa_snapshot'),
  }));
  expect(final).toEqual({ dato: 'intacto', snapshot: null });
});
