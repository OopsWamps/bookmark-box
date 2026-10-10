async(mainPage)=>{
 const page=mainPage,checks=[],errors=[],check=(v,m)=>{if(!v)throw Error(m);checks.push(m);};
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.setViewportSize({width:1440,height:1080});
 await page.goto('http://127.0.0.1:8768/书签收纳盒-凸轮倾斜高级版.html',{waitUntil:'load'});
 await page.waitForFunction(()=>window.bookmarkDesignState&&window.advancedScene&&document.querySelectorAll('.part-callout').length===32);
 const frame=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 const state=()=>page.evaluate(()=>window.bookmarkDesignState);
 const scrub=async p=>{
  await page.locator('#progress').evaluate((e,v)=>{e.value=String(v*100);e.dispatchEvent(new Event('input',{bubbles:true}));},p);await frame();
 };
 const model=()=>page.evaluate(()=>{
  const q=window.bookmarkDesignState,a=window.advancedScene;
  a.tiltPivot.parent.updateMatrixWorld(true);
  const cam=a.camRollers.map((m,i)=>{const v=m.getWorldPosition(new THREE.Vector3());return {x:v.x,y:-v.z,z:v.y,expectedX:i===0?-132:132};});
  const bushes=a.liftGroup.children.filter(m=>Math.abs(m.position.x)===129&&m.position.y===30&&m.position.z===-40).map(m=>{const v=m.getWorldPosition(new THREE.Vector3());return {x:v.x,y:-v.z,z:v.y};});
  const nuts=a.liftGroup.children.filter(m=>Math.abs(m.position.x)===129&&m.position.y===35&&m.position.z===18).map(m=>{const v=m.localToWorld(new THREE.Vector3(0,0,5));return {x:v.x,y:-v.z,z:v.y};});
  return {cam,bushes,nuts,carriageRotation:a.liftGroup.quaternion.toArray(),pivot:a.tiltPivot.position.toArray(),tilt:a.tiltPivot.rotation.x,slot:Mechanism.advancedConstants,expected:Mechanism.camAtLift(q.lift)};
 });
 const geometry=async name=>{
  const q=await state(),m=await model(),near=(a,b)=>Math.abs(a-b)<1e-7;
  check(m.cam.length===2&&m.cam.every(c=>near(c.x,c.expectedX)&&near(c.y,m.expected.y)&&near(c.z,m.expected.z)),name+': mesh roller centres follow closed cam centreline');
  check(m.bushes.length===2&&m.bushes.every(b=>near(b.z,30+q.lift)&&near(b.y,40)),name+': guide bushes retain vertical motion');
  check(m.nuts.length===2&&m.nuts.every(n=>near(n.z,q.nutZ)&&near(n.y,-18)),name+': lead nuts retain screw alignment');
  check(m.carriageRotation.every((v,i)=>near(v,i===3?1:0)),name+': carriage does not tilt');
  check(near(m.tilt,q.tilt)&&near(m.pivot[1],100+q.lift),name+': separated tilt hinge follows analytic pose');
 };
 check(await page.locator('.model-canvas').count()===1,'one working WebGL canvas');
 check(await page.locator('.part-callout').count()===32,'32 numbered component callouts');
 check(await page.locator('.part-callout:visible').count()===9,'exterior shows nine relevant callouts');
 await geometry('closed');
 check((await state()).lift===0&&(await state()).tiltDegrees===0&&(await state()).retract===0,'closed state is flat and covered');
 await page.screenshot({path:'output/advanced-closed.png'});
 // Find the end of the 18 mm horizontal dwell by inversion of the independent progress map.
 const dwellProgress=await page.evaluate(()=>{let lo=0,hi=.36;for(let i=0;i<48;i++){const m=(lo+hi)/2;if(Mechanism.pose(m).lift<18)lo=m;else hi=m;}return (lo+hi)/2;});
 await scrub(dwellProgress);
 check(Math.abs((await state()).lift-18)<.1&&Math.abs((await state()).tiltDegrees)<1e-5,'slider nearest dwell point remains level at 18 mm lift');
 await geometry('dwell');
 await scrub(.27);check((await state()).tiltDegrees>0&&(await state()).tiltDegrees<20&&(await state()).retract===0,'lift and tilt occur together after dwell');await geometry('mid stroke');
 await page.locator('[data-state="1"]').click();await frame();
 const display=await state();check(display.progress===.36&&display.lift===60&&Math.abs(display.tiltDegrees-20)<1e-8&&display.retract===0,'36 percent reaches 60 mm and 20 degrees with cover closed');await geometry('display');
 await page.screenshot({path:'output/advanced-display.png'});
 await page.locator('[data-state="2"]').click();await frame();
 const open=await state();check(open.progress===1&&open.retract===184&&Math.abs(open.tiltDegrees-20)<1e-8&&open.skirtOverlap===42,'fully open preserves tilt and 42 mm sleeve overlap');await geometry('open');
 await page.screenshot({path:'output/advanced-open.png'});
 await page.locator('#cutaway').check();await frame();check((await state()).cutaway,'cutaway reveals mechanism');
 check(await page.locator('.part-callout:visible').count()===27,'cutaway shows 27 support and motion annotations');
 await page.locator('.part-callout[data-part="31"]').click();
 check((await page.locator('#partInfo').innerText()).includes('直线导向滑套'),'guide bushing has an independent component explanation');
 await page.locator('.part-callout[data-part="32"]').click();
 check((await page.locator('#partInfo').innerText()).includes('后导向连接臂')&&(await page.locator('#partInfo').innerText()).includes('12 × 12 × 6 mm'),'grey guide arm has a separate explanation and dimensions');
 await page.locator('.part-callout[data-part="25"]').click();check((await page.locator('#partInfo').innerText()).includes('主侧封闭凸轮槽'),'master cam callout reports closed groove');
 await page.locator('.part-callout[data-part="28"]').click();check((await page.locator('#partInfo').innerText()).includes('12.6 mm'),'backup cam callout reports clearanced groove');
 const s=await model();check(s.slot.masterSide===1&&s.slot.backupSide===-1&&s.slot.backupSlotWidth===12.6,'renderer and metadata locate right master and left backup');
 await page.screenshot({path:'output/advanced-cutaway.png'});
 await page.locator('#annotationGroup').selectOption('drive');check(await page.locator('.part-callout:visible').count()===6,'drive filter shows six components');
 await page.locator('#annotationGroup').selectOption('support');check(await page.locator('.part-callout:visible').count()===16,'support filter includes hinge, cams, pockets, guide bushing and its grey arm');
 await page.locator('.part-directory summary').click();await page.locator('.part-entry[data-part="30"]').click();
 check((await page.locator('#partInfo').innerText()).includes('52 × 152 × 4 mm'),'part directory selects retaining pockets');await page.locator('.part-directory summary').click();
 await page.locator('#labels').uncheck();check(await page.locator('.part-callout:visible').count()===0,'annotation master switch hides callouts');await page.locator('#labels').check();
 await page.locator('#obstacleBtn').click();const stopped=await state();check(stopped.obstacle&&!stopped.moving,'obstruction stops and blocks drive');
 await page.locator('#resetBtn').click();await scrub(.2);check((await state()).progress===stopped.progress,'obstruction blocks commands and timeline');
 await page.locator('#obstacleBtn').click();check(!(await state()).moving&&(await state()).restartRequired,'clear obstruction requires a new command');
 await page.locator('#serviceOpen').check();await page.locator('#resetBtn').click();check((await state()).progress===stopped.progress&&!(await state()).moving,'maintenance interlock blocks reset');
 await page.locator('#serviceOpen').uncheck();check(!(await state()).moving&&(await state()).restartRequired,'closing maintenance cover cannot auto restart');
 await page.locator('#resetBtn').click();await frame();check((await state()).progress===0,'fresh reset restores flat storage');await geometry('reset');
 // Continuous scrub validates world placement beyond the endpoint checks.
 for(let i=0;i<=12;i++){await scrub(i*.36/12);await geometry('sample '+i);}
 await scrub(.36);await page.locator('#annotationGroup').selectOption('support');
 for(const width of [390,320]){
  await page.setViewportSize({width,height:width===390?844:760});await frame();
  await page.waitForFunction(()=>{const h=document.getElementById('sceneHost').getBoundingClientRect(),a=[...document.querySelectorAll('.part-callout:not([hidden])')].map(e=>e.getBoundingClientRect());return a.every(b=>b.left>=h.left&&b.right<=h.right&&b.top>=h.top+45&&b.bottom<=h.bottom-45)&&!a.some((b,i)=>a.slice(i+1).some(c=>b.left<c.right&&b.right>c.left&&b.top<c.bottom&&b.bottom>c.top));},{timeout:5000});
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),width+' px page has no horizontal overflow');
  const boxes=await page.evaluate(()=>{const host=document.getElementById('sceneHost').getBoundingClientRect(),a=[...document.querySelectorAll('.part-callout:not([hidden])')].map(e=>e.getBoundingClientRect());return {inside:a.every(b=>b.left>=host.left&&b.right<=host.right&&b.top>=host.top+45&&b.bottom<=host.bottom-45),overlap:a.some((b,i)=>a.slice(i+1).some(c=>b.left<c.right&&b.right>c.left&&b.top<c.bottom&&b.bottom>c.top))};});
  check(boxes.inside&&!boxes.overlap,width+' px numbered labels remain readable without overlap');
  await page.locator('#annotationGroup').selectOption('view');
  await page.waitForFunction(()=>document.getElementById('sceneHost').classList.contains('dense-annotations'));
  await page.waitForFunction(()=>{const h=document.getElementById('sceneHost').getBoundingClientRect(),a=[...document.querySelectorAll('.part-callout:not([hidden])')].map(e=>e.getBoundingClientRect());return a.every(b=>b.top>=h.top+45&&b.bottom<=h.bottom-45)&&!a.some((b,i)=>a.slice(i+1).some(c=>b.left<c.right&&b.right>c.left&&b.top<c.bottom&&b.bottom>c.top));});
  check(await page.locator('.part-callout:visible').count()===27,width+' px dense cutaway retains all component callouts');
  check(await page.evaluate(()=>{const h=document.getElementById('sceneHost').getBoundingClientRect();return [...document.querySelectorAll('.part-callout:not([hidden])')].every(e=>{const b=e.getBoundingClientRect();return b.top>=h.top+45&&b.bottom<=h.bottom-45;});}),width+' px dense cutaway fits the expanded canvas');
  await page.screenshot({path:'output/advanced-mobile-'+width+'.png',fullPage:true});
  await page.locator('#annotationGroup').selectOption('support');
 }
 await page.setViewportSize({width:1440,height:1080});await page.locator('#annotationGroup').selectOption('view');await page.locator('#cutaway').uncheck();await scrub(.36);
 await page.locator('#viewSide').click();await frame();await page.screenshot({path:'output/advanced-side.png'});await page.locator('#viewIso').click();
 check(errors.length===0,'no browser runtime or console errors');
 return {status:'passed',count:checks.length,scope:'3D transforms, states, component labels, interlocks and mobile layouts',errors};
}
