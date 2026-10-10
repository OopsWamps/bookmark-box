const fs=require('node:fs');
let html=fs.readFileSync('ui-template.html','utf8');
const details=fs.readFileSync('engineering-details.html','utf8');
function insertOnce(marker, content) {
  const first=html.indexOf(marker);
  if(first===-1 || html.indexOf(marker,first+marker.length)!==-1) {
    throw new Error('Expected exactly one template marker: '+marker);
  }
  html=html.replace(marker,()=>content);
}
const supplementalCss=`
.model-tag{position:absolute;top:0;left:0;z-index:3;pointer-events:none;font-size:11px;color:#4f4f4f;background:rgba(255,255,255,.82);padding:5px 9px;border-radius:3px;white-space:nowrap;box-shadow:0 1px 8px #00000005}.model-tag:before{content:'';display:inline-block;width:4px;height:4px;border:1px solid #777;border-radius:50%;margin:0 7px 1px 0}.model-tag[hidden]{display:none}.model-canvas{cursor:grab}.webgl-warning{padding:110px 40px;color:#555;max-width:500px}.engineering{margin-bottom:0;padding-bottom:26px}.technical-dossier{margin-bottom:38px;border-top:1px solid #dedede;border-bottom:1px solid #dedede}.technical-dossier>summary{cursor:pointer;padding:21px 0;font-size:14px;font-weight:500}.technical-dossier>summary span{font-size:12px;font-weight:400;color:#777;margin-left:12px}.engineering-details{max-width:1050px;margin:0 auto;padding:20px 0 36px;font-size:13px;line-height:1.9}.engineering-details h2{font-family:var(--serif);font-weight:400;font-size:28px;margin-bottom:16px}.engineering-details h3{font-size:16px;margin:30px 0 12px}.engineering-details p{margin:12px 0;color:#555}.engineering-details table{border-collapse:collapse;width:100%;font-size:12px;margin:20px 0}.engineering-details td,.engineering-details th{border-bottom:1px solid #dedede;padding:11px 14px 11px 0;text-align:left}.engineering-details ul,.engineering-details ol{padding-left:22px;color:#555}.engineering-details li{margin-bottom:10px}.engineering-details a{text-underline-offset:3px}.material-line{display:flex;gap:20px;margin-top:15px;font-size:11px;color:#666}.material-line span::before{content:'';display:inline-block;width:10px;height:10px;margin:0 6px -1px 0;border:1px solid #ccc;background:#eee}.material-line span:first-child::before{background:#171717;border-color:#171717}.engineering-copy .clearance{font-size:24px;color:#111;margin-bottom:6px}.engineering-copy h3{margin-top:4px}.limits{font-size:11px;color:#777;margin-top:15px;line-height:1.8}.profile-figure{position:relative}.state-button{transition:border-color .2s}.technical-dossier summary:focus-visible{outline:2px solid #111;outline-offset:5px}@media(max-width:520px){.model-tag{font-size:9px;padding:4px 6px}.technical-dossier>summary span{display:block;margin-left:0;margin-top:5px}.engineering-details{font-size:12px}.engineering-details table{font-size:11px}.engineering-details th,.engineering-details td{padding-right:8px;overflow-wrap:anywhere}}
`;
insertOnce('</style>',supplementalCss+fs.readFileSync('annotations.css','utf8')+'</style>');
insertOnce('<!-- DIMENSIONS -->','<span class="height-comparison">盒身 300 × 222 × 110 mm <small>· 较低盒版体积再减6.59%</small></span><span class="dimension-detail">紧凑防护版 · 四列 50 × 150 mm 书签<br>60 mm 升降 · 全程封装传动</span>');
insertOnce('<!-- ENGINEERING_DETAILS -->',`<h3>收紧空间，补全支承，封住传动。</h3><p>保留四列书签与 60 mm 升降，将盒体收紧至 300 × 222 × 110 mm。底支架与固定侧脊板连接上下轴承，丝杠、导向轴和传动带均有明确的安装支承。</p><dl><div class="detail-row"><dt>紧凑布局</dt><dd>244 × 172 mm 托盘 · 254 mm 宽透明膜</dd></div><div class="detail-row"><dt>真实连接</dt><dd>上下轴承座 + 固定支架 + 闭环同步带</dd></div><div class="detail-row"><dt>机械封装</dt><dd>活动裙罩最小搭接 42 mm，侧带与后辊独立罩封</dd></div></dl><p style="margin-top:18px">柔性盖开盖行程 <strong>184 mm</strong>，仍卷入直径 <strong>36 mm</strong> 的后侧卷盒。儿童取用区域与内部传动隔开；成人操作升降，维护盖联锁和遮挡信号可在上方模拟。</p><div class="material-line"><span>哑黑外壳</span><span>白色承托</span><span>透明 TPU</span></div><div class="limits">几何校核与联锁动画用于方案评审，不代表安全认证。实物需验证夹点防护、停机响应及材料耐久性。书签理念文案为可替换示例。</div>`);
insertOnce('    </main>',`<details class="technical-dossier"><summary>展开机构说明与尺寸校核<span>连接关系、动作联锁、驱动估算和资料来源</span></summary>${details}</details>\n    </main>`);
insertOnce('<!-- THREE_LIBRARY -->','<script>\n'+fs.readFileSync('assets/three.min.js','utf8')+'\n</script>');
const sceneSource=fs.readFileSync('scene.js','utf8');
const rendererMarker='/* MECHANISM_RENDERER */';
if(sceneSource.indexOf(rendererMarker)===-1 || sceneSource.indexOf(rendererMarker)!==sceneSource.lastIndexOf(rendererMarker)) {
  throw new Error('Expected exactly one renderer marker in scene.js');
}
const sceneScript=sceneSource.replace(rendererMarker,()=>fs.readFileSync('lowbox-renderer.js','utf8')).replace('/* ANNOTATION_SYSTEM */',()=>fs.readFileSync('annotations.js','utf8'));
insertOnce('<!-- SCENE_SCRIPT -->','<script>\n'+fs.readFileSync('kinematics.js','utf8')+'\n'+sceneScript+'\n</script>');
insertOnce('</head>','<link rel="icon" href="data:,">\n</head>');
for(const filename of ['书签收纳盒.html','index.html','书签收纳盒-紧凑防护版.html']) {
  fs.writeFileSync(filename,html);
}
console.log('Built standalone HTML (offline, embedded Three.js): '+Buffer.byteLength(html)+' bytes');
