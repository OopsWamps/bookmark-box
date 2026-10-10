async page=>{
 const offlineUrl=__STANDALONE_FILE_URL__;
 const errors=[],checks=[];page.on('pageerror',e=>errors.push(String(e)));
 const check=(v,m)=>{if(!v)throw Error(m);checks.push(m);};
 await page.emulateMedia({reducedMotion:'no-preference'});await page.setViewportSize({width:1440,height:1080});
 await page.goto('http://127.0.0.1:8768/书签收纳盒-凸轮倾斜高级版.html');
 await page.waitForFunction(()=>window.bookmarkDesignState);await page.locator('#speed').selectOption('2');
 await page.locator('#playBtn').click();await page.waitForFunction(()=>window.bookmarkDesignState.progress>.12);
 await page.locator('#pauseBtn').click();const a=await page.evaluate(()=>window.bookmarkDesignState);
 await page.waitForFunction(()=>!window.bookmarkDesignState.moving);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 check((await page.evaluate(()=>window.bookmarkDesignState.progress))===a.progress,'pause holds full 3D pose');
 await page.locator('#pauseBtn').click();await page.waitForFunction(()=>window.bookmarkDesignState.progress>.36&&window.bookmarkDesignState.retract>0);
 check(await page.evaluate(()=>window.bookmarkDesignState.lift===60&&Math.abs(window.bookmarkDesignState.tiltDegrees-20)<1e-8),'opening begins after full lift and tilt');
 await page.waitForFunction(()=>window.bookmarkDesignState.progress===1&&!window.bookmarkDesignState.moving,{timeout:20000});
 await page.locator('#resetBtn').click();await page.waitForFunction(()=>window.bookmarkDesignState.progress<.36);
 check(await page.evaluate(()=>window.bookmarkDesignState.retract===0),'reverse closes film before lowering and returning level');
 await page.waitForFunction(()=>window.bookmarkDesignState.progress===0&&!window.bookmarkDesignState.moving,{timeout:20000});
 check(await page.evaluate(()=>window.bookmarkDesignState.tiltDegrees===0&&window.bookmarkDesignState.lift===0),'reverse animation reaches flat storage');
 await page.locator('[data-state="2"]').click();await page.waitForFunction(()=>window.bookmarkDesignState.progress>.08);
 await page.locator('#obstacleBtn').click();const b=await page.evaluate(()=>window.bookmarkDesignState.progress);
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 check(await page.evaluate(v=>!window.bookmarkDesignState.moving&&window.bookmarkDesignState.progress===v,b),'moving interlock stops actual animation');
 await page.locator('#obstacleBtn').click();check(await page.evaluate(()=>!window.bookmarkDesignState.moving&&window.bookmarkDesignState.restartRequired),'clearing signal cannot restart animation');
 await page.locator('#resetBtn').click();await page.waitForFunction(()=>window.bookmarkDesignState.progress===0&&!window.bookmarkDesignState.moving);
 check(errors.length===0,'motion animation has no runtime errors');
 // Verify packaged standalone document works without a server or network library.
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto(offlineUrl);await page.waitForFunction(()=>window.advancedScene);
 await page.locator('[data-state="1"]').click();check(await page.evaluate(()=>Math.abs(window.bookmarkDesignState.tiltDegrees-20)<1e-8),'offline HTML runs with embedded 3D library');
 await page.locator('#labels').uncheck();await page.screenshot({path:'output/高级版-最终展示.png'});
 return {status:'passed',checks,errors};
}
