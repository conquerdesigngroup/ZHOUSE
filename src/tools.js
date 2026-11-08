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
function syncToolsUI(){[['tRings','rings'],['tDists','dists'],['tSnapAl','snap'],['tSwings','swings']].forEach(function(p){var el=$('#'+p[0]);if(el)el.checked=!!TV[p[1]];});}
[['tRings','rings'],['tDists','dists'],['tSnapAl','snap'],['tSwings','swings']].forEach(function(p){var el=$('#'+p[0]);if(!el)return;el.onchange=function(){TV[p[1]]=el.checked;saveTV();renderPlan();buildHelpers3D();};});
$$('[data-tape]').forEach(function(b){b.onclick=function(){setTape(!tape.on);};});
$$('[data-tapeclear]').forEach(function(b){b.onclick=clearTape;});
$('#personBtn').onclick=addPerson;
syncToolsUI();drawTape();
