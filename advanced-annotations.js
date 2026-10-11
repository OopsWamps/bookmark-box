let selectedPart=null,annotationSvg,searchQuery='';
// Focus/dim: selecting a callout keeps its own meshes readable and blurs the
// rest. Mesh membership is decided geometrically from the callout's anchor
// point (bbox containment, nearest-cluster fallback) because the part specs
// carry points, not mesh references.
const dimCache=new Map(),selCache=new Map();
function dimMat(base){
 if(!dimCache.has(base)){const m=base.clone();m.transparent=true;m.opacity=Math.min(base.opacity??1,.13);m.depthWrite=false;dimCache.set(base,m);}
 return dimCache.get(base);
}
function selMat(base){
 if(!selCache.has(base)){const m=base.clone();if(m.emissive)m.emissive=new THREE.Color(0x232323);selCache.set(base,m);}
 return selCache.get(base);
}
function focusMeshes(t){
 // Exact part membership: the renderer tags every mesh with userData.partId
 // while building, so a callout selects precisely its own construction group.
 if(!t||!t.partKey)return null;
 const keep=[];
 scene.traverse(o=>{if(o.isMesh&&o.userData.partId===t.partKey)keep.push(o);});
 return keep.length?keep:null;
}
function applyFocus(t){
 const keep=t?focusMeshes(t):null;
 scene.traverse(o=>{
  if(!o.isMesh)return;
  if(!o.userData._origMat)o.userData._origMat=o.material;
  const base=o.userData._origMat;
  o.material=!keep?base:keep.includes(o)?selMat(base):dimMat(base);
 });
}
function partPoint(x,y,z,motion='fixed'){
 return ()=>{
  const q=pose(p);
  if(motion==='tilt'){
   const a=Mechanism.transformPoint(x,y,z,q);
   return new THREE.Vector3(a.x,a.z,-a.y);
  }
  return new THREE.Vector3(x,z+(motion==='carriage'?q.lift:0),-y);
 };
}
function tiltPartPoint(x,y,z){return partPoint(x,y,z,'tilt');}
function buildPartAnnotations(){
 const specs=[
 ['透明柔性膜','cover','always',()=>{const q=pose(p),a=q.retract>183?Mechanism.transformPoint(0,88,66,q):Mechanism.transformPoint(65,(q.frontY+92)/2,106,q);return new THREE.Vector3(a.x,a.z,-a.y);},'0.30 mm TPU 膜，与承托盒和卷盖机构一起倾斜；打开后经后导辊进入卷盒。演示中降低透明度，使膜面与书签更容易区分；显示效果不代表膜材实测透光率。', 'film'],
 ['四列凹槽承托盒','support','always',tiltPartPoint(-117,-30,98),'244 × 172 mm 承托盒；四个 52 × 152 × 4 mm 定位槽容纳 50 × 150 mm 书签。前侧和右侧为定位基准，后端与左侧一体软肋轻预压；2 mm 连续槽底下有五条纵筋及横梁。', 'tray'],
 ['哑黑箱体','guard','outer',partPoint(70,-111,52),'300 × 222 × 110 mm 固定外壳连接底板，包围底部传动、竖直导向与封闭凸轮槽。', 'shell'],
 ['竖直升降套筒','guard','outer',partPoint(145.8,0,76,'carriage'),'仅随车架竖直平移，保持与固定箱体搭接；上缘降低至 Z80＋升程，为倾斜模块留出运动空间。', 'movingShell'],
 ['两侧倾斜传动护罩','guard','outer',tiltPartPoint(136,15,110),'与承托盒一起倾斜，封闭同步带、齿轮和轴端；上层护罩与下层竖裙罩由连续柔性罩衔接。', 'hoodSide'],
 ['后导辊护罩','guard','outer',tiltPartPoint(-60,93,110),'与倾斜模块连接，包围导辊入口和收卷区域；后下缘通过成形斜接法兰从局部 Y100、Z80 接至 Y106.5、Z84，再接入后壁，隔开导辊与柔性罩。入口设软唇，实际触达和夹持风险仍需实物测试。', 'hoodRear'],
 ['牵引横梁与软边','cover','always',()=>{const q=pose(p),a=Mechanism.transformPoint(50,q.frontY,107.2,q);return new THREE.Vector3(a.x,a.z,-a.y);},'两端同步牵引透明膜，局部行程 184 mm；升降与倾斜到位后才开盖，前缘采用柔性包边。', 'pullBarBeam'],
 ['承力底板','support','inside',partPoint(-70,-70,6),'6 mm 固定底板连接侧脊板、升降支座、电机桥架和凸轮槽板底脚，构成完整承力基础。', 'floorPlate'],
 ['升降梯形丝杠','support','inside',partPoint(-129,-18,62),'两侧丝杠只旋转，螺母保持竖直运动；有效螺纹 Z22…98，升程 60 mm。倾斜侧向载荷由导向和车架承担。', 'screw'],
 ['下固定轴承座','support','inside',partPoint(-129,-18,18),'通过桥脚与侧脊板连接底板，下方留出带轮通道；下端承担轴向定位，不悬空。', 'screwLowerBearing'],
 ['上游动支承座','support','inside',partPoint(-129,-18,102),'连接固定侧脊板，提供径向支承并保留轴向游动；丝杠轴颈贯通座孔。', 'screwUpperBearing'],
 ['后侧直线导杆','support','inside',partPoint(-129,40,65),'固定导杆位于 Y40，上下夹持座连接固定支承。31号滑套沿杆升降，引导车架并承受侧向载荷；一侧采用允许微量浮动的导向配合以避免过约束。导杆自身不升降。', 'guideRod'],
 ['固定侧脊板','support','inside',partPoint(137.5,15,66),'固定于底板，支承丝杠上座和导杆上座；不随车架升降，也不随托盘倾斜。柱与底脚根部增加 R2 过渡，尺寸为待载荷校核的加工候选。', 'spine'],
 ['升降螺母与竖车架','support','inside',partPoint(-129,-18,30,'carriage'),'螺母位于 Y−18，将丝杠转动变为车架升降，中心由 Z30 升至 Z90；侧向导向由 Y40 的31号滑套分担。车架主梁外边 C0.5、叉臂连接块 C0.3；车架保持竖直，托盘通过耳轴独立倾斜。', 'carriage'],
 ['M1 升降电机','drive','inside',partPoint(0,-64,31),'固定桥架上的升降驱动，经底部闭环同步带驱动两侧丝杠；同一升降输入同时使槽滚轮产生规定的展示倾角。', 'm1'],
 ['底部闭环同步带','drive','inside',partPoint(60,-13,11),'三只带轮构成闭环，中心高 Z11；同步两侧丝杠并保留端轮包角，实体需设置张紧和防跳齿措施。', 'belt'],
 ['M2 卷盖电机','drive','inside',tiltPartPoint(121,-92,93),'右前侧电机采用下挂 L 形钢角连接承托框梁，通过齿轮驱动前横轴；耳轴附近另设柔性供电弯曲段。', 'm2'],
 ['同步传动齿轮组','drive','inside',tiltPartPoint(138.5,-92,103),'20 齿、模数 0.5 等节圆齿轮反向传动，连接 M2 输出与牵引横轴；与倾斜模块整体转动。', 'gears'],
 ['两侧牵引同步带','drive','inside',tiltPartPoint(142,15,106),'共用前横轴驱动两条闭环带，保持横梁两端同步；传动护罩与带轮一起倾斜。', 'tiltBelt'],
 ['后导向辊','cover','inside',tiltPartPoint(75,92,94),'有效走膜半径 R12，实体辊半径 11.85；由后侧共用轴承板支承，倾斜时保持与卷芯的相对位置。', 'guideRoller'],
 ['上置收卷轴与卷芯','cover','inside',tiltPartPoint(30,72,66),'卷芯中心前移并上移至局部 Y72、Z66；芯半径 R14，卷盒外半径 R18，以缩小倾斜时的后侧扫掠包络。', 'spool'],
 ['卷簧与固定反力端','cover','inside',tiltPartPoint(-138,58,66),'卷簧内端连接芯轴，外端锁定在倾斜模块上的固定壳体；固定指相对于卷芯，整个壳体仍随模块倾斜。', 'spring'],
 ['共用轴承侧板','support','inside',tiltPartPoint(132,84,80),'连接承托盒后缘并支承导向辊、上置卷芯和后带轮；低段后边收至局部 Y82，上部保留导辊座及连接桥，为柔性罩让位。两处凹转角采用 R2，外凸轮廓 R1，轴孔保持原尺寸；强度仍需校核。', 'rearPlate'],
 ['升降电缆 U 形回环','drive','inside',()=>new THREE.Vector3(106,30+pose(p).lift/2,68),'固定箱体与竖车架之间使用恒长 U 形回弯；它只补偿升降，耳轴附近还需独立补偿倾斜的柔性线缆段。', 'cableLift'],
 ['主侧封闭凸轮槽','support','inside',partPoint(132,-66,80),'4 mm 槽板通过底脚与上侧连接耳固定到底板和侧脊板；名义槽宽 10.3 mm、滚轮直径 10 mm。支脚根部增加 R2 过渡、脚外边 C0.3，槽工作面保留原尺寸。封闭槽双向限制滚轮路径，倾角由升程唯一确定。', 'camMaster'],
 ['槽滚轮与 65 mm 曲柄','support','inside',tiltPartPoint(132,-82,35),'曲柄固定在倾斜模块上，滚轮轴与曲柄连续连接；滚轮在主侧封闭槽内滚动，曲柄长度 65 mm。滚轮中心 X±132、宽 7 mm。', 'crank'],
 ['前侧同轴双耳轴','support','inside',partPoint(-120.5,-82,100,'carriage'),'耳轴中心随车架升降，局部 Y−82、Z100；双耳叉采用 R5 圆耳，内叉 X119…122、外叉 X127.5…129.5，左右镜像。两端同轴，主侧轴向定位、副侧允许轴向浮动。', 'trunnion'],
 ['副侧防翻落备份槽','support','inside',partPoint(-132,-66,80),'副槽宽 12.6 mm，配 Ø10 滚轮形成名义单边余隙 1.3 mm；与主槽 0.15 mm 单边间隙区分，避免双侧重复精定位。提供防翻落备份，不能替代升降防坠或失电保持。', 'camBackup'],
 ['连续倾斜防护罩','guard','outer',()=>{const q=pose(p),a=Mechanism.transformPoint(142,20,91,q);return new THREE.Vector3(142,(a.z+76+q.lift)/2,-(a.y+20)/2);},'侧根 X±142，前后根 Y±100；前部下根 Z76＋升程、上根局部 Z91，局部 Y70…96 段连续下移 11 mm，后根为 Z65＋升程与局部 Z80。16 折浅褶罩末端向内回折，上下以连续成形法兰连接倾斜硬罩与竖裙罩。厚约 0.25 mm 为候选，折叠、夹持和疲劳性能需实物验证。', 'bellows'],
 ['定位槽与一体软限位','support','always',tiltPartPoint(29,62.5,95.8),'四槽各 52 × 152 × 4 mm、内角 R2；后端增加 R8 盲指槽并保留 2 mm 连续槽底。书签贴前、右基准，后端与左侧不可拆软肋轻预压，抑制纵向及侧向游隙；示例堆厚不超过 3 mm。', 'softRib'],
 ['直线导向滑套','support','inside',partPoint(-129,40,30,'carriage'),'黑色滑动套筒由32号灰色连接臂连接竖车架，沿12号固定导杆滑动；随车架从 Z30 升至 Z90，不随托盘倾斜。内孔名义 Ø6、外径 Ø10、长10 mm，提供滑动支承、防止车架侧摆并分担凸轮侧向载荷；14号螺母负责驱动升降。滑套配合、材料和允许载荷需选型校核。', 'sleeve'],
 ['后导向连接臂','support','inside',partPoint(-119,40,30,'carriage'),'附着在31号黑色滑套侧面的灰色连接臂，经短承接段连接竖直车架，把车架侧向力传给滑套与12号固定导杆；它随车架升降，不是止挡或固定底座。左右各一组：连接臂12 × 12 × 6 mm（X × Y × Z），外边 C0.5；短承接段6 × 9 × 6 mm，外边 C0.3，跨接原5 mm断口并与两端搭接。连接与滑套保持方式需在加工图中明确。', 'guideArm'],
 ['防坠棘条','support','inside',partPoint(123.75,-2,44),'固定于底板并经上连接板接到侧脊板的齿条，位于丝杠内侧、螺母臂与滑套臂扫掠区之间（X±122.5…125.0、Y−10…6、Z6…83）。34号棘爪沿齿升降，失电时爪落在齿上，传动失效或断带时的下坠由与驱动链无关的棘条挡住。固定齿顶不超过 Z83，为收纳状态托盘底面（Z86）让出间隙。齿距4 mm、齿深2.3 mm为概念占位；齿形、齿强度与冲击载荷需按整机质量设计，副槽与棘条都不能替代检修支撑。', 'rack'],
 ['防坠棘爪与保持电磁铁','support','inside',partPoint(117.5,-2,38,'carriage'),'装在竖车架梁外侧的摆动爪，枢轴 Z38＋升程；由保持型电磁铁得电抬起、失电靠自重落入33号棘条齿谷，满升位置爪底仍在最高齿上方1 mm，全行程保持可啮合。得电抬起、失电落下的方向满足失效安全；落座冲击、骑齿对位和爪销磨损需实物验证。图中电磁铁为占位外形，选型按整机质量与下降加速度核算。', 'pawl'],
 ['M1 失电制动抱闸','drive','inside',partPoint(0,-64,16),'带轮与电机本体之间的失电制动盘占位：通电松闸、断电抱轴，负责正常停止后的位置保持。它作用在电机轴上，断带后对丝杠失去约束，防坠由33号棘条独立承担；抱闸扭矩、响应时间与停止距离需按载荷选型，本模型不代表已选定型号。', 'brake'],
 ['可翻转检修挡块','support','inside',partPoint(136,22,27),'铰接在侧脊板内侧的支撑臂，维护盖开启时翻出到车架梁下方（支撑面 Z28，梁底 Z30，落差2 mm）。检修时机构落在挡块上，人员才能接近升降区；挡块是检修支撑，不是运行防坠，臂不触及侧脊板与罩体，悬臂刚度与落座冲击需校核。演示中随"模拟维护盖未锁"联动。', 'prop']
 ];
 annotationSvg=document.createElementNS('http://www.w3.org/2000/svg','svg');annotationSvg.classList.add('annotation-lines');annotationSvg.setAttribute('aria-hidden','true');host.appendChild(annotationSvg);
 specs.forEach((s,i)=>{
  const id=String(i+1).padStart(2,'0'),[name,group,mode,point,detail,partKey]=s;
  const e=document.createElement('button');e.type='button';e.className='part-callout';e.dataset.part=id;e.setAttribute('aria-label',id+' '+name);e.setAttribute('aria-pressed','false');e.title=name;
  const n=document.createElement('span');n.className='part-number';n.textContent=id;const txt=document.createElement('span');txt.className='part-name';txt.textContent=name;e.append(n,txt);host.appendChild(e);
  const line=document.createElementNS(annotationSvg.namespaceURI,'polyline'),dot=document.createElementNS(annotationSvg.namespaceURI,'circle');dot.setAttribute('r','2.2');annotationSvg.append(line,dot);
  const entry=document.createElement('button');entry.type='button';entry.className='part-entry';entry.dataset.part=id;entry.textContent=id+'  '+name;entry.setAttribute('aria-pressed','false');$('partsList').appendChild(entry);
  const t={id,name,group,mode,point,detail,partKey,e,line,dot,entry};tags.push(t);e.addEventListener('click',()=>selectPart(t));entry.addEventListener('click',()=>selectPart(t));
 });
 $('partCount').textContent=tags.length+' 个部件';
 $('partSearch').addEventListener('input',e=>{
  searchQuery=e.target.value.trim();$('partInfo').textContent=searchQuery?'搜索中：'+searchQuery:'点选模型编号或部件目录，查看名称与作用。';
  $('partDirectory').open=!!searchQuery;sync();
 });
 $('annotationGroup').addEventListener('change',()=>{
  const group=$('annotationGroup').value;if(group!=='view'){cut=group!=='guard';$('cutaway').checked=cut;}
  $('labels').checked=true;selectedPart=null;applyFocus(null);$('partInfo').textContent='点选模型编号或部件目录，查看名称与作用。';sync();
 });
}
function selectPart(t){
 if(selectedPart===t.id){ // second tap on the same callout clears the focus
  selectedPart=null;applyFocus(null);$('partInfo').textContent='点选模型编号或部件目录，查看名称与作用。';
  $('labels').checked=true;sync();return;
 }
 selectedPart=t.id;applyFocus(t);
 $('labels').checked=true; // keep the active group filter untouched
 if(t.mode!=='always'){cut=t.mode==='inside';$('cutaway').checked=cut;}
 $('partInfo').textContent=t.id+' · '+t.name+' — '+t.detail;sync();
}
function updateAnnotations(){
 const w=host.clientWidth,compact=w<620,show=$('labels').checked,group=$('annotationGroup').value;
 let h=host.clientHeight;
 host.classList.toggle('compact-annotations',compact);
 annotationSvg.hidden=!show;
 const visible=[],q=searchQuery.toLowerCase();
 const match=t=>!q||t.name.toLowerCase().includes(q)||t.id.includes(q)||t.detail.toLowerCase().includes(q);
 tags.forEach(t=>{
  const pt=t.point().project(camera),visibleMode=t.mode==='always'||(cut?t.mode==='inside':t.mode==='outer');
  const shown=show&&visibleMode&&(group==='view'||t.group===group)&&match(t)&&pt.z>=-1&&pt.z<=1;
  t.e.hidden=!shown;t.line.style.display=shown?'':'none';t.dot.style.display=shown?'':'none';
  t.e.classList.toggle('selected',t.id===selectedPart);t.entry.classList.toggle('selected',t.id===selectedPart);t.e.setAttribute('aria-pressed',String(t.id===selectedPart));t.entry.setAttribute('aria-pressed',String(t.id===selectedPart));
  t.entry.hidden=(group!=='view'&&t.group!==group)||!match(t);
  if(shown)visible.push({...t,px:(pt.x/2+.5)*w,projectedY:pt.y});
 });
 host.classList.toggle('dense-annotations',compact&&visible.length>20);
 h=host.clientHeight;
 annotationSvg.setAttribute('viewBox',`0 0 ${w} ${h}`);
 visible.forEach(t=>{t.py=(-t.projectedY/2+.5)*h;});
 visible.sort((a,b)=>a.px-b.px);const half=Math.ceil(visible.length/2);
 [visible.slice(0,half),visible.slice(half)].forEach((column,side)=>{
  column.sort((a,b)=>a.py-b.py);const height=compact?24:27,min=54,max=h-64-height,gap=Math.max(1,Math.min(compact?4:7,(max-min-height*(column.length-1))/Math.max(1,column.length-1)));
  column.forEach((t,i)=>{t.top=Math.max(min,Math.min(max,t.py-height/2));if(i)t.top=Math.max(t.top,column[i-1].top+height+gap);});
  if(column.length){column.at(-1).top=Math.min(column.at(-1).top,max);for(let i=column.length-2;i>=0;i--)column[i].top=Math.min(column[i].top,column[i+1].top-height-gap);}
  column.forEach(t=>{
   const width=compact?26:Math.min(175,w*.23),left=side?w-12-width:12,cy=t.top+height/2,edge=side?left:left+width;
   t.e.style.width=width+'px';t.e.style.transform=`translate(${left}px,${t.top}px)`;
   const elbow=edge+(side?-12:12);t.line.setAttribute('points',`${edge},${cy} ${elbow},${cy} ${t.px},${t.py}`);t.line.classList.toggle('selected',t.id===selectedPart);
   t.dot.setAttribute('cx',t.px);t.dot.setAttribute('cy',t.py);t.dot.classList.toggle('selected',t.id===selectedPart);
  });
 });
}
