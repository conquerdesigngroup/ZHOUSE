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
  model.items.forEach(function(it){if((skip&&skip.indexOf(it.id)>=0)||it.kind==='rug'||!onFloorItem(it))return;out.push({poly:itemPoly(it),ref:{type:'item',id:it.id},name:iName(it),it:it});});return out;}
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
function planExtrasSVG(k){if(!TV)return '';var h=[];if(!model.onFloor2)model.items.forEach(function(it){if(it.kind==='stairs')h.push(stairSVG(it,k,false));});var sw=function(px){return (px*k).toFixed(3);},fs=(10.5*k).toFixed(2),o=sel&&sel.type==='item'?getObj():null;
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
function buildHelpers3D(){if(!helpG)return;helpG.position.y=activeElev();while(helpG.children.length){var c=helpG.children.pop();if(c.geometry)c.geometry.dispose();if(c.material)c.material.dispose();}
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
function syncToolsUI(){TOGS.forEach(function(p){var el=$('#'+p[0]);if(el)el.checked=!!TV[p[1]];});var a=$('#tAccess');if(a)a.checked=!!model.specs.access;if(typeof renderFloorsUI==='function'){renderFloorsUI();syncRoofUI();}}
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
  model.items.forEach(function(it){if(it.kind==='rug'||!onFloorItem(it))return;rast(itemPoly(it),function(i){if(!block[i])block[i]=2;});});
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

/* ---------- floors: the ground floor plus an optional second floor ----------
   The floor being edited always lives in model.walls/doors/windows/rooms/items/fixtures, so every
   editor, check and tool works on it unchanged. The other floor waits in model.floor2 (with
   floor2.elev, the height of the upper floor). model.onFloor2 is true while the second floor is
   the one being edited; saves and comparisons use the canonical form (ground floor in front). */
var LEVELS=[],LV_KEYS=['walls','doors','windows','rooms','items','fixtures'],WALLHUNG=['art','mirror','curtain'],walkLv=0,lampShades=[],roofG=null;
function swapLevels(m){var f=m.floor2;if(!f)return;LV_KEYS.forEach(function(k){var t=m[k];m[k]=f[k]||[];f[k]=t;});if(m.onFloor2)delete m.onFloor2;else m.onFloor2=true;}
function canonJSON(m){if(!m.onFloor2||!m.floor2)return JSON.stringify(m);var c=clone(m);swapLevels(c);return JSON.stringify(c);}
function canonStr(s){return s.indexOf('"onFloor2":true')<0?s:canonJSON(JSON.parse(s));}
function keepFloor(wasOn2){if(!!model.onFloor2!==wasOn2&&model.floor2)swapLevels(model);}
function floor2Elev(){return model.floor2&&model.floor2.elev||10;}
function activeElev(){return model.onFloor2&&model.floor2?floor2Elev():0;}
function groundItems(){return model.onFloor2&&model.floor2?model.floor2.items:model.items;}
function eachLevel(fn){lampShades=[];roofG=null;if(!model.floor2){fn({lv:0,elev:0,active:true,top:true});return;}var act=model.onFloor2?1:0;
  [0,1].forEach(function(lv){var me=lv===act;if(!me)swapLevels(model);try{fn({lv:lv,elev:lv?floor2Elev():0,active:me,top:lv===1});}finally{if(!me)swapLevels(model);}});}
function stairHoles(){return (groundItems()||[]).filter(function(it){return it.kind==='stairs';}).map(function(it){return {it:it,poly:itemPoly(it)};});}
function onFloorItem(it){return it.kind!=='person'&&WALLHUNG.indexOf(it.kind)<0&&!((it.elev||0)>=1.5);}
function roomPlane(r,holes,m,down){var inR=function(p){return p[0]>=r.x-0.01&&p[0]<=r.x+r.w+0.01&&p[1]>=r.y-0.01&&p[1]<=r.y+r.d+0.01;},hs=(holes||[]).filter(function(H){return H.poly.every(inR);});
  if(!hs.length){var pm=new THREE.Mesh(new THREE.PlaneGeometry(Math.max(r.w,0.1),Math.max(r.d,0.1)),m);pm.rotation.x=down?Math.PI/2:-Math.PI/2;pm.position.set(r.x+r.w/2,0,r.y+r.d/2);return pm;}
  var sg=down?1:-1,V=function(p){return new THREE.Vector2(p[0],sg*p[1]);},sh=new THREE.Shape([[r.x,r.y],[r.x+r.w,r.y],[r.x+r.w,r.y+r.d],[r.x,r.y+r.d]].map(V));
  hs.forEach(function(H){sh.holes.push(new THREE.Path(H.poly.map(V)));});
  var g=new THREE.ShapeGeometry(sh),pos=g.attributes.position,uv=g.attributes.uv;for(var i=0;i<pos.count;i++)uv.setXY(i,(pos.getX(i)-r.x)/r.w,1-(sg*pos.getY(i)-r.y)/r.d);uv.needsUpdate=true;
  var mesh=new THREE.Mesh(g,m);mesh.rotation.x=down?Math.PI/2:-Math.PI/2;return mesh;}
// The floor structure under an upstairs room, from the ceiling below up to the new floor, with the stair opening cut out.
// Between the ground-floor walls and the floor above: a band of siding outside, so no gap shows.
function rimBands(){if(!model.floor2)return;var E=floor2Elev();model.walls.forEach(function(w){if(!w.ext)return;var h=wallHeight(w);if(E-h<0.05)return;var L=segLen(w);if(L<0.2)return;
  var b=bx(L+(w.t||0.5),E-h,w.t||0.5,realMat('siding',w.extColor||'#e4e1da'));b.position.set((w.x1+w.x2)/2,h+(E-h)/2,(w.y1+w.y2)/2);b.rotation.y=-Math.atan2(w.y2-w.y1,w.x2-w.x1);house.add(b);});}
function upperSlab(r,holes){var e=0.3,R=[[r.x-e,r.y-e],[r.x+r.w+e,r.y-e],[r.x+r.w+e,r.y+r.d+e],[r.x-e,r.y+r.d+e]],V=function(p){return new THREE.Vector2(p[0],-p[1]);};
  var gTop=(model.floor2.rooms||[]).reduce(function(m,q){return Math.max(m,q.ceil||model.specs.ceiling);},0)||model.specs.ceiling,dep=clamp(floor2Elev()-gTop,0.4,4);
  var sh=new THREE.Shape(R.map(V));(holes||[]).forEach(function(H){if(H.poly.every(function(p){return p[0]>r.x-e&&p[0]<r.x+r.w+e&&p[1]>r.y-e&&p[1]<r.y+r.d+e;}))sh.holes.push(new THREE.Path(H.poly.map(V)));});
  var m=new THREE.Mesh(new THREE.ExtrudeGeometry(sh,{depth:dep-0.01,bevelEnabled:false}),realMat('plaster','#e4e0d8',{rough:0.9}));m.rotation.x=-Math.PI/2;m.position.y=-dep;m.castShadow=true;m.receiveShadow=true;return m;}
function levelTag(LV,c0,p0,d0){if(!model.floor2)return;for(var i=c0;i<colSegs.length;i++)if(colSegs[i].lv==null)colSegs[i].lv=LV.lv;
  Object.keys(doorObjs).forEach(function(id){if(d0.indexOf(id)<0)doorObjs[id].lv=LV.lv;});
  if(!LV.active)for(var j=p0;j<pickables.length;j++){var u=pickables[j].userData;if(u.sel)u.sel=Object.assign({},u.sel,{inactive:true});}}
// Stairs: rails block the long sides; downstairs the high end is closed, upstairs the low end is.
function stairSegs(it){var P=itemPoly(it),seg=function(a,b,lv){var s={x1:a[0],y1:a[1],x2:b[0],y2:b[1],r:0.08};if(lv!=null)s.lv=lv;colSegs.push(s);};
  seg(P[0],P[1]);seg(P[2],P[3]);seg(P[1],P[2]);if(model.floor2){seg(P[0],P[1],1);seg(P[2],P[3],1);seg(P[3],P[0],1);}}
function walkFloorY(){if(!model.floor2){walkLv=0;return 0;}var E=floor2Elev(),hs=stairHoles();
  for(var i=0;i<hs.length;i++){var it=hs[i].it,A=itemAx(it),dx=player.x-it.cx,dz=player.z-it.cy,lx=dx*A.x[0]+dz*A.x[1],lz=dx*A.z[0]+dz*A.z[1];
    if(Math.abs(lx)<=it.w/2+0.05&&Math.abs(lz)<=it.d/2){var t=clamp((lx+it.w/2)/it.w,0,1);walkLv=t>0.5?1:0;return t*E;}}
  return walkLv?E:0;}
// What shows in orbit: floors above the one being edited only with "show roof" on; everything in walk mode.
function levelsView(){var walk=view.mode==='walk',act=model.onFloor2?1:0,all=walk||!!TV.roof;
  LEVELS.forEach(function(L){if(L.active)return;if(L.lv>act){L.g.visible=all;L.vert.scale.y=1;L.ceil.visible=walk;}else{L.g.visible=true;L.vert.scale.y=1;L.ceil.visible=true;}});
  if(roofG)roofG.visible=roofSpec().style!=='none'&&(walk||(!!TV.roof&&view.cut>=0.999));
  var lb=$('#labels');if(lb)lb.classList.toggle('under-roof',!walk&&!!(roofG&&roofG.visible));}
function ghostLevelSVG(k){var f=model.floor2;if(!f)return '';var h=[],sw=function(px){return (px*k).toFixed(3);};
  (f.rooms||[]).forEach(function(r){h.push('<rect x="'+r.x+'" y="'+r.y+'" width="'+r.w+'" height="'+r.d+'" fill="none" stroke="#6a5f8a" stroke-opacity="0.5" stroke-width="'+sw(1)+'" stroke-dasharray="'+sw(2)+' '+sw(4)+'" pointer-events="none"/>');});
  (f.walls||[]).forEach(function(w){h.push('<line x1="'+w.x1+'" y1="'+w.y1+'" x2="'+w.x2+'" y2="'+w.y2+'" stroke="#bdb6d6" stroke-opacity="0.22" stroke-width="'+(w.t||0.33)+'" pointer-events="none"/>');});
  if(model.onFloor2)stairHoles().forEach(function(H){h.push(stairSVG(H.it,k,true));});
  return h.join('');}
function stairSVG(it,k,hole){var A=itemAx(it),n=Math.max(3,Math.round((model.floor2?floor2Elev():it.h||9)/0.625)),h=[],sw=function(px){return (px*k).toFixed(3);},P=function(lx,lz){return r3(it.cx+A.x[0]*lx+A.z[0]*lz)+','+r3(it.cy+A.x[1]*lx+A.z[1]*lz);};
  var col=hole?'#ffd84d':'#cfc8e8';if(hole)h.push('<polygon points="'+itemPoly(it).map(function(p){return r3(p[0])+','+r3(p[1]);}).join(' ')+'" fill="#000" fill-opacity="0.45" stroke="'+col+'" stroke-width="'+sw(1.2)+'" pointer-events="none"/>');
  for(var i=1;i<n;i++){var x=-it.w/2+it.w*i/n;h.push('<polyline points="'+P(x,-it.d/2)+' '+P(x,it.d/2)+'" stroke="'+col+'" stroke-opacity="0.6" stroke-width="'+sw(1)+'" pointer-events="none"/>');}
  h.push('<polyline points="'+P(-it.w/2+0.5,0)+' '+P(it.w/2-0.5,0)+' '+P(it.w/2-1.1,-0.45)+' '+P(it.w/2-0.5,0)+' '+P(it.w/2-1.1,0.45)+'" fill="none" stroke="'+col+'" stroke-width="'+sw(1.6)+'" pointer-events="none"/>');
  var tp=P(hole?it.w/2-1.6:-it.w/2+1.2,0).split(',');h.push('<text x="'+tp[0]+'" y="'+tp[1]+'" font-size="'+(10*k).toFixed(2)+'" text-anchor="middle" dominant-baseline="middle" fill="'+col+'" stroke="#0c0a14" stroke-width="'+sw(3)+'" paint-order="stroke" font-family="JetBrains Mono, monospace" pointer-events="none">'+(hole?'DN':'UP')+'</text>');
  return h.join('');}
function setLevel(n){if(!model.floor2||n===(model.onFloor2?1:0))return;sel=null;swapLevels(model);orbit.ty=activeElev();CK.memo=null;afterChange();if(document.body.classList.contains('editing')){fitPlan();renderPlan();}
  toast(n?'Editing the second floor. The ground floor shows faintly under it in the plan.':'Editing the ground floor.',2600);}
function footprintRects(){var R=model.rooms;if(!R.length)return [];var S=0.5,x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;R.forEach(function(r){x0=Math.min(x0,r.x);y0=Math.min(y0,r.y);x1=Math.max(x1,r.x+r.w);y1=Math.max(y1,r.y+r.d);});
  var W=Math.ceil((x1-x0)/S),H=Math.ceil((y1-y0)/S),g=new Uint8Array(W*H);
  R.forEach(function(r){for(var j=Math.round((r.y-y0)/S);j<Math.round((r.y+r.d-y0)/S);j++)for(var i=Math.round((r.x-x0)/S);i<Math.round((r.x+r.w-x0)/S);i++)if(i>=0&&j>=0&&i<W&&j<H)g[j*W+i]=1;});
  // close small gaps under interior walls between rooms
  for(var pass=0;pass<2;pass++)for(var j=0;j<H;j++)for(var i=0;i<W;i++){if(g[j*W+i])continue;var h=i>0&&i<W-1&&g[j*W+i-1]&&g[j*W+i+1],v=j>0&&j<H-1&&g[(j-1)*W+i]&&g[(j+1)*W+i];if(h||v)g[j*W+i]=1;}
  var out=[];for(var guard=0;guard<6;guard++){var best=null,hts=new Int32Array(W);
    for(var j2=0;j2<H;j2++){for(var i2=0;i2<W;i2++)hts[i2]=g[j2*W+i2]?hts[i2]+1:0;
      for(var a=0;a<W;a++){if(!hts[a])continue;var mh=Infinity;for(var b2=a;b2<W&&hts[b2];b2++){mh=Math.min(mh,hts[b2]);var ar=mh*(b2-a+1);if(!best||ar>best.ar)best={ar:ar,i:a,j:j2-mh+1,w:b2-a+1,h:mh};}}}
    if(!best||best.ar*S*S<30)break;out.push({x:r3(x0+best.i*S),y:r3(y0+best.j*S),w:r3(best.w*S),d:r3(best.h*S)});
    for(var jj=best.j;jj<best.j+best.h;jj++)for(var ii=best.i;ii<best.i+best.w;ii++)g[jj*W+ii]=0;}
  return out;}
function addFloor2(){if(model.floor2)return;pushUndo();var mc=model.rooms.reduce(function(m,r){return Math.max(m,roomCeil(r));},model.specs.ceiling);
  var F={elev:r3(mc+1),walls:[],doors:[],windows:[],rooms:[],items:[],fixtures:[]};model.floor2=F;var bb=bounds(),ext=model.walls.filter(function(w){return w.ext;});
  ext.forEach(function(w){var c=clone(w);c.id=uid('w');c.h=null;c.note='';F.walls.push(c);});
  model.windows.forEach(function(wi){var hw=hostWall(wi);if(!hw||!hw.ext)return;var c=clone(wi);c.id=uid('win');c.name=(wi.name||'Window')+' (upstairs)';F.windows.push(c);});
  footprintRects().forEach(function(R,i){F.rooms.push({id:uid('r'),name:i?'Upstairs '+(i+1):'Upstairs',x:R.x,y:R.y,w:R.w,d:R.d,ceil:null,floor:'#9b7653',floorMat:'wood',note:''});});
  if(!F.rooms.length)F.rooms.push({id:uid('r'),name:'Upstairs',x:r3(bb.x+0.25),y:r3(bb.y+0.25),w:r3(bb.w-0.5),d:r3(bb.d-0.5),ceil:null,floor:'#9b7653',floorMat:'wood',note:''});
  swapLevels(model);sel=null;orbit.ty=activeElev();setEditing(true);afterChange();setTimeout(function(){fitPlan();renderPlan();},60);
  toast('Added a second floor with the same outside walls and windows. Draw its rooms and walls with Draw walls (B), then add stairs.',5600);}
function removeFloor2(){if(!model.floor2||!window.confirm('Remove the second floor and everything on it? (Undo brings it back.)'))return;pushUndo();if(model.onFloor2)swapLevels(model);delete model.floor2;sel=null;orbit.ty=0;afterChange();toast('Second floor removed. Ctrl+Z brings it back.');}
function addStairs(){if(model.onFloor2)setLevel(0);var E=model.floor2?floor2Elev():10,n=Math.max(3,Math.round(E/0.625)),c=viewCenter();pushUndo();
  var o={id:uid('i'),label:'Stairs',kind:'stairs',cx:snapV(c.x),cy:snapV(c.y),w:r3(Math.max(6,(n-1)*0.833)),d:3.5,h:E,rot:0,color:'#8a6a4c',note:n+' risers of about '+inchStr(E/n)+', 10" treads'};
  model.items.push(o);sel={type:'item',id:o.id};setEditing(true);afterChange();onSelChange();toast('Stairs added on the ground floor, going up toward the arrow. Drag and turn them into place; the opening upstairs follows.',5200);}
function renderFloorsUI(){var box=$('#floorBox');if(!box)return;var F=model.floor2,on=!!model.onFloor2,seg=$('#lvSeg');if(seg){seg.hidden=!F;}
  $$('[data-lv]').forEach(function(b){b.classList.toggle('on',(+b.dataset.lv===1)===on);});
  var key=(F?'2:'+F.elev:'1')+(on?'u':'g');if(box._k===key)return;box._k=key;
  box.innerHTML=!F?'<button class="btn" id="addF2">Add a second floor</button><p class="hint">It starts with the same outside walls and windows as the ground floor and one open room. Stairs connect the two in walk mode.</p>':
    '<div class="seg lv-seg"><button data-lv="0">Ground floor</button><button data-lv="1">Second floor</button></div>'+
    '<div class="row"><span class="lbl">Upstairs floor at</span><input id="f2Elev" class="txt" inputmode="decimal" value="'+fmt(F.elev)+'"></div>'+
    '<div class="row2"><button class="btn" id="addStairs">Add stairs</button><button class="btn danger" id="rmF2">Remove 2nd floor</button></div>'+
    '<p class="hint">You edit one floor at a time; the other shows faintly in the plan. Walk up the stairs in walk mode.</p>';
  $$('[data-lv]').forEach(function(b){b.onclick=function(){setLevel(+b.dataset.lv);};b.classList.toggle('on',(+b.dataset.lv===1)===on);});
  if($('#addF2'))$('#addF2').onclick=addFloor2;if($('#addStairs'))$('#addStairs').onclick=addStairs;if($('#rmF2'))$('#rmF2').onclick=removeFloor2;
  if($('#f2Elev'))$('#f2Elev').onchange=function(e){var v=parseLen(e.target.value);if(!v||v<6||v>30){toast('Type a height like 10\' or 10\'6"');renderFloorsUI();return;}pushUndo();model.floor2.elev=r3(v);box._k=null;afterChange();};}

/* ---------- roof: gable, hip or flat, with shingles or metal, overhangs and gutters ---------- */
var ROOF_COLORS=[['#4b4f57','Charcoal'],['#2a2b2e','Black'],['#7a6a58','Weathered wood'],['#5a6575','Slate blue'],['#8c4a35','Terracotta'],['#55634f','Forest green'],['#9aa0a6','Light gray']];
function roofSpec(){return Object.assign({style:'gable',pitch:6,over:1.5,mat:'shingle',color:'#4b4f57',gutters:true},model.specs.roof||{});}
var roofTexCache={};
function roofTex(kind){if(roofTexCache[kind])return roofTexCache[kind];var N=256,c=document.createElement('canvas');c.width=c.height=N;var g=c.getContext('2d'),R=rng(kind==='metal'?77:31);
  if(kind==='metal'){g.fillStyle='#d0d0d0';g.fillRect(0,0,N,N);for(var x=0;x<N;x+=N/2){g.fillStyle='#f4f4f4';g.fillRect(x,0,6,N);g.fillStyle='#8a8a8a';g.fillRect(x+6,0,3,N);}for(var i=0;i<N;i++){g.fillStyle='rgba(255,255,255,'+(R()*0.05)+')';g.fillRect(0,i,N,1);}}
  else{g.fillStyle='#777';g.fillRect(0,0,N,N);var rows=8,rh=N/rows,tw=N/3;for(var r=0;r<rows;r++){var off=(r%2)*tw/2;for(var x2=-tw;x2<N+tw;x2+=tw){var v=150+((R()*70)|0);g.fillStyle='rgb('+v+','+v+','+v+')';g.fillRect(x2+off+1,r*rh,tw-2,rh-3);}
      g.fillStyle='rgba(0,0,0,0.55)';g.fillRect(0,r*rh+rh-3,N,3);}for(var k=0;k<9000;k++){var q=R()<0.5?0:255;g.fillStyle='rgba('+q+','+q+','+q+','+(R()*0.18)+')';g.fillRect(R()*N,R()*N,1.5,1.5);}}
  var t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.encoding=THREE.sRGBEncoding;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());roofTexCache[kind]=t;return t;}
function buildRoof(LV){var R=roofSpec();if(R.style==='none')return;var ws=model.walls.filter(function(w){return w.ext;});if(!ws.length)ws=model.walls;if(!ws.length)return;
  var x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity,base=0;ws.forEach(function(w){var t=(w.t||0.5)/2;x0=Math.min(x0,Math.min(w.x1,w.x2)-t);x1=Math.max(x1,Math.max(w.x1,w.x2)+t);y0=Math.min(y0,Math.min(w.y1,w.y2)-t);y1=Math.max(y1,Math.max(w.y1,w.y2)+t);base=Math.max(base,wallHeight(w));});
  var G=new THREE.Group();roofG=G;house.add(G);var cx=(x0+x1)/2,cy=(y0+y1)/2,alongX=(x1-x0)>=(y1-y0),A=(alongX?x1-x0:y1-y0)/2,B=(alongX?y1-y0:x1-x0)/2,o=Math.max(0,R.over),k=R.pitch/12,Hr=B*k,drop=o*k,sec=Math.sqrt(1+k*k);
  var W=function(s,t,y){return alongX?new THREE.Vector3(cx+s,y,cy+t):new THREE.Vector3(cx+t,y,cy+s);};
  var tex=roofTex(R.mat==='metal'?'metal':'shingle'),rm=new THREE.MeshStandardMaterial({color:new THREE.Color(R.color).convertSRGBToLinear(),map:tex,roughness:R.mat==='metal'?0.35:0.9,metalness:R.mat==='metal'?0.55:0,side:THREE.DoubleSide});
  if(R.mat==='metal'&&ENV){rm.envMap=ENV;rm.envMapIntensity=0.6;}
  var pos=[],uvs=[],TS=R.mat==='metal'?2:3;
  function face(pts,uvf){for(var i=1;i<pts.length-1;i++)[pts[0],pts[i],pts[i+1]].forEach(function(p){var v=W(p[0],p[1],p[2]);pos.push(v.x,v.y,v.z);var u=uvf(p);uvs.push(u[0]/TS,u[1]/TS);});}
  var yAt=function(dist){return base+dist*k;},E=-drop+base;                                    // dist = horizontal distance in from the wall line
  if(R.style==='flat'){var sl=bx((alongX?2*A:2*B)+2*o,0.6,(alongX?2*B:2*A)+2*o,rm);sl.position.set(cx,base+0.3,cy);G.add(sl);}
  else if(R.style==='hip'&&A>B){var rA=A-B;
    face([[-(A+o),B+o,E],[A+o,B+o,E],[rA,0,base+Hr],[-rA,0,base+Hr]],function(p){return [p[0],(B+o-p[1])*sec];});
    face([[-(A+o),-(B+o),E],[A+o,-(B+o),E],[rA,0,base+Hr],[-rA,0,base+Hr]],function(p){return [p[0],(B+o+p[1])*sec];});
    face([[A+o,-(B+o),E],[A+o,B+o,E],[rA,0,base+Hr]],function(p){return [p[1],(A+o-p[0])*sec];});
    face([[-(A+o),-(B+o),E],[-(A+o),B+o,E],[-rA,0,base+Hr]],function(p){return [p[1],(A+o+p[0])*sec];});}
  else{face([[-(A+o),0,base+Hr],[A+o,0,base+Hr],[A+o,B+o,E],[-(A+o),B+o,E]],function(p){return [p[0],(B+o-p[1])*sec];});
    face([[-(A+o),0,base+Hr],[A+o,0,base+Hr],[A+o,-(B+o),E],[-(A+o),-(B+o),E]],function(p){return [p[0],(B+o+p[1])*sec];});
    var sid=realMat('siding',model.walls.filter(function(w){return w.ext;}).map(function(w){return w.extColor;})[0]||'#e4e1da'),gp=[];
    [-A,A].forEach(function(s){[[s,-B,base],[s,B,base],[s,0,base+Hr]].forEach(function(p){var v=W(p[0],p[1],p[2]);gp.push(v.x,v.y,v.z);});});
    var gg=new THREE.BufferGeometry();gg.setAttribute('position',new THREE.Float32BufferAttribute(gp,3));var guv=[];for(var gi=0;gi<gp.length;gi+=3)guv.push((alongX?gp[gi+2]:gp[gi])/3,gp[gi+1]/3);gg.setAttribute('uv',new THREE.Float32BufferAttribute(guv,2));gg.computeVertexNormals();
    var gm=new THREE.Mesh(gg,sid.clone());gm.material.side=THREE.DoubleSide;gm.castShadow=true;gm.receiveShadow=true;G.add(gm);}
  if(pos.length){var geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geo.computeVertexNormals();
    var rf=new THREE.Mesh(geo,rm);rf.castShadow=true;rf.receiveShadow=true;G.add(rf);}
  // fascia boards and gutters along the eaves; downspouts at the corners
  if(R.style!=='flat'){var eaves=R.style==='hip'&&A>B?[[1,0],[-1,0],[0,1],[0,-1]]:[[1,0],[-1,0]];var fas=mat(TRIM,{roughness:0.6}),gut=mat('#e9e7e2',{roughness:0.4,metalness:0.2});
    eaves.forEach(function(e){var len=e[0]?2*(A+o):2*(B+o),c=e[0]?W(0,e[0]*(B+o),E-0.3):W(e[1]*(A+o),0,E-0.3),fb=bx(alongX===!!e[0]?len:0.12,0.6,alongX===!!e[0]?0.12:len,fas);fb.position.copy(c);G.add(fb);
      if(R.gutters){var gc=e[0]?W(0,e[0]*(B+o+0.22),E-0.32):W(e[1]*(A+o+0.22),0,E-0.32),cy2=cyl(0.22,0.18,len,gut);cy2.position.copy(gc);if(alongX===!!e[0])cy2.rotation.z=Math.PI/2;else cy2.rotation.x=Math.PI/2;G.add(cy2);}});
    if(R.gutters)[[-1,-1],[1,-1],[-1,1],[1,1]].forEach(function(q){if(eaves.length===2&&false)return;var p=W(q[0]*(A-0.35),q[1]*(B+0.12),0),hh=E-0.3+LV.elev;var ds=bx(0.25,hh,0.18,gut);ds.position.set(p.x,E-0.3-hh/2,p.z);G.add(ds);});}
  else{var par=mat(TRIM,{roughness:0.6});[[0,1],[0,-1],[1,0],[-1,0]].forEach(function(e){var len=e[0]?2*(B+o):2*(A+o),c=e[0]?W(e[0]*(A+o),0,base+0.9):W(0,e[1]*(B+o),base+0.9),pp=bx(alongX===!e[0]?len:0.35,0.6,alongX===!e[0]?0.35:len,par);pp.position.copy(c);G.add(pp);});}}
function setRoof(k,v){var R=roofSpec();R[k]=v;pushUndo();model.specs.roof=R;afterChange();if(R.style!=='none'&&!TV.roof&&view.mode!=='walk'){TV.roof=true;saveTV();levelsView();syncToolsUI();toast('Showing the roof from outside. Turn off "Show the roof" to look inside again.',3600);}}
function syncRoofUI(){var R=roofSpec(),q=function(s){return $(s);};if(!q('#roofStyle'))return;q('#roofStyle').value=R.style;q('#roofPitch').value=String(R.pitch);q('#roofOver').value=fmt(R.over);q('#roofMat').value=R.mat;q('#roofColor').value=R.color;q('#roofGut').checked=!!R.gutters;q('#tRoof').checked=!!TV.roof;
  $$('.roof-only').forEach(function(el){el.style.display=R.style==='none'?'none':'';});}
(function(){var pc=$('#roofPitch');if(pc)pc.innerHTML=[3,4,5,6,7,8,9,10,12].map(function(n){return '<option value="'+n+'">'+n+' in 12'+(n===4?' (low)':n===6?' (typical)':n===12?' (steep)':'')+'</option>';}).join('');
  var rc=$('#roofColor');if(rc)rc.innerHTML=ROOF_COLORS.map(function(c){return '<option value="'+c[0]+'">'+c[1]+'</option>';}).join('');
  if(!$('#roofStyle'))return;$('#roofStyle').onchange=function(e){setRoof('style',e.target.value);};$('#roofPitch').onchange=function(e){setRoof('pitch',+e.target.value);};
  $('#roofOver').onchange=function(e){var v=parseLen(e.target.value);if(v==null||v<0||v>4){toast('Overhang between 0 and 4\'');syncRoofUI();return;}setRoof('over',r3(v));};
  $('#roofMat').onchange=function(e){setRoof('mat',e.target.value);};$('#roofColor').onchange=function(e){setRoof('color',e.target.value);};$('#roofGut').onchange=function(e){setRoof('gutters',e.target.checked);};
  $('#tRoof').onchange=function(e){TV.roof=e.target.checked;saveTV();levelsView();};})();

/* ---------- more furniture: lamps, art, mirrors, curtains, sectionals, ottomans, styles ---------- */
var STYLES={any:null,modern:{fab:'#8b8e94',wood:'#2f2a27',accent:'#1f1f22'},farmhouse:{fab:'#e6e0d4',wood:'#9a7452',accent:'#3a3633'},traditional:{fab:'#6b2f35',wood:'#4e3324',accent:'#b08d57'},
  midcentury:{fab:'#c98a3c',wood:'#8a5a35',accent:'#2d4a52'},coastal:{fab:'#d5dee3',wood:'#d8c8ad',accent:'#4f7c94'},industrial:{fab:'#5b4a3f',wood:'#6b4e36',accent:'#2b2b2b'}};
var catStyle='any';
function styleColor(p){var S=STYLES[catStyle];if(!S)return p[5];var k=p[1],l=p[0].toLowerCase();
  if(['sofa','sectional','ottoman'].indexOf(k)>=0||(k==='chair'&&!/dining|desk|stool/.test(l))||/bench/.test(l))return S.fab;
  if(k==='table'||k==='shelf'||(k==='cabinet'&&lum(p[5])<0.45)||(k==='bed')||(k==='chair'&&/dining|stool/.test(l)))return S.wood;
  if(k==='lamp'||/frame|mirror/.test(l))return S.accent;return p[5];}
CATALOG.forEach(function(c){var add={Bedroom:[['Bench, end of bed','ottoman',4,1.5,1.5,'#7a6a8e'],['Table lamp','lamp',1.1,1.1,2.1,'#2b2b2e'],['Floor mirror','mirror',2,0.25,5.5,'#2b2b2e']],
  Living:[['Sectional 9\'×7\'','sectional',7,9,2.8,'#5c5f78'],['Ottoman','ottoman',2.5,2.5,1.4,'#7a6a8e'],['Floor lamp','lamp',1.3,1.3,5.4,'#2b2b2e'],['Arc lamp','lamp',1.6,1.6,6.6,'#c9a24a'],['Table lamp','lamp',1.1,1.1,2.1,'#2b2b2e'],['Round coffee table','table',3,3,1.5,'#6b5544'],['Round rug 8\'','rug',8,8,0.04,'#7d6b5d'],['Bookcase','shelf',3,1,6.5,'#c8b89c'],['Curtains 8\' wide','curtain',8,0.35,8,'#d9d2c3'],['Upright piano','cabinet',4.8,2,4.3,'#141414']],
  Dining:[['Round table 60"','table',5,5,2.5,'#6b5544'],['Bench seat','ottoman',5,1.25,1.5,'#6b5544'],['Pendant over table','lamp',2,2,1.4,'#c9a24a']],
  Office:[['Desk lamp','lamp',0.9,0.9,1.6,'#2b2b2e']]}[c[0]];if(add)c[1]=c[1].concat(add);});
CATALOG.push(['Decor',[['Wall art 36×24','art',3,0.12,2,'#c75b39'],['Wall art 48×36','art',4,0.12,3,'#2d6a8a'],['Wall art 24×36','art',2,0.12,3,'#7a8a4a'],['Gallery of 3 frames','art',5,0.1,1.8,'#2b2b2e'],
  ['Round mirror 30"','mirror',2.5,0.12,2.5,'#b08d57'],['Mirror 24×36','mirror',2,0.12,3,'#2b2b2e'],['Curtains 6\' wide','curtain',6,0.35,8,'#d9d2c3'],['Runner rug 2½×8','rug',8,2.5,0.04,'#6f5a7d'],
  ['Fiddle leaf fig','plant',2,2,6,'#3f8f5a'],['Snake plant','plant',1.2,1.2,2.8,'#4f7d4a'],['Olive tree','plant',2.4,2.4,6.5,'#7c8f5d'],['Plant on a stand','plant',1.4,1.4,3.2,'#3f8f5a']]]);
ITEM_KINDS.push(['lamp','Lamp',1.3,1.3,5.4,'#2b2b2e'],['art','Wall art',3,0.12,2,'#c75b39'],['mirror','Mirror',2.5,0.12,2.5,'#b08d57'],['curtain','Curtains',8,0.35,8,'#d9d2c3'],['ottoman','Ottoman / bench',2.5,2.5,1.4,'#7a6a8e'],['sectional','Sectional sofa',7,9,2.8,'#5c5f78'],['stairs','Stairs',10,3.5,10,'#8a6a4c']);
FIELDS.item[1].options=ITEM_KINDS.map(function(k){return [k[0],k[1]];});
FIELDS.item.splice(5,0,LEN('elev','Off the floor',{opt:true,ph:function(){return 'on the floor';}}),{k:'price',label:'Price $',kind:'num'},{k:'link',label:'Link',kind:'text'});
var HANG_AT={art:4.2,mirror:4.2,curtain:0.1};
// Wall art, mirrors and curtains hang on the nearest wall, facing into the room.
function hangOnWall(o){var best=null,bd=3.5;model.walls.forEach(function(w){var L=segLen(w);if(L<0.5)return;var ux=(w.x2-w.x1)/L,uy=(w.y2-w.y1)/L,s=clamp((o.cx-w.x1)*ux+(o.cy-w.y1)*uy,0,L),px=w.x1+ux*s,py=w.y1+uy*s,d=Math.hypot(o.cx-px,o.cy-py);
    if(d<bd){bd=d;var off=(o.cx-w.x1)*(-uy)+(o.cy-w.y1)*ux,sg=off>=0?1:-1;if(Math.abs(off)<0.01)sg=roomAt(px-uy*(w.t/2+0.5),py+ux*(w.t/2+0.5))?1:-1;best={px:px,py:py,n:[-uy*sg,ux*sg],t:w.t};}});
  if(!best)return false;var D=best.t/2+o.d/2+0.01;o.cx=r3(best.px+best.n[0]*D);o.cy=r3(best.py+best.n[1]*D);o.rot=Math.round(((Math.atan2(-best.n[0],best.n[1])*180/Math.PI)+360)%360);
  if(o.elev==null&&HANG_AT[o.kind]!=null){o.elev=o.kind==='curtain'?HANG_AT.curtain:r3(Math.max(0.5,5.2-o.h/2));if(/floor mirror/i.test(o.label||''))o.elev=0;}return true;}
var artCache={};
function artTex(it){var key=it.id+'|'+it.w+'|'+it.h+'|'+it.color+'|'+(it.label||'');if(artCache[key])return artCache[key];var W=384,H=Math.max(64,Math.round(W*it.h/Math.max(it.w,0.1))),c=document.createElement('canvas');c.width=W;c.height=H;
  var g=c.getContext('2d'),R=rng(parseInt(hashStr(it.id),36)%100000+7),base=new THREE.Color(it.color||'#c75b39'),hex=function(k,j){var q=base.clone();q.offsetHSL(j||0,0,k);return '#'+q.getHexString();};
  g.fillStyle='#efe9df';g.fillRect(0,0,W,H);var kind=(R()*3)|0;
  if(/gallery/i.test(it.label||'')){g.fillStyle='#e9e4da';g.fillRect(0,0,W,H);[0,1,2].forEach(function(i){var fw=W/3-16,x=8+i*W/3;g.fillStyle='#222';g.fillRect(x,8,fw,H-16);g.fillStyle='#f3efe8';g.fillRect(x+6,14,fw-12,H-28);g.fillStyle=hex(-0.1+i*0.08,i*0.1);g.beginPath();g.arc(x+fw/2,H/2,Math.min(fw,H)/4,0,7);g.fill();});}
  else if(kind===0){for(var i=0;i<7;i++){g.fillStyle=hex((R()-0.5)*0.4,(R()-0.5)*0.15);g.globalAlpha=0.75;g.fillRect(R()*W*0.8,R()*H*0.8,W*(0.2+R()*0.4),H*(0.15+R()*0.4));}g.globalAlpha=1;}
  else if(kind===1){var hz=H*(0.45+R()*0.2);var sky=g.createLinearGradient(0,0,0,hz);sky.addColorStop(0,hex(0.3,0.5));sky.addColorStop(1,hex(0.25,0.08));g.fillStyle=sky;g.fillRect(0,0,W,hz);for(var b=0;b<4;b++){g.fillStyle=hex(-0.05-b*0.08,b*0.02);g.beginPath();g.moveTo(0,hz+b*H*0.08);for(var x=0;x<=W;x+=W/8)g.lineTo(x,hz+b*H*0.08-R()*H*0.12);g.lineTo(W,H);g.lineTo(0,H);g.fill();}}
  else{for(var j=0;j<5;j++){g.strokeStyle=hex((R()-0.5)*0.5,(R()-0.5)*0.2);g.lineWidth=6+R()*26;g.lineCap='round';g.beginPath();g.moveTo(R()*W,R()*H);g.bezierCurveTo(R()*W,R()*H,R()*W,R()*H,R()*W,R()*H);g.stroke();}}
  for(var n=0;n<1800;n++){g.fillStyle='rgba(0,0,0,'+(R()*0.05)+')';g.fillRect(R()*W,R()*H,2,2);}
  var t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;artCache[key]=t;return t;}
(function(){var prev=buildExtra;buildExtra=function(it,g,add,w,d,h,c){if(prev(it,g,add,w,d,h,c))return true;var l=(it.label||'').toLowerCase(),wood=function(col){return realMat('wood',col||'#6b4e36');},fab=function(col){return realMat('fabric',col||c);};
  switch(it.kind){
    case 'stairs':{var E=model.floor2?floor2Elev():h,n=Math.max(3,Math.round(E/0.625)),rs=E/n,tr=w/n,tread=wood(c),stringer=paintMat('#f1eee8',{rough:0.7});
      for(var i=0;i<n;i++){var sh=(i+1)*rs,x=-w/2+tr*(i+0.5);add(bx(tr+0.02,0.1,d,tread),x,sh-0.05,0);add(bx(tr,sh-0.1,d-0.02,stringer),x,(sh-0.1)/2,0);}
      [-1,1].forEach(function(sz){var L=Math.hypot(w,E),rail=add(cyl(0.07,0.07,L,wood('#3b2a1e')),0,E/2+3,sz*(d/2-0.08));rail.rotation.z=Math.PI/2-Math.atan2(E,w);
        for(var b=0;b<n;b+=2){var bx2=-w/2+tr*(b+0.5),bh=3+0;add(bx(0.09,bh,0.09,'#2b2b2e'),bx2,(b+1)*rs+bh/2,sz*(d/2-0.08));}});return true;}
    case 'lamp':{var metal=mat(c,{metalness:0.6,roughness:0.35}),shadeM=new THREE.MeshStandardMaterial({color:new THREE.Color('#f3ead8').convertSRGBToLinear(),emissive:new THREE.Color('#ffcf8a'),emissiveIntensity:view.lightsOn?1.2:0.05,roughness:0.9,side:THREE.DoubleSide,transparent:true,opacity:0.94});lampShades.push(shadeM);
      if(/pendant/.test(l)){var cord=add(cyl(0.02,0.02,3,metal),0,h+1.5,0);var sp=new THREE.Mesh(new THREE.CylinderGeometry(w*0.18,w*0.45,h*0.6,28,1,true),shadeM);add(sp,0,h*0.7,0);return true;}
      if(/arc/.test(l)){add(cyl(0.45,0.5,0.15,mat('#e8e4dc',{roughness:0.3})),-w/2+0.3,0.08,0);var arc=new THREE.Mesh(new THREE.TorusGeometry(h*0.42,0.04,8,40,Math.PI*0.62),metal);arc.rotation.z=Math.PI*0.08;add(arc,-w/2+0.3+h*0.42*0.2,h*0.42,0);
        var dome=new THREE.Mesh(new THREE.SphereGeometry(0.55,24,12,0,Math.PI*2,0,Math.PI/2),shadeM);add(dome,w/2,h-0.9,0);return true;}
      var table=h<3.5,bh=table?h*0.45:0.12;if(table){var bs=add(cyl(w*0.22,w*0.3,bh,mat(c,{roughness:0.3,metalness:0.2})),0,bh/2,0);}else add(cyl(w*0.32,w*0.35,0.12,metal),0,0.06,0);
      add(cyl(0.035,0.035,h-bh-(table?0.55:0.9),metal),0,bh+(h-bh-(table?0.55:0.9))/2,0);var sh2=new THREE.Mesh(new THREE.CylinderGeometry(w*0.34,w*0.46,table?0.75:1.1,28,1,true),shadeM);add(sh2,0,h-(table?0.37:0.55),0);return true;}
    case 'art':{var fr=add(bx(w,h,d,/gallery/.test(l)?'#e9e4da':'#1d1b1a'),0,h/2,0);var cnv=new THREE.Mesh(new THREE.PlaneGeometry(Math.max(0.1,w-(/gallery/.test(l)?0.05:0.18)),Math.max(0.1,h-(/gallery/.test(l)?0.05:0.18))),new THREE.MeshStandardMaterial({map:artTex(it),roughness:0.85}));add(cnv,0,h/2,d/2+0.006);return true;}
    case 'mirror':{if(/round/.test(l)){var rim=add(cyl(w/2,w/2,d,c,{metalness:0.6,roughness:0.35}),0,h/2,0);rim.rotation.x=Math.PI/2;var gl=add(cyl(w/2-0.12,w/2-0.12,0.02,mat('#c9d6df',{metalness:0.9,roughness:0.05})),0,h/2,d/2);gl.rotation.x=Math.PI/2;return true;}
      add(bx(w,h,d,c,{metalness:0.4,roughness:0.4}),0,h/2,0);add(bx(w-0.2,h-0.2,0.02,mat('#c9d6df',{metalness:0.9,roughness:0.05})),0,h/2,d/2);return true;}
    case 'curtain':{var cm=realMat('linen',c,{side:THREE.DoubleSide}),panels=2,pw=Math.min(w*0.32,3),folds=7;add(cyl(0.05,0.05,w+0.6,mat('#2b2b2e',{metalness:0.6,roughness:0.4})),0,h-0.1,0).rotation.z=Math.PI/2;
      [-1,1].forEach(function(sd){for(var f=0;f<folds;f++){var fx=sd*(w/2-pw+pw*(f+0.5)/folds),pz=(f%2?0.08:-0.08);add(bx(pw/folds+0.03,h-0.25,0.06,cm),fx,(h-0.25)/2,pz);}});return true;}
    case 'ottoman':{var bench=/bench/.test(l)||w/d>1.8,legH=bench?0.45:0.25;[[1,1],[1,-1],[-1,1],[-1,-1]].forEach(function(q){add(bx(0.12,legH,0.12,wood(bench&&c!=='#7a6a8e'?c:'#3b2a1e')),q[0]*(w/2-0.15),legH/2,q[1]*(d/2-0.15));});
      add(bx(w,h-legH-0.15,d,bench&&lum(c)<0.4?wood(c):fab(c)),0,legH+(h-legH-0.15)/2,0);add(bx(w-0.05,0.18,d-0.05,fab(bench&&lum(c)<0.4?'#d8d0c4':c)),0,h-0.09,0);return true;}
    case 'sectional':{var F=fab(c),seat=fab(shade(c,1.12)),depth=Math.min(3.2,w*0.45);
      add(bx(depth,1.4,d,F),-w/2+depth/2,0.7,0);add(bx(0.75,2.8,d,F),-w/2+0.375,1.4,0);add(bx(depth,2.0,0.6,F),-w/2+depth/2,1.0,-d/2+0.3);
      add(bx(w-depth,1.4,depth,F),-w/2+depth+(w-depth)/2,0.7,d/2-depth/2);add(bx(w-0.75,2.0,0.6,F),0.375,1.0,d/2-0.3);add(bx(0.6,2.0,depth-0.6,F),w/2-0.3,1.0,d/2-depth/2-0.3);
      for(var s=0;s<3;s++)add(bx(depth-0.9,0.35,(d-depth-0.6)/3-0.06,seat),-w/2+0.75+(depth-0.75)/2,1.57,-d/2+0.6+(s+0.5)*(d-depth-0.6)/3);
      add(bx(w-depth-0.6,0.35,depth-0.75,seat),-w/2+depth+(w-depth-0.6)/2,1.57,d/2-0.6-(depth-0.75)/2);add(bx(depth-0.75,0.35,depth-0.75,seat),-w/2+0.75+(depth-0.75)/2,1.57,d/2-0.6-(depth-0.75)/2);return true;}
  }return false;};})();
function lampLights(pl,lit){model.items.forEach(function(it){if(it.kind!=='lamp')return;var r=roomAt(it.cx,it.cy);if(r)lit[r.id]=1;pl(it.cx,(it.elev||0)+it.h-0.5,it.cy,/pendant/i.test(it.label||'')?0.6:0.42);});}
function lampGlow(on){lampShades.forEach(function(m){m.emissiveIntensity=on?1.2:0.05;});}
(function(){var cs=$('#catStyle');if(!cs)return;cs.onchange=function(){catStyle=cs.value;renderCatalog();};})();
renderCatalog();

/* ---------- shared pop-up for photos, videos and the shopping list ---------- */
function xOpen(title,body,acts){$('#xTitle').textContent=title;$('#xBody').innerHTML=body;var a=$('#xActs');a.innerHTML='';(acts||[]).concat([['Close',function(){xClose();},'primary']]).forEach(function(b){var el=document.createElement('button');el.className='btn'+(b[2]?' '+b[2]:'');el.textContent=b[0];el.onclick=b[1];a.appendChild(el);});$('#xDlg').hidden=false;}
function xClose(){$('#xDlg').hidden=true;$('#xBody').innerHTML='';}
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!$('#xDlg').hidden){xClose();e.stopImmediatePropagation();}},true);
function download(name,blobOrUrl){var a=document.createElement('a');a.href=typeof blobOrUrl==='string'?blobOrUrl:URL.createObjectURL(blobOrUrl);a.download=name;document.body.appendChild(a);a.click();setTimeout(function(){a.remove();},100);}
function fileBase(){return (model.specs.name||'house').replace(/[^\w\- ]+/g,'').trim().replace(/\s+/g,'-').toLowerCase()||'house';}
function money(v){return '$'+Math.round(v).toLocaleString('en-US');}

/* ---------- cost estimate per room (Specs tab) ---------- */
var FLOOR_RATE={solid:5,wood:9,lvp:5,herring:14,hex:12,marble:22,concrete:6,carpet:4,epoxy:5};
function rateSpec(){var R=model.specs.rates||{};return {floor:Object.assign({},FLOOR_RATE,R.floor||{}),paint:R.paint!=null?R.paint:2.5,build:R.build!=null?R.build:225};}
function itemsInRoom(r){return model.items.filter(function(it){return it.cx>=r.x&&it.cx<=r.x+r.w&&it.cy>=r.y&&it.cy<=r.y+r.d;});}
function costHTML(){var R=rateSpec(),T={f:0,p:0,i:0},area=0,noPrice=0,used={};
  var rows=model.rooms.map(function(r){var A=roomAreas(r),fm=r.floorMat||'solid';used[fm]=1;if(R.floor[fm]==null)R.floor[fm]=8;var f=A.floor*1.1*R.floor[fm],p=(A.wall+A.ceil)*R.paint,i=0;area+=A.floor;
    itemsInRoom(r).forEach(function(it){if(it.price>0)i+=+it.price;else if(it.kind!=='person'&&it.kind!=='stairs')noPrice++;});T.f+=f;T.p+=p;T.i+=i;
    return '<tr><td>'+esc(r.name)+'</td><td>'+money(f)+'</td><td>'+money(p)+'</td><td>'+(i?money(i):'–')+'</td><td><b>'+money(f+p+i)+'</b></td></tr>';}).join('');
  var lvl=model.floor2?(model.onFloor2?' (second floor)':' (ground floor)'):'';
  return '<div class="group"><div class="g-title">Cost estimate'+lvl+'</div><table class="sched cost"><thead><tr><th>Room</th><th>Floor</th><th>Paint</th><th>Furniture</th><th>Total</th></tr></thead><tbody>'+rows+
    '</tbody><tfoot><tr><td>Total</td><td>'+money(T.f)+'</td><td>'+money(T.p)+'</td><td>'+money(T.i)+'</td><td><b>'+money(T.f+T.p+T.i)+'</b></td></tr></tfoot></table>'+
    '<p class="hint">Building the house itself at <b>'+money(R.build)+'</b> a sq ft comes to about <b>'+money(R.build*area)+'</b> for '+Math.round(area).toLocaleString('en-US')+' sq ft'+(lvl?' on this floor':'')+'.'+(noPrice?' '+noPrice+' pieces of furniture have no price yet; add one in the Edit tab or the shopping list.':'')+'</p>'+
    '<details class="tg rates"><summary>Change the prices used</summary>'+
    Object.keys(used).map(function(k){return '<div class="row"><span class="lbl">'+esc(MAT_NAME[k]||k)+'</span><input class="txt" type="number" min="0" step="0.5" data-rate="'+k+'" value="'+R.floor[k]+'"><span class="unit">$/sf</span></div>';}).join('')+
    '<div class="row"><span class="lbl">Painting</span><input class="txt" type="number" min="0" step="0.25" data-rate="paint" value="'+R.paint+'"><span class="unit">$/sf</span></div>'+
    '<div class="row"><span class="lbl">Build cost</span><input class="txt" type="number" min="0" step="5" data-rate="build" value="'+R.build+'"><span class="unit">$/sf</span></div>'+
    '<p class="hint">Flooring includes 10% waste and installation. Painting covers walls and ceilings, labor and paint.</p></details>'+
    '<button class="btn" data-shop style="margin-top:8px;width:100%">Shopping list</button></div>';}
function wireCost(box){$$('[data-rate]',box).forEach(function(inp){inp.onchange=function(){var v=Math.max(0,+inp.value||0),R=model.specs.rates=model.specs.rates||{};pushUndo();if(inp.dataset.rate==='paint'||inp.dataset.rate==='build')R[inp.dataset.rate]=v;else{R.floor=R.floor||{};R.floor[inp.dataset.rate]=v;}afterChange();};});
  $$('[data-shop]',box).forEach(function(b){b.onclick=openShopping;});}
var _specsX=specsExtrasHTML,_wireSX=wireSpecsExtras;
specsExtrasHTML=function(){return _specsX()+costHTML();};
wireSpecsExtras=function(box){_wireSX(box);wireCost(box);};

/* ---------- shopping list with sizes and links ---------- */
var BUILTIN=['counter','island','cabinet','shelf','stairs','person','tub','shower'];
function bothLevels(){var L=[{lv:model.onFloor2?1:0,items:model.items,rooms:model.rooms}];if(model.floor2){var o=model.onFloor2?groundItems():model.floor2.items,orooms=model.onFloor2?model.floor2.rooms:model.floor2.rooms;L.push({lv:model.onFloor2?0:1,items:o||[],rooms:orooms||[]});}return L;}
function shopRows(withBuilt){var g={},order=[];bothLevels().forEach(function(L){L.items.forEach(function(it){if(!withBuilt&&BUILTIN.indexOf(it.kind)>=0)return;if(it.kind==='person'||it.kind==='stairs')return;
    var r=null;L.rooms.forEach(function(q){if(!r&&it.cx>=q.x&&it.cx<=q.x+q.w&&it.cy>=q.y&&it.cy<=q.y+q.d)r=q;});
    var key=[iName(it),r3(it.w),r3(it.d),r3(it.h),it.link||''].join('|');if(!g[key]){g[key]={name:iName(it),w:it.w,d:it.d,h:it.h,qty:0,price:0,priced:0,link:it.link||'',rooms:[],ids:[],kind:it.kind};order.push(key);}
    var G=g[key];G.qty++;G.ids.push(it.id);if(it.price>0){G.price=+it.price;G.priced++;}var rn=r?r.name:'Outside';if(G.rooms.indexOf(rn)<0)G.rooms.push(rn);});});
  return order.map(function(k){return g[k];});}
function sizeStr(G){return fmt(G.w)+' W × '+fmt(G.d)+' D × '+fmt(G.h)+' H';}
function findUrl(G){return 'https://www.google.com/search?tbm=shop&q='+encodeURIComponent(G.name+' '+inchStr(G.w)+' wide');}
var shopBuilt=false;
function openShopping(){var rows=shopRows(shopBuilt),tot=0,miss=0;
  var body='<p class="muted">Everything in the design'+(model.floor2?' on both floors':'')+', grouped when the same piece appears more than once. Type a price to fill it in for every one of them.</p>'+
    '<label class="tog"><input type="checkbox" id="shopBuilt"'+(shopBuilt?' checked':'')+'> Include built-ins (counters, cabinets, shelving, tubs)</label>'+
    '<div class="shop-wrap"><table class="shop"><thead><tr><th>Item</th><th>Size</th><th>Qty</th><th>Each</th><th>Total</th><th></th></tr></thead><tbody>'+
    rows.map(function(G,i){var t=G.price*G.qty;tot+=t;if(!G.price)miss++;return '<tr><td><b>'+esc(G.name)+'</b><span>'+esc(G.rooms.join(', '))+'</span></td><td class="mono">'+esc(sizeStr(G))+'</td><td>'+G.qty+'</td>'+
      '<td><input class="txt" type="number" min="0" step="1" data-sp="'+i+'" value="'+(G.price||'')+'" placeholder="$"></td><td>'+(t?money(t):'–')+'</td>'+
      '<td>'+(G.link?'<a href="'+esc(G.link)+'" target="_blank" rel="noopener">Open link</a>':'<a href="'+esc(findUrl(G))+'" target="_blank" rel="noopener">Find it</a>')+'</td></tr>';}).join('')+
    '</tbody><tfoot><tr><td colspan="4">Total'+(miss?' ('+miss+' without a price)':'')+'</td><td><b>'+money(tot)+'</b></td><td></td></tr></tfoot></table></div>';
  xOpen('Shopping list',body,[['Download CSV',function(){shopCSV(rows);}],['Print / PDF',function(){shopPrint(rows,tot);}]]);
  $('#shopBuilt').onchange=function(e){shopBuilt=e.target.checked;openShopping();};
  $$('[data-sp]').forEach(function(inp){inp.onchange=function(){var G=rows[+inp.dataset.sp],v=Math.max(0,+inp.value||0);pushUndo();
    bothLevels().forEach(function(L){L.items.forEach(function(it){if(G.ids.indexOf(it.id)>=0){if(v)it.price=v;else delete it.price;}});});afterChange();openShopping();};});}
function csvCell(v){v=String(v==null?'':v);return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;}
function shopCSV(rows){var L=[['Item','Rooms','Width','Depth','Height','Qty','Price each','Total','Link']];rows.forEach(function(G){L.push([G.name,G.rooms.join('; '),fmt(G.w),fmt(G.d),fmt(G.h),G.qty,G.price||'',G.price?G.price*G.qty:'',G.link||findUrl(G)]);});
  download(fileBase()+'-shopping-list.csv',new Blob([L.map(function(r){return r.map(csvCell).join(',');}).join('\n')],{type:'text/csv'}));}
function shopPrint(rows,tot){var w=window.open('','_blank');if(!w){toast('Allow pop-ups to print the list.');return;}
  w.document.write('<!doctype html><title>Shopping list</title><style>body{font:14px system-ui,sans-serif;margin:32px;color:#111}h1{font-size:22px}table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #ddd;padding:7px 6px;text-align:left;vertical-align:top}th{font-size:12px;text-transform:uppercase;color:#666}small{color:#666;display:block}a{color:#2850c8}</style>'+
    '<h1>'+esc(model.specs.name||'Residence')+': shopping list</h1><table><tr><th>Item</th><th>Size</th><th>Qty</th><th>Each</th><th>Total</th></tr>'+rows.map(function(G){return '<tr><td>'+esc(G.name)+'<small>'+esc(G.rooms.join(', '))+(G.link?' · <a href="'+esc(G.link)+'">'+esc(G.link)+'</a>':'')+'</small></td><td>'+esc(sizeStr(G))+'</td><td>'+G.qty+'</td><td>'+(G.price?money(G.price):'')+'</td><td>'+(G.price?money(G.price*G.qty):'')+'</td></tr>';}).join('')+
    '<tr><td colspan="4"><b>Total</b></td><td><b>'+money(tot)+'</b></td></tr></table>');w.document.close();setTimeout(function(){w.print();},300);}

/* ---------- photo mode: bigger render, sharper shadows, depth of field ---------- */
var PH={scale:2,dof:1,sharp:true,focus:null,shot:null};
function blurCopy(src,f){var w=src.width,h=src.height,a=document.createElement('canvas');a.width=Math.max(1,Math.round(w/f));a.height=Math.max(1,Math.round(h/f));var g=a.getContext('2d');g.imageSmoothingQuality='high';g.drawImage(src,0,0,a.width,a.height);
  var b=document.createElement('canvas');b.width=w;b.height=h;var g2=b.getContext('2d');g2.imageSmoothingQuality='high';g2.drawImage(a,0,0,w,h);return g2.getImageData(0,0,w,h).data;}
function shootPhoto(){var W=host.clientWidth||1,H=host.clientHeight||1,pr=renderer.getPixelRatio(),hid=[helpG,tapeG,issueG].filter(function(o){return o&&o.visible;});hid.forEach(function(o){o.visible=false;});
  var ms=sun.shadow.mapSize.x;if(PH.sharp){if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null;}sun.shadow.mapSize.set(4096,4096);}
  renderer.setPixelRatio(PH.scale);renderer.setSize(W,H,false);renderer.render(scene,camera);
  var w=cv.width,h=cv.height,col=document.createElement('canvas');col.width=w;col.height=h;col.getContext('2d').drawImage(cv,0,0);var depth=null;
  try{var rt=new THREE.WebGLRenderTarget(w,h),bg=scene.background,fog=scene.fog,dm=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});scene.background=null;scene.fog=null;scene.overrideMaterial=dm;
    var cc=renderer.getClearColor(new THREE.Color()),ca=renderer.getClearAlpha();renderer.setClearColor(0xffffff,1);renderer.setRenderTarget(rt);renderer.render(scene,camera);depth=new Uint8Array(w*h*4);renderer.readRenderTargetPixels(rt,0,0,w,h,depth);
    renderer.setRenderTarget(null);renderer.setClearColor(cc,ca);scene.overrideMaterial=null;scene.background=bg;scene.fog=fog;dm.dispose();rt.dispose();}catch(err){depth=null;scene.overrideMaterial=null;renderer.setRenderTarget(null);}
  if(PH.sharp){if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null;}sun.shadow.mapSize.set(ms,ms);}
  renderer.setPixelRatio(pr);resize();hid.forEach(function(o){o.visible=true;});
  var dist=null;if(depth){dist=new Float32Array(w*h);var n=camera.near,f=camera.far;for(var y=0;y<h;y++)for(var x=0;x<w;x++){var i=((h-1-y)*w+x)*4,d=(depth[i]/16777216+depth[i+1]/65536+depth[i+2]/256+depth[i+3])/255;d*=255/256;dist[y*w+x]=d>=0.9999?1e4:(n*f)/(f-(f-n)*d);}}
  PH.shot={w:w,h:h,col:col,dist:dist,levels:null};if(!PH.focus)PH.focus=[0.5,0.5];return composePhoto();}
function composePhoto(){var S=PH.shot,w=S.w,h=S.h,out=document.createElement('canvas');out.width=w;out.height=h;var g=out.getContext('2d');
  if(!PH.dof||!S.dist){g.drawImage(S.col,0,0);return out;}
  if(!S.levels){var s0=S.col.getContext('2d').getImageData(0,0,w,h).data;S.levels=[s0,blurCopy(S.col,2.2*PH.scale),blurCopy(S.col,4.5*PH.scale),blurCopy(S.col,9*PH.scale)];}
  var fx=clamp(Math.round(PH.focus[0]*w),0,w-1),fy=clamp(Math.round(PH.focus[1]*h),0,h-1),fd=S.dist[fy*w+fx];if(fd>=1e4)fd=60;
  var img=g.createImageData(w,h),o=img.data,L=S.levels,k=PH.dof===2?6:3;
  for(var p=0,q=0;p<w*h;p++,q+=4){var c=Math.min(3,Math.abs(S.dist[p]-fd)/fd*k),a=c|0,t=c-a,A=L[a],B=L[Math.min(3,a+1)];o[q]=A[q]+(B[q]-A[q])*t;o[q+1]=A[q+1]+(B[q+1]-A[q+1])*t;o[q+2]=A[q+2]+(B[q+2]-A[q+2])*t;o[q+3]=255;}
  g.putImageData(img,0,0);return out;}
function openPhoto(){if(rebuildQueued){rebuildQueued=false;rebuild();}toast('Rendering your photo…',1500);setTimeout(function(){var c=shootPhoto();showPhoto(c);},40);}
function showPhoto(c){var url=c.toDataURL('image/png');
  xOpen('Photo','<div class="photo-box"><img id="phImg" src="'+url+'" alt="Rendered photo of the design"><i id="phFocus"></i></div>'+
    '<div class="photo-opts"><label>Size <select id="phScale"><option value="1">Screen</option><option value="2">2× (sharp)</option><option value="3">3× (print)</option></select></label>'+
    '<label>Depth of field <select id="phDof"><option value="0">Off</option><option value="1">Soft</option><option value="2">Strong</option></select></label>'+
    '<label class="tog"><input type="checkbox" id="phSharp"> Crisp shadows</label></div><p class="hint">Click the photo to choose what stays in focus. Line up the view first with orbit or walk mode, then take the photo again.</p>',
    [['Download PNG',function(){download(fileBase()+'-photo.png',$('#phImg').src);}]]);
  $('#phScale').value=String(PH.scale);$('#phDof').value=String(PH.dof);$('#phSharp').checked=PH.sharp;
  var mark=function(){var f=$('#phFocus');if(!f)return;f.style.left=(PH.focus[0]*100)+'%';f.style.top=(PH.focus[1]*100)+'%';f.style.display=PH.dof?'':'none';};mark();
  var retake=function(){PH.scale=+$('#phScale').value;PH.dof=+$('#phDof').value;PH.sharp=$('#phSharp').checked;xClose();openPhoto();};
  $('#phScale').onchange=retake;$('#phSharp').onchange=retake;$('#phDof').onchange=function(){PH.dof=+$('#phDof').value;$('#phImg').src=composePhoto().toDataURL('image/png');mark();};
  $('#phImg').onclick=function(e){var r=e.target.getBoundingClientRect();PH.focus=[(e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height];if(!PH.dof){PH.dof=1;$('#phDof').value='1';}$('#phImg').src=composePhoto().toDataURL('image/png');mark();};}

/* ---------- day-to-night video ---------- */
var tour=null,recBadge=document.createElement('div');recBadge.id='recBadge';recBadge.hidden=true;host.appendChild(recBadge);
function startTour(){if(tour)return stopTour();if(typeof MediaRecorder==='undefined'||!cv.captureStream){toast('This browser can’t record video. Try Chrome, Edge or Safari 15+.');return;}
  if(view.mode==='walk')setMode('orbit');var types=['video/mp4;codecs=avc1','video/mp4','video/webm;codecs=vp9','video/webm'],mime=types.filter(function(t){return MediaRecorder.isTypeSupported(t);})[0]||'';
  var st=cv.captureStream(30),rec;try{rec=new MediaRecorder(st,mime?{mimeType:mime,videoBitsPerSecond:8e6}:{});}catch(e){toast('Could not start recording: '+e.message);return;}
  tour={t:0,dur:16,rec:rec,chunks:[],mime:mime||'video/webm',keep:{time:view.time,lights:view.lightsOn,theta:orbit.theta}};rec.ondataavailable=function(e){if(e.data&&e.data.size)tour.chunks.push(e.data);};
  rec.onstop=function(){var T=tour;tour=null;recBadge.hidden=true;view.time=T.keep.time;view.lightsOn=T.keep.lights;applyLighting();syncViewUI();if(T.cancel)return;
    var blob=new Blob(T.chunks,{type:T.mime}),ext=/mp4/.test(T.mime)?'mp4':'webm',url=URL.createObjectURL(blob);
    xOpen('Day to night','<video src="'+url+'" controls autoplay loop playsinline class="tour-vid"></video><p class="hint">'+Math.round(blob.size/1e5)/10+' MB '+ext.toUpperCase()+'. The camera circles the house while the sun goes down and the lights come on.</p>',[['Download video',function(){download(fileBase()+'-day-to-night.'+ext,blob);}]]);};
  rec.start(500);recBadge.hidden=false;recBadge.innerHTML='<span class="dot"></span><b>Recording</b> <span id="recT">0s</span><button class="btn mini" id="recStop">Stop</button>';$('#recStop').onclick=function(){stopTour(true);};}
function stopTour(cancel){if(!tour)return;if(cancel)tour.cancel=true;if(tour.rec.state!=='inactive')tour.rec.stop();}
function tourFrame(dt){if(!tour||tour.stopping)return;if(!tour.t0)tour.t0=performance.now();tour.t=(performance.now()-tour.t0)/1000;var f=Math.min(1,tour.t/tour.dur),e=f<0.5?2*f*f:1-Math.pow(-2*f+2,2)/2;
  view.time=7+15*e;view.lightsOn=view.time>=17;orbit.theta=tour.keep.theta+e*Math.PI*0.9;applyLighting();var rt=$('#recT');if(rt)rt.textContent=Math.ceil(tour.dur-tour.t)+'s left';
  if(f>=1){tour.stopping=true;setTimeout(function(){if(tour)tour.rec.stop();},300);}}

/* ---------- notes and pins from the family ---------- */
var notePlacing=false,noteBox=document.createElement('div');noteBox.id='noteLabels';host.appendChild(noteBox);
function noteAuthor(){return lsGet('house3d-author')||'';}
function notes(){return model.notes||[];}
function noteLv(){return model.onFloor2?1:0;}
function setNotePlacing(on){notePlacing=on;document.body.classList.toggle('noting',on);$$('[data-noteadd]').forEach(function(b){b.classList.toggle('on',on);});if(on)toast('Click in the plan or the 3D view where the note goes. Esc to cancel.',3800);}
function addNoteAt(x,y,hgt){var n={id:'n'+Date.now().toString(36)+Math.floor(Math.random()*1e4),x:r3(x),y:r3(y),h:r3(hgt==null?4:hgt),lv:noteLv(),text:'',by:noteAuthor(),at:new Date().toISOString().slice(0,10),done:false};pushUndo();(model.notes=model.notes||[]).push(n);setNotePlacing(false);afterChange();
  showTab('tools');var d=$('#notesTg');if(d)d.open=true;renderNotes();var t=$('[data-ntext="'+n.id+'"]');if(t){t.focus();t.scrollIntoView({block:'center'});}}
function noteNum(n){return notes().indexOf(n)+1;}
function notesSVG(k){var h=[];notes().forEach(function(n,i){if((n.lv||0)!==noteLv())return;var r=9*k,op=n.done?0.45:1;
  h.push('<g data-note="'+n.id+'" style="cursor:pointer" opacity="'+op+'"><circle cx="'+n.x+'" cy="'+n.y+'" r="'+r.toFixed(3)+'" fill="#ffd84d" stroke="#0c0a14" stroke-width="'+(2*k).toFixed(3)+'"/><text x="'+n.x+'" y="'+n.y+'" font-size="'+(10.5*k).toFixed(2)+'" text-anchor="middle" dominant-baseline="central" fill="#0c0a14" font-weight="700" font-family="Space Grotesk, sans-serif" pointer-events="none">'+(i+1)+'</text></g>');});return h.join('');}
var _pex=planExtrasSVG;planExtrasSVG=function(k){return _pex(k)+notesSVG(k);};
svg.addEventListener('pointerdown',function(e){var t=e.target.closest&&e.target.closest('[data-note]');
  if(notePlacing&&e.button===0){e.stopImmediatePropagation();e.preventDefault();var p=toPlan(e);addNoteAt(p.x,p.y);return;}
  if(t&&e.button===0){e.stopImmediatePropagation();e.preventDefault();focusNote(t.getAttribute('data-note'));}},true);
function noteClick3d(e){if(!notePlacing||view.mode!=='orbit')return false;var p=pickPoint(e.clientX,e.clientY);if(!p)return true;var E=activeElev();addNoteAt(p.x,p.z,Math.max(0.5,p.y-E+0.4));return true;}
function focusNote(id){showTab('tools');var d=$('#notesTg');if(d)d.open=true;renderNotes();var c=$('[data-ncard="'+id+'"]');if(c){c.scrollIntoView({block:'center'});c.classList.add('flash');setTimeout(function(){c.classList.remove('flash');},900);}}
function renderNotes(){var box=$('#notesList');if(!box)return;if(box.contains(document.activeElement)&&box._n===notes().length){drawNotes3D();return;}box._n=notes().length;var N=notes(),me=$('#noteBy');if(me&&document.activeElement!==me)me.value=noteAuthor();
  box.innerHTML=N.length?N.map(function(n,i){var other=(n.lv||0)!==noteLv();return '<div class="note-card'+(n.done?' done':'')+'" data-ncard="'+n.id+'"><div class="nh"><span class="nb">'+(i+1)+'</span><span class="nm">'+esc(n.by||'Someone')+' · '+esc(n.at||'')+(model.floor2?' · '+(n.lv?'2nd':'1st')+' floor':'')+'</span>'+
    '<label class="nd"><input type="checkbox" data-ndone="'+n.id+'"'+(n.done?' checked':'')+'> Done</label></div><textarea data-ntext="'+n.id+'" rows="2" placeholder="What should we change here?">'+esc(n.text||'')+'</textarea>'+
    '<div class="na"><button class="btn mini" data-ngo="'+n.id+'"'+(other?' disabled title="On the other floor"':'')+'>Show</button><button class="btn mini danger" data-ndel="'+n.id+'">Delete</button></div></div>';}).join(''):'<p class="hint">No notes yet.</p>';
  var get=function(id){return N.filter(function(n){return n.id===id;})[0];};
  $$('[data-ntext]',box).forEach(function(t){t.onchange=function(){var n=get(t.dataset.ntext);if(!n||n.text===t.value)return;pushUndo();n.text=t.value;afterChange();};});
  $$('[data-ndone]',box).forEach(function(c){c.onchange=function(){var n=get(c.dataset.ndone);pushUndo();n.done=c.checked;afterChange();};});
  $$('[data-ndel]',box).forEach(function(b){b.onclick=function(){pushUndo();model.notes=N.filter(function(n){return n.id!==b.dataset.ndel;});afterChange();};});
  $$('[data-ngo]',box).forEach(function(b){b.onclick=function(){var n=get(b.dataset.ngo);if(view.mode==='walk')setMode('orbit');tween={t0:performance.now(),dur:650,from:{tx:orbit.tx,tz:orbit.tz,r:orbit.r,theta:orbit.theta,phi:orbit.phi},to:{tx:n.x,tz:n.y,r:Math.min(orbit.r,32),theta:orbit.theta,phi:Math.min(orbit.phi,0.95)}};};});
  drawNotes3D();}
function drawNotes3D(){noteBox.innerHTML='';notes().forEach(function(n,i){if(n.done)return;var el=document.createElement('button');el.className='note-pin';el.innerHTML='<b>'+(i+1)+'</b>'+(n.text?'<span>'+esc(n.text.length>42?n.text.slice(0,40)+'…':n.text)+'</span>':'');
  el._p=new THREE.Vector3(n.x,(n.lv?floor2Elev():0)+(n.h||4),n.y);el._lv=n.lv||0;el.onclick=function(){focusNote(n.id);};noteBox.appendChild(el);});}
function updateNoteLabels(){if(!noteBox.children.length)return;var W=host.clientWidth,H=host.clientHeight,walk=view.mode==='walk';Array.prototype.forEach.call(noteBox.children,function(el){
  if(!walk&&el._lv>noteLv()&&!TV.roof){el.style.display='none';return;}v3.copy(el._p).project(camera);if(v3.z>1||v3.z<-1){el.style.display='none';return;}el.style.display='';el.style.left=((v3.x+1)/2*W)+'px';el.style.top=((1-v3.y)/2*H)+'px';});}
(function(){var a=$('[data-noteadd]');if(a)a.onclick=function(){setNotePlacing(!notePlacing);};var by=$('#noteBy');if(by)by.onchange=function(){lsSet('house3d-author',by.value.trim());};
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&notePlacing){setNotePlacing(false);e.stopImmediatePropagation();}},true);
  var p=$('#photoBtn');if(p)p.onclick=openPhoto;var v=$('#tourBtn');if(v)v.onclick=startTour;var s=$('#shopBtn');if(s)s.onclick=openShopping;})();
var _tf=toolsFrame;toolsFrame=function(dt){_tf(dt);tourFrame(dt);updateNoteLabels();};
var _sync=syncToolsUI;syncToolsUI=function(){_sync();renderNotes();};
