const fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
let html=read('ui-template.html');
const base=read('build.cjs');
const css=base.match(/const supplementalCss=`([\s\S]*?)`;/)[1];
function insert(marker,value){if(html.split(marker).length!==2)throw Error('Marker '+marker);html=html.replace(marker,()=>value);}
html=html.replace(/<title>[^<]*<\/title>/,'<title>拾页 · 凸轮倾斜高级版</title>')
 .replace('一盒收纳，四列呈现。紧凑封装，让取用更从容。','一盒收纳，四列呈现。抬升联动倾斜，让理念更易看见。')
 .replaceAll('升起展示','倾斜展示')
 .replace('升起 60 mm','抬升并倾斜 20°')
 .replace('选择一个状态，观察升起与卷收。','选择一个状态，观察抬升、倾斜与卷收。')
 .replace('<dt>卷筒直径</dt><dd><span id="angleValue">28</span><small>mm</small>','<dt>展示倾角</dt><dd><span id="angleValue">0</span><small>°</small>')
 .replace('剖面用于检查支承、运动与裙罩搭接；几何检查不等于安全认证。','主槽滚轮把升程转换为倾角；整组卷盖随托盘倾斜。剖视与数值检查用于结构评审。');
insert('</style>',css+read('annotations.css')+'#sceneHost.dense-annotations{min-height:460px}\n'+'</style>');
// Lift-safety demo (D5-2): a third interlock button drops the pawls and blocks
// every motion source until it is released, mirroring the obstacle/service gates.
html=html.replace('<button type="button" id="obstacleBtn" aria-pressed="false">模拟遮挡</button>',
 '<button type="button" id="obstacleBtn" aria-pressed="false">模拟遮挡</button><button type="button" id="powerLossBtn" aria-pressed="false">模拟失电锁定</button>');
html=html.replace('<p class="safety-note">信号触发即停；解除后需重新选择动作。此处为控制逻辑演示。</p>',
 '<p class="safety-note">信号触发即停；失电时棘爪落入棘条保持位置，检修支撑随维护盖翻出。此处为控制逻辑演示，不代表实物保持与防坠性能。</p>');
insert('<!-- DIMENSIONS -->','<span class="height-comparison">300 × 222 × 110 mm</span><span class="dimension-detail">凸轮倾斜高级版 · 四列 50 × 150 mm 书签<br>60 mm 抬升 · 20° 展示 · 柔性卷盖</span>');
insert('<!-- ENGINEERING_DETAILS -->',`<h3>一个升降输入，联动 20° 展示。</h3><p>右侧封闭凸轮槽与轴承滚轮配合，前 18 mm 保持水平避开盒口，后 42 mm 抬升并逐渐倾斜。左侧余隙槽提供防翻落备份，两侧耳轴通过托盘底部框梁相连。</p><dl><div class="detail-row"><dt>定位收纳</dt><dd>四个 52 × 152 × 4 mm 凹槽，盲指槽与侧向软限位</dd></div><div class="detail-row"><dt>紧凑机构</dt><dd>65 mm 曲柄 · Ø10 滚轮 · 4 mm 窄带槽板</dd></div><div class="detail-row"><dt>连续封装</dt><dd>竖直套筒 + 倾斜护罩 + 连续浅褶柔性罩</dd></div></dl><p style="margin-top:18px">整组卷盖随托盘倾斜，保持膜路相对位置。到达展示位后，透明柔性盖卷收 <strong>184 mm</strong>，进入后侧 <strong>Ø36 mm</strong> 卷盒。复位先闭盖，再反向回平下降。</p><div class="material-line"><span>哑黑外壳</span><span>白色承托</span><span>透明 TPU</span></div><div class="limits">滚轮肩轴、槽壁接触应力、柔性罩折叠与儿童触达需要实物验证；页面联锁为交互演示。最大压力角约 46.5°，驱动力及寿命须按实际载荷校核。</div>`);
insert('    </main>',`<details class="technical-dossier"><summary>展开机构说明与尺寸校核<span>方案选择、支承连接、凹槽与儿童防护</span></summary><p><a href="书签收纳盒-紧凑防护版.html">查看基础版</a> · <a href="高级版-方案评审.html">查看方案评审</a></p>${read('advanced-engineering-details.html')}</details>\n    </main>`);
insert('<!-- THREE_LIBRARY -->','<!-- Three.js r160: '+read('assets/THREE-LICENSE.txt')+' -->\n<script>\n'+read('assets/three.min.js')+'\n</script>');
const low=read('lowbox-renderer.js'),buildStart=low.indexOf('function buildLowBox(){'),foundationEnd=low.indexOf('// Moving carriage, connected'),helperStart=low.indexOf('function xBearingPlate'),helperEnd=low.indexOf('function updateLowBox');
if([buildStart,foundationEnd,helperStart,helperEnd].some(n=>n<0))throw Error('Missing renderer split marker');
const renderer=low.slice(0,buildStart)+low.slice(helperStart,helperEnd).replace('function cableCurve(','function legacyCableCurve(')+low.slice(buildStart,foundationEnd)+'\n buildAdvancedParts();\n}\n'+read('advanced-renderer.js');
let scene=read('scene.js')
 .replace("const states=['平放收纳','升起展示','开盖取用'];","const states=['平放收纳','倾斜展示','开盖取用'];")
 .replace("const titles=['平放收纳','承托盘正在上升','升起展示','柔性盖正在弯折卷收','开盖取用'];","const titles=['平放收纳','抬升与倾斜联动','20° 倾斜展示','柔性盖正在弯折卷收','开盖取用'];")
 .replace('四列书签平放于 300 × 222 × 110 mm 紧凑盒体内。丝杠、皮带和卷簧由外壳与随动套筒包覆。','四列书签嵌入定位凹槽，前缘与右侧为基准，后端和左侧一体软肋保持位置。透明柔性膜平展覆盖。')
 .replace('M1 同步带驱动两根侧置丝杠，托盘和整组卷盖机构一起竖直上升。','前 18 mm 水平抬升，越过盒口；之后封闭槽滚轮驱动托盘渐倾。竖车架保持直线运动，卷盖随托盘倾斜。')
 .replace('承托盘上升 60 mm，透明膜保持展开。升降上位确认后才允许卷收开盖。','升程 60 mm、倾角 20°，透明膜保持展开。定位凹槽与软肋限制书签滑移；展示到位后才开盖。')
 .replace('184 mm 平面膜段已卷收，机构静止后取用。套筒与箱体仍搭接 42 mm；复位时先闭盖，再下降。','184 mm 膜段已卷收，托盘保持 20°，机构静止后取用。盲指槽辅助抬起书签；复位先闭盖，再回平下降。')
 .replace('x,99.5,12,material','x+1,95.5,13,material')
 .replace('face.position.set(x,101.1,12)','face.position.set(x+1,97.05,13)')
 .replace('const radius=850,focus=76','const radius=850,focus=106')
 .replace('roughness:.10,metalness:0,transparent:true,opacity:.17','roughness:.14,metalness:0,transparent:true,opacity:.38')
 .replace("q.rollDiameter.toFixed(1)","q.tiltDegrees.toFixed(1)")
 .replace('obstacle=false,serviceOpen=false,restartRequired=false;','obstacle=false,serviceOpen=false,restartRequired=false,powerLost=false;')
 .replaceAll('obstacle||serviceOpen','obstacle||serviceOpen||powerLost')
 .replace("serviceOpen?'维护盖未锁 · 驱动禁用':","powerLost?'失电锁定 · 棘爪落入棘条，运动保持禁止':serviceOpen?'维护盖未锁 · 驱动禁用':")
 .replace("$('obstacleBtn').textContent=obstacle?'解除遮挡':'模拟遮挡';$('obstacleBtn').setAttribute('aria-pressed',String(obstacle));",
 "$('obstacleBtn').textContent=obstacle?'解除遮挡':'模拟遮挡';$('obstacleBtn').setAttribute('aria-pressed',String(obstacle));$('powerLossBtn').textContent=powerLost?'恢复供电':'模拟失电锁定';$('powerLossBtn').setAttribute('aria-pressed',String(powerLost));")
 .replace("obstacle,serviceOpen,restartRequired};","obstacle,serviceOpen,restartRequired,powerLost};")
 .replace("$('serviceOpen').addEventListener('change',e=>{serviceOpen=e.target.checked;stopOnInterlock();});",
 "$('serviceOpen').addEventListener('change',e=>{serviceOpen=e.target.checked;stopOnInterlock();});\n$('powerLossBtn').addEventListener('click',()=>{powerLost=!powerLost;stopOnInterlock();});")
 .replace('/* ANNOTATION_SYSTEM */',()=>read('advanced-annotations.js'))
 .replace('/* MECHANISM_RENDERER */',()=>renderer);
insert('<!-- SCENE_SCRIPT -->','<script>\n'+read('advanced-kinematics.js')+'\n'+scene+'\n</script>');
insert('</head>','<link rel="icon" href="data:,">\n</head>');
html=html.replace(/^[ \t]+$/gm,'');
fs.writeFileSync('advanced-scene.generated.js',scene);
fs.writeFileSync('书签收纳盒-凸轮倾斜高级版.html',html);
console.log('Built standalone advanced HTML: '+Buffer.byteLength(html)+' bytes');
