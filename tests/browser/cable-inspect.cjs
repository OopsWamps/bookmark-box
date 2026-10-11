// QA v4: replicate the page camera math, project every dark part + cable
// anchor to pixel coords, so screenshot blobs can be named precisely.
const path = require('path');
const fs = require('fs');
const { chromium } = require(path.join(process.env.PWDIR, 'playwright-core'));
(async () => {
  fs.mkdirSync('qa-shots', { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROME_EXE, headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1360, height: 880 } });
  page.on('pageerror', e => console.log('PAGE-ERR:', e.message));
  const url = 'file:///' + encodeURI(path.resolve('书签收纳盒-凸轮倾斜高级版.html').replace(/\\/g, '/'));
  await page.goto(url);
  await page.waitForTimeout(1800);
  await page.click('#cutaway');
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const canvas = document.querySelector('canvas.model-canvas');
    const r = canvas.getBoundingClientRect();
    const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
    const fire = (t, x, y) => canvas.dispatchEvent(new PointerEvent(t, { clientX: x, clientY: y, pointerId: 1, bubbles: true, cancelable: true }));
    fire('pointerdown', cx, cy);
    for (let i = 1; i <= 10; i++) fire('pointermove', cx - i * 4, cy + i * 2);
    fire('pointerup', cx - 40, cy + 20);
    for (let i = 0; i < 12; i++) canvas.dispatchEvent(new WheelEvent('wheel', { clientX: cx, clientY: cy, deltaY: -450, bubbles: true, cancelable: true }));
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const pr = document.getElementById('progress');
    pr.value = '36'; pr.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(700);
  const out = await page.evaluate(() => {
    const canvas = document.querySelector('canvas.model-canvas');
    const rect = canvas.getBoundingClientRect();
    // updateCamera math from scene.js: radius 850, focus 106 (advanced build),
    // azimuth .73 + .24 drag, elevation .60, zoom capped at 1.6, span 390.
    const az = .97, el = .60, radius = 850, focus = 106;
    const cam = new THREE.OrthographicCamera(-390 * rect.width / rect.height / 2, 390 * rect.width / rect.height / 2, 390 / 2, -390 / 2, 1, 2500);
    cam.position.set(Math.sin(az) * Math.cos(el) * radius, focus + Math.sin(el) * radius, Math.cos(az) * Math.cos(el) * radius);
    cam.up.set(0, 1, 0); cam.lookAt(0, focus, 0); cam.zoom = 1.6; cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
    const scene = window.advancedScene.liftGroup.parent;
    scene.updateMatrixWorld(true);
    const px = v => { const p = v.clone().project(cam); return [(p.x / 2 + .5) * rect.width + rect.left, (-p.y / 2 + .5) * rect.height + rect.top].map(n => +n.toFixed(0)); };
    const box = new THREE.Box3(), rows = [];
    const name = (label, o) => { box.setFromObject(o); rows.push({ label, world: box.getCenter(new THREE.Vector3()).toArray().map(v => +v.toFixed(1)), px: px(box.getCenter(new THREE.Vector3())) }); };
    scene.traverse(o => {
      if (!o.isMesh) return;
      const part = o.userData.partId, nm = o.name;
      const dark = o.material && o.material.color && ['181818', '303030', '575757'].includes(o.material.color.getHexString());
      if (nm === 'brake-disc' || nm === 'brake-armature') name(nm, o);
      else if (part === 'm2') name('m2-' + o.geometry.type + '-' + (o.material.color ? o.material.color.getHexString() : ''), o);
      else if (part === 'cableLift' && o.geometry.type === 'BoxGeometry') name('clamp-' + o.material.color.getHexString(), o);
      else if (part === 'cableLift' && o.geometry.type === 'TubeGeometry') name('tube-' + (o.name || 'fixed-run'), o);
      else if (nm === 'rear-bearing-plate') name('rearPlate', o);
    });
    return { canvas: [rect.left, rect.top, rect.width, rect.height], rows };
  });
  console.log(JSON.stringify(out, null, 1));
  await page.screenshot({ path: 'qa-shots/cable-v4-36.png' });
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
