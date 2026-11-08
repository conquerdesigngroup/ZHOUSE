/* ==================== Tools tab (src/tools.js) ====================
   Spliced into app.js at build time, inside the same IIFE, so it can use every helper above.
   Measuring and spacing helpers, walkways, fit test, roof and floors, costs, photos and notes.
   Viewer preferences for these tools live in localStorage (LS_TOOLS); anything that is part
   of the design itself (roof, notes, prices) is saved in the plan. */
var LS_TOOLS='house3d-tools-v1';
var TV={rings:true,dists:true,snap:true,swings:false};
(function(){try{Object.assign(TV,JSON.parse(lsGet(LS_TOOLS)||'{}'));}catch(e){}})();
function saveTV(){lsSet(LS_TOOLS,JSON.stringify(TV));}
function inFt(v){return v<5?Math.round(v*12)+'"':fmt(v);}

/* ---------- plan geometry for spacing: obstacles, rays, item sides ---------- */
function spaceObstacles(skip){var out=[];wallSolids().forEach(function(s){out.push({poly:s.poly,ref:{type:'wall',id:s.w.id},name:'a wall',wall:true});});
  model.items.forEach(function(it){if((skip&&skip.indexOf(it.id)>=0)||it.kind==='rug'||it.kind==='person')return;out.push({poly:itemPoly(it),ref:{type:'item',id:it.id},name:iName(it),it:it});});return out;}
function rayPoly(p,d,P){var best=Infinity;for(var i=0;i<P.length;i++){var a=P[i],b=P[(i+1)%P.length],ex=b[0]-a[0],ey=b[1]-a[1],den=d[0]*ey-d[1]*ex;if(Math.abs(den)<1e-9)continue;
  var wx=a[0]-p[0],wy=a[1]-p[1],t=(wx*ey-wy*ex)/den,s=(wx*d[1]-wy*d[0])/den;if(t>1e-6&&s>=-1e-6&&s<=1+1e-6&&t<best)best=t;}return best;}
function castObs(p,d,obs,max){var best=max||40,hit=null;obs.forEach(function(o){if(ptInConvex(p,o.poly,0.001)){best=0;hit=o;return;}var t=rayPoly(p,d,o.poly);if(t<best){best=t;hit=o;}});return {d:best,hit:hit};}
// The four faces of an item: outward normal n, direction along the face u, distance to the face, half its length.
function itemSides(it){var A=itemAx(it),neg=function(v){return [-v[0],-v[1]];};
  return [{k:'+x',n:A.x,u:A.z,half:it.w/2,across:it.d/2},{k:'-x',n:neg(A.x),u:A.z,half:it.w/2,across:it.d/2},{k:'+z',n:A.z,u:A.x,half:it.d/2,across:it.w/2},{k:'-z',n:neg(A.z),u:A.x,half:it.d/2,across:it.w/2}]
    .map(function(s){s.c=[it.cx+s.n[0]*s.half,it.cy+s.n[1]*s.half];return s;});}
// Shortest open distance straight out from a face (sampled at both ends and the middle).
function sideGap(s,obs,max){var best={d:max||40,hit:null,p:s.c};[-0.85,0,0.85].forEach(function(f){var p=[s.c[0]+s.u[0]*s.across*f+s.n[0]*0.004,s.c[1]+s.u[1]*s.across*f+s.n[1]*0.004],r=castObs(p,s.n,obs,best.d);
  if(r.hit&&r.d<best.d)best={d:r.d,hit:r.hit,p:p};});return best;}

/* ---------- clearance zones: the space each piece needs to be used ---------- */
function clearSpec(it){var k=it.kind,l=(it.label||'').toLowerCase(),all=function(n,why){return [['+x',n,why],['-x',n,why],['+z',n,why],['-z',n,why]];};
  switch(k){
    case 'bed':return [['+z',2,'to get in and make the bed'],['-z',2,'to get in and make the bed'],['-x',2,'at the foot']];
    case 'table':if(/coffee/.test(l))return all(1.5,'knee room');if(/side|end|night|accent/.test(l))return [];if(/desk/.test(l))return [['free',3,'to pull the chair out']];return all(3,'to pull a chair out and sit');
    case 'island':return all(3.5,'work aisle');
    case 'counter':case 'sink':return [['+z',3.5,'work aisle']];
    case 'range':return [['+z',3,'to open the oven']];
    case 'dishwasher':return [['+z',3,'to drop the door']];
    case 'fridge':return [['+z',3,'to open the doors']];
    case 'washer':return [['+z',3,'to load it']];
    case 'vanity':return [['+z',2.5,'at the sink']];
    case 'toilet':return [['+x',2.5,'in front (21" is code)']];
    case 'tub':return [['free',2.5,'to step out']];
    case 'shower':return [['+z',2,'at the opening']];
    case 'sofa':case 'sectional':return [['+x',1.5,'to the coffee table']];
    case 'chair':return /dining|side|kitchen|desk|stool/.test(l)?[['+z',2,'to pull it out']]:[['-z',1.5,'in front']];
    case 'cabinet':return /dresser|wardrobe|buffet|pantry|chest|file/.test(l)?[['free',3,'to open the drawers']]:[];
    case 'car':return [['+z',2.5,'to open the doors'],['-z',2.5,'to open the doors']];
    case 'desk':return [['free',3,'to pull the chair out']];
  }return [];}
function clearZones(it){var spec=clearSpec(it);if(!spec.length)return [];var sides=itemSides(it),byK={},P=itemPoly(it),out=[];sides.forEach(function(s){byK[s.k]=s;});
  var skip=[it.id],l=it.kind;model.items.forEach(function(o){if(o===it)return;var near=polyDist(P,itemPoly(o))<0.15;
    if((l==='table'||l==='island'||l==='counter'||l==='desk')&&o.kind==='chair')skip.push(o.id);                                   // chairs tuck in
    else if((l==='counter'||l==='sink'||l==='range'||l==='dishwasher')&&near&&['counter','island','vanity','sink','range','dishwasher','cabinet','fridge'].indexOf(o.kind)>=0)skip.push(o.id); // the run it sits in
    else if(it.kind==='chair'&&['table','island','counter','desk'].indexOf(o.kind)>=0)skip.push(o.id);});
  var obs=spaceObstacles(skip),walls=obs.filter(function(o){return o.wall;});
  spec.forEach(function(sp){var s;if(sp[0]==='free'){var best=-1;sides.forEach(function(q){var g=sideGap(q,obs,30).d;if(g>best){best=g;s=q;}});}else s=byK[sp[0]];if(!s)return;
    var a0=-s.across,a1=s.across;if(it.kind==='bed'&&(s.k==='+z'||s.k==='-z')){a0=-s.across;a1=s.across-1.8;}                     // nightstands go by the headboard
    if(it.kind==='bed'&&s.k!=='-x'&&sideGap(s,walls,1).d<0.35)return;                                                                // pushed against a wall on purpose
    var lo=Math.min(a0,a1),hi=Math.max(a0,a1),Z=zoneRect(s.c,s.u,s.n,lo,hi,0.02,sp[1]),hits=[],gap=sp[1];
    obs.forEach(function(o){if(overlapDepth(Z,o.poly)>0.04){hits.push(o);gap=Math.min(gap,polyDist(P,o.poly));}});
    out.push({zone:Z,need:sp[1],why:sp[2],ok:!hits.length,gap:gap,hits:hits,s:s,lbl:[s.c[0]+s.n[0]*(sp[1]+0.45),s.c[1]+s.n[1]*(sp[1]+0.45)]});});
  return out;}
function zoneText(z){return z.ok?inchStr(z.need)+' clear':inchStr(z.gap)+' of '+inchStr(z.need);}

/* ---------- live distances + snap & align while dragging furniture ---------- */
var guides=[];
function distLines(it){var obs=spaceObstacles([it.id]),out=[];itemSides(it).forEach(function(s){var g=sideGap(s,obs,24);if(!g.hit||g.d<0.03)return;
  var a=[g.p[0]-s.n[0]*0.004,g.p[1]-s.n[1]*0.004];out.push({a:a,b:[a[0]+s.n[0]*g.d,a[1]+s.n[1]*g.d],d:g.d,to:g.hit.name});});return out;}
// After a drag step: pull a face flush to a wall or piece within 6", then line the piece up with
// nearby furniture edges and centers (square pieces only). Hold Alt for a free move.
function dragAssist(o,e){guides=[];if(!TV.snap||(e&&e.altKey))return;var obs=spaceObstacles([o.id]),done={x:false,y:false};
  [['+x','-x'],['+z','-z']].forEach(function(pair){var best=null;itemSides(o).forEach(function(s){if(pair.indexOf(s.k)<0)return;var g=sideGap(s,obs,0.5);if(g.hit&&g.d>0.015&&g.d<0.5&&(!best||g.d<best.d))best={d:g.d,s:s};});
    if(best){o.cx=r3(o.cx+best.s.n[0]*(best.d+0.004));o.cy=r3(o.cy+best.s.n[1]*(best.d+0.004));if(Math.abs(best.s.n[0])>0.9)done.x=true;if(Math.abs(best.s.n[1])>0.9)done.y=true;}});
  if(((o.rot||0)%90+90)%90>0.5)return;
  var box=function(it){var P=itemPoly(it),xs=P.map(function(p){return p[0];}),ys=P.map(function(p){return p[1];});return {x:[Math.min.apply(0,xs),it.cx,Math.max.apply(0,xs)],y:[Math.min.apply(0,ys),it.cy,Math.max.apply(0,ys)]};};
  var me=box(o);
  ['x','y'].forEach(function(ax){if(done[ax])return;var best=null;model.items.forEach(function(it){if(it===o||it.kind==='rug'||Math.hypot(it.cx-o.cx,it.cy-o.cy)>16||((it.rot||0)%90+90)%90>0.5)return;var b=box(it);
      me[ax].forEach(function(v,i){b[ax].forEach(function(w,j){if((i===1)!==(j===1))return;var df=w-v;if(Math.abs(df)<0.3&&Math.abs(df)>1e-4&&(!best||Math.abs(df)<Math.abs(best.df)))best={df:df,v:w,b:b};else if(Math.abs(df)<=1e-4&&!best)best={df:0,v:w,b:b};});});});
    if(!best)return;if(ax==='x')o.cx=r3(o.cx+best.df);else o.cy=r3(o.cy+best.df);me=box(o);var oth=ax==='x'?'y':'x',lo=Math.min(me[oth][0],best.b[oth][0])-0.6,hi=Math.max(me[oth][2],best.b[oth][2])+0.6;
    guides.push(ax==='x'?{a:[best.v,lo],b:[best.v,hi]}:{a:[lo,best.v],b:[hi,best.v]});});}

/* ---------- plan overlay: zones, distances, guides, door swings ---------- */
function planExtrasSVG(k){if(!TV)return '';var h=[],sw=function(px){return (px*k).toFixed(3);},fs=(10.5*k).toFixed(2),o=sel&&sel.type==='item'?getObj():null;
  var pts=function(P){return P.map(function(p){return r3(p[0])+','+r3(p[1]);}).join(' ');};
  function lbl(x,y,t,col){h.push('<text x="'+r3(x)+'" y="'+r3(y)+'" font-size="'+fs+'" text-anchor="middle" dominant-baseline="middle" fill="'+col+'" stroke="#0c0a14" stroke-width="'+sw(3)+'" paint-order="stroke" font-family="JetBrains Mono, monospace" pointer-events="none">'+esc(t)+'</text>');}
  if(TV.swings)swingInfo().forEach(function(s){var c=s.bad?'#ff5c7a':'#b57bff';h.push('<polygon points="'+pts(s.poly)+'" fill="'+c+'" fill-opacity="'+(s.bad?0.28:0.1)+'" stroke="'+c+'" stroke-width="'+sw(1)+'" pointer-events="none"/>');});
  if(o&&TV.rings)clearZones(o).forEach(function(z){var c=z.ok?'#2de2e6':'#ff5c7a';h.push('<polygon points="'+pts(z.zone)+'" fill="'+c+'" fill-opacity="'+(z.ok?0.1:0.2)+'" stroke="'+c+'" stroke-width="'+sw(1.2)+'" stroke-dasharray="'+sw(5)+' '+sw(3)+'" pointer-events="none"/>');lbl(z.lbl[0],z.lbl[1],zoneText(z),c);});
  if(o&&TV.dists)distLines(o).forEach(function(L){h.push('<line x1="'+r3(L.a[0])+'" y1="'+r3(L.a[1])+'" x2="'+r3(L.b[0])+'" y2="'+r3(L.b[1])+'" stroke="#ffd84d" stroke-width="'+sw(1.4)+'" marker-start="url(#dimA)" marker-end="url(#dimA)" pointer-events="none"/>');
    lbl((L.a[0]+L.b[0])/2,(L.a[1]+L.b[1])/2,inFt(L.d),'#ffd84d');});
  if(TV.paths)h.push(pathsSVG(k));h.push(accessSVG(k));
  guides.forEach(function(g){h.push('<line x1="'+r3(g.a[0])+'" y1="'+r3(g.a[1])+'" x2="'+r3(g.b[0])+'" y2="'+r3(g.b[1])+'" stroke="#ff7ad9" stroke-width="'+sw(1.2)+'" stroke-dasharray="'+sw(4)+' '+sw(3)+'" pointer-events="none"/>');});
  return '<defs><marker id="dimA" viewBox="-5 -5 10 10" markerWidth="'+sw(7)+'" markerHeight="'+sw(7)+'" markerUnits="userSpaceOnUse" orient="auto"><path d="M0 -4V4" stroke="#ffd84d" stroke-width="1.6"/></marker></defs>'+h.join('');}
// Swing doors with their swing area, and whether the design check found them hitting something.
function swingInfo(){var bad={};runChecks().forEach(function(c){if(!c.ignored&&(c.rule==='swing'||c.rule==='doors'))c.refs.forEach(function(r){if(r.type==='door')bad[r.id]=1;});});
  return model.doors.filter(function(d){return d.type!=='barn'&&d.type!=='overhead'&&segLen(d)>=0.5;}).map(function(d){return {d:d,poly:doorSector(d),bad:!!bad[d.id]};});}

/* ---------- 3D overlay: the same zones and swings on the floor ---------- */
var helpG=new THREE.Group();scene.add(helpG);
function floorPoly(P,col,op,y){var m=new THREE.MeshBasicMaterial({color:new THREE.Color(col).convertSRGBToLinear(),transparent:true,opacity:op,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
  var mesh=new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(P.map(function(p){return new THREE.Vector2(p[0],p[1]);}))),m);mesh.rotation.x=Math.PI/2;mesh.position.y=y||0.04;mesh.renderOrder=2;helpG.add(mesh);
  var ln=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(P.map(function(p){return new THREE.Vector3(p[0],(y||0.04)+0.01,p[1]);})),new THREE.LineBasicMaterial({color:m.color,toneMapped:false}));ln.renderOrder=3;helpG.add(ln);}
function buildHelpers3D(){if(!helpG)return;while(helpG.children.length){var c=helpG.children.pop();if(c.geometry)c.geometry.dispose();if(c.material)c.material.dispose();}
  var o=sel&&sel.type==='item'?getObj():null;
  if(TV.swings)swingInfo().forEach(function(s,i){floorPoly(s.poly,s.bad?'#ff5c7a':'#b57bff',s.bad?0.45:0.22,0.035+i*0.0004);});
  if(o&&TV.rings)clearZones(o).forEach(function(z,i){floorPoly(z.zone,z.ok?'#2de2e6':'#ff5c7a',z.ok?0.28:0.5,0.05+i*0.0004);});
  if(typeof buildPaths3D==='function')buildPaths3D();}
function onSelChange(){buildHelpers3D();}
function inspectorExtras(o){var a='';if(sel.type==='item')arrangeOptions(o).forEach(function(x){a+='<button class="btn" data-arr="'+x[0]+'">'+esc(x[1])+'</button>';});if(sel.type==='wall')a+='<button class="btn" data-elev>Wall elevation</button>';return a;}
function wireInspectorExtras(box){$$('[data-arr]',box).forEach(function(b){b.onclick=function(){autoArrange(b.dataset.arr);};});$$('[data-elev]',box).forEach(function(b){b.onclick=function(){openElevation(getObj());};});}

/* ---------- 3D tape measure: click two points anywhere, heights included ---------- */
var tape={on:false,a:null,hover:null,list:[]},tapeG=new THREE.Group();scene.add(tapeG);
var tapeBox=document.createElement('div');tapeBox.id='tapeLabels';host.appendChild(tapeBox);
var TAPE_COL='#ffd84d';
function setTape(on){tape.on=on;tape.a=null;tape.hover=null;$$('[data-tape]').forEach(function(b){b.classList.toggle('on',on);});document.body.classList.toggle('taping',on);drawTape();
  if(on)toast(view.mode==='walk'?'Tape measure: aim the crosshair and click two points. T to stop.':'Tape measure: click two points on walls, floors or furniture. Esc clears, T to stop.',4200);}
function pickPoint(cx,cy,center){if(center)v2.set(0,0);else{var rc=cv.getBoundingClientRect();v2.set(((cx-rc.left)/rc.width)*2-1,-((cy-rc.top)/rc.height)*2+1);}
  ray.setFromCamera(v2,camera);ray.far=Infinity;var hits=ray.intersectObjects(pickables,false).filter(function(h){return isVisible(h.object);}),p=null;
  if(hits.length)p=hits[0].point.clone();else{var d=ray.ray.direction,o=ray.ray.origin;if(d.y<-1e-4){var t=-o.y/d.y;p=o.clone().add(d.clone().multiplyScalar(t));}}
  if(p&&p.y<0.12)p.y=0;return p;}
function tapeClick(p){if(!p)return;if(!tape.a)tape.a=p;else{tape.list.push({a:tape.a,b:p});tape.a=null;tape.hover=null;}drawTape();}
function tapeMesh(p){var m=new THREE.Mesh(new THREE.SphereGeometry(0.11,12,8),new THREE.MeshBasicMaterial({color:new THREE.Color(TAPE_COL),depthTest:false,toneMapped:false}));m.position.copy(p);m.renderOrder=20;return m;}
function tapeLine(a,b,col,dash){var g=new THREE.BufferGeometry().setFromPoints([a,b]),m=dash?new THREE.LineDashedMaterial({color:col,dashSize:0.4,gapSize:0.25,depthTest:false,transparent:true,opacity:0.8,toneMapped:false}):new THREE.LineBasicMaterial({color:col,depthTest:false,toneMapped:false});
  var l=new THREE.Line(g,m);if(dash)l.computeLineDistances();l.renderOrder=19;return l;}
function drawTape(){while(tapeG.children.length){var c=tapeG.children.pop();if(c.geometry)c.geometry.dispose();if(c.material)c.material.dispose();}tapeBox.innerHTML='';
  var all=tape.list.slice();if(tape.a&&tape.hover)all.push({a:tape.a,b:tape.hover,live:true});
  if(tape.a)tapeG.add(tapeMesh(tape.a));
  all.forEach(function(m,i){var c=new THREE.Color(TAPE_COL),dy=Math.abs(m.b.y-m.a.y),hz=Math.hypot(m.b.x-m.a.x,m.b.z-m.a.z);tapeG.add(tapeLine(m.a,m.b,c));tapeG.add(tapeMesh(m.b));if(!m.live)tapeG.add(tapeMesh(m.a));
    if(dy>0.15&&hz>0.15){var k=new THREE.Vector3(m.b.x,m.a.y,m.b.z);tapeG.add(tapeLine(m.a,k,c,true));tapeG.add(tapeLine(k,m.b,c,true));}
    var el=document.createElement('div');el.className='tape-l'+(m.live?' live':'');var tot=m.a.distanceTo(m.b);
    el.innerHTML='<b>'+esc(fmt(tot))+'</b>'+(dy>0.15&&hz>0.15?'<span>across '+esc(fmt(hz))+' · up '+esc(fmt(dy))+'</span>':dy>0.15?'<span>straight up</span>':'')+(m.live?'':'<button aria-label="Remove this measurement" data-tdel="'+i+'">×</button>');
    el._mid=m.a.clone().add(m.b).multiplyScalar(0.5);tapeBox.appendChild(el);});
  $$('[data-tdel]',tapeBox).forEach(function(b){b.onclick=function(e){e.stopPropagation();tape.list.splice(+b.dataset.tdel,1);drawTape();};});
  var n=tape.list.length;$$('[data-tapeclear]').forEach(function(b){b.disabled=!n;});}
function clearTape(){tape.list=[];tape.a=null;tape.hover=null;drawTape();}
cv.addEventListener('pointermove',function(e){if(!tape.on||view.mode!=='orbit'||!tape.a||e.buttons)return;tape.hover=pickPoint(e.clientX,e.clientY);drawTape();});
function updateTapeLabels(){var W=host.clientWidth,H=host.clientHeight;Array.prototype.forEach.call(tapeBox.children,function(el){if(!el._mid)return;v3.copy(el._mid).project(camera);
  if(v3.z>1||v3.z<-1){el.style.display='none';return;}el.style.display='';el.style.left=((v3.x+1)/2*W)+'px';el.style.top=((1-v3.y)/2*H)+'px';});}
var tapeT=0;
function toolsFrame(dt){if(tape.on&&tape.a&&view.mode==='walk'){tapeT+=dt;if(tapeT>0.08){tapeT=0;tape.hover=pickPoint(0,0,true);drawTape();}}if(tapeBox.children.length)updateTapeLabels();}

/* ---------- scale person (an item, so it can be moved, turned and resized like furniture) ---------- */
ITEM_KINDS.push(['person','Person (scale figure)',1.6,1,5.83,'#4a7bd0']);
FIELDS.item[1].options=ITEM_KINDS.map(function(k){return [k[0],k[1]];});
function buildExtra(it,g,add,w,d,h,c){switch(it.kind){
  case 'person':{var P=new THREE.Group(),skin='#c99a7a',pants='#2f3542',shoe='#1f1f24';P.scale.set(w/1.6,h/5.83,d/1);g.add(P);var put=function(m,x,y,z){m.position.set(x,y,z);P.add(m);return m;};
    [-1,1].forEach(function(sx){put(bx(0.34,0.22,0.75,shoe),sx*0.24,0.11,0.1);put(cyl(0.17,0.14,2.6,pants),sx*0.24,0.22+1.3,0);
      var arm=put(cyl(0.12,0.1,2.15,skin),sx*0.68,3.75,0);arm.rotation.z=sx*0.08;put(cyl(0.16,0.14,0.75,c),sx*0.64,4.45,0).rotation.z=sx*0.1;});
    put(bx(0.95,0.45,0.55,pants),0,2.95,0);var tor=put(cyl(0.56,0.45,1.75,c),0,4.0,0);tor.scale.z=0.55;put(cyl(0.13,0.15,0.3,skin),0,4.98,0);
    var hd=put(new THREE.Mesh(new THREE.SphereGeometry(0.36,18,14),mat(skin)),0,5.42,0.02);hd.scale.set(0.9,1.08,1);hd.castShadow=true;
    var hair=put(new THREE.Mesh(new THREE.SphereGeometry(0.37,18,10,0,Math.PI*2,0,Math.PI*0.55),mat('#3b2a20')),0,5.47,-0.01);hair.scale.set(0.92,1.06,1.02);return true;}
  }return false;}
function addPerson(){var c=viewCenter(),r=model.rooms.slice().sort(function(a,b){return b.w*b.d-a.w*a.d;})[0];if(r&&!document.body.classList.contains('editing'))c={x:r.x+r.w/2,y:r.y+r.d/2};
  pushUndo();var o={id:uid('i'),label:'Person 5\'10"',kind:'person',cx:snapV(c.x),cy:snapV(c.y),w:1.6,d:1,h:5.83,rot:0,color:'#4a7bd0',note:'Scale figure. Change the height to match anyone in the family.'};
  model.items.push(o);sel={type:'item',id:o.id};afterChange();onSelChange();toast('Added a 5\'10" person. Drag them anywhere; change Height in Edit to match someone in the family.',4200);}

/* ---------- area & paint (Specs tab) ---------- */
function roomAreas(r){var C=roomCeil(r),open=0,near=function(v,a){return Math.abs(v-a)<0.6;};
  model.doors.concat(model.windows).forEach(function(o){var mx=(o.x1+o.x2)/2,my=(o.y1+o.y2)/2;
    var on=((near(mx,r.x)||near(mx,r.x+r.w))&&my>r.y-0.3&&my<r.y+r.d+0.3)||((near(my,r.y)||near(my,r.y+r.d))&&mx>r.x-0.3&&mx<r.x+r.w+0.3);if(!on)return;
    var H=o.sill!=null?(o.head-o.sill):(o.h||model.specs.doorH);open+=segLen(o)*Math.min(H,C);});
  return {floor:r.w*r.d,wall:Math.max(0,2*(r.w+r.d)*C-open),ceil:r.w*r.d};}
function paintSpec(){var p=model.specs.paint||{};return {coats:p.coats||2,cover:p.cover||350};}
function specsExtrasHTML(){var P=paintSpec(),tw=0,tc=0,tf=0,byMat={};
  var rows=model.rooms.map(function(r){var A=roomAreas(r),g=A.wall*P.coats/P.cover;tw+=A.wall;tc+=A.ceil;tf+=A.floor;var fm=r.floorMat||'solid';byMat[fm]=(byMat[fm]||0)+A.floor;
    return '<tr><td>'+esc(r.name)+'</td><td>'+A.floor.toFixed(0)+'</td><td>'+A.wall.toFixed(0)+'</td><td>'+g.toFixed(1)+'</td></tr>';}).join('');
  var gw=tw*P.coats/P.cover,gc=tc*P.coats/P.cover;
  var mats=Object.keys(byMat).map(function(k){return esc(MAT_NAME[k]||k)+' <b>'+Math.ceil(byMat[k]*1.1)+' sf</b>';}).join(' · ');
  return '<div class="group"><div class="g-title">Area &amp; paint</div><table class="sched"><thead><tr><th>Room</th><th>Floor SF</th><th>Wall SF</th><th>Paint gal</th></tr></thead><tbody>'+rows+
    '</tbody><tfoot><tr><td>Total</td><td>'+tf.toFixed(0)+'</td><td>'+tw.toFixed(0)+'</td><td>'+gw.toFixed(1)+'</td></tr></tfoot></table>'+
    '<div class="row"><span class="lbl">Coats</span><select id="pCoats" style="flex:1">'+[1,2,3].map(function(n){return '<option'+(n===P.coats?' selected':'')+'>'+n+'</option>';}).join('')+'</select></div><div class="row"><span class="lbl">Sq ft per gal</span><input id="pCover" class="txt" type="number" min="150" max="500" step="10" value="'+P.cover+'"></div>'+
    '<p class="hint">Walls are net of doors and windows; buy about <b>'+Math.ceil(gw)+' gal</b> for walls and <b>'+Math.ceil(gc)+' gal</b> of ceiling white ('+tc.toFixed(0)+' sf). Flooring to order with 10% waste: '+mats+'.</p></div>';}
function wireSpecsExtras(box){var c=$('#pCoats',box),v=$('#pCover',box);if(!c)return;var set=function(){pushUndo();model.specs.paint={coats:+c.value||2,cover:clamp(+v.value||350,100,600)};afterChange();};c.onchange=set;v.onchange=set;}

/* ---------- Tools tab wiring ---------- */
var TOGS=[['tRings','rings'],['tDists','dists'],['tSnapAl','snap'],['tSwings','swings'],['tPaths','paths']];
function syncToolsUI(){TOGS.forEach(function(p){var el=$('#'+p[0]);if(el)el.checked=!!TV[p[1]];});var a=$('#tAccess');if(a)a.checked=!!model.specs.access;}
TOGS.forEach(function(p){var el=$('#'+p[0]);if(!el)return;el.onchange=function(){TV[p[1]]=el.checked;saveTV();renderPlan();buildHelpers3D();};});
$$('[data-tape]').forEach(function(b){b.onclick=function(){setTape(!tape.on);};});
$$('[data-tapeclear]').forEach(function(b){b.onclick=clearTape;});
$('#personBtn').onclick=addPerson;
syncToolsUI();drawTape();

/* ---------- floor grid: walls and furniture rasterized at 3", with distance to the nearest obstacle ----------
   Shared by the walking paths, the accessibility checks and the fit test. Cached per plan. */
var GRID={key:null,g:null};
function floorGrid(){var key=JSON.stringify([model.walls,model.doors,model.windows,model.rooms,model.items]);if(GRID.key===key)return GRID.g;
  var bb=bounds(),cs=0.25,pad=3,x0=bb.x-pad,y0=bb.y-pad,nx=Math.ceil((bb.w+2*pad)/cs),ny=Math.ceil((bb.d+2*pad)/cs),N=nx*ny,block=new Uint8Array(N),room=new Int16Array(N),door=new Uint8Array(N);room.fill(-1);
  function rast(P,fn){var xs=P.map(function(p){return p[0];}),ys=P.map(function(p){return p[1];});var i0=Math.max(0,Math.floor((Math.min.apply(0,xs)-x0)/cs)),i1=Math.min(nx-1,Math.ceil((Math.max.apply(0,xs)-x0)/cs)),
    j0=Math.max(0,Math.floor((Math.min.apply(0,ys)-y0)/cs)),j1=Math.min(ny-1,Math.ceil((Math.max.apply(0,ys)-y0)/cs));
    for(var j=j0;j<=j1;j++)for(var i=i0;i<=i1;i++)if(ptInConvex([x0+(i+0.5)*cs,y0+(j+0.5)*cs],P,0))fn(j*nx+i);}
  model.rooms.forEach(function(r,ri){rast([[r.x,r.y],[r.x+r.w,r.y],[r.x+r.w,r.y+r.d],[r.x,r.y+r.d]],function(i){room[i]=ri;});});
  wallSolids().forEach(function(s){rast(s.poly,function(i){block[i]=1;});});
  model.items.forEach(function(it){if(it.kind==='rug'||it.kind==='person')return;rast(itemPoly(it),function(i){if(!block[i])block[i]=2;});});
  model.doors.forEach(function(d){var W=segLen(d);if(W<0.3)return;var u=[(d.x2-d.x1)/W,(d.y2-d.y1)/W],n=[-u[1],u[0]];rast(zoneRect([d.x1,d.y1],u,n,0,W,-0.9,0.9),function(i){door[i]=1;});});
  // chamfer distance (in feet) from each cell center to the nearest blocked cell center
  var D=new Float32Array(N),R2=Math.SQRT2*cs;for(var i=0;i<N;i++)D[i]=block[i]?0:1e9;
  for(var j=0;j<ny;j++)for(var i2=0;i2<nx;i2++){var k=j*nx+i2,v=D[k];if(!v)continue;if(i2>0)v=Math.min(v,D[k-1]+cs);if(j>0){v=Math.min(v,D[k-nx]+cs);if(i2>0)v=Math.min(v,D[k-nx-1]+R2);if(i2<nx-1)v=Math.min(v,D[k-nx+1]+R2);}D[k]=v;}
  for(var j3=ny-1;j3>=0;j3--)for(var i3=nx-1;i3>=0;i3--){var k3=j3*nx+i3,w=D[k3];if(!w)continue;if(i3<nx-1)w=Math.min(w,D[k3+1]+cs);if(j3<ny-1){w=Math.min(w,D[k3+nx]+cs);if(i3<nx-1)w=Math.min(w,D[k3+nx+1]+R2);if(i3>0)w=Math.min(w,D[k3+nx-1]+R2);}D[k3]=w;}
  var g={x0:x0,y0:y0,cs:cs,nx:nx,ny:ny,block:block,room:room,door:door,dist:D,
    at:function(x,y){var i=Math.floor((x-x0)/cs),j=Math.floor((y-y0)/cs);return i<0||j<0||i>=nx||j>=ny?-1:j*nx+i;},
    pt:function(k){return [x0+(k%nx+0.5)*cs,y0+(Math.floor(k/nx)+0.5)*cs];},
    width:function(k){return Math.max(0,2*D[k]-cs);}};                                       // open width of a passage centered on this cell
  GRID.key=key;GRID.g=g;return g;}
function nearestFree(g,k,maxR){if(k>=0&&!g.block[k])return k;var cx=k%g.nx,cy=Math.floor(k/g.nx);for(var r=1;r<=(maxR||12);r++)for(var dj=-r;dj<=r;dj++)for(var di=-r;di<=r;di++){if(Math.max(Math.abs(di),Math.abs(dj))!==r)continue;
  var i=cx+di,j=cy+dj;if(i<0||j<0||i>=g.nx||j>=g.ny)continue;var q=j*g.nx+i;if(!g.block[q])return q;}return -1;}

/* ---------- walking paths from the front door to every room ---------- */
var PATHS={key:null,list:null};
function walkPaths(){var g=floorGrid(),key=GRID.key+'|'+(model.specs.access?1:0);if(PATHS.key===key)return PATHS.list;var fd=frontDoor(),out=[];PATHS.key=key;PATHS.list=out;if(!fd||!model.rooms.length)return out;
  var start=nearestFree(g,g.at(fd.mx-fd.nx*1.2,fd.my-fd.ny*1.2),8);if(start<0)return out;
  var N=g.nx*g.ny,cost=new Float32Array(N),prev=new Int32Array(N),done=new Uint8Array(N),heap=[];cost.fill(1e9);prev.fill(-1);cost[start]=0;heap.push([0,start]);
  function push(e){heap.push(e);var i=heap.length-1;while(i>0){var p=(i-1)>>1;if(heap[p][0]<=heap[i][0])break;var t=heap[p];heap[p]=heap[i];heap[i]=t;i=p;}}
  function pop(){var top=heap[0],last=heap.pop();if(heap.length){heap[0]=last;var i=0;for(;;){var l=2*i+1,r=l+1,m=i;if(l<heap.length&&heap[l][0]<heap[m][0])m=l;if(r<heap.length&&heap[r][0]<heap[m][0])m=r;if(m===i)break;var t=heap[m];heap[m]=heap[i];heap[i]=t;i=m;}}return top;}
  heap=[];push([0,start]);var NB=[[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,1.414],[1,-1,1.414],[-1,1,1.414],[-1,-1,1.414]];
  while(heap.length){var e=pop(),k=e[1];if(done[k])continue;done[k]=1;var ci=k%g.nx,cj=Math.floor(k/g.nx);
    for(var n=0;n<8;n++){var i=ci+NB[n][0],j=cj+NB[n][1];if(i<0||j<0||i>=g.nx||j>=g.ny)continue;var q=j*g.nx+i;if(g.block[q]||done[q])continue;
      if(g.room[q]<0&&g.room[k]>=0&&!g.door[q])continue;                                          // stay indoors once inside
      var c=e[0]+NB[n][2]*(1+3*Math.max(0,1.6-g.dist[q]));if(c<cost[q]){cost[q]=c;prev[q]=k;push([c,q]);}}}
  var need=model.specs.access?3:2.99;
  model.rooms.forEach(function(r,ri){var best=-1,bd=-1;for(var j=Math.floor((r.y-g.y0)/g.cs);j<=Math.floor((r.y+r.d-g.y0)/g.cs);j++)for(var i=Math.floor((r.x-g.x0)/g.cs);i<=Math.floor((r.x+r.w-g.x0)/g.cs);i++){
      if(i<0||j<0||i>=g.nx||j>=g.ny)continue;var q=j*g.nx+i;if(g.room[q]!==ri||g.block[q]||cost[q]>=1e9)continue;var sc=Math.min(g.dist[q],2.5)*4-cost[q]*0.002;if(sc>bd){bd=sc;best=q;}}
    if(best<0){out.push({room:r,none:true});return;}
    var cells=[],k=best;while(k>=0){cells.push(k);k=prev[k];}cells.reverse();
    var tight=[],minW=Infinity;cells.forEach(function(q,idx){if(g.door[q]||g.room[q]<0)return;var w=g.width(q);if(w<minW)minW=w;if(w<need-0.01){var p=g.pt(q),last=tight[tight.length-1];
      if(last&&idx-last.idx<12){if(w<last.w){last.w=w;last.p=p;}last.idx=idx;}else tight.push({p:p,w:w,idx:idx});}});
    var pts=[];cells.forEach(function(q,idx){if(idx%2===0||idx===cells.length-1)pts.push(g.pt(q));});
    out.push({room:r,pts:pts,tight:tight,minW:minW,cells:cells});});
  return out;}
function tightNames(p){var obs=spaceObstacles([]),tiny=[[p[0]-0.01,p[1]-0.01],[p[0]+0.01,p[1]-0.01],[p[0]+0.01,p[1]+0.01],[p[0]-0.01,p[1]+0.01]];
  var near=obs.map(function(o){return {o:o,d:polyDist(tiny,o.poly)};}).sort(function(a,b){return a.d-b.d;}).filter(function(x){return x.d<2.5;});var names=[];
  near.forEach(function(x){if(names.length<2&&names.indexOf(x.o.name)<0)names.push(x.o.name);});return names;}
function pathsSVG(k){var h=[],sw=function(px){return (px*k).toFixed(3);};
  walkPaths().forEach(function(P){if(P.none||!P.pts||P.pts.length<2)return;h.push('<polyline points="'+P.pts.map(function(p){return r3(p[0])+','+r3(p[1]);}).join(' ')+'" fill="none" stroke="#4dff9a" stroke-opacity="0.75" stroke-width="'+sw(2.5)+'" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="'+sw(1)+' '+sw(5)+'" pointer-events="none"/>');
    P.tight.forEach(function(t){h.push('<circle cx="'+r3(t.p[0])+'" cy="'+r3(t.p[1])+'" r="'+sw(9)+'" fill="#ff5c7a" fill-opacity="0.3" stroke="#ff5c7a" stroke-width="'+sw(1.5)+'" pointer-events="none"/><text x="'+r3(t.p[0])+'" y="'+r3(t.p[1]-12*k)+'" font-size="'+(10*k).toFixed(2)+'" text-anchor="middle" fill="#ff8fa3" stroke="#0c0a14" stroke-width="'+sw(3)+'" paint-order="stroke" font-family="JetBrains Mono, monospace" pointer-events="none">'+inchStr(t.w)+'</text>');});});
  return h.join('');}
var pathG=null;
function buildPaths3D(){if(pathG){helpG.remove(pathG);pathG=null;}if(!TV.paths)return;var pts=[],bad=[];
  walkPaths().forEach(function(P){if(P.none||!P.cells)return;var g=floorGrid(),need=model.specs.access?3:2.99;P.cells.forEach(function(q,i){if(i%4)return;var p=g.pt(q);pts.push(p);bad.push(!g.door[q]&&g.room[q]>=0&&g.width(q)<need-0.01);});});
  if(!pts.length)return;var geo=new THREE.CircleGeometry(0.13,10);geo.rotateX(-Math.PI/2);var im=new THREE.InstancedMesh(geo,new THREE.MeshBasicMaterial({toneMapped:false}),pts.length),M=new THREE.Matrix4(),ok=new THREE.Color('#4dff9a'),no=new THREE.Color('#ff5c7a');
  pts.forEach(function(p,i){M.makeTranslation(p[0],0.06,p[1]);im.setMatrixAt(i,M);im.setColorAt(i,bad[i]?no:ok);});im.renderOrder=4;pathG=im;helpG.add(im);}

/* ---------- accessibility: 5' turning circles, door widths, grab-bar walls ---------- */
var ACC_ROOMS=/bath|wc|powder|kitchen|bed|laundry|living|great|family|dining/i;
function turnSpots(){var g=floorGrid(),out=[];model.rooms.forEach(function(r,ri){if(!ACC_ROOMS.test(r.name))return;var best=-1,bd=0;
  for(var q=0;q<g.room.length;q++){if(g.room[q]!==ri||g.block[q])continue;if(g.dist[q]>bd){bd=g.dist[q];best=q;}}
  out.push({room:r,p:best>=0?g.pt(best):null,ok:bd-g.cs/2>=2.5-0.01,r:Math.max(0,bd-g.cs/2)});});return out;}
function accessSVG(k){if(!model.specs.access)return '';var h=[],sw=function(px){return (px*k).toFixed(3);};
  turnSpots().forEach(function(t){if(!t.p)return;var c=t.ok?'#2de2e6':'#ff5c7a',R=t.ok?2.5:Math.max(0.6,t.r);h.push('<circle cx="'+r3(t.p[0])+'" cy="'+r3(t.p[1])+'" r="'+r3(R)+'" fill="'+c+'" fill-opacity="0.1" stroke="'+c+'" stroke-width="'+sw(1.3)+'" stroke-dasharray="'+sw(5)+' '+sw(3)+'" pointer-events="none"/>');
    if(!t.ok)h.push('<text x="'+r3(t.p[0])+'" y="'+r3(t.p[1])+'" font-size="'+(9.5*k).toFixed(2)+'" text-anchor="middle" fill="#ff8fa3" stroke="#0c0a14" stroke-width="'+sw(3)+'" paint-order="stroke" font-family="JetBrains Mono, monospace" pointer-events="none">'+inchStr(t.r*2)+' circle</text>');});
  return h.join('');}
// Extra rules for the Check tab: walking paths always, accessibility when it's turned on.
function extraChecks(add,ref,items,polys){var sq=function(p,s){s=s||0.6;return [[p[0]-s,p[1]-s],[p[0]+s,p[1]-s],[p[0]+s,p[1]+s],[p[0]-s,p[1]+s]];},acc=!!model.specs.access;
  var spots=[];
  walkPaths().forEach(function(P){var r=P.room,store=/closet|pantry|storage|linen/i.test(r.name);
    if(P.none){if(r.w*r.d>12)add(store?'tip':'warn','path',[ref('room',r)],'No way to walk into '+r.name,'From the front door there is no open path 2\' wide into this room. Check its doors, or furniture blocking them.',[[r.x,r.y],[r.x+r.w,r.y],[r.x+r.w,r.y+r.d],[r.x,r.y+r.d]]);return;}
    P.tight.forEach(function(t){var s=spots.filter(function(q){return Math.hypot(q.p[0]-t.p[0],q.p[1]-t.p[1])<1.6;})[0];if(!s){s={p:t.p,w:t.w,rooms:[]};spots.push(s);}else if(t.w<s.w){s.w=t.w;s.p=t.p;}
      if(s.rooms.indexOf(r.name)<0)s.rooms.push(r.name);});});
  spots.forEach(function(s){var nm=tightNames(s.p),where=nm.length>1?' between '+nm.join(' and '):nm.length?' next to '+nm[0]:'',rs=s.rooms.length>3?s.rooms.slice(0,3).join(', ')+' and '+(s.rooms.length-3)+' more':s.rooms.join(', ');
    add(s.w<2.5?'warn':'tip','path',[{type:'path',id:'p'+Math.round(s.p[0]*2)+'_'+Math.round(s.p[1]*2)}],'Walkway narrows to '+inchStr(s.w)+where,'It is on the way from the front door to '+rs+'. 36" is the usual minimum for a walking path'+(acc?' and for a wheelchair':'')+'.',sq(s.p));});
  if(!acc)return;
  model.doors.forEach(function(d){var W=segLen(d);if(d.type==='overhead'||W>=2.83-0.01)return;add('warn','acc-door',[ref('door',d)],doorName(d)+' is too narrow for a wheelchair','A 34" or 36" door gives the 32" clear opening a wheelchair needs; this one is '+inchStr(W)+'.',zoneRect([d.x1,d.y1],[(d.x2-d.x1)/W,(d.y2-d.y1)/W],[-(d.y2-d.y1)/W,(d.x2-d.x1)/W],0,W,-0.6,0.6));});
  turnSpots().forEach(function(t){if(!t.ok)add('warn','acc-turn',[ref('room',t.room)],t.room.name+' has no 5\' turning circle','The biggest open circle is about '+inchStr(t.r*2)+' across. A wheelchair needs a 60" circle of open floor to turn around.',t.p?sq(t.p,Math.max(0.6,t.r)):null);});
  var walls=wallSolids();
  items.forEach(function(it){var A=itemAx(it),P=polys[it.id];
    if(it.kind==='toilet'){var ok=[1,-1].some(function(sd){var Z=zoneRect([it.cx,it.cy],A.x,[A.z[0]*sd,A.z[1]*sd],-it.w/2,it.w/2,0,1.5);return walls.some(function(s){return overlapDepth(Z,s.poly)>0.02;});});
      if(!ok)add('tip','acc-grab',[ref('item',it)],iName(it)+' has no wall beside it for a grab bar','Put the toilet 16"–18" from a side wall so a grab bar can go there.',P);}
    if(it.kind==='shower')add('tip','acc-shower',[ref('item',it)],'Make '+iName(it)+' curbless','A zero-threshold shower with a fold-down seat and grab bars works for every age.',P);
    if(it.kind==='vanity'&&it.h>2.85)add('tip','acc-vanity',[ref('item',it)],iName(it)+' is '+inchStr(it.h)+' tall','34" or lower, with knee space under one sink, works from a wheelchair.',P);
    if(it.kind==='bed'){var free=itemSides(it).filter(function(s){return s.k==='+z'||s.k==='-z';}).some(function(s){return sideGap(s,spaceObstacles([it.id]),3.1).d>=3;});
      if(!free)add('tip','acc-bed',[ref('item',it)],iName(it)+' needs 36" on one side','One side of the bed with 36" open lets a wheelchair pull up alongside.',P);}});}

/* ---------- wall elevation: one wall drawn flat-on with every height ---------- */
var ELEV={w:null,side:1};
function openElevation(w,side){if(!w){var o=sel&&sel.type==='wall'?getObj():null;w=o;}if(!w){toast('Select a wall first: open the Plan editor and click a wall.',3200);return;}
  ELEV.w=w.id;if(side==null){var L=segLen(w)||1,mx=(w.x1+w.x2)/2,my=(w.y1+w.y2)/2,nx=-(w.y2-w.y1)/L,ny=(w.x2-w.x1)/L;side=roomAt(mx+nx*(w.t/2+0.5),my+ny*(w.t/2+0.5))?1:-1;}ELEV.side=side;
  $('#elevDlg').hidden=false;renderElevation();}
function elevSVG(w,side,forPrint){var L=segLen(w),ux=(w.x2-w.x1)/L,uy=(w.y2-w.y1)/L,n=[-uy*side,ux*side],H=wallHeight(w),t=w.t;
  var right=[n[1],-n[0]],sgn=right[0]*ux+right[1]*uy>0?1:-1,X=function(px,py){var s=(px-w.x1)*ux+(py-w.y1)*uy;return sgn>0?s:L-s;};
  var face=[(w.x1+w.x2)/2+n[0]*t/2,(w.y1+w.y2)/2+n[1]*t/2],rm=roomAt(face[0]+n[0]*0.5,face[1]+n[1]*0.5);
  var Wpx=forPrint?900:620,pad=forPrint?70:56,sc=(Wpx-pad*2)/Math.max(L,6),Hpx=H*sc+pad*2+20,Y=function(z){return pad+(H-z)*sc;},Xp=function(x){return pad+x*sc;};
  var fg=forPrint?'#222':'#ece9f7',mu=forPrint?'#666':'#a9a3c2',ac=forPrint?'#0a7d80':'#2de2e6',h=[];
  function dim(x1,y1,x2,y2,txt,off,vert){var o=off||0;if(vert){h.push('<line x1="'+(x1+o)+'" y1="'+y1+'" x2="'+(x2+o)+'" y2="'+y2+'" stroke="'+ac+'" stroke-width="1"/><line x1="'+(x1+o-4)+'" y1="'+y1+'" x2="'+(x1+o+4)+'" y2="'+y1+'" stroke="'+ac+'"/><line x1="'+(x1+o-4)+'" y1="'+y2+'" x2="'+(x1+o+4)+'" y2="'+y2+'" stroke="'+ac+'"/><text x="'+(x1+o-6)+'" y="'+((y1+y2)/2)+'" fill="'+ac+'" font-size="11" text-anchor="end" dominant-baseline="middle" font-family="JetBrains Mono, monospace">'+esc(txt)+'</text>');}
    else{h.push('<line x1="'+x1+'" y1="'+(y1+o)+'" x2="'+x2+'" y2="'+(y2+o)+'" stroke="'+ac+'" stroke-width="1"/><line x1="'+x1+'" y1="'+(y1+o-4)+'" x2="'+x1+'" y2="'+(y1+o+4)+'" stroke="'+ac+'"/><line x1="'+x2+'" y1="'+(y1+o-4)+'" x2="'+x2+'" y2="'+(y1+o+4)+'" stroke="'+ac+'"/><text x="'+((x1+x2)/2)+'" y="'+(y1+o+13)+'" fill="'+ac+'" font-size="11" text-anchor="middle" font-family="JetBrains Mono, monospace">'+esc(txt)+'</text>');}}
  h.push('<rect x="'+Xp(0)+'" y="'+Y(H)+'" width="'+(L*sc)+'" height="'+(H*sc)+'" fill="'+(forPrint?'#f4f2ee':esc(w.color||model.specs.wallColor||'#ece8e1'))+'" fill-opacity="'+(forPrint?1:0.16)+'" stroke="'+fg+'" stroke-width="1.5"/>');
  h.push('<line x1="'+(pad-14)+'" y1="'+Y(0)+'" x2="'+(pad+L*sc+14)+'" y2="'+Y(0)+'" stroke="'+fg+'" stroke-width="2"/>');
  var marks=[0,L];
  wallOpenings(w).forEach(function(o){var a=sgn>0?o.a:L-o.b,b=sgn>0?o.b:L-o.a;marks.push(a,b);var isDoor=o.kind==='door';
    h.push('<rect x="'+Xp(a)+'" y="'+Y(o.top)+'" width="'+((b-a)*sc)+'" height="'+((o.top-o.bot)*sc)+'" fill="'+(isDoor?(forPrint?'#fff':'#0f0c19'):(forPrint?'#d8eef5':'rgba(45,226,230,.18)'))+'" stroke="'+fg+'" stroke-width="1.2"/>');
    if(isDoor)h.push('<path d="M'+Xp(a)+' '+Y(0)+' L'+Xp(b)+' '+Y(o.top/2)+' L'+Xp(a)+' '+Y(o.top)+'" fill="none" stroke="'+mu+'" stroke-dasharray="4 3"/>');
    else{h.push('<line x1="'+Xp((a+b)/2)+'" y1="'+Y(o.top)+'" x2="'+Xp((a+b)/2)+'" y2="'+Y(o.bot)+'" stroke="'+mu+'"/>');dim(Xp(b),Y(0),Xp(b),Y(o.bot),inFt(o.bot)+' sill',12,true);}
    h.push('<text x="'+Xp((a+b)/2)+'" y="'+(Y(o.top)-6)+'" fill="'+fg+'" font-size="11" text-anchor="middle" font-family="JetBrains Mono, monospace">'+esc(fmt(b-a)+' × '+fmt(o.top-o.bot))+'</text>');});
  // furniture and fixtures standing against this face
  var near=model.items.filter(function(it){if(it.kind==='rug')return false;var P=itemPoly(it),dmin=Infinity;P.concat([[it.cx,it.cy]]).forEach(function(p){var s=(p[0]-w.x1)*ux+(p[1]-w.y1)*uy,off=(p[0]-w.x1)*n[0]+(p[1]-w.y1)*n[1];if(s>-0.5&&s<L+0.5&&off>0)dmin=Math.min(dmin,off-t/2);});
    var cOff=(it.cx-w.x1)*n[0]+(it.cy-w.y1)*n[1];return cOff>0&&dmin<2.2;}).sort(function(a,b){return (b.h||0)-(a.h||0);});
  var tags=[];
  near.forEach(function(it){var xs=itemPoly(it).map(function(p){return X(p[0],p[1]);}),a=Math.max(0,Math.min.apply(0,xs)),b=Math.min(L,Math.max.apply(0,xs));if(b-a<0.2)return;var z0=it.elev||0,z1=z0+(it.h||1);
    h.push('<rect x="'+Xp(a)+'" y="'+Y(z1)+'" width="'+((b-a)*sc)+'" height="'+((z1-z0)*sc)+'" fill="'+esc(it.color||'#888')+'" fill-opacity="'+(forPrint?0.25:0.35)+'" stroke="'+fg+'" stroke-width="1"/>');
    var tw=Math.max(iName(it).length*5.6,40),cx=Xp((a+b)/2),y=Y(z1)+13;while(tags.some(function(q){return Math.abs(q.y-y)<26&&Math.abs(q.x-cx)<(q.w+tw)/2+4;}))y+=26;tags.push({x:cx,y:y,w:tw});
    h.push('<text x="'+cx+'" y="'+y+'" fill="'+fg+'" font-size="10.5" text-anchor="middle" font-family="Space Grotesk, sans-serif" stroke="'+(forPrint?'#fff':'#0f0c19')+'" stroke-width="3" paint-order="stroke">'+esc(iName(it))+'</text><text x="'+cx+'" y="'+(y+12)+'" fill="'+mu+'" font-size="10" text-anchor="middle" font-family="JetBrains Mono, monospace" stroke="'+(forPrint?'#fff':'#0f0c19')+'" stroke-width="3" paint-order="stroke">'+esc(inFt(z1))+' high</text>');});
  (model.fixtures||[]).forEach(function(f){var D=FIX[f.kind];if(!D||D.mount!=='wall')return;var off=(f.x-w.x1)*n[0]+(f.y-w.y1)*n[1],s=(f.x-w.x1)*ux+(f.y-w.y1)*uy;if(off<0||off>t/2+0.6||s<0||s>L)return;var x=X(f.x,f.y),z=fixH(f);
    h.push('<rect x="'+(Xp(x)-5)+'" y="'+(Y(z)-7)+'" width="10" height="14" rx="2" fill="none" stroke="'+(forPrint?'#a14':'#ffb86b')+'" stroke-width="1.4"/><text x="'+(Xp(x)+8)+'" y="'+(Y(z)+4)+'" fill="'+(forPrint?'#a14':'#ffb86b')+'" font-size="9.5" font-family="JetBrains Mono, monospace">'+esc(D.label.split(' ')[0])+' '+inchStr(z)+'</text>');});
  marks=marks.filter(function(v,i,a){return a.indexOf(v)===i;}).sort(function(p,q){return p-q;});
  if(marks.length>2)for(var i=0;i<marks.length-1;i++)if(marks[i+1]-marks[i]>0.3)dim(Xp(marks[i]),Y(0),Xp(marks[i+1]),Y(0),fmt(marks[i+1]-marks[i]),16);
  dim(Xp(0),Y(0),Xp(L),Y(0),fmt(L)+' overall',38);dim(Xp(0),Y(0),Xp(0),Y(H),fmt(H),-14,true);
  var title=(rm?rm.name+' · ':'')+(w.ext?(rm?'inside of exterior wall':'exterior face'):'interior wall')+' · '+fmt(L)+' long';
  return {svg:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+Wpx+' '+Math.round(Hpx+30)+'" width="100%" style="display:block;max-width:'+Wpx+'px">'+h.join('')+'</svg>',title:title};}
function renderElevation(){var w=model.walls.filter(function(x){return x.id===ELEV.w;})[0];if(!w){$('#elevDlg').hidden=true;return;}var E=elevSVG(w,ELEV.side);$('#elevTitle').textContent='Wall elevation';$('#elevSub').textContent=E.title;$('#elevBox').innerHTML=E.svg;}
$('#elevFlip').onclick=function(){ELEV.side=-ELEV.side;renderElevation();};$('#elevClose').onclick=function(){$('#elevDlg').hidden=true;};
$('#elevPrint').onclick=function(){var w=model.walls.filter(function(x){return x.id===ELEV.w;})[0];if(!w)return;var E=elevSVG(w,ELEV.side,true),win=window.open('','_blank');if(!win){toast('Allow pop-ups to print the elevation');return;}
  win.document.write('<!DOCTYPE html><title>'+esc(E.title)+'</title><style>body{font-family:system-ui,sans-serif;margin:24px;color:#222}h1{font-size:18px;margin:0 0 4px}p{color:#666;margin:0 0 16px;font-size:13px}@page{size:landscape;margin:12mm}</style><h1>'+esc(model.specs.name||'Residence')+': wall elevation</h1><p>'+esc(E.title)+'</p>'+E.svg+'<script>setTimeout(function(){print()},300)<\/script>');win.document.close();};
$('#elevBtn').onclick=function(){openElevation();};

/* ---------- auto-arrange: furniture that goes with the selected piece ---------- */
function placeAt(base,lx,lz){var A=itemAx(base);return [r3(base.cx+A.x[0]*lx+A.z[0]*lz),r3(base.cy+A.x[1]*lx+A.z[1]*lz)];}
function fitsHere(o,skip){var P=itemPoly(o);if(!roomAt(o.cx,o.cy))return false;return !spaceObstacles(skip||[]).some(function(ob){return overlapDepth(P,ob.poly)>0.05;});}
function newItem(label,kind,w,d,h,color,cx,cy,rot){return {id:uid('i'),label:label,kind:kind,cx:cx,cy:cy,w:w,d:d,h:h,rot:((Math.round(rot)%360)+360)%360,color:color,note:''};}
function arrangeOptions(it){var l=(it.label||'').toLowerCase();if(it.kind==='bed')return [['nights','Add nightstands + dresser']];
  if(it.kind==='table'&&/desk/.test(l))return [['deskchair','Add a desk chair']];if(it.kind==='table'&&!/coffee|side|end|night|accent/.test(l))return [['chairs','Arrange chairs around it']];
  if(it.kind==='sofa'||it.kind==='sectional')return [['living','Add coffee table, rug + TV']];return [];}
function autoArrange(act){var it=getObj();if(!it)return;var before=JSON.stringify(model),added=[],skipped=[],rot=it.rot||0;
  function tryAdd(o,skip,what){if(fitsHere(o,skip)){model.items.push(o);added.push(o.label);return true;}skipped.push(what||o.label);return false;}
  if(act==='chairs'){var round=/round/i.test(it.label||'')||Math.abs(it.w-it.d)<0.3&&/round/i.test(it.note||''),P=itemPoly(it);
    model.items=model.items.filter(function(o){return !(o.kind==='chair'&&polyDist(P,itemPoly(o))<1.2);});
    var spots=[];if(round){var R=Math.max(it.w,it.d)/2+0.45,n=Math.max(4,Math.floor(Math.PI*Math.max(it.w,it.d)/2.1));for(var i=0;i<n;i++){var a=i/n*Math.PI*2;spots.push([Math.cos(a)*R,Math.sin(a)*R,rot+90-a*180/Math.PI]);}}
    else{var per=Math.max(1,Math.floor((it.w-0.3)/2.0));for(var j=0;j<per;j++){var x=-it.w/2+(j+0.5)*it.w/per;spots.push([x,it.d/2+0.45,rot]);spots.push([x,-it.d/2-0.45,rot+180]);}
      if(it.d>=2.8){spots.push([it.w/2+0.45,0,rot+270]);spots.push([-it.w/2-0.45,0,rot+90]);}}
    var placed=[];spots.forEach(function(s){var c=placeAt(it,s[0],s[1]),o=newItem('Dining chair','chair',1.5,1.6,3.2,'#6b5544',c[0],c[1],s[2]);if(tryAdd(o,[it.id].concat(placed),'a chair'))placed.push(o.id);});}
  else if(act==='nights'){var ids=[it.id];[1,-1].forEach(function(sd){var c=placeAt(it,it.w/2-0.75,sd*(it.d/2+1.15)),o=newItem('Nightstand','cabinet',1.5,2,2.17,'#5a4636',c[0],c[1],rot);if(tryAdd(o,ids,'a nightstand'))ids.push(o.id);});
    var obs=spaceObstacles(ids),A=itemAx(it),foot=[it.cx-A.x[0]*it.w/2,it.cy-A.x[1]*it.w/2],g=castObs([foot[0]-A.x[0]*0.01,foot[1]-A.x[1]*0.01],[-A.x[0],-A.x[1]],obs,30);
    if(g.hit&&g.d>=1.67+2.4){var dc=[foot[0]-A.x[0]*(g.d-0.86),foot[1]-A.x[1]*(g.d-0.86)],dr=newItem('Dresser 60"','cabinet',5,1.67,2.75,'#5a4636',r3(dc[0]),r3(dc[1]),rot+90);tryAdd(dr,ids,'the dresser');}
    else skipped.push('the dresser (no wall across from the foot of the bed with 30" to walk)');}
  else if(act==='living'){var A2=itemAx(it),fr=it.w/2,ct=placeAt(it,fr+1.5+1,0),tb=newItem('Coffee table','table',4,2,1.5,'#6b5544',ct[0],ct[1],rot+90);tryAdd(tb,[it.id]);
    var hasRug=model.items.some(function(o){return o.kind==='rug'&&Math.hypot(o.cx-it.cx,o.cy-it.cy)<6;});if(!hasRug){var rc=placeAt(it,fr+2.3,0),rug=newItem('Rug 8×10','rug',10,8,0.04,'#6f5a7d',rc[0],rc[1],rot+90);model.items.push(rug);added.push(rug.label);}
    var obs2=spaceObstacles([it.id,tb.id]),from=[it.cx+A2.x[0]*(fr+3.6),it.cy+A2.x[1]*(fr+3.6)],g2=castObs(from,A2.x,obs2,24);
    if(g2.hit&&g2.hit.wall&&g2.d>=2){var wd=fr+3.6+g2.d,cc=placeAt(it,wd-0.76,0),con=newItem('TV console','cabinet',6,1.5,2,'#3a3440',cc[0],cc[1],rot+90);if(tryAdd(con,[it.id,tb.id])){var tc=placeAt(it,wd-0.76,0),tv=newItem('TV 65"','tv',4.75,0.75,5,'#111114',tc[0],tc[1],rot+90);model.items.push(tv);added.push(tv.label);}}
    else skipped.push('a TV (no wall across from the sofa)');}
  else if(act==='deskchair'){var S=itemSides(it).filter(function(s){return s.k==='+z'||s.k==='-z';}).sort(function(a,b){return sideGap(b,spaceObstacles([it.id]),10).d-sideGap(a,spaceObstacles([it.id]),10).d;})[0];
    var cc2=[it.cx+S.n[0]*(S.half+0.6),it.cy+S.n[1]*(S.half+0.6)],ch=newItem('Desk chair','chair',2,2,3.3,'#3a3440',r3(cc2[0]),r3(cc2[1]),Math.atan2(-S.n[0],S.n[1])*180/Math.PI);tryAdd(ch,[it.id]);}
  if(!added.length&&JSON.stringify(model)===before){toast('No room to add anything here'+(skipped.length?' ('+skipped.join(', ')+')':'')+'.',3800);return;}
  pushUndo(before);afterChange();toast((added.length?'Added '+added.join(', '):'Rearranged')+(skipped.length?'. Skipped '+skipped.join(', '):'')+'. Ctrl+Z undoes it.',4200);}

/* ---------- will it fit? a piece of a given size, room by room ---------- */
function fitTest(W,D){var g=floorGrid(),cs=g.cs,res=[];
  model.rooms.forEach(function(r,ri){var i0=Math.max(0,Math.floor((r.x-g.x0)/cs)),i1=Math.min(g.nx-1,Math.floor((r.x+r.w-g.x0)/cs)),j0=Math.max(0,Math.floor((r.y-g.y0)/cs)),j1=Math.min(g.ny-1,Math.floor((r.y+r.d-g.y0)/cs)),
      nx=i1-i0+1,ny=j1-j0+1,S=new Int32Array((nx+1)*(ny+1));
    for(var j=0;j<ny;j++)for(var i=0;i<nx;i++){var q=(j0+j)*g.nx+i0+i,bad=g.block[q]||g.room[q]!==ri?1:0;S[(j+1)*(nx+1)+i+1]=bad+S[j*(nx+1)+i+1]+S[(j+1)*(nx+1)+i]-S[j*(nx+1)+i];}
    var best=null;[[W,D,0],[D,W,90]].forEach(function(o){var cw=Math.ceil(o[0]/cs),ch=Math.ceil(o[1]/cs);if(cw>nx||ch>ny)return;
      for(var j=0;j+ch<=ny;j++)for(var i=0;i+cw<=nx;i++){var s=S[(j+ch)*(nx+1)+i+cw]-S[j*(nx+1)+i+cw]-S[(j+ch)*(nx+1)+i]+S[j*(nx+1)+i];if(s)continue;
        var cx=g.x0+(i0+i+cw/2)*cs,cy=g.y0+(j0+j+ch/2)*cs,sc=-Math.hypot(cx-(r.x+r.w/2),cy-(r.y+r.d/2));if(!best||sc>best.sc)best={sc:sc,cx:r3(cx),cy:r3(cy),rot:o[2]};}});
    var doors=model.doors.filter(function(d){var mx=(d.x1+d.x2)/2,my=(d.y1+d.y2)/2;return mx>r.x-0.7&&mx<r.x+r.w+0.7&&my>r.y-0.7&&my<r.y+r.d+0.7;}).map(segLen);
    res.push({room:r,spot:best,door:doors.length?Math.max.apply(0,doors):null});});
  return res.sort(function(a,b){return (!!b.spot)-(!!a.spot);});}
function runFit(){var W=parseLen($('#fitW').value),D=parseLen($('#fitD').value),H=parseLen($('#fitH').value||'0')||0,box=$('#fitOut');
  if(!W||!D||W<=0||D<=0){box.innerHTML='<p class="hint">Type a width and a depth, like <b>7\'</b> and <b>38"</b>.</p>';return;}
  var dims=[W,D].concat(H?[H]:[]).sort(function(a,b){return a-b;}),need=dims[0],fd=frontDoor(),fdW=fd?segLen(model.doors.filter(function(d){return Math.abs((d.x1+d.x2)/2-fd.mx)<0.01&&Math.abs((d.y1+d.y2)/2-fd.my)<0.01;})[0]||{x1:0,y1:0,x2:3,y2:0}):3;
  var doorH=model.specs.doorH,through=need<=fdW-0.08&&(dims.length<3||dims[1]<=doorH-0.05);
  var R=fitTest(W,D),h='<p class="fit-sum '+(through?'ok':'no')+'">'+(through?'✓ Gets through the '+inchStr(fdW)+' front door':'✗ Too big for the '+inchStr(fdW)+' front door')+' <span>(its smallest side is '+inchStr(need)+(H?'':'; add a height to check tipping it on end')+')</span></p><ul class="fit-list">';
  R.forEach(function(x,i){var dn=x.door&&need>x.door-0.08?' · too wide for its '+inchStr(x.door)+' door':'';
    h+='<li class="'+(x.spot?'ok':'no')+'"><span>'+esc(x.room.name)+'</span><em>'+(x.spot?'fits'+dn:'no open spot')+'</em>'+(x.spot?'<button class="btn mini" data-fitplace="'+i+'">Place</button>':'')+'</li>';});
  box.innerHTML=h+'</ul>';
  $$('[data-fitplace]',box).forEach(function(b){b.onclick=function(){var x=R[+b.dataset.fitplace];pushUndo();var nm=($('#fitName').value||'').trim()||'New piece',o=newItem(nm,'cabinet',W,D,H||2.5,'#8a7b6a',x.spot.cx,x.spot.cy,x.spot.rot);
    model.items.push(o);sel={type:'item',id:o.id};setEditing(true);afterChange();onSelChange();toast(nm+' placed in '+x.room.name+'. Drag it where you want it; the zones show the space around it.',4200);};});}
$('#fitBtn').onclick=runFit;['#fitW','#fitD','#fitH'].forEach(function(s){$(s).addEventListener('keydown',function(e){if(e.key==='Enter')runFit();});});
$('#tAccess').onchange=function(e){pushUndo();model.specs.access=e.target.checked;afterChange();if(e.target.checked){toast('Accessibility checks are on: see the Check tab and the 5\' circles in the plan.',3600);}};
