let selectedPart=null,annotationSvg;
function partPoint(x,y,z,moving=false){return ()=>new THREE.Vector3(x,z+(moving?pose(p).lift:0),-y);}
function buildPartAnnotations(){
 const specs=[
 ['透明柔性膜','cover','always',()=>{const q=pose(p);return q.retract>183?new THREE.Vector3(0,32+q.lift,-101):new THREE.Vector3(65,q.coverZ,-(q.frontY+92)/2);},'0.30 mm TPU 膜，随前横梁移动，经后导辊进入卷盒；打开后收在后罩内部。'],
 ['四列承托盘','support','always',partPoint(-117,-30,98,true),'244 × 172 mm 水平承托盘，容纳四列 50 × 150 mm 书签，与托架一同升降 60 mm。'],
 ['哑黑箱体','guard','outer',partPoint(70,-111,52),'固定外壳包围底部传动与升降机构，连接底板；侧壁厚度暂定 3 mm。'],
 ['连续升降套筒','guard','outer',partPoint(145.8,0,98,true),'随托盘升降，遮蔽侧面运动区。收纳时藏于箱内，满升后仍与箱体搭接 42 mm。'],
 ['两侧传动护罩','guard','outer',partPoint(136,15,110,true),'封住同步带和轴端，内侧设错位唇口供牵引横梁通过。'],
 ['后导辊护罩','guard','outer',partPoint(-60,93,110,true),'包围后导辊入口，柔性盖与横梁从前侧狭长通道进入。'],
 ['牵引横梁与软边','cover','always',()=>{const q=pose(p);return new THREE.Vector3(50,107.2+q.lift,-q.frontY);},'两端连接同步带，夹持膜前缘。行程 184 mm；打开后进入后罩，外露前缘采用柔性包边。'],
 ['承力底板','support','inside',partPoint(-70,-70,6),'6 mm 底板连接侧脊板、电机支架和轴支座，形成固定承力基础。'],
 ['升降梯形丝杠','support','inside',partPoint(-129,-18,62),'两侧丝杠同步旋转，螺母驱动托架升降。有效螺纹段 Z22…98，导程暂定 2 mm。'],
 ['下固定轴承座','support','inside',partPoint(-129,-18,18),'轴承座由底部桥脚与侧脊板承托；下方为带轮通道，轴颈连续连接丝杠和带轮。'],
 ['上游动支承座','support','inside',partPoint(-129,-18,102),'连接固定侧脊板，提供径向支承；轴向游动用于避免丝杠两端重复定位。'],
 ['后侧直线导杆','support','inside',partPoint(-129,40,65),'承担托架的侧向导向。下夹持座落到底板，上夹持座连接侧脊板；一侧导向需允许微量浮动。'],
 ['固定侧脊板','support','inside',partPoint(137.5,15,66),'连接上下支座与底部法兰，把支承载荷传递到底板；这一构件不随托盘运动。'],
 ['升降螺母与托架','support','inside',partPoint(-129,-18,30,true),'螺母通过横臂连接升降框架；中心随行程从 Z30 升至 Z90，带动托盘和卷盖机构。'],
 ['M1 升降电机','drive','inside',partPoint(0,-64,31),'安装在固定桥架上，输出轴驱动底部闭环同步带，同步带再带动两侧丝杠。'],
 ['底部闭环同步带','drive','inside',partPoint(60,-13,11),'三带轮闭环传动，包含端轮包角。带轮中心高 Z11，与底法兰和轴承桥座保持运行间隙。'],
 ['M2 卷盖电机','drive','inside',partPoint(121,-92,93,true),'固定在托盘右前角的让位口内，通过齿轮驱动前横轴；卡片区域保持完整。'],
 ['同步传动齿轮组','drive','inside',partPoint(138.5,-92,103,true),'两只 20 齿、模数 0.5 的等节圆齿轮反向转动，将 M2 输出连接到前横轴。'],
 ['两侧牵引同步带','drive','inside',partPoint(142,15,106,true),'两条闭环带由同一前横轴驱动，牵引横梁两端同步移动，避免直接推送柔性膜。'],
 ['后导向辊','cover','inside',partPoint(75,92,94,true),'有效走膜半径 R12，改变膜的运动方向；轴端装入后侧双孔支承板。'],
 ['收卷轴与卷芯','cover','inside',partPoint(30,86,32,true),'卷芯半径 R14，随收膜增大至约 R14.92；整个卷盒随托架升降。'],
 ['卷簧与固定反力端','cover','inside',partPoint(-138,72,32,true),'卷簧内端连接芯轴，外端锁定在固定壳体，为膜提供回卷张力；端盖在剖视中隐藏。'],
 ['共用轴承侧板','support','inside',partPoint(132,89,65,true),'连接托盘后缘，支承后导向辊、收卷轴和后带轮；同一侧板上的轴孔分别定位各轴。'],
 ['随动电缆 U 形回环','drive','inside',()=>new THREE.Vector3(106,30+pose(p).lift/2,68),'固定端与移动端之间采用恒长 U 形路径，回弯半径暂定 R6；位于独立封闭空间内。']
 ];
 annotationSvg=document.createElementNS('http://www.w3.org/2000/svg','svg');annotationSvg.classList.add('annotation-lines');annotationSvg.setAttribute('aria-hidden','true');host.appendChild(annotationSvg);
 specs.forEach((s,i)=>{
  const id=String(i+1).padStart(2,'0'),[name,group,mode,point,detail]=s;
  const e=document.createElement('button');e.type='button';e.className='part-callout';e.dataset.part=id;e.setAttribute('aria-label',id+' '+name);e.setAttribute('aria-pressed','false');e.title=name;
  const n=document.createElement('span');n.className='part-number';n.textContent=id;const txt=document.createElement('span');txt.className='part-name';txt.textContent=name;e.append(n,txt);host.appendChild(e);
  const line=document.createElementNS(annotationSvg.namespaceURI,'polyline'),dot=document.createElementNS(annotationSvg.namespaceURI,'circle');dot.setAttribute('r','2.2');annotationSvg.append(line,dot);
  const entry=document.createElement('button');entry.type='button';entry.className='part-entry';entry.dataset.part=id;entry.textContent=id+'  '+name;entry.setAttribute('aria-pressed','false');$('partsList').appendChild(entry);
  const t={id,name,group,mode,point,detail,e,line,dot,entry};tags.push(t);e.addEventListener('click',()=>selectPart(t));entry.addEventListener('click',()=>selectPart(t));
 });
 $('partCount').textContent=tags.length+' 个部件';
 $('annotationGroup').addEventListener('change',()=>{
  const group=$('annotationGroup').value;if(group!=='view'){cut=group!=='guard';$('cutaway').checked=cut;}
  $('labels').checked=true;selectedPart=null;$('partInfo').textContent='点选模型编号或部件目录，查看名称与作用。';sync();
 });
}
function selectPart(t){
 selectedPart=t.id;$('labels').checked=true;$('annotationGroup').value='view';
 if(t.mode!=='always'){cut=t.mode==='inside';$('cutaway').checked=cut;}
 $('partInfo').textContent=t.id+' · '+t.name+' — '+t.detail;sync();
}
function updateAnnotations(){
 const w=host.clientWidth,h=host.clientHeight,compact=w<620,show=$('labels').checked,group=$('annotationGroup').value;
 host.classList.toggle('compact-annotations',compact);
 annotationSvg.setAttribute('viewBox',`0 0 ${w} ${h}`);annotationSvg.hidden=!show;
 const visible=[];
 tags.forEach(t=>{
  const pt=t.point().project(camera),visibleMode=t.mode==='always'||(cut?t.mode==='inside':t.mode==='outer');
  const shown=show&&visibleMode&&(group==='view'||t.group===group)&&pt.z>=-1&&pt.z<=1;
  t.e.hidden=!shown;t.line.style.display=shown?'':'none';t.dot.style.display=shown?'':'none';
  t.e.classList.toggle('selected',t.id===selectedPart);t.entry.classList.toggle('selected',t.id===selectedPart);t.e.setAttribute('aria-pressed',String(t.id===selectedPart));t.entry.setAttribute('aria-pressed',String(t.id===selectedPart));
  t.entry.hidden=group!=='view'&&t.group!==group;
  if(shown)visible.push({...t,px:(pt.x/2+.5)*w,py:(-pt.y/2+.5)*h});
 });
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
