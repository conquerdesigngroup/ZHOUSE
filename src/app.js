(function(){
'use strict';
var HEAD_STATIC=__HEAD__;
var DEFAULT_MODEL=__DEFAULT__;

var $=function(s,r){return (r||document).querySelector(s);};
var $$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s));};
document.body.appendChild(document.getElementById('tpl').content.cloneNode(true));
if(typeof THREE==='undefined'){document.getElementById('view3d').innerHTML='<p style="padding:24px;color:#ffb3c4">The 3D engine didn\'t load. Check your connection and reload.</p>';return;}

var clone=function(o){return JSON.parse(JSON.stringify(o));};
var clamp=function(v,a,b){return v<a?a:v>b?b:v;};
function hashStr(s){var h=2166136261;for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(36);}
function lsGet(k){try{return localStorage.getItem(k);}catch(e){return null;}}
function lsSet(k,v){try{if(v==null)localStorage.removeItem(k);else localStorage.setItem(k,v);}catch(e){}}

var embedded;
try{embedded=JSON.parse(document.getElementById('plan-data').textContent);}catch(e){embedded=clone(DEFAULT_MODEL);}
normalize(embedded);
var EMBED_HASH=hashStr(JSON.stringify(embedded));
var savedJSON=JSON.stringify(embedded);
var model=clone(embedded);
var LS_DRAFT='house3d-draft-v1', LS_VIEW='house3d-view-v1';
(function(){var d=lsGet(LS_DRAFT);if(!d)return;try{var o=JSON.parse(d);if(o.base===EMBED_HASH&&o.model){model=o.model;normalize(model);}}catch(e){}})();

function normalize(m){
  m.specs=Object.assign({name:'Residence',ceiling:9,doorH:6.67,extT:0.5,intT:0.33,eye:5.4,wallColor:'#ece8e1'},m.specs||{});
  ['walls','doors','windows','rooms','items','fixtures'].forEach(function(k){if(!Array.isArray(m[k]))m[k]=[];});
  if(!Array.isArray(m.checkIgnore))m.checkIgnore=[];
}
var COLL={wall:'walls',door:'doors',window:'windows',room:'rooms',item:'items',fixture:'fixtures'};
function uid(p){var all={};['walls','doors','windows','rooms','items','fixtures'].forEach(function(k){model[k].forEach(function(o){all[o.id]=1;});});var i=1;while(all[p+i])i++;return p+i;}
function fmt(v){if(v==null||isNaN(v))return '';var neg=v<0;v=Math.abs(v);var ft=Math.floor(v+1e-9);var inch=Math.round((v-ft)*12*4)/4;if(inch>=12){ft++;inch-=12;}var is=Number.isInteger(inch)?String(inch):String(inch);return (neg?'-':'')+ft+"'-"+is+'"';}
function parseLen(s){if(typeof s==='number')return s;s=String(s).trim().replace(/[′’]/g,"'").replace(/[″”]/g,'"');if(s==='')return null;
  var m=s.match(/^(-?\d+(?:\.\d+)?)\s*(?:'|ft)\s*-?\s*(\d+(?:\.\d+)?)?\s*(?:"|in)?$/);if(m)return parseFloat(m[1])+(m[2]?parseFloat(m[2])/12:0);
  m=s.match(/^(-?\d+(?:\.\d+)?)\s*(?:"|in)$/);if(m)return parseFloat(m[1])/12;var n=parseFloat(s);return isNaN(n)?null:n;}
function r3(v){return Math.round(v*1000)/1000;}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function toast(msg,ms){var t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(toast._t);toast._t=setTimeout(function(){t.classList.remove('show');},ms||2600);}

/* ---------- geometry helpers ---------- */
function bounds(){var minx=Infinity,miny=Infinity,maxx=-Infinity,maxy=-Infinity;
  model.walls.forEach(function(w){minx=Math.min(minx,w.x1,w.x2);maxx=Math.max(maxx,w.x1,w.x2);miny=Math.min(miny,w.y1,w.y2);maxy=Math.max(maxy,w.y1,w.y2);});
  model.rooms.forEach(function(r){minx=Math.min(minx,r.x);maxx=Math.max(maxx,r.x+r.w);miny=Math.min(miny,r.y);maxy=Math.max(maxy,r.y+r.d);});
  if(!isFinite(minx)){minx=0;miny=0;maxx=30;maxy=40;}
  return {x:minx,y:miny,w:maxx-minx,d:maxy-miny,cx:(minx+maxx)/2,cy:(miny+maxy)/2};}
function segLen(o){return Math.hypot(o.x2-o.x1,o.y2-o.y1);}
function hostWall(o){var best=null,bd=Infinity;model.walls.forEach(function(w){var L=segLen(w);if(L<1e-6)return;var ux=(w.x2-w.x1)/L,uy=(w.y2-w.y1)/L,nx=-uy,ny=ux;
  var d1=Math.abs((o.x1-w.x1)*nx+(o.y1-w.y1)*ny),d2=Math.abs((o.x2-w.x1)*nx+(o.y2-w.y1)*ny);var s=((o.x1+o.x2)/2-w.x1)*ux+((o.y1+o.y2)/2-w.y1)*uy;
  if(d1<=w.t/2+0.15&&d2<=w.t/2+0.15&&s>-0.1&&s<L+0.1&&d1+d2<bd){bd=d1+d2;best=w;}});return best;}
function wallOpenings(w){var L=segLen(w);if(L<1e-6)return [];var ux=(w.x2-w.x1)/L,uy=(w.y2-w.y1)/L,nx=-uy,ny=ux,tol=w.t/2+0.15,ops=[];
  function add(o,bot,top,kind){var s1=(o.x1-w.x1)*ux+(o.y1-w.y1)*uy,s2=(o.x2-w.x1)*ux+(o.y2-w.y1)*uy;var d1=Math.abs((o.x1-w.x1)*nx+(o.y1-w.y1)*ny),d2=Math.abs((o.x2-w.x1)*nx+(o.y2-w.y1)*ny);
    if(d1>tol||d2>tol)return;var a=Math.min(s1,s2),b=Math.max(s1,s2);if(b<=0.02||a>=L-0.02)return;ops.push({a:Math.max(0,a),b:Math.min(L,b),bot:bot,top:top,kind:kind});}
  model.doors.forEach(function(d){add(d,0,d.h||model.specs.doorH,'door');});
  model.windows.forEach(function(wi){add(wi,wi.sill,wi.head,'win');});
  ops.sort(function(p,q){return p.a-q.a;});var out=[];
  ops.forEach(function(o){var l=out[out.length-1];if(l&&o.a<l.b-0.01){l.b=Math.max(l.b,o.b);l.bot=Math.min(l.bot,o.bot);l.top=Math.max(l.top,o.top);}else out.push(Object.assign({},o));});
  return out;}
function roomCeil(r){return r.ceil||model.specs.ceiling;}
function wallHeight(w){if(w.h)return w.h;var L=segLen(w)||1,ux=(w.x2-w.x1)/L,uy=(w.y2-w.y1)/L,nx=-uy,ny=ux,off=w.t/2+0.35,H=0,found=false;
  [0.2,0.5,0.8].forEach(function(f){var mx=w.x1+(w.x2-w.x1)*f,my=w.y1+(w.y2-w.y1)*f;[[mx+nx*off,my+ny*off],[mx-nx*off,my-ny*off]].forEach(function(p){
    model.rooms.forEach(function(r){if(p[0]>r.x&&p[0]<r.x+r.w&&p[1]>r.y&&p[1]<r.y+r.d){H=Math.max(H,roomCeil(r));found=true;}});});});
  return found?H:model.specs.ceiling;}
function doorOpenAngle(d,f){var W=segLen(d)||1,a=Math.atan2(d.y2-d.y1,d.x2-d.x1);return a+(d.swing||1)*Math.PI/2*f;}

/* ---------- three.js setup ---------- */
var host=$('#view3d');
var renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputEncoding=THREE.sRGBEncoding;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
host.insertBefore(renderer.domElement,host.firstChild);
var cv=renderer.domElement;cv.tabIndex=0;cv.setAttribute('aria-label','3D view of the house');
var scene=new THREE.Scene();scene.background=new THREE.Color('#0c0a14');scene.fog=new THREE.Fog('#0c0a14',180,460);
var camera=new THREE.PerspectiveCamera(55,1,0.1,1200);camera.rotation.order='YXZ';
scene.add(new THREE.HemisphereLight(0xe9eeff,0x3a3046,0.72));
scene.add(new THREE.AmbientLight(0xffffff,0.2));
var sun=new THREE.DirectionalLight(0xfff3e2,0.95);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.bias=-0.0004;sun.shadow.normalBias=0.03;scene.add(sun);scene.add(sun.target);
var interior=new THREE.PointLight(0xfff1dc,0,0,2);scene.add(interior);
var ground=new THREE.Mesh(new THREE.PlaneGeometry(800,800),new THREE.MeshStandardMaterial({color:new THREE.Color('#16131f').convertSRGBToLinear(),roughness:1}));
ground.rotation.x=-Math.PI/2;ground.position.y=-0.31;ground.receiveShadow=true;scene.add(ground);
var grid=new THREE.GridHelper(400,80,0x3a2c5c,0x221c33);grid.position.y=-0.29;scene.add(grid);

var matCache={};
function mat(c,o){var k=c+'|'+JSON.stringify(o||{});if(!matCache[k]){var p=Object.assign({roughness:0.85,metalness:0},o||{});p.color=new THREE.Color(c).convertSRGBToLinear();matCache[k]=new THREE.MeshStandardMaterial(p);}return matCache[k];}
var glassMat=new THREE.MeshStandardMaterial({color:new THREE.Color('#8fe9ff').convertSRGBToLinear(),transparent:true,opacity:0.25,roughness:0.05,metalness:0.1,depthWrite:false});
function bx(w,h,d,c,o){var m=new THREE.Mesh(new THREE.BoxGeometry(Math.max(w,0.01),Math.max(h,0.01),Math.max(d,0.01)),typeof c==='string'?mat(c,o):c);m.castShadow=true;m.receiveShadow=true;return m;}
/* ---------- materials: procedural textures (no image files, so the page stays one file) ----------
   Each texture covers TEX_FT × TEX_FT feet; meshes set texture.repeat from their real size. */
var TEX_FT=4,texCache={},texMatCache={};
var FINISH_COL={brick:'#9c4a32',stone:'#8a8178',subway:'#f4f2ee',shiplap:'#f2efe8',board:'#f2efe8',concrete:'#9a9893'};
var FLOOR_MATS=[['solid','Solid color'],['wood','Hardwood planks'],['lvp','Wide plank / LVP'],['herring','Herringbone wood'],['tile12','Tile 12×12'],['tile24','Tile 24×24'],['hex','Hex tile'],['marble','Marble'],['concrete','Polished concrete'],['carpet','Carpet'],['epoxy','Garage epoxy']];
var WALL_MATS=[['paint','Paint'],['brick','Brick'],['shiplap','Shiplap'],['subway','Subway tile'],['stone','Stone'],['board','Board & batten'],['concrete','Concrete']];
var TOP_MATS=[['quartz','Quartz (white)'],['granite','Granite (dark)'],['marble','Marble'],['butcher','Butcher block'],['concrete','Concrete'],['steel','Stainless']];
function rng(seed){var s=seed>>>0||1;return function(){s=(s*1664525+1013904223)>>>0;return s/4294967296;};}
function shade(hex,k){var c=new THREE.Color(hex);c.r=clamp(c.r*k,0,1);c.g=clamp(c.g*k,0,1);c.b=clamp(c.b*k,0,1);return '#'+c.getHexString();}
function makeTex(type,base){var key=type+'|'+base;if(texCache[key])return texCache[key];var N=512,px=N/TEX_FT,cv=document.createElement('canvas');cv.width=cv.height=N;var g=cv.getContext('2d'),R=rng(type.length*977+parseInt(base.slice(1),16));
  g.fillStyle=base;g.fillRect(0,0,N,N);
  function noise(n,a,sz){for(var i=0;i<n;i++){g.fillStyle='rgba('+(R()<0.5?'0,0,0':'255,255,255')+','+(R()*a)+')';var s=sz*(0.5+R());g.fillRect(R()*N,R()*N,s,s);}}
  function grout(step,col,w){g.fillStyle=col;for(var i=0;i<=N;i+=step){g.fillRect(i-w/2,0,w,N);g.fillRect(0,i-w/2,N,w);}}
  switch(type){
    case 'wood':case 'lvp':{var pw=(type==='wood'?0.42:0.6)*px;for(var y=0;y<N;y+=pw){var x=-R()*N;while(x<N){var L=(type==='wood'?2+R()*3:3.5+R()*2)*px;g.fillStyle=shade(base,0.82+R()*0.32);g.fillRect(x,y,L,pw);
        g.strokeStyle='rgba(0,0,0,0.08)';g.lineWidth=1;for(var k=0;k<5;k++){g.beginPath();var gy=y+R()*pw;g.moveTo(x,gy);g.bezierCurveTo(x+L*0.3,gy+(R()-0.5)*6,x+L*0.6,gy+(R()-0.5)*6,x+L,gy+(R()-0.5)*4);g.stroke();}
        g.fillStyle='rgba(0,0,0,0.35)';g.fillRect(x,y,1.5,pw);x+=L;}g.fillStyle='rgba(0,0,0,0.3)';g.fillRect(0,y,N,1.2);}break;}
    case 'herring':{var bw=0.25*px,bl=1*px;g.save();g.translate(N/2,N/2);g.rotate(Math.PI/4);for(var i=-N*1.5;i<N*1.5;i+=bl){for(var j=-N*1.5;j<N*1.5;j+=bw*2){[0,1].forEach(function(f){g.fillStyle=shade(base,0.82+R()*0.3);
        if(f)g.fillRect(i+bw*((j/bw/2)%4),j,bl,bw);else g.fillRect(i+bw*((j/bw/2)%4)+bl-bw,j+bw,bw,bl);});}}g.restore();noise(1200,0.05,2);break;}
    case 'tile12':case 'tile24':case 'hex':{var st=(type==='tile12'?1:type==='tile24'?2:0.5)*px;
      if(type==='hex'){g.fillStyle='#cfcac2';g.fillRect(0,0,N,N);var r=st/2;for(var yy=0,row=0;yy<N+r;yy+=r*1.5,row++)for(var xx=(row%2?r*0.866:0);xx<N+r;xx+=r*1.732){g.beginPath();for(var a=0;a<6;a++){var an=Math.PI/6+a*Math.PI/3;g.lineTo(xx+Math.cos(an)*(r-1.5),yy+Math.sin(an)*(r-1.5));}g.closePath();g.fillStyle=shade(base,0.93+R()*0.12);g.fill();}}
      else{for(var ty=0;ty<N;ty+=st)for(var tx=0;tx<N;tx+=st){g.fillStyle=shade(base,0.92+R()*0.14);g.fillRect(tx,ty,st,st);}noise(1500,0.05,2);grout(st,'rgba(70,64,58,0.55)',2.2);}break;}
    case 'marble':{noise(800,0.04,4);for(var v=0;v<9;v++){g.strokeStyle='rgba(90,90,100,'+(0.12+R()*0.2)+')';g.lineWidth=0.6+R()*1.6;g.beginPath();var mx=R()*N,my=0;g.moveTo(mx,my);for(var q=0;q<8;q++){mx+=(R()-0.4)*90;my+=N/8;g.lineTo(mx,my);}g.stroke();}grout(2*px,'rgba(0,0,0,0.12)',1);break;}
    case 'concrete':case 'epoxy':noise(9000,type==='epoxy'?0.08:0.06,type==='epoxy'?1.5:3);if(type==='epoxy'){for(var e=0;e<1400;e++){g.fillStyle=['#e8e8e8','#222','#8a8f99'][e%3];g.fillRect(R()*N,R()*N,2,2);}}else{g.fillStyle='rgba(0,0,0,0.25)';g.fillRect(0,N/2,N,1.5);g.fillRect(N/2,0,1.5,N);}break;
    case 'carpet':noise(26000,0.08,1.6);break;
    case 'brick':{var bh=(2.67/12)*px,bwid=(8/12)*px;g.fillStyle='#bdb3a6';g.fillRect(0,0,N,N);for(var by=0,rr=0;by<N;by+=bh,rr++)for(var bx2=(rr%2?-bwid/2:0);bx2<N;bx2+=bwid){g.fillStyle=shade(base,0.78+R()*0.38);g.fillRect(bx2+1.5,by+1.5,bwid-3,bh-3);}noise(3000,0.06,2);break;}
    case 'shiplap':case 'board':{if(type==='shiplap'){var sh=0.5*px;for(var sy=0;sy<N;sy+=sh){g.fillStyle=shade(base,0.97+R()*0.05);g.fillRect(0,sy,N,sh);g.fillStyle='rgba(0,0,0,0.35)';g.fillRect(0,sy,N,2);}}
      else{var bt=1.33*px;for(var sx=0;sx<N;sx+=bt){g.fillStyle=shade(base,1.04);g.fillRect(sx,0,0.2*px,N);g.fillStyle='rgba(0,0,0,0.18)';g.fillRect(sx+0.2*px,0,2,N);}}break;}
    case 'subway':{var uh=0.25*px,uw=0.5*px;g.fillStyle='#d8d6d0';g.fillRect(0,0,N,N);for(var uy=0,ur=0;uy<N;uy+=uh,ur++)for(var ux=(ur%2?-uw/2:0);ux<N;ux+=uw){g.fillStyle=shade(base,0.95+R()*0.08);g.fillRect(ux+1.2,uy+1.2,uw-2.4,uh-2.4);}break;}
    case 'stone':{g.fillStyle='#6d665e';g.fillRect(0,0,N,N);for(var s=0;s<70;s++){var cx=R()*N,cy=R()*N,rad=(0.35+R()*0.5)*px;g.beginPath();for(var a2=0;a2<7;a2++){var an2=a2/7*Math.PI*2;g.lineTo(cx+Math.cos(an2)*rad*(0.7+R()*0.4),cy+Math.sin(an2)*rad*(0.6+R()*0.4));}g.closePath();g.fillStyle=shade(base,0.75+R()*0.45);g.fill();}noise(2000,0.08,2);break;}
    case 'quartz':noise(5000,0.06,1.6);break;
    case 'granite':noise(14000,0.35,2.2);break;
    case 'butcher':{var sw=0.125*px;for(var bx3=0;bx3<N;bx3+=sw){g.fillStyle=shade(base,0.8+R()*0.4);g.fillRect(bx3,0,sw,N);}g.fillStyle='rgba(0,0,0,0.15)';for(var b2=0;b2<N;b2+=sw)g.fillRect(b2,0,1,N);break;}
    case 'steel':for(var l=0;l<N;l++){g.fillStyle='rgba(255,255,255,'+(R()*0.05)+')';g.fillRect(0,l,N,1);}break;}
  var t=new THREE.CanvasTexture(cv);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.encoding=THREE.sRGBEncoding;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());texCache[key]=t;return t;}
var ROUGH={wood:0.55,lvp:0.6,herring:0.55,tile12:0.35,tile24:0.3,hex:0.35,marble:0.18,concrete:0.5,epoxy:0.3,carpet:1,brick:0.95,shiplap:0.85,board:0.85,subway:0.2,stone:0.95,quartz:0.25,granite:0.25,butcher:0.6,steel:0.3};
// A textured material sized for a surface w × h feet (one material per distinct size; cached).
function texMat(type,base,w,h,extra){var rx=Math.round(Math.max(0.05,w/TEX_FT)*100)/100,ry=Math.round(Math.max(0.05,h/TEX_FT)*100)/100,key=type+'|'+base+'|'+rx+'|'+ry+'|'+JSON.stringify(extra||{});
  if(texMatCache[key])return texMatCache[key];var t=makeTex(type,base).clone();t.needsUpdate=true;t.repeat.set(rx,ry);
  var m=new THREE.MeshStandardMaterial(Object.assign({map:t,roughness:ROUGH[type]==null?0.8:ROUGH[type],metalness:type==='steel'?0.7:0},extra||{}));texMatCache[key]=m;return m;}
function floorMaterial(r){var fm=r.floorMat||'solid';if(fm==='solid')return mat(r.floor||'#9b7653',{roughness:0.75});return texMat(fm,r.floor||'#9b7653',r.w,r.d);}
var TOP_COL={quartz:'#efede8',granite:'#2b2a2e',marble:'#ecebe7',butcher:'#a8743f',concrete:'#9a9893',steel:'#c4c8cc'};
function topMaterial(it,fallback,w,d){if(!it.top)return mat(fallback,{roughness:0.35});return texMat(it.top,TOP_COL[it.top]||'#eeeeee',w,d);}
function cyl(rt,rb,h,c,o){var m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,24),typeof c==='string'?mat(c,o):c);m.castShadow=true;m.receiveShadow=true;return m;}

var house=null,vert=null,ceilG=null,colSegs=[],doorObjs={},pickables=[];
var doorState={};
var view={mode:'orbit',ceilings:false,cut:1,labels:true,shadows:true,speed:6,snap:0.25,issues:true,dims:true,elec:true};
(function(){var v=lsGet(LS_VIEW);if(v){try{Object.assign(view,JSON.parse(v));view.mode='orbit';}catch(e){}}})();
function saveView(){lsSet(LS_VIEW,JSON.stringify({ceilings:view.ceilings,cut:view.cut,labels:view.labels,shadows:view.shadows,speed:view.speed,snap:view.snap,issues:view.issues,dims:view.dims,elec:view.elec}));}

function disposeTree(o){o.traverse(function(m){if(m.geometry)m.geometry.dispose();});}
function tagSel(obj,sel){obj.traverse(function(m){if(m.isMesh){m.userData.sel=sel;pickables.push(m);}});}

function rebuild(){
  if(house){scene.remove(house);disposeTree(house);}
  house=new THREE.Group();vert=new THREE.Group();ceilG=new THREE.Group();house.add(vert);house.add(ceilG);
  colSegs=[];doorObjs={};pickables=[];
  var S=model.specs,bb=bounds();
  var slab=bx(bb.w+1.2,0.3,bb.d+1.2,'#2a2633');slab.position.set(bb.cx,-0.15,bb.cy);slab.castShadow=false;house.add(slab);
  model.rooms.forEach(function(r,i){
    var f=new THREE.Mesh(new THREE.PlaneGeometry(Math.max(r.w,0.1),Math.max(r.d,0.1)),floorMaterial(r));
    f.rotation.x=-Math.PI/2;f.position.set(r.x+r.w/2,0.004+i*0.0015,r.y+r.d/2);f.receiveShadow=true;house.add(f);tagSel(f,{type:'room',id:r.id});
    var c=new THREE.Mesh(new THREE.PlaneGeometry(Math.max(r.w,0.1),Math.max(r.d,0.1)),mat('#f3f1ec',{side:THREE.DoubleSide,roughness:0.95}));
    c.rotation.x=Math.PI/2;c.position.set(r.x+r.w/2,roomCeil(r)-i*0.0015,r.y+r.d/2);ceilG.add(c);});
  model.walls.forEach(buildWall);
  model.windows.forEach(buildWindow);
  model.doors.forEach(buildDoor);
  model.items.forEach(buildItem);
  fixtureObjs=[];if(view.elec!==false)model.fixtures.forEach(buildFixture);
  scene.add(house);
  var s=Math.max(bb.w,bb.d)/2+14;var sc=sun.shadow.camera;sc.left=-s;sc.right=s;sc.top=s;sc.bottom=-s;sc.near=1;sc.far=320;sc.updateProjectionMatrix();
  sun.target.position.set(bb.cx,0,bb.cy);sun.position.set(bb.cx-30,80,bb.cy+40);
  buildLabels();applyViewState();updateDoors(0);buildIssues3D();
}
function buildWall(w){
  var L=segLen(w);if(L<0.05)return;var ux=(w.x2-w.x1)/L,uy=(w.y2-w.y1)/L,rot=-Math.atan2(uy,ux),H=wallHeight(w),t=w.t||0.33;
  var wm=mat(model.specs.wallColor||'#ece8e1',{roughness:0.92});
  function piece(a,b,y0,y1,col){if(b-a<0.01||y1-y0<0.01)return;var a2=a===0?a-t/2:a,b2=b>=L-1e-6?b+t/2:b;var len=b2-a2,s=(a2+b2)/2;
    var fin=w.finish&&w.finish!=='paint'?w.finish:null,pm=fin?texMat(fin,w.color||FINISH_COL[fin]||'#cccccc',len,y1-y0):(w.color?mat(w.color,{roughness:0.92}):wm);
    var m=bx(len,y1-y0,t,pm);m.position.set(w.x1+ux*s,y0+(y1-y0)/2,w.y1+uy*s);m.rotation.y=rot;vert.add(m);tagSel(m,{type:'wall',id:w.id});
    if(col)colSegs.push({x1:w.x1+ux*a2,y1:w.y1+uy*a2,x2:w.x1+ux*b2,y2:w.y1+uy*b2,r:t/2});}
  var cur=0;wallOpenings(w).forEach(function(o){piece(cur,o.a,0,H,true);if(o.bot>0.05)piece(o.a,o.b,0,o.bot,true);if(o.top<H)piece(o.a,o.b,o.top,H,false);cur=o.b;});
  piece(cur,L,0,H,true);
}
function buildWindow(wi){
  var W=segLen(wi);if(W<0.1)return;var ux=(wi.x2-wi.x1)/W,uy=(wi.y2-wi.y1)/W,rot=-Math.atan2(uy,ux),hw=hostWall(wi),t=hw?hw.t:model.specs.extT;
  var h=Math.max(0.2,wi.head-wi.sill),cx=(wi.x1+wi.x2)/2,cz=(wi.y1+wi.y2)/2,g=new THREE.Group();g.position.set(cx,0,cz);g.rotation.y=rot;
  var gl=new THREE.Mesh(new THREE.BoxGeometry(W,h,0.04),glassMat);gl.position.y=wi.sill+h/2;g.add(gl);
  var fc='#2b2836',ft=0.18;
  [[W,ft,0,wi.sill+ft/2],[W,ft,0,wi.head-ft/2],[ft,h,-W/2+ft/2,wi.sill+h/2],[ft,h,W/2-ft/2,wi.sill+h/2],[0.08,h,0,wi.sill+h/2]].forEach(function(p){var m=bx(p[0],p[1],t+0.04,fc);m.position.set(p[2],p[3],0);g.add(m);});
  var sill=bx(W+0.3,0.08,t+0.35,'#d9d4cb');sill.position.y=wi.sill-0.04;g.add(sill);
  vert.add(g);tagSel(g,{type:'window',id:wi.id});
}
function buildDoor(d){
  var W=segLen(d);if(W<0.2)return;var ux=(d.x2-d.x1)/W,uy=(d.y2-d.y1)/W,H=d.h||model.specs.doorH,base=-Math.atan2(uy,ux);
  if(!doorState[d.id])doorState[d.id]={f:0,target:0};
  var hw=hostWall(d),t=hw?hw.t:model.specs.intT,ext=hw&&hw.ext;
  if(d.type==='barn'){
    var side=d.swing||1,nx=-uy*side,ny=ux*side,off=t/2+0.1;
    var g=new THREE.Group();g.rotation.y=base;var leaf=bx(W,H+0.15,0.13,'#5b3f2c');leaf.position.y=(H+0.15)/2;g.add(leaf);
    [0.25,0.75].forEach(function(f){var s=bx(W-0.1,0.25,0.03,'#3f2b1f');s.position.set(0,(H+0.15)*f,0.08*side*0+0.08);g.add(s);var s2=s.clone();s2.position.z=-0.08;g.add(s2);});
    var mx=(d.x1+d.x2)/2+nx*off,my=(d.y1+d.y2)/2+ny*off;vert.add(g);
    var track=bx(2*W+0.3,0.12,0.12,'#1d1b22',{metalness:0.6,roughness:0.4});track.rotation.y=base;
    track.position.set(mx-ux*W/2,H+0.3,my-uy*W/2);vert.add(track);
    doorObjs[d.id]={d:d,type:'barn',g:g,mx:mx,my:my,ox:-ux,oy:-uy,ux:ux,uy:uy,W:W};tagSel(g,{type:'door',id:d.id});
  }else{
    var pivot=new THREE.Group();pivot.position.set(d.x1,0,d.y1);
    var leaf2=bx(W-0.05,H-0.04,0.14,ext?'#3d4f63':'#efece6');leaf2.position.set(W/2,H/2,0);pivot.add(leaf2);
    [-0.1,0.1].forEach(function(z){var k=new THREE.Mesh(new THREE.SphereGeometry(0.1,12,10),mat('#d6bf7a',{metalness:0.8,roughness:0.3}));k.position.set(W-0.4,3,z);pivot.add(k);});
    vert.add(pivot);doorObjs[d.id]={d:d,type:'swing',pivot:pivot,base:base,W:W};tagSel(pivot,{type:'door',id:d.id});
    // jamb casing
    [0,W].forEach(function(s){var j=bx(0.12,H,t+0.1,'#d8d3ca');j.position.set(d.x1+ux*s,H/2,d.y1+uy*s);j.rotation.y=base;vert.add(j);});
  }
}
function buildItem(it){
  var g=new THREE.Group(),w=Math.max(0.2,it.w),d=Math.max(0.2,it.d),h=Math.max(0.1,it.h||3),c=it.color||'#888888';
  function add(m,x,y,z){m.position.set(x,y,z);g.add(m);return m;}
  switch(it.kind){
    case 'bed':var hb=Math.max(h+1.6,3.6);add(bx(w,1.0,d,c),0,0.5,0);add(bx(w-0.45,0.8,d-0.25,'#f3f1ee'),-0.2,1.4,0);add(bx(0.35,hb,d+0.1,c),w/2-0.175,hb/2,0);
      [-d/4,d/4].forEach(function(z){add(bx(1.1,0.35,d/2-0.45,'#ffffff'),w/2-1.0,1.95,z);});add(bx(w*0.42,0.1,d-0.15,'#6b4fb3'),-w*0.25,1.84,0);break;
    case 'sofa':add(bx(w,1.4,d,c),0,0.7,0);add(bx(0.75,h,d,c),-w/2+0.375,h/2,0);add(bx(w,2.0,0.55,c),0,1.0,-d/2+0.275);add(bx(w,2.0,0.55,c),0,1.0,d/2-0.275);
      add(bx(w-0.9,0.35,d-1.3,'#6b6f8c'),0.2,1.55,0);break;
    case 'chair':add(bx(w,1.5,d,c),0,0.75,0);add(bx(w,h,0.5,c),0,h/2,d/2-0.25);break;
    case 'table':add(bx(w,0.15,d,c),0,h-0.075,0);[[1,1],[1,-1],[-1,1],[-1,-1]].forEach(function(p){add(bx(0.2,h-0.15,0.2,c),p[0]*(w/2-0.2),(h-0.15)/2,p[1]*(d/2-0.2));});break;
    case 'counter':add(bx(w,h-0.12,d-0.08,c),0,(h-0.12)/2,0);add(bx(w+0.04,0.12,d,topMaterial(it,'#2a2a30',w,d)),0,h-0.06,0);break;
    case 'island':add(bx(w-0.3,h-0.12,d-0.3,c),0,(h-0.12)/2,0);add(bx(w,0.12,d,topMaterial(it,'#ecebe6',w,d)),0,h-0.06,0);break;
    case 'range':add(bx(w,h,d,'#2d2e33',{metalness:0.45,roughness:0.4}),0,h/2,0);[[1,1],[1,-1],[-1,1],[-1,-1]].forEach(function(p){add(cyl(0.3,0.3,0.04,'#0d0d0f'),p[0]*w/4,h+0.02,p[1]*d/4);});break;
    case 'fridge':add(bx(w,h,d,'#b9bec6',{metalness:0.6,roughness:0.35}),0,h/2,0);add(bx(0.03,h*0.96,0.04,'#7e838b'),0,h/2,d/2+0.01);break;
    case 'sink':add(bx(w,0.05,d,'#9aa3ad',{metalness:0.6,roughness:0.3}),0,h+0.03,0);add(cyl(0.05,0.05,1,'#c9ccd1',{metalness:0.8,roughness:0.2}),-w/2+0.15,h+0.5,0);break;
    case 'vanity':add(bx(w,h-0.1,d,c),0,(h-0.1)/2,0);add(bx(w+0.04,0.1,d,topMaterial(it,'#ecebe6',w,d)),0,h-0.05,0);
      var n=it.sinks||2;for(var i=0;i<n;i++){var s=add(cyl(0.55,0.55,0.03,'#ffffff'),(i+0.5)/n*w-w/2,h+0.02,0.05);s.scale.z=0.7;}
      add(bx(w*0.9,2.6,0.06,'#a8c6d8',{metalness:0.9,roughness:0.05}),0,h+2.2,-d/2+0.03);break;
    case 'toilet':add(bx(0.7,h,Math.min(1.6,d),'#f4f4f4'),-w/2+0.35,h/2,0);var b=add(cyl(0.62,0.48,1.35,'#f4f4f4'),0.3,0.675,0);b.scale.z=0.75;break;
    case 'tub':add(bx(w,h,d,'#f4f4f4'),0,h/2,0);add(bx(w-0.5,0.02,d-0.5,'#9fd6e3'),0,h+0.01,0);break;
    case 'shower':add(bx(w,0.3,d,'#e8e8ea'),0,0.15,0);var gp=new THREE.Mesh(new THREE.BoxGeometry(w,h-0.3,0.05),glassMat);add(gp,0,0.3+(h-0.3)/2,d/2-0.03);
      add(cyl(0.3,0.3,0.05,'#c9ccd1',{metalness:0.8,roughness:0.2}),0,h-0.6,-d/2+0.5);break;
    case 'shelf':add(bx(0.08,h,d,c),-w/2+0.04,h/2,0);add(bx(0.08,h,d,c),w/2-0.04,h/2,0);for(var k=0;k<6;k++)add(bx(w,0.07,d,c),0,0.2+k*(h-0.3)/5,0);break;
    case 'plant':add(cyl(0.6,0.45,1.2,'#3b3448'),0,0.6,0);var lf=new THREE.Mesh(new THREE.SphereGeometry(Math.min(w,d)/2,14,10),mat('#3f8f5a'));lf.castShadow=true;add(lf,0,1.2+Math.max(0.5,h-1.2)/2,0);lf.scale.y=Math.max(0.5,h-1.2)/Math.min(w,d);break;
    case 'dishwasher':add(bx(w,h,d,'#2a2a30'),0,h/2,0);add(bx(w-0.08,h-0.5,0.04,c,{metalness:0.6,roughness:0.35}),0,(h-0.5)/2+0.3,d/2+0.01);add(bx(w*0.7,0.06,0.08,'#7e838b',{metalness:0.8}),0,h-0.35,d/2+0.06);break;
    case 'washer':add(bx(w,h,d,c),0,h/2,0);var dr=add(cyl(w*0.32,w*0.32,0.06,'#4a5260',{metalness:0.5,roughness:0.3}),0,h*0.48,d/2+0.02);dr.rotation.x=Math.PI/2;add(bx(w,0.4,0.08,'#cfd3d8'),0,h-0.2,-d/2+0.2);break;
    case 'tv':var sh2=w*0.5625;add(bx(w,sh2,0.12,'#0b0b0e',{roughness:0.25,metalness:0.3}),0,h-sh2/2,0);add(bx(w-0.12,sh2-0.12,0.01,'#1d2a44',{roughness:0.1}),0,h-sh2/2,0.065);break;
    case 'rug':var rg=add(bx(w,Math.max(0.02,h),d,c,{roughness:1}),0,Math.max(0.02,h)/2+0.006,0);rg.castShadow=false;break;
    case 'car':var bh=h*0.5,wr=Math.min(1.15,h*0.24);add(bx(w,bh,d*0.96,c,{metalness:0.5,roughness:0.35}),0,wr*0.7+bh/2,0);
      add(bx(w*0.52,h-bh-wr*0.7,d*0.84,c,{metalness:0.5,roughness:0.35}),-w*0.04,wr*0.7+bh+(h-bh-wr*0.7)/2,0);add(bx(w*0.5+0.02,(h-bh-wr*0.7)*0.7,d*0.86,'#1d2a44',{roughness:0.1,metalness:0.3}),-w*0.04,wr*0.7+bh+(h-bh-wr*0.7)*0.45,0);
      [[1,1],[1,-1],[-1,1],[-1,-1]].forEach(function(q){var t=add(cyl(wr,wr,0.7,'#141416',{roughness:0.9}),q[0]*w*0.32,wr,q[1]*(d/2-0.3));t.rotation.x=Math.PI/2;});break;
    default:add(bx(w,h,d,c),0,h/2,0);
  }
  g.position.set(it.cx,0,it.cy);g.rotation.y=-(it.rot||0)*Math.PI/180;house.add(g);tagSel(g,{type:'item',id:it.id});
  if(h>=1.4&&it.kind!=='plant'){var a=(it.rot||0)*Math.PI/180,ca=Math.cos(a),sa=Math.sin(a);var pts=[[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]].map(function(p){return [it.cx+p[0]*ca-p[1]*sa,it.cy+p[0]*sa+p[1]*ca];});
    for(var q=0;q<4;q++){var p1=pts[q],p2=pts[(q+1)%4];colSegs.push({x1:p1[0],y1:p1[1],x2:p2[0],y2:p2[1],r:0.02});}}
}
function updateDoors(dt){
  Object.keys(doorObjs).forEach(function(id){var o=doorObjs[id],st=doorState[id]||(doorState[id]={f:0,target:0});
    if(st.f!==st.target){var step=dt*1.7;st.f=st.f<st.target?Math.min(st.target,st.f+step):Math.max(st.target,st.f-step);}
    var e=st.f*st.f*(3-2*st.f);
    if(o.type==='swing')o.pivot.rotation.y=o.base-(o.d.swing||1)*Math.PI/2*e;
    else o.g.position.set(o.mx+o.ox*o.W*e,0,o.my+o.oy*o.W*e);});
}
function dynSegs(){var out=[];Object.keys(doorObjs).forEach(function(id){var o=doorObjs[id],st=doorState[id]||{f:0},e=st.f*st.f*(3-2*st.f),d=o.d;
  if(o.type==='swing'){var a=doorOpenAngle(d,e);out.push({x1:d.x1,y1:d.y1,x2:d.x1+o.W*Math.cos(a),y2:d.y1+o.W*Math.sin(a),r:0.09});}
  else{var cx=o.mx+o.ox*o.W*e,cy=o.my+o.oy*o.W*e;out.push({x1:cx-o.ux*o.W/2,y1:cy-o.uy*o.W/2,x2:cx+o.ux*o.W/2,y2:cy+o.uy*o.W/2,r:0.08});}});return out;}
function toggleDoor(id,force){var st=doorState[id]||(doorState[id]={f:0,target:0});st.target=force!=null?force:(st.target>0.5?0:1);}
function doorName(d){return d.name||'door';}

/* ---------- labels ---------- */
var labelEls=[];
function buildLabels(){var box=$('#labels');box.innerHTML='';labelEls=model.rooms.map(function(r){var el=document.createElement('div');el.className='rl';
  el.innerHTML=esc(r.name)+'<span>'+esc(fmt(r.w))+' × '+esc(fmt(r.d))+' · '+esc(fmt(roomCeil(r)))+' clg</span>';box.appendChild(el);return {el:el,r:r};});}
var v3=new THREE.Vector3();
function updateLabels(){var show=view.labels&&view.mode==='orbit';var W=host.clientWidth,H=host.clientHeight;
  labelEls.forEach(function(L){if(!show){L.el.style.display='none';return;}v3.set(L.r.x+L.r.w/2,0.5,L.r.y+L.r.d/2).project(camera);
    if(v3.z>1||v3.z<-1){L.el.style.display='none';return;}L.el.style.display='block';L.el.style.left=((v3.x+1)/2*W)+'px';L.el.style.top=((1-v3.y)/2*H)+'px';});}

/* ---------- view state ---------- */
function applyViewState(){var walk=view.mode==='walk';if(!house)return;
  ceilG.visible=walk||(view.ceilings&&view.cut>=0.999);vert.scale.y=walk?1:view.cut;sun.castShadow=view.shadows;
  interior.intensity=walk?0.55:0;document.body.classList.toggle('walk',walk);
  $('#mOrbit').classList.toggle('on',!walk);$('#mWalk').classList.toggle('on',walk);}
function syncViewUI(){var S=model.specs;$('#ceilRange').value=S.ceiling;$('#ceilVal').textContent=fmt(S.ceiling);$('#tCeil').checked=view.ceilings;$('#tLabels').checked=view.labels;$('#tShadows').checked=view.shadows;
  $('#cutRange').value=view.cut;$('#cutVal').textContent=Math.round(view.cut*100)+'%';$('#eyeRange').value=S.eye;$('#eyeVal').textContent=fmt(S.eye);$('#spdRange').value=view.speed;$('#spdVal').textContent=view.speed+' ft/s';
  $('#snapSel').value=String(view.snap);$('#tIssues').checked=view.issues!==false;$('#tDims').checked=view.dims!==false;$('#tElec').checked=view.elec!==false;$('#projName').textContent=S.name||'Residence';document.title=(S.name||'Residence')+' · 3D Walkthrough';}

/* ---------- orbit camera ---------- */
var orbit={tx:15,ty:0,tz:21,r:80,theta:Math.PI*0.8,phi:0.9},tween=null;
function setOrbitCam(){var sp=Math.sin(orbit.phi);camera.position.set(orbit.tx+orbit.r*sp*Math.sin(orbit.theta),orbit.ty+orbit.r*Math.cos(orbit.phi),orbit.tz+orbit.r*sp*Math.cos(orbit.theta));camera.up.set(0,1,0);camera.lookAt(orbit.tx,orbit.ty,orbit.tz);}
var VIEWS={top:{theta:0,phi:0.0005,k:1.05},ne:{theta:3*Math.PI/4,phi:0.88,k:1},nw:{theta:-3*Math.PI/4,phi:0.88,k:1},se:{theta:Math.PI/4,phi:0.88,k:1},sw:{theta:-Math.PI/4,phi:0.88,k:1},front:{theta:0,phi:1.33,k:0.9},side:{theta:Math.PI/2,phi:1.33,k:0.9}};
function goView(name){var V=VIEWS[name];if(!V)return;if(view.mode==='walk')setMode('orbit');var bb=bounds();var fovk=1/Math.tan(camera.fov*Math.PI/360);
  var span=Math.max(bb.w/Math.max(camera.aspect,0.5),bb.d)*0.5+6;var R=span*fovk*V.k*(name==='top'?1:1.35)*(camera.aspect<1?1.2:1);
  var dth=V.theta-orbit.theta;dth=Math.atan2(Math.sin(dth),Math.cos(dth));
  tween={t0:performance.now(),dur:650,from:{tx:orbit.tx,tz:orbit.tz,r:orbit.r,theta:orbit.theta,phi:orbit.phi},to:{tx:bb.cx,tz:bb.cy,r:R,theta:orbit.theta+dth,phi:V.phi}};
  $$('[data-view]').forEach(function(b){b.classList.toggle('on',b.dataset.view===name);});}
function stepTween(now){if(!tween)return;var t=clamp((now-tween.t0)/tween.dur,0,1),e=t<0.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
  ['tx','tz','r','theta','phi'].forEach(function(k){orbit[k]=tween.from[k]+(tween.to[k]-tween.from[k])*e;});if(t>=1)tween=null;}
function clearViewBtns(){$$('[data-view]').forEach(function(b){b.classList.remove('on');});}

/* ---------- walk ---------- */
var player={x:20.5,z:38.5,yaw:0,pitch:0,placed:false},locked=false,keys={},joy={x:0,y:0};
function setMode(m){if(m===view.mode)return;view.mode=m;
  if(m==='walk'){tween=null;if(!player.placed){var fd=model.doors.filter(function(d){return /front/i.test(d.name||'');})[0];
      if(fd){var mx=(fd.x1+fd.x2)/2,my=(fd.y1+fd.y2)/2,a=Math.atan2(fd.y2-fd.y1,fd.x2-fd.x1),nx=-Math.sin(a),ny=Math.cos(a),bb=bounds();
        var s1=[mx+nx*7,my+ny*7],s2=[mx-nx*7,my-ny*7];var inside=function(p){return p[0]>bb.x&&p[0]<bb.x+bb.w&&p[1]>bb.y&&p[1]<bb.y+bb.d;};var p=inside(s1)?s2:s1;
        player.x=p[0];player.z=p[1];player.yaw=Math.atan2(-(mx-p[0]),-(my-p[1]));}
      else{var b2=bounds();player.x=b2.cx;player.z=b2.cy;}player.placed=true;player.pitch=0;}
    clearViewBtns();toast(isTouch?'You\'re at the front door. Drag the left side to move, the right side to look, and tap Door.':'You\'re at the front door. Click the view, then press E to open it and WASD to walk in.',4200);}
  else{if(document.pointerLockElement)try{document.exitPointerLock();}catch(e){}
    orbit.tx=player.x;orbit.tz=player.z;}
  applyViewState();}
function requestLock(){if(locked||isTouch)return;try{var p=cv.requestPointerLock();if(p&&p.catch)p.catch(function(){});}catch(e){}}
document.addEventListener('pointerlockchange',function(){locked=document.pointerLockElement===cv;$('#walkHud').classList.toggle('locked',locked);});
document.addEventListener('mousemove',function(e){if(locked&&view.mode==='walk')look(e.movementX,e.movementY);});
function look(dx,dy){player.yaw-=dx*0.0024;player.pitch=clamp(player.pitch-dy*0.0024,-1.4,1.4);}
function collide(px,pz){var R=0.6,segs=colSegs.concat(dynSegs());for(var it=0;it<4;it++){for(var i=0;i<segs.length;i++){var s=segs[i],vx=s.x2-s.x1,vz=s.y2-s.y1,L2=vx*vx+vz*vz||1e-9;
  var t=clamp(((px-s.x1)*vx+(pz-s.y1)*vz)/L2,0,1),cx=s.x1+vx*t,cz=s.y1+vz*t,dx=px-cx,dz=pz-cz,d=Math.hypot(dx,dz),min=R+(s.r||0);
  if(d<min){if(d<1e-6){dx=1;dz=0;}else{dx/=d;dz/=d;}px=cx+dx*min;pz=cz+dz*min;}}}return [px,pz];}
var ray=new THREE.Raycaster(),v2=new THREE.Vector2();
function targetDoor(){ray.setFromCamera(v2.set(0,0),camera);ray.far=8;var hits=ray.intersectObjects(pickables,false);
  for(var i=0;i<hits.length;i++){var s=hits[i].object.userData.sel;if(s&&s.type==='door')return s.id;if(s&&(s.type==='wall'||s.type==='item'))break;}
  var best=null,bd=4.5,fx=-Math.sin(player.yaw),fz=-Math.cos(player.yaw);model.doors.forEach(function(d){var mx=(d.x1+d.x2)/2,my=(d.y1+d.y2)/2,dx=mx-player.x,dz=my-player.z,dist=Math.hypot(dx,dz);
    if(dist<bd&&(dx*fx+dz*fz)/(dist||1)>0.45){bd=dist;best=d.id;}});return best;}
function interact(){var id=targetDoor();if(id)toggleDoor(id);}
var lastPrompt='';
function updateWalk(dt){var f=0,s=0;if(keys.KeyW||keys.ArrowUp)f+=1;if(keys.KeyS||keys.ArrowDown)f-=1;if(keys.KeyD||keys.ArrowRight)s+=1;if(keys.KeyA||keys.ArrowLeft)s-=1;
  f+=clamp(-joy.y/50,-1,1);s+=clamp(joy.x/50,-1,1);var m=Math.hypot(f,s);if(m>1){f/=m;s/=m;}
  var sp=view.speed*((keys.ShiftLeft||keys.ShiftRight)?1.9:1)*dt,fx=-Math.sin(player.yaw),fz=-Math.cos(player.yaw),rx=Math.cos(player.yaw),rz=-Math.sin(player.yaw);
  var p=collide(player.x+(fx*f+rx*s)*sp,player.z+(fz*f+rz*s)*sp);player.x=p[0];player.z=p[1];
  var eye=model.specs.eye||5.4;camera.position.set(player.x,eye,player.z);camera.rotation.set(player.pitch,player.yaw,0);
  interior.position.set(player.x,Math.min(eye+2,model.specs.ceiling-0.5),player.z);
  var id=targetDoor(),txt='';if(id){var d=model.doors.filter(function(x){return x.id===id;})[0];var st=doorState[id]||{target:0};txt=(isTouch?'Tap Door · ':'E · ')+(st.target>0.5?'Close ':'Open ')+(d?doorName(d):'door');}
  if(txt!==lastPrompt){var el=$('#doorPrompt');el.textContent=txt;el.style.display=txt?'block':'none';lastPrompt=txt;}}

/* ---------- 3D pointer input ---------- */
var isTouch=('ontouchstart' in window)&&matchMedia('(pointer:coarse)').matches;document.body.classList.toggle('touch',isTouch);
var ptrs=new Map(),pinch=null;
cv.addEventListener('contextmenu',function(e){e.preventDefault();});
cv.addEventListener('pointerdown',function(e){try{cv.setPointerCapture(e.pointerId);}catch(_){}cv.focus({preventScroll:true});
  ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY,btn:e.button,shift:e.shiftKey,t:performance.now(),type:e.pointerType});
  if(ptrs.size===2&&view.mode==='orbit'){var a=Array.from(ptrs.values());pinch={d:Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y),mx:(a[0].x+a[1].x)/2,my:(a[0].y+a[1].y)/2};}
  if(view.mode==='walk'&&e.pointerType==='mouse'){if(locked)interact();else requestLock();}});
cv.addEventListener('pointermove',function(e){var p=ptrs.get(e.pointerId);if(!p)return;var dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;
  if(view.mode==='orbit'){tween=null;
    if(ptrs.size>=2&&pinch){var a=Array.from(ptrs.values()),d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y),mx=(a[0].x+a[1].x)/2,my=(a[0].y+a[1].y)/2;
      orbit.r=clamp(orbit.r*pinch.d/(d||1),4,400);pan(mx-pinch.mx,my-pinch.my);pinch={d:d,mx:mx,my:my};clearViewBtns();}
    else if(ptrs.size===1){if(p.btn===2||p.btn===1||p.shift)pan(dx,dy);else{orbit.theta-=dx*0.006;orbit.phi=clamp(orbit.phi-dy*0.006,0.0005,1.56);}if(Math.abs(dx)+Math.abs(dy)>0)clearViewBtns();}}
  else{if(p.type!=='mouse'){var rect=cv.getBoundingClientRect();if(p.sx-rect.left<rect.width/2){joy.x=clamp(e.clientX-p.sx,-60,60);joy.y=clamp(e.clientY-p.sy,-60,60);p.joy=true;}else look(dx*1.4,dy*1.4);}
    else if(!locked&&(e.buttons&1))look(dx,dy);}});
function endPtr(e){var p=ptrs.get(e.pointerId);if(!p)return;ptrs.delete(e.pointerId);if(ptrs.size<2)pinch=null;if(p.joy){joy.x=0;joy.y=0;}
  var moved=Math.hypot(e.clientX-p.sx,e.clientY-p.sy);if(moved<6&&performance.now()-p.t<500&&e.type==='pointerup')click3d(e,p);}
cv.addEventListener('pointerup',endPtr);cv.addEventListener('pointercancel',endPtr);
cv.addEventListener('wheel',function(e){if(view.mode!=='orbit')return;e.preventDefault();tween=null;orbit.r=clamp(orbit.r*Math.exp(e.deltaY*0.0012),4,400);clearViewBtns();},{passive:false});
function pan(dx,dy){var k=orbit.r*0.0017,rx=Math.cos(orbit.theta),rz=-Math.sin(orbit.theta),fx=-Math.sin(orbit.theta),fz=-Math.cos(orbit.theta);
  orbit.tx+=-rx*dx*k+fx*dy*k;orbit.tz+=-rz*dx*k+fz*dy*k;}
function click3d(e,p){if(view.mode==='walk'){if(p.type!=='mouse'&&!p.joy){var rect0=cv.getBoundingClientRect();v2.set(((e.clientX-rect0.left)/rect0.width)*2-1,-((e.clientY-rect0.top)/rect0.height)*2+1);ray.setFromCamera(v2,camera);ray.far=10;
      var hh=ray.intersectObjects(pickables,false);for(var j=0;j<hh.length;j++){var sj=hh[j].object.userData.sel;if(sj&&sj.type==='door'){toggleDoor(sj.id);return;}if(sj&&sj.type!=='room')return;}}return;}
  var rect=cv.getBoundingClientRect();v2.set(((e.clientX-rect.left)/rect.width)*2-1,-((e.clientY-rect.top)/rect.height)*2+1);ray.setFromCamera(v2,camera);ray.far=Infinity;
  var hits=ray.intersectObjects(pickables,false).filter(function(h){return h.object.visible&&isVisible(h.object);});if(!hits.length){if(e.shiftKey)select(null);return;}
  var s=hits[0].object.userData.sel;if(!s)return;
  if(e.shiftKey||p.shift||document.body.classList.contains('editing')){select(s);showTab('edit');}
  else if(s.type==='door')toggleDoor(s.id);}
function isVisible(o){while(o){if(!o.visible)return false;o=o.parent;}return true;}

/* ---------- keyboard ---------- */
function typing(){var a=document.activeElement;return a&&(a.tagName==='INPUT'||a.tagName==='TEXTAREA'||a.tagName==='SELECT')&&a.type!=='range'&&a.type!=='checkbox';}
document.addEventListener('keydown',function(e){
  if(!$('#help').hidden&&e.key==='Escape'){$('#help').hidden=true;return;}
  if(!$('#ioDlg').hidden&&e.key==='Escape'){$('#ioDlg').hidden=true;return;}
  var mod=e.ctrlKey||e.metaKey;
  if(mod&&e.key.toLowerCase()==='s'){e.preventDefault();save();return;}
  if(typing())return;
  if(toolKey(e)){e.preventDefault();return;}
  if(mod&&e.key.toLowerCase()==='z'){e.preventDefault();if(e.shiftKey)redo();else undo();return;}
  if(mod&&e.key.toLowerCase()==='y'){e.preventDefault();redo();return;}
  if(mod&&e.key.toLowerCase()==='d'){e.preventDefault();duplicateSel();return;}
  if(mod)return;
  var walking=view.mode==='walk';
  if(walking&&/^(Key[WASD]|Arrow|Shift)/.test(e.code)){keys[e.code]=true;e.preventDefault();return;}
  if(!walking&&sel&&/^Arrow/.test(e.code)){e.preventDefault();var st=(view.snap||0.25)*(e.shiftKey?4:1),dx=e.code==='ArrowLeft'?-st:e.code==='ArrowRight'?st:0,dy=e.code==='ArrowUp'?-st:e.code==='ArrowDown'?st:0;nudge(dx,dy);return;}
  switch(e.code){
    case 'KeyO':setMode('orbit');break;case 'KeyF':setMode(walking?'orbit':'walk');break;
    case 'KeyE':if(walking)interact();break;
    case 'Digit1':goView('top');break;case 'Digit2':goView('ne');break;case 'Digit3':goView('nw');break;case 'Digit4':goView('se');break;case 'Digit5':goView('sw');break;case 'Digit6':goView('front');break;case 'Digit7':goView('side');break;
    case 'KeyC':view.ceilings=!view.ceilings;saveView();syncViewUI();applyViewState();break;
    case 'KeyL':view.labels=!view.labels;saveView();syncViewUI();break;
    case 'KeyP':setEditing(!document.body.classList.contains('editing'));break;
    case 'KeyK':showTab('check');break;
    case 'KeyR':if(sel&&sel.type==='item'){var ro=getObj();if(ro){pushUndo();ro.rot=((ro.rot||0)+90)%360;afterChange();}}break;
    case 'KeyV':setTool('select');break;case 'KeyB':setTool('wall');break;case 'KeyM':setTool('measure');break;
    case 'KeyH':$('#help').hidden=!$('#help').hidden;break;
    case 'BracketLeft':setCeiling(model.specs.ceiling-0.25);break;case 'BracketRight':setCeiling(model.specs.ceiling+0.25);break;
    case 'Backslash':toggleSide();break;
    case 'Delete':case 'Backspace':if(sel){e.preventDefault();deleteSel();}break;
    case 'Escape':if(sel)select(null);break;
    default:if(e.key==='?')$('#help').hidden=!$('#help').hidden;}
});
document.addEventListener('keyup',function(e){keys[e.code]=false;});
window.addEventListener('blur',function(){keys={};});

/* ---------- model changes ---------- */
var undoStack=[],redoStack=[];
function pushUndo(snap){undoStack.push(snap||JSON.stringify(model));if(undoStack.length>200)undoStack.shift();redoStack.length=0;}
function undo(){if(!undoStack.length)return toast('Nothing to undo');redoStack.push(JSON.stringify(model));model=JSON.parse(undoStack.pop());validateSel();afterChange();}
function redo(){if(!redoStack.length)return toast('Nothing to redo');undoStack.push(JSON.stringify(model));model=JSON.parse(redoStack.pop());validateSel();afterChange();}
var rebuildQueued=false;
function scheduleRebuild(){rebuildQueued=true;}
function afterChange(){scheduleRebuild();renderPlan();renderInspector();renderSpecs();renderChecks();syncViewUI();updateDirty();}
function updateDirty(){var cur=JSON.stringify(model),dirty=cur!==savedJSON;var s=$('#saveState');s.textContent=dirty?(artifactApi?'Unsaved changes':'Edits kept in this browser'):'Saved';s.classList.toggle('dirty',dirty);
  $('#saveBtn').disabled=!dirty||!artifactApi;lsSet(LS_DRAFT,dirty?JSON.stringify({base:EMBED_HASH,model:model}):null);}
function setCeiling(v){v=clamp(r3(v),6,30);if(v===model.specs.ceiling)return;pushUndo();model.specs.ceiling=v;afterChange();toast('Ceiling height '+fmt(v),1200);}

/* ---------- save / io ---------- */
var artifactApi=null,dlApi=null;
if(window.claude&&typeof window.claude.use==='function'){
  window.claude.use('artifact').then(function(a){artifactApi=a||null;updateDirty();}).catch(function(){});
  window.claude.use('downloads').then(function(d){dlApi=d||null;}).catch(function(){});}
function buildDoc(m){var css=document.getElementById('app-css').textContent,tpl=document.getElementById('tpl').innerHTML,src=document.getElementById('app-src').textContent;
  var json=JSON.stringify(m).replace(/</g,'\\u003c');
  return '<!DOCTYPE html>\n<html lang="en">\n<head>\n'+HEAD_STATIC+'<style id="app-css">'+css+'</style>\n<script id="plan-data" type="application/json">'+json+'<\/script>\n</head>\n<body>\n<template id="tpl">'+tpl+'</template>\n<script id="app-src">'+src+'<\/script>\n</body>\n</html>\n';}
var saving=false;
function save(){if(saving)return;if(!artifactApi){toast('Saving works on the published page. Your edits are kept in this browser for now.');return;}
  if(JSON.stringify(model)===savedJSON){toast('Nothing new to save');return;}
  saving=true;$('#saveBtn').disabled=true;$('#saveState').textContent='Saving…';
  Promise.resolve(artifactApi.publish(buildDoc(model))).then(function(){savedJSON=JSON.stringify(model);lsSet(LS_DRAFT,null);toast('Saved');saving=false;updateDirty();})
  .catch(function(err){saving=false;var c=err&&(err.code||err.name);toast(c==='conflict'?'A newer version was saved elsewhere, so the page is reloading.':c==='not_writer'||c==='not_granted'?'This copy is view-only, so edits stay in this browser.':'Couldn\'t save'+(c?' ('+c+')':'')+'. Your edits are still here.',4200);updateDirty();});}
function openIO(mode){var dlg=$('#ioDlg');dlg.hidden=false;var exp=mode==='export';$('#ioTitle').textContent=exp?'Export plan data':'Import plan data';
  $('#ioMsg').textContent=exp?'This JSON holds every wall, door, window, room, item and spec. Copy it or download it, then load it again with Import.':'Paste plan JSON, or choose a .json file, then click Load plan.';
  $('#ioText').value=exp?JSON.stringify(model,null,1):'';$('#ioApply').hidden=exp;$('#ioFile').parentNode.hidden=exp;$('#ioCopy').textContent=exp&&dlApi?'Download':'Copy';$('#ioCopy').hidden=!exp;dlg.dataset.mode=mode;}
$('#exportBtn').onclick=function(){openIO('export');};$('#importBtn').onclick=function(){openIO('import');};
$('#ioCancel').onclick=function(){$('#ioDlg').hidden=true;};
$('#ioCopy').onclick=function(){var txt=$('#ioText').value;if(dlApi){Promise.resolve(dlApi.save({filename:(model.specs.name||'plan').replace(/[^\w-]+/g,'-')+'.json',data:txt})).then(function(){toast('Download ready');}).catch(function(){copyText(txt);});}else copyText(txt);};
function copyText(t){try{navigator.clipboard.writeText(t).then(function(){toast('Copied to clipboard');}).catch(function(){$('#ioText').select();toast('Press Ctrl+C to copy');});}catch(e){$('#ioText').select();toast('Press Ctrl+C to copy');}}
$('#ioFile').onchange=function(e){var f=e.target.files[0];if(!f)return;var r=new FileReader();r.onload=function(){$('#ioText').value=r.result;};r.readAsText(f);};
$('#ioApply').onclick=function(){try{var m=JSON.parse($('#ioText').value);if(!m||!Array.isArray(m.walls))throw new Error('no walls');normalize(m);pushUndo();model=m;select(null);$('#ioDlg').hidden=true;afterChange();goView('ne');toast('Plan loaded');}catch(err){toast('That isn\'t valid plan JSON');}};
var resetArm=0;$('#resetBtn').onclick=function(){if(Date.now()-resetArm>3000){resetArm=Date.now();toast('Click Reset again to restore the original sketch layout');return;}resetArm=0;pushUndo();model=clone(DEFAULT_MODEL);normalize(model);select(null);afterChange();toast('Reset to the sketch. You can undo this.');};

/* ---------- selection & editing ---------- */
var sel=null;
function getObj(s){s=s||sel;if(!s)return null;var arr=model[COLL[s.type]]||[];for(var i=0;i<arr.length;i++)if(arr[i].id===s.id)return arr[i];return null;}
function validateSel(){if(sel&&!getObj())sel=null;}
function select(s){sel=s;renderPlan();renderInspector();}
function deleteSel(){var o=getObj();if(!o)return;pushUndo();var arr=model[COLL[sel.type]];arr.splice(arr.indexOf(o),1);sel=null;afterChange();toast('Deleted');}
function duplicateSel(){var o=getObj();if(!o)return;pushUndo();var c=clone(o);c.id=uid({wall:'w',door:'d',window:'win',room:'r',item:'i',fixture:'f'}[sel.type]);
  if(sel.type==='item'){c.cx+=1;c.cy+=1;}else if(sel.type==='fixture'){if(FIX[c.kind].mount==='wall'){var ra=(c.rot||0)*Math.PI/180;c.x-=Math.sin(ra)*2;c.y+=Math.cos(ra)*2;snapFixture(c);}else{c.x+=2;}}else if(sel.type==='room'){c.x+=1;c.y+=1;c.name+=' copy';}else{c.x1+=1;c.x2+=1;c.y1+=1;c.y2+=1;}
  model[COLL[sel.type]].push(c);sel={type:sel.type,id:c.id};afterChange();}
function moveObj(o,type,dx,dy){if(type==='item'){o.cx=r3(o.cx+dx);o.cy=r3(o.cy+dy);}else if(type==='room'||type==='fixture'){o.x=r3(o.x+dx);o.y=r3(o.y+dy);}else{o.x1=r3(o.x1+dx);o.y1=r3(o.y1+dy);o.x2=r3(o.x2+dx);o.y2=r3(o.y2+dy);}}
function hosted(w){return model.doors.concat(model.windows).filter(function(o){return hostWall(o)===w;});}
function nudge(dx,dy){var o=getObj();if(!o)return;pushUndo();if(sel.type==='wall')hosted(o).forEach(function(h){moveObj(h,'x',dx,dy);});moveObj(o,sel.type,dx,dy);afterChange();}
function setOpeningWidth(o,v){var L=segLen(o)||1,ux=(o.x2-o.x1)/L,uy=(o.y2-o.y1)/L,mx=(o.x1+o.x2)/2,my=(o.y1+o.y2)/2;
  if(o.type==='barn'){o.x2=r3(o.x1+ux*v);o.y2=r3(o.y1+uy*v);return;}o.x1=r3(mx-ux*v/2);o.y1=r3(my-uy*v/2);o.x2=r3(mx+ux*v/2);o.y2=r3(my+uy*v/2);}
function snapOpening(o){var mx=(o.x1+o.x2)/2,my=(o.y1+o.y2)/2,W=segLen(o)||3,best=null,bd=3.5;
  model.walls.forEach(function(w){var L=segLen(w);if(L<W)return;var ux=(w.x2-w.x1)/L,uy=(w.y2-w.y1)/L;var s=clamp((mx-w.x1)*ux+(my-w.y1)*uy,0,L);var px=w.x1+ux*s,py=w.y1+uy*s,d=Math.hypot(mx-px,my-py);if(d<bd){bd=d;best={w:w,ux:ux,uy:uy,L:L,s:s};}});
  if(!best)return false;var ou=(o.x2-o.x1)*best.ux+(o.y2-o.y1)*best.uy>=0?1:-1,s=clamp(best.s,W/2,best.L-W/2),w=best.w;
  o.x1=r3(w.x1+best.ux*(s-ou*W/2));o.y1=r3(w.y1+best.uy*(s-ou*W/2));o.x2=r3(w.x1+best.ux*(s+ou*W/2));o.y2=r3(w.y1+best.uy*(s+ou*W/2));return true;}
var ITEM_KINDS=[['cabinet','Cabinet / box',3,2,3,'#e6e1d8'],['counter','Base counter',6,2.1,3,'#e6e1d8'],['island','Island',4,7,3,'#3a4a5a'],['range','Range',2.5,2.1,3.05,'#2d2e33'],['fridge','Refrigerator',3,2.6,6,'#b9bec6'],['sink','Sink',2,1.6,3,'#9aa3ad'],
  ['vanity','Vanity',5,1.9,2.8,'#5a4636'],['toilet','Toilet',2.4,1.6,2.5,'#f4f4f4'],['tub','Tub',5,2.5,1.8,'#f4f4f4'],['shower','Shower',4,3.5,7,'#e8e8ea'],['bed','Bed',6.8,6,2,'#4a3f36'],['sofa','Sofa',3,7.5,2.8,'#5c5f78'],
  ['chair','Chair',2.8,2.8,2.8,'#7a6a8e'],['table','Table',6,3.5,2.5,'#6b5544'],['shelf','Shelving',4,1.3,7,'#c8b89c'],['plant','Plant',1.8,1.8,4,'#3f8f5a'],
  ['dishwasher','Dishwasher',2,2.08,2.83,'#b9bec6'],['washer','Washer / dryer',2.25,2.5,3.17,'#eceef0'],['tv','TV',4.75,0.75,5,'#111114'],['rug','Rug',10,8,0.04,'#6f5a7d'],['car','Vehicle',16,6.17,4.75,'#3d5a80']];
function viewCenter(){if(document.body.classList.contains('editing'))return {x:r3(pvb.x+pvb.w/2),y:r3(pvb.y+pvb.h/2)};var b=bounds();return {x:b.cx,y:b.cy};}
function snapV(v){var s=view.snap;return s?Math.round(v/s)*s:v;}
$$('[data-add]').forEach(function(b){b.onclick=function(){addThing(b.dataset.add);};});
function addThing(kind){pushUndo();var c=viewCenter(),S=model.specs,o;c.x=snapV(c.x);c.y=snapV(c.y);
  if(kind==='wall'){o={id:uid('w'),x1:c.x-5,y1:c.y,x2:c.x+5,y2:c.y,t:S.intT,ext:false,h:null,note:''};model.walls.push(o);}
  else if(kind==='door'||kind==='window'){var w=sel&&sel.type==='wall'?getObj():null,mx=c.x,my=c.y;if(w){mx=(w.x1+w.x2)/2;my=(w.y1+w.y2)/2;}
    var W=kind==='door'?3:3;o=kind==='door'?{id:uid('d'),name:'New door',type:'swing',x1:mx-W/2,y1:my,x2:mx+W/2,y2:my,swing:1,h:null,note:''}:{id:uid('win'),name:'New window',x1:mx-W/2,y1:my,x2:mx+W/2,y2:my,sill:3,head:S.doorH,note:''};
    if(w){var L=segLen(w),ux=(w.x2-w.x1)/L,uy=(w.y2-w.y1)/L;o.x1=r3(mx-ux*W/2);o.y1=r3(my-uy*W/2);o.x2=r3(mx+ux*W/2);o.y2=r3(my+uy*W/2);}else snapOpening(o);
    model[kind==='door'?'doors':'windows'].push(o);}
  else if(kind==='room'){o={id:uid('r'),name:'New room',x:c.x-5,y:c.y-5,w:10,d:10,ceil:null,floor:'#8f7356',note:''};model.rooms.push(o);}
  else{var k=ITEM_KINDS.filter(function(x){return x[0]==='cabinet';})[0]||ITEM_KINDS[0];o={id:uid('i'),label:k[1],kind:k[0],cx:c.x,cy:c.y,w:k[2],d:k[3],h:k[4],rot:0,color:k[5],note:''};model.items.push(o);kind='item';}
  sel={type:kind,id:o.id};setEditing(true);showTab('edit');afterChange();toast(kind==='door'||kind==='window'?(sel&&getObj()&&hostWall(getObj())?'Added. Drag it along the wall to place it.':'Added. Drag it onto a wall.'):'Added in the middle of the plan');}

/* ---------- inspector ---------- */
var LEN=function(k,label,o){return Object.assign({k:k,label:label,kind:'len'},o||{});};
var FIELDS={
 wall:[LEN('len','Length',{get:function(o){return segLen(o);},set:function(o,v){var L=segLen(o)||1;o.x2=r3(o.x1+(o.x2-o.x1)/L*v);o.y2=r3(o.y1+(o.y2-o.y1)/L*v);}}),LEN('t','Thickness'),LEN('h','Height',{opt:true,ph:function(o){return 'auto '+fmt(wallHeight(Object.assign({},o,{h:null})));}}),
   LEN('x1','Start X'),LEN('y1','Start Y'),LEN('x2','End X'),LEN('y2','End Y'),{k:'ext',label:'Exterior wall',kind:'bool'},{k:'finish',label:'Finish',kind:'select',options:WALL_MATS},{k:'color',label:'Wall color',kind:'color',get:function(o){return o.color||(o.finish&&FINISH_COL[o.finish])||model.specs.wallColor;}},{k:'note',label:'Spec notes',kind:'area',ph:'e.g. 2x6 @16" o.c., R-21, drywall'}],
 door:[{k:'name',label:'Name',kind:'text'},{k:'type',label:'Type',kind:'select',options:[['swing','Swing'],['barn','Barn / slider']]},LEN('width','Width',{get:segLen,set:setOpeningWidth}),LEN('h','Height',{opt:true,ph:function(){return 'default '+fmt(model.specs.doorH);}}),{k:'note',label:'Spec notes',kind:'area',ph:'e.g. solid-core 1-3/4", lever set'}],
 window:[{k:'name',label:'Name',kind:'text'},LEN('width','Width',{get:segLen,set:setOpeningWidth}),LEN('sill','Sill height'),LEN('head','Head height'),{k:'note',label:'Spec notes',kind:'area',ph:'e.g. vinyl double-hung, low-E'}],
 room:[{k:'name',label:'Name',kind:'text'},LEN('w','Width (E–W)'),LEN('d','Depth (N–S)'),LEN('ceil','Ceiling height',{opt:true,ph:function(){return 'house '+fmt(model.specs.ceiling);}}),LEN('x','Left (X)'),LEN('y','Top (Y)'),{k:'floorMat',label:'Floor material',kind:'select',options:FLOOR_MATS},{k:'floor',label:'Floor color',kind:'color'},{k:'note',label:'Spec notes',kind:'area',ph:'e.g. LVP flooring, recessed lights'}],
 item:[{k:'label',label:'Name',kind:'text'},{k:'kind',label:'Type',kind:'select',options:ITEM_KINDS.map(function(k){return [k[0],k[1]];})},LEN('w','Width'),LEN('d','Depth'),LEN('h','Height'),{k:'rot',label:'Rotation °',kind:'num'},LEN('cx','Center X'),LEN('cy','Center Y'),{k:'color',label:'Color',kind:'color'},{k:'top',label:'Countertop',kind:'select',options:[['','Default']].concat(TOP_MATS),when:function(o){return ['counter','island','vanity','sink'].indexOf(o.kind)>=0;}},{k:'note',label:'Spec notes',kind:'area',ph:'model, finish, supplier'}]};
var TITLES={wall:'Wall',door:'Door',window:'Window',room:'Room',item:'Item',fixture:'Fixture'};
function fval(f,o){return f.get?f.get(o):o[f.k];}
function renderInspector(){var box=$('#inspector'),o=getObj();
  if(!o){$('#inspTitle').innerHTML='Selection';box.innerHTML='<p class="muted">Select something in the plan, or Shift-click it in 3D, to change its size, position and specs.</p>';return;}
  $('#inspTitle').innerHTML=TITLES[sel.type]+'<span class="badge">'+esc(o.id)+'</span>';
  var html=FIELDS[sel.type].map(function(f,i){if(f.when&&!f.when(o))return '';var v=fval(f,o),id='f_'+i,inp;
    if(f.kind==='len'){var ph=f.ph?f.ph(o):'';inp='<input type="text" inputmode="decimal" id="'+id+'" data-i="'+i+'" value="'+(v==null?'':r3(v))+'" placeholder="'+esc(ph)+'"><span class="fi">'+(v==null?'':fmt(v))+'</span>';}
    else if(f.kind==='num')inp='<input type="number" step="15" id="'+id+'" data-i="'+i+'" value="'+(v||0)+'">';
    else if(f.kind==='text')inp='<input type="text" id="'+id+'" data-i="'+i+'" value="'+esc(v)+'">';
    else if(f.kind==='area')inp='<textarea id="'+id+'" data-i="'+i+'" placeholder="'+esc(f.ph||'')+'">'+esc(v)+'</textarea>';
    else if(f.kind==='bool')inp='<input type="checkbox" id="'+id+'" data-i="'+i+'"'+(v?' checked':'')+'>';
    else if(f.kind==='color')inp='<input type="color" id="'+id+'" data-i="'+i+'" value="'+esc(v||'#888888')+'">';
    else inp='<select id="'+id+'" data-i="'+i+'">'+f.options.map(function(op){return '<option value="'+op[0]+'"'+(op[0]===v?' selected':'')+'>'+esc(op[1])+'</option>';}).join('')+'</select>';
    return '<div class="field"><label for="'+id+'">'+esc(f.label)+'</label><div class="inp">'+inp+'</div></div>';}).join('');
  if(sel.type==='room')html+='<p class="hint">Area: <b>'+r3(o.w*o.d).toFixed(1)+' sq ft</b></p>';
  if(sel.type==='wall'){var hw=hosted(o).length;html+='<p class="hint">'+hw+' door/window opening'+(hw===1?'':'s')+' on this wall move with it.</p>';}
  var acts='';
  if(sel.type==='door'){var st=doorState[o.id]||{target:0};acts+='<button class="btn" data-act="toggle">'+(st.target>0.5?'Close':'Open')+' door</button><button class="btn" data-act="hinge">Flip hinge side</button><button class="btn" data-act="swing">Flip swing side</button>';}
  if(sel.type==='item')acts+='<button class="btn" data-act="rot90">Rotate 90°</button>';
  if(sel.type==='wall')acts+='<button class="btn" data-act="adddoor">Add door here</button><button class="btn" data-act="addwin">Add window here</button>';
  acts+='<button class="btn" data-act="dup">Duplicate</button><button class="btn danger" data-act="del">Delete</button>';
  box.innerHTML=html+'<div class="insp-actions">'+acts+'</div>';
  $$('[data-i]',box).forEach(function(el){var f=FIELDS[sel.type][+el.dataset.i];var ev=(f.kind==='color')?'input':'change';var snap=null;
    el.addEventListener('focus',function(){snap=JSON.stringify(model);el._pushed=false;});
    el.addEventListener(ev,function(){var o2=getObj();if(!o2)return;var before=snap||JSON.stringify(model),v;
      if(f.kind==='len'){v=parseLen(el.value);if(v==null){if(!f.opt){toast('Couldn\'t read that length');renderInspector();return;}}else if(v<0&&!/^[xy]|^c[xy]/.test(f.k)){toast('Length must be positive');renderInspector();return;}}
      else if(f.kind==='num')v=parseFloat(el.value)||0;else if(f.kind==='bool')v=el.checked;else v=el.value;
      if(f.set)f.set(o2,v);else o2[f.k]=(f.kind==='len'&&v!=null)?r3(v):v;
      if(!el._pushed){pushUndo(before);el._pushed=true;}
      if(f.kind==='color'){scheduleRebuild();renderPlan();updateDirty();renderSpecs();}else afterChange();});
    if(f.kind==='len')el.addEventListener('keydown',function(e){if(e.key==='Enter')el.blur();});});
  $$('[data-act]',box).forEach(function(b){b.onclick=function(){var a=b.dataset.act,o2=getObj();if(!o2)return;
    if(a==='toggle'){toggleDoor(o2.id);setTimeout(renderInspector,50);return;}
    if(a==='del')return deleteSel();if(a==='dup')return duplicateSel();
    if(a==='adddoor'||a==='addwin')return addThing(a==='adddoor'?'door':'window');
    pushUndo();if(a==='hinge'){var t=[o2.x1,o2.y1];o2.x1=o2.x2;o2.y1=o2.y2;o2.x2=t[0];o2.y2=t[1];o2.swing=-(o2.swing||1);}
    else if(a==='swing')o2.swing=-(o2.swing||1);else if(a==='rot90'){o2.rot=((o2.rot||0)+90)%360;}afterChange();};});
}

/* ---------- specs ---------- */
var SPEC_FIELDS=[['name','Project name','text'],['ceiling','Ceiling height','len'],['doorH','Door height','len'],['extT','Ext. wall thickness','len'],['intT','Int. wall thickness','len'],['eye','Eye height (walk)','len'],['wallColor','Wall color','color']];
function renderSpecs(){var S=model.specs,box=$('#specsBox');
  var h='<div class="group"><div class="g-title">House specs</div>'+SPEC_FIELDS.map(function(f){var v=S[f[0]],id='s_'+f[0];var inp=f[2]==='len'?'<input type="text" inputmode="decimal" id="'+id+'" data-s="'+f[0]+'" value="'+r3(v)+'"><span class="fi">'+fmt(v)+'</span>':f[2]==='color'?'<input type="color" id="'+id+'" data-s="'+f[0]+'" value="'+esc(v)+'">':'<input type="text" id="'+id+'" data-s="'+f[0]+'" value="'+esc(v)+'">';
    return '<div class="field"><label for="'+id+'">'+f[1]+'</label><div class="inp">'+inp+'</div></div>';}).join('')+
    '<div class="row2"><button class="btn" id="applyExt">Use on all ext. walls</button><button class="btn" id="applyInt">Use on all int. walls</button></div></div>';
  var tot=0,rows=model.rooms.map(function(r){var a=r.w*r.d;tot+=a;return '<tr class="click" data-room="'+r.id+'"><td>'+esc(r.name)+'</td><td>'+fmt(r.w)+' × '+fmt(r.d)+'</td><td>'+a.toFixed(0)+'</td><td>'+fmt(roomCeil(r))+'</td></tr>';}).join('');
  var bb=bounds();
  h+='<div class="group"><div class="g-title">Room schedule</div><table class="sched"><thead><tr><th>Room</th><th>Size</th><th>SF</th><th>Ceiling</th></tr></thead><tbody>'+rows+'</tbody><tfoot><tr><td>Footprint</td><td>'+fmt(bb.w)+' × '+fmt(bb.d)+'</td><td>'+(bb.w*bb.d).toFixed(0)+'</td><td></td></tr></tfoot></table>'+
    '<p class="hint">'+model.walls.length+' walls · '+model.doors.length+' doors · '+model.windows.length+' windows · '+model.items.length+' items · '+model.fixtures.length+' electrical/HVAC. Room areas use each room\'s rectangle, so rooms that overlap are counted twice.</p></div>';
  box.innerHTML=h;
  $$('[data-s]',box).forEach(function(el){var k=el.dataset.s,t=SPEC_FIELDS.filter(function(f){return f[0]===k;})[0][2];var snap=null;el.addEventListener('focus',function(){snap=JSON.stringify(model);el._pushed=false;});
    el.addEventListener(t==='color'?'input':'change',function(){var v=t==='len'?parseLen(el.value):el.value;if(t==='len'&&(v==null||v<=0)){toast('Couldn\'t read that length');renderSpecs();return;}
      var before=snap||JSON.stringify(model);model.specs[k]=t==='len'?r3(v):v;if(!el._pushed){pushUndo(before);el._pushed=true;}
      if(t==='color'){scheduleRebuild();updateDirty();}else afterChange();});
    if(t==='len')el.addEventListener('keydown',function(e){if(e.key==='Enter')el.blur();});});
  $('#applyExt').onclick=function(){pushUndo();model.walls.forEach(function(w){if(w.ext)w.t=model.specs.extT;});afterChange();toast('Updated exterior walls');};
  $('#applyInt').onclick=function(){pushUndo();model.walls.forEach(function(w){if(!w.ext)w.t=model.specs.intT;});afterChange();toast('Updated interior walls');};
  $$('[data-room]',box).forEach(function(tr){tr.onclick=function(){setEditing(true);select({type:'room',id:tr.dataset.room});showTab('edit');};});}

/* ---------- 2D plan editor ---------- */
var svg=$('#plan'),pvb={x:-6,y:-6,w:42,h:54},pdrag=null;
function fitPlan(){var bb=bounds(),r=svg.getBoundingClientRect(),asp=(r.width||400)/(r.height||400),w=bb.w+8,h=bb.d+8;if(w/h>asp)h=w/asp;else w=h*asp;pvb={x:bb.cx-w/2,y:bb.cy-h/2,w:w,h:h};setVB();}
function setVB(){svg.setAttribute('viewBox',pvb.x+' '+pvb.y+' '+pvb.w+' '+pvb.h);}
function toPlan(e){var pt=svg.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;var m=svg.getScreenCTM();if(!m)return {x:0,y:0};var p=pt.matrixTransform(m.inverse());return {x:p.x,y:p.y};}
function renderPlan(){if(!document.body.classList.contains('editing'))return;var h=[],k=pvb.w/(svg.clientWidth||600),S=model.specs;
  var sw=function(px){return (px*k).toFixed(3);};
  h.push('<defs><pattern id="g1" width="1" height="1" patternUnits="userSpaceOnUse"><path d="M1 0H0V1" fill="none" stroke="#1e1930" stroke-width="'+sw(1)+'"/></pattern><pattern id="g5" width="5" height="5" patternUnits="userSpaceOnUse"><rect width="5" height="5" fill="url(#g1)"/><path d="M5 0H0V5" fill="none" stroke="#2c2446" stroke-width="'+sw(1)+'"/></pattern></defs>');
  h.push('<rect x="'+(pvb.x-200)+'" y="'+(pvb.y-200)+'" width="'+(pvb.w+400)+'" height="'+(pvb.h+400)+'" fill="url(#g5)" data-bg="1"/>');
  var isSel=function(t,id){return sel&&sel.type===t&&sel.id===id;};
  model.rooms.forEach(function(r){var s=isSel('room',r.id);h.push('<rect data-type="room" data-id="'+r.id+'" x="'+r.x+'" y="'+r.y+'" width="'+r.w+'" height="'+r.d+'" fill="'+esc(r.floor||'#8f7356')+'" fill-opacity="'+(s?0.42:0.22)+'" stroke="'+(s?'#2de2e6':'#6a5f8a')+'" stroke-width="'+sw(s?2:1)+'" stroke-dasharray="'+(s?'':sw(5)+' '+sw(4))+'"/>');});
  var fixSvg=planFixSVG(k,isSel);
  model.items.forEach(function(it){var s=isSel('item',it.id);h.push('<g data-type="item" data-id="'+it.id+'" transform="translate('+it.cx+' '+it.cy+') rotate('+(it.rot||0)+')"><rect x="'+(-it.w/2)+'" y="'+(-it.d/2)+'" width="'+it.w+'" height="'+it.d+'" fill="'+esc(it.color||'#888')+'" fill-opacity="0.55" stroke="'+(s?'#2de2e6':'#cfc8e8')+'" stroke-width="'+sw(s?2.2:1)+'"/>'+
    ((Math.min(it.w,it.d)>1.2)?'<text x="0" y="0.25" font-size="'+Math.min(0.75,it.w/6,1.2).toFixed(2)+'" text-anchor="middle" fill="#fff" font-family="JetBrains Mono, monospace" pointer-events="none">'+esc(it.label||'')+'</text>':'')+'</g>');});
  model.walls.forEach(function(w){var L=segLen(w);if(L<0.01)return;var ux=(w.x2-w.x1)/L,uy=(w.y2-w.y1)/L,nx=-uy*w.t/2,ny=ux*w.t/2,ex=ux*w.t/2,ey=uy*w.t/2,s=isSel('wall',w.id);
    var pts=[[w.x1-ex+nx,w.y1-ey+ny],[w.x2+ex+nx,w.y2+ey+ny],[w.x2+ex-nx,w.y2+ey-ny],[w.x1-ex-nx,w.y1-ey-ny]].map(function(p){return r3(p[0])+','+r3(p[1]);}).join(' ');
    h.push('<polygon data-type="wall" data-id="'+w.id+'" points="'+pts+'" fill="'+(s?'#2de2e6':(w.ext?'#ece9f7':'#bdb6d6'))+'" stroke="'+(s?'#2de2e6':'none')+'" stroke-width="'+sw(1)+'"/>');});
  model.windows.forEach(function(wi){var s=isSel('window',wi.id);h.push('<line data-type="window" data-id="'+wi.id+'" x1="'+wi.x1+'" y1="'+wi.y1+'" x2="'+wi.x2+'" y2="'+wi.y2+'" stroke="'+(s?'#4dff9a':'#2de2e6')+'" stroke-width="'+(hostWall(wi)?hostWall(wi).t*0.9:0.4)+'" stroke-linecap="butt"/>');});
  model.doors.forEach(function(d){var s=isSel('door',d.id),W=segLen(d),col=s?'#4dff9a':'#b57bff',hw=hostWall(d),t=hw?hw.t:0.33;
    h.push('<line x1="'+d.x1+'" y1="'+d.y1+'" x2="'+d.x2+'" y2="'+d.y2+'" stroke="#0f0c19" stroke-width="'+(t+0.04)+'"/>');
    if(d.type==='barn'){var a=Math.atan2(d.y2-d.y1,d.x2-d.x1),side=d.swing||1,ox=-Math.sin(a)*side*(t/2+0.15),oy=Math.cos(a)*side*(t/2+0.15);h.push('<line x1="'+(d.x1+ox)+'" y1="'+(d.y1+oy)+'" x2="'+(d.x2+ox)+'" y2="'+(d.y2+oy)+'" stroke="'+col+'" stroke-width="0.18"/>');}
    else{var oa=doorOpenAngle(d,1),tx=d.x1+W*Math.cos(oa),ty=d.y1+W*Math.sin(oa),sweep=(d.swing||1)>0?1:0;
      h.push('<line x1="'+d.x1+'" y1="'+d.y1+'" x2="'+r3(tx)+'" y2="'+r3(ty)+'" stroke="'+col+'" stroke-width="'+sw(2.2)+'"/><path d="M'+d.x2+' '+d.y2+' A'+W+' '+W+' 0 0 '+sweep+' '+r3(tx)+' '+r3(ty)+'" fill="none" stroke="'+col+'" stroke-width="'+sw(1)+'" stroke-dasharray="'+sw(4)+' '+sw(3)+'"/>');}
    h.push('<line data-type="door" data-id="'+d.id+'" x1="'+d.x1+'" y1="'+d.y1+'" x2="'+d.x2+'" y2="'+d.y2+'" stroke="transparent" stroke-width="'+Math.max(t+0.4,0.8)+'"/>');});
  model.rooms.forEach(function(r){var fs=Math.max(0.55,Math.min(1.1,r.w/9));h.push('<text x="'+(r.x+r.w/2)+'" y="'+(r.y+r.d/2)+'" font-size="'+fs.toFixed(2)+'" text-anchor="middle" fill="#ffffff" font-weight="600" font-family="Space Grotesk, sans-serif" pointer-events="none">'+esc(r.name)+'</text><text x="'+(r.x+r.w/2)+'" y="'+(r.y+r.d/2+fs*1.1)+'" font-size="'+(fs*0.7).toFixed(2)+'" text-anchor="middle" fill="#2de2e6" font-family="JetBrains Mono, monospace" pointer-events="none">'+esc(fmt(r.w)+' × '+fmt(r.d))+'</text>');});
  h.push(fixSvg);h.push(planIssueSVG(k));h.push(planToolSVG(k));
  var o=getObj(),hr=(7*k).toFixed(3),hd=function(name,x,y){h.push('<circle data-handle="'+name+'" cx="'+r3(x)+'" cy="'+r3(y)+'" r="'+hr+'" fill="#0c0a14" stroke="#4dff9a" stroke-width="'+sw(2)+'" style="cursor:grab"/>');};
  if(o){if(sel.type==='wall'||sel.type==='door'||sel.type==='window'){hd('p1',o.x1,o.y1);hd('p2',o.x2,o.y2);
      if(sel.type==='wall'){var mx=(o.x1+o.x2)/2,my=(o.y1+o.y2)/2;h.push('<text x="'+mx+'" y="'+(my-o.t-0.4)+'" font-size="'+(12*k).toFixed(2)+'" text-anchor="middle" fill="#4dff9a" font-family="JetBrains Mono, monospace" pointer-events="none">'+esc(fmt(segLen(o)))+'</text>');}}
    else if(sel.type==='room')hd('br',o.x+o.w,o.y+o.d);
    else if(sel.type==='item'){var a2=(o.rot||0)*Math.PI/180;hd('ibr',o.cx+(o.w/2)*Math.cos(a2)-(o.d/2)*Math.sin(a2),o.cy+(o.w/2)*Math.sin(a2)+(o.d/2)*Math.cos(a2));}}
  svg.innerHTML=h.join('');}
svg.addEventListener('pointerdown',function(e){var pt=toPlan(e),t=e.target,handle=t.getAttribute&&t.getAttribute('data-handle'),node=t.closest?t.closest('[data-type]'):null;
  try{svg.setPointerCapture(e.pointerId);}catch(_){}
  if(e.button===1||e.button===2||(!handle&&!node)){if(e.button===0&&!handle&&!node)select(null);pdrag={kind:'pan',sx:e.clientX,sy:e.clientY,vb:Object.assign({},pvb)};return;}
  if(handle){pdrag={kind:'handle',h:handle,start:pt,orig:clone(getObj()),before:JSON.stringify(model),moved:false};return;}
  var s={type:node.getAttribute('data-type'),id:node.getAttribute('data-id')};if(!sel||sel.type!==s.type||sel.id!==s.id)select(s);
  var o=getObj();pdrag={kind:'move',start:pt,orig:clone(o),before:JSON.stringify(model),moved:false,att:s.type==='wall'?hosted(o).map(function(x){return {o:x,orig:clone(x)};}):[]};});
svg.addEventListener('pointermove',function(e){if(!pdrag)return;
  if(pdrag.kind==='pan'){var r=svg.getBoundingClientRect(),k=pdrag.vb.w/r.width;pvb.x=pdrag.vb.x-(e.clientX-pdrag.sx)*k;pvb.y=pdrag.vb.y-(e.clientY-pdrag.sy)*k;setVB();return;}
  var pt=toPlan(e),dx=pt.x-pdrag.start.x,dy=pt.y-pdrag.start.y;if(!pdrag.moved&&Math.hypot(dx,dy)<0.15)return;pdrag.moved=true;
  var o=getObj();if(!o)return;var O=pdrag.orig;
  if(pdrag.kind==='move'){var sdx=snapV(dx),sdy=snapV(dy);Object.assign(o,clone(O));moveObj(o,sel.type,sdx,sdy);pdrag.att.forEach(function(a){Object.assign(a.o,clone(a.orig));moveObj(a.o,'x',sdx,sdy);});}
  else{var hh=pdrag.h;
    if(hh==='p1'||hh==='p2'){var px=snapV(O[hh==='p1'?'x1':'x2']+dx),py=snapV(O[hh==='p1'?'y1':'y2']+dy);
      if(sel.type==='wall'){if(!e.altKey){var ax=O[hh==='p1'?'x2':'x1'],ay=O[hh==='p1'?'y2':'y1'];if(Math.abs(px-ax)<Math.abs(py-ay)*0.12)px=ax;else if(Math.abs(py-ay)<Math.abs(px-ax)*0.12)py=ay;}
        model.walls.forEach(function(w){if(w.id===o.id)return;[[w.x1,w.y1],[w.x2,w.y2]].forEach(function(q){if(Math.hypot(q[0]-px,q[1]-py)<0.6){px=q[0];py=q[1];}});});
        o[hh==='p1'?'x1':'x2']=r3(px);o[hh==='p1'?'y1':'y2']=r3(py);}
      else{var L=segLen(O)||1,ux=(O.x2-O.x1)/L,uy=(O.y2-O.y1)/L;var s=hh==='p1'?((O.x1+dx-O.x2)*ux+(O.y1+dy-O.y2)*uy):((O.x2+dx-O.x1)*ux+(O.y2+dy-O.y1)*uy);
        s=hh==='p1'?Math.min(-0.5,snapV(s)):Math.max(0.5,snapV(s));if(hh==='p1'){o.x1=r3(O.x2+ux*s);o.y1=r3(O.y2+uy*s);}else{o.x2=r3(O.x1+ux*s);o.y2=r3(O.y1+uy*s);}}}
    else if(hh==='br'){o.w=r3(Math.max(1,snapV(O.w+dx)));o.d=r3(Math.max(1,snapV(O.d+dy)));}
    else if(hh==='ibr'){var a=(O.rot||0)*Math.PI/180,lx=dx*Math.cos(a)+dy*Math.sin(a),ly=-dx*Math.sin(a)+dy*Math.cos(a);var nw=Math.max(0.5,snapV(O.w+lx)),nd=Math.max(0.5,snapV(O.d+ly));
      var cdx=(nw-O.w)/2,cdy=(nd-O.d)/2;o.w=r3(nw);o.d=r3(nd);o.cx=r3(O.cx+cdx*Math.cos(a)-cdy*Math.sin(a));o.cy=r3(O.cy+cdx*Math.sin(a)+cdy*Math.cos(a));}}
  renderPlan();scheduleRebuild();});
function endPlanDrag(){if(!pdrag)return;var d=pdrag;pdrag=null;if(d.kind==='pan'||!d.moved)return;var o=getObj();if(o&&d.kind==='move'&&(sel.type==='door'||sel.type==='window'))snapOpening(o);if(o&&d.kind==='move'&&sel.type==='fixture'&&FIX[o.kind]&&FIX[o.kind].mount==='wall')snapFixture(o);pushUndo(d.before);afterChange();}
svg.addEventListener('pointerup',endPlanDrag);svg.addEventListener('pointercancel',endPlanDrag);
svg.addEventListener('contextmenu',function(e){e.preventDefault();});
svg.addEventListener('wheel',function(e){e.preventDefault();var p=toPlan(e),f=Math.exp(e.deltaY*0.0015);var nw=clamp(pvb.w*f,5,400),ff=nw/pvb.w;pvb.x=p.x-(p.x-pvb.x)*ff;pvb.y=p.y-(p.y-pvb.y)*ff;pvb.w*=ff;pvb.h*=ff;setVB();renderPlan();},{passive:false});
$('#fitPlan').onclick=function(){fitPlan();renderPlan();};
function setEditing(on){if(on===document.body.classList.contains('editing'))return;if(!on&&tool!=='select'){tool='select';draw=null;measures=[];$$('[data-tool]').forEach(function(b){b.classList.toggle('on',b.dataset.tool==='select');});svg.classList.remove('drawing');}document.body.classList.toggle('editing',on);$('#editToggle').classList.toggle('on',on);
  requestAnimationFrame(function(){resize();if(on){fitPlan();renderPlan();}});if(on)showTab('edit');}
$('#editToggle').onclick=function(){setEditing(!document.body.classList.contains('editing'));};
/* ---------- plan tools: draw walls, measure, dimensions ---------- */
var tool='select',draw=null,hover=null,measures=[],lenBuf='';
function setTool(t){if(t!=='select')setEditing(true);tool=t;if(t!=='place'){placeKind=null;$$('[data-fix]').forEach(function(b){b.classList.remove('on');});}draw=null;lenBuf='';hover=null;if(t!=='measure')measures=[];
  $$('[data-tool]').forEach(function(b){b.classList.toggle('on',b.dataset.tool===t);});svg.classList.toggle('drawing',t!=='select');renderPlan();
  if(t==='wall')toast('Click to start a wall and click again for each corner. Type a length like 12\'6" and press Enter. Double-click or Esc to stop.',5200);
  else if(t==='measure')toast('Click two points to measure. Esc clears the measurements.',3200);}
$$('[data-tool]').forEach(function(b){b.onclick=function(){setTool(b.dataset.tool);};});
function planTol(){return pvb.w/(svg.clientWidth||600)*11;}
// Snap a plan point: wall endpoints first, then (from a previous corner) 45-degree angles with snapped
// length, then a point along a wall, else the grid. Alt turns snapping off.
function snapPt(p,from,free){if(free)return {x:r3(p.x),y:r3(p.y),snap:null};var tol=planTol(),best=null,bd=tol;
  model.walls.forEach(function(w){[[w.x1,w.y1],[w.x2,w.y2]].forEach(function(q){var d=Math.hypot(q[0]-p.x,q[1]-p.y);if(d<bd){bd=d;best={x:q[0],y:q[1],snap:'end'};}});});
  if(best)return best;
  if(from){var dx=p.x-from.x,dy=p.y-from.y,L=Math.hypot(dx,dy);if(L>1e-6){var a=Math.round(Math.atan2(dy,dx)/(Math.PI/4))*(Math.PI/4),ca=Math.cos(a),sa=Math.sin(a);L=snapV(L)||L;
    var q={x:r3(from.x+L*ca),y:r3(from.y+L*sa),snap:'angle'};
    // stop exactly on a wall the ray crosses near the cursor
    model.walls.forEach(function(w){var Lw=segLen(w);if(Lw<0.1)return;var ux=(w.x2-w.x1)/Lw,uy=(w.y2-w.y1)/Lw,den=ca*uy-sa*ux;if(Math.abs(den)<0.2)return;
      var t=((w.x1-from.x)*uy-(w.y1-from.y)*ux)/den;if(t<=0.05)return;var ix=from.x+t*ca,iy=from.y+t*sa,s=(ix-w.x1)*ux+(iy-w.y1)*uy;if(s<-0.01||s>Lw+0.01)return;
      var d=Math.hypot(ix-q.x,iy-q.y);if(d<bd){bd=d;q={x:r3(ix),y:r3(iy),snap:'wall'};}});
    return q;}}
  var g={x:snapV(p.x),y:snapV(p.y),snap:null};
  model.walls.forEach(function(w){var Lw=segLen(w);if(Lw<0.1)return;var ux=(w.x2-w.x1)/Lw,uy=(w.y2-w.y1)/Lw,s=clamp((p.x-w.x1)*ux+(p.y-w.y1)*uy,0,Lw),px=w.x1+ux*s,py=w.y1+uy*s,d=Math.hypot(px-p.x,py-p.y);
    if(d<bd){bd=d;var ss=snapV(s);g={x:r3(w.x1+ux*ss),y:r3(w.y1+uy*ss),snap:'wall'};}});return g;}
function commitWall(p){var f=draw.from,L=Math.hypot(p.x-f.x,p.y-f.y);if(L<0.1)return;var ext=$('#wallType').value==='ext';pushUndo();
  model.walls.push({id:uid('w'),x1:r3(f.x),y1:r3(f.y),x2:r3(p.x),y2:r3(p.y),t:ext?model.specs.extT:model.specs.intT,ext:ext,h:null,note:''});
  var closed=Math.hypot(p.x-draw.start.x,p.y-draw.start.y)<0.01;draw=closed?null:{from:{x:p.x,y:p.y},start:draw.start};lenBuf='';afterChange();
  if(closed)toast('Closed the outline. Click to start another wall, or press V to select.');}
svg.addEventListener('pointerdown',function(e){if(tool==='select'||e.button!==0)return;e.stopImmediatePropagation();e.preventDefault();
  var p=snapPt(toPlan(e),draw&&draw.from,e.altKey);
  if(tool==='place'){var raw=toPlan(e);placeFixture(FIX[placeKind]&&FIX[placeKind].mount==='wall'?raw:p);return;}
  if(tool==='wall'){if(!draw)draw={from:p,start:p};else commitWall(p);}
  else if(tool==='measure'){if(!draw)draw={from:p};else{measures.push({a:draw.from,b:p});draw=null;}}
  renderPlan();},true);
svg.addEventListener('pointermove',function(e){if(tool==='select')return;hover=snapPt(toPlan(e),draw&&draw.from,e.altKey);renderPlan();});
svg.addEventListener('pointerleave',function(){if(tool!=='select'){hover=null;renderPlan();}});
svg.addEventListener('dblclick',function(){if(tool==='wall'&&draw){draw=null;lenBuf='';renderPlan();}});
// Keys while a tool is active: type a length for the next wall, Enter to place it, Esc to stop.
function toolKey(e){if(tool==='select')return false;
  if(e.key==='Escape'){if(draw||lenBuf){draw=null;lenBuf='';}else if(measures.length)measures=[];else setTool('select');renderPlan();return true;}
  if(tool!=='wall'||!draw)return false;
  if(/^[0-9.'"\- ]$/.test(e.key)){lenBuf+=e.key;renderPlan();return true;}
  if(e.key==='Backspace'&&lenBuf){lenBuf=lenBuf.slice(0,-1);renderPlan();return true;}
  if(e.key==='Enter'&&lenBuf){var L=parseLen(lenBuf),f=draw.from,h=hover||{x:f.x+1,y:f.y},dx=h.x-f.x,dy=h.y-f.y;
    if(L==null||L<=0){toast('Couldn\'t read that length');lenBuf='';renderPlan();return true;}
    var a=e.altKey?Math.atan2(dy,dx):Math.round(Math.atan2(dy,dx)/(Math.PI/4))*(Math.PI/4);commitWall({x:r3(f.x+L*Math.cos(a)),y:r3(f.y+L*Math.sin(a))});return true;}
  return false;}
function planToolSVG(k){var h=[],sw=function(px){return (px*k).toFixed(3);},fs=(11*k).toFixed(2);
  function lbl(x,y,txt,col){h.push('<text x="'+r3(x)+'" y="'+r3(y)+'" font-size="'+fs+'" text-anchor="middle" fill="'+col+'" stroke="#0c0a14" stroke-width="'+sw(3)+'" paint-order="stroke" font-family="JetBrains Mono, monospace" pointer-events="none">'+esc(txt)+'</text>');}
  if(view.dims!==false)model.walls.forEach(function(w){var L=segLen(w);if(L<1.5)return;var ux=(w.x2-w.x1)/L,uy=(w.y2-w.y1)/L,a=Math.atan2(uy,ux)*180/Math.PI,off=w.t/2+9*k;if(a>90.5||a<-89.5)a+=180;
    var mx=(w.x1+w.x2)/2-uy*off,my=(w.y1+w.y2)/2+ux*off;h.push('<text x="'+r3(mx)+'" y="'+r3(my)+'" transform="rotate('+r3(a)+' '+r3(mx)+' '+r3(my)+')" font-size="'+(9*k).toFixed(2)+'" text-anchor="middle" dominant-baseline="middle" fill="#a9a3c2" font-family="JetBrains Mono, monospace" pointer-events="none">'+esc(fmt(L))+'</text>');});
  function seg(a,b,col,dash){h.push('<line x1="'+r3(a.x)+'" y1="'+r3(a.y)+'" x2="'+r3(b.x)+'" y2="'+r3(b.y)+'" stroke="'+col+'" stroke-width="'+sw(2)+'"'+(dash?' stroke-dasharray="'+sw(6)+' '+sw(4)+'"':'')+' pointer-events="none"/>');
    [a,b].forEach(function(q){h.push('<circle cx="'+r3(q.x)+'" cy="'+r3(q.y)+'" r="'+sw(3)+'" fill="'+col+'" pointer-events="none"/>');});}
  measures.forEach(function(m){seg(m.a,m.b,'#ffd84d');lbl((m.a.x+m.b.x)/2,(m.a.y+m.b.y)/2-6*k,fmt(Math.hypot(m.b.x-m.a.x,m.b.y-m.a.y)),'#ffd84d');});
  if(tool==='select')return h.join('');
  var col=tool==='wall'?'#4dff9a':'#ffd84d';
  if(draw&&hover){var L=Math.hypot(hover.x-draw.from.x,hover.y-draw.from.y),ang=Math.round(-Math.atan2(hover.y-draw.from.y,hover.x-draw.from.x)*180/Math.PI);seg(draw.from,hover,col,true);
    lbl((draw.from.x+hover.x)/2,(draw.from.y+hover.y)/2-7*k,(lenBuf?'typed '+lenBuf+' · ':'')+fmt(L)+' · '+((ang+360)%360)+'°',col);}
  else if(draw&&lenBuf)lbl(draw.from.x,draw.from.y-8*k,'typed '+lenBuf,col);
  if(hover)h.push('<circle cx="'+r3(hover.x)+'" cy="'+r3(hover.y)+'" r="'+sw(hover.snap==='end'?7:hover.snap==='wall'?6:4)+'" fill="none" stroke="'+col+'" stroke-width="'+sw(2)+'" pointer-events="none"/>');
  return h.join('');}
$('#tDims').onchange=function(e){view.dims=e.target.checked;saveView();renderPlan();};
/* ---------- electrical & HVAC layer ----------
   fixtures: { id, kind, x,y, rot (deg, the direction it faces), h|null (mount height), note }.
   Wall kinds sit on a wall face; ceiling kinds hang from the ceiling of the room they're in. */
var FIX={outlet:{label:'Outlet',mount:'wall',h:1.33},gfci:{label:'GFCI outlet',mount:'wall',h:3.5},usb:{label:'Outlet (240V / dryer, range)',mount:'wall',h:1.33},switch:{label:'Switch',mount:'wall',h:4},
  data:{label:'Data / TV jack',mount:'wall',h:1.33},sconce:{label:'Wall sconce',mount:'wall',h:6},light:{label:'Ceiling light',mount:'ceil'},recessed:{label:'Recessed light',mount:'ceil'},
  pendant:{label:'Pendant',mount:'ceil'},fan:{label:'Ceiling fan',mount:'ceil'},smoke:{label:'Smoke / CO detector',mount:'ceil'},register:{label:'Supply register',mount:'floor'},ret:{label:'Return air grille',mount:'wall',h:1}};
var FIX_ORDER=['outlet','gfci','usb','switch','data','sconce','light','recessed','pendant','fan','smoke','register','ret'];
var LIGHT_KINDS=['light','recessed','pendant','fan','sconce'],OUTLET_KINDS=['outlet','gfci','usb'];
function fixH(f){return f.h!=null?f.h:FIX[f.kind]&&FIX[f.kind].h!=null?FIX[f.kind].h:0;}
function fixCeil(f){var r=roomAt(f.x,f.y);return r?roomCeil(r):model.specs.ceiling;}
// Put a wall-mounted fixture on the face of the nearest wall, on the side the point is on.
function snapFixture(f,p){p=p||{x:f.x,y:f.y};var best=null,bd=2.5;
  model.walls.forEach(function(w){var L=segLen(w);if(L<0.2)return;var ux=(w.x2-w.x1)/L,uy=(w.y2-w.y1)/L,s=clamp((p.x-w.x1)*ux+(p.y-w.y1)*uy,0.15,L-0.15),px=w.x1+ux*s,py=w.y1+uy*s,d=Math.hypot(p.x-px,p.y-py);
    if(d<bd){bd=d;var side=((p.x-px)*-uy+(p.y-py)*ux)>=0?1:-1;best={x:px+(-uy)*side*(w.t/2+0.02),y:py+ux*side*(w.t/2+0.02),rot:Math.atan2(ux*side,-uy*side)*180/Math.PI};}});
  if(best){f.x=r3(best.x);f.y=r3(best.y);f.rot=Math.round(best.rot*100)/100;}else{f.x=r3(p.x);f.y=r3(p.y);}return !!best;}
var placeKind=null;
function startPlace(kind){placeKind=kind;setTool('place');$$('[data-fix]').forEach(function(b){b.classList.toggle('on',b.dataset.fix===kind);});
  toast('Click in the plan to place '+FIX[kind].label.toLowerCase()+'s'+(FIX[kind].mount==='wall'?' (they snap to the nearest wall)':'')+'. Esc when done.',3600);}
function placeFixture(p){var k=placeKind;if(!k)return;pushUndo();var f={id:uid('f'),kind:k,x:r3(p.x),y:r3(p.y),rot:0,h:null,note:''};
  if(FIX[k].mount==='wall'&&!snapFixture(f,p)){undoStack.pop();toast('Click closer to a wall to place a '+FIX[k].label.toLowerCase());return;}
  model.fixtures.push(f);afterChange();}
$('#fixBtns').innerHTML=FIX_ORDER.map(function(k){return '<button class="btn fix-btn" data-fix="'+k+'"><svg viewBox="-1 -1 2 2" width="18" height="18" aria-hidden="true">'+fixGlyph(k,1,'currentColor')+'</svg>'+esc(FIX[k].label)+'</button>';}).join('');
$$('[data-fix]').forEach(function(b){b.onclick=function(){startPlace(b.dataset.fix);};});
// Plan symbol for a fixture, drawn in a unit box (radius r) around 0,0, facing +x.
function fixGlyph(k,r,col){var s=function(v){return r3(v*r);},sw=s(0.14);
  switch(k){
    case 'outlet':case 'usb':case 'gfci':return '<circle r="'+s(0.62)+'" fill="#0c0a14" stroke="'+col+'" stroke-width="'+sw+'"/><line x1="'+s(-0.2)+'" y1="'+s(-0.95)+'" x2="'+s(-0.2)+'" y2="'+s(0.95)+'" stroke="'+col+'" stroke-width="'+sw+'"/><line x1="'+s(0.2)+'" y1="'+s(-0.95)+'" x2="'+s(0.2)+'" y2="'+s(0.95)+'" stroke="'+col+'" stroke-width="'+sw+'"/>'+(k==='gfci'?'<circle r="'+s(0.22)+'" fill="'+col+'"/>':k==='usb'?'<rect x="'+s(-0.25)+'" y="'+s(-0.25)+'" width="'+s(0.5)+'" height="'+s(0.5)+'" fill="'+col+'"/>':'');
    case 'switch':return '<text x="0" y="'+s(0.42)+'" font-size="'+s(1.4)+'" text-anchor="middle" fill="'+col+'" font-family="Space Grotesk, sans-serif" font-weight="700">S</text>';
    case 'data':return '<path d="M0 '+s(-0.7)+'L'+s(0.7)+' '+s(0.6)+'H'+s(-0.7)+'Z" fill="#0c0a14" stroke="'+col+'" stroke-width="'+sw+'"/>';
    case 'sconce':return '<path d="M'+s(-0.2)+' '+s(-0.7)+'A'+s(0.7)+' '+s(0.7)+' 0 0 1 '+s(-0.2)+' '+s(0.7)+'Z" fill="#0c0a14" stroke="'+col+'" stroke-width="'+sw+'"/>';
    case 'light':return '<circle r="'+s(0.8)+'" fill="#0c0a14" stroke="'+col+'" stroke-width="'+sw+'"/><path d="M'+s(-0.56)+' '+s(-0.56)+'L'+s(0.56)+' '+s(0.56)+'M'+s(0.56)+' '+s(-0.56)+'L'+s(-0.56)+' '+s(0.56)+'" stroke="'+col+'" stroke-width="'+sw+'"/>';
    case 'recessed':return '<circle r="'+s(0.55)+'" fill="#0c0a14" stroke="'+col+'" stroke-width="'+sw+'"/><circle r="'+s(0.2)+'" fill="'+col+'"/>';
    case 'pendant':return '<circle r="'+s(0.75)+'" fill="#0c0a14" stroke="'+col+'" stroke-width="'+sw+'"/><text x="0" y="'+s(0.35)+'" font-size="'+s(0.95)+'" text-anchor="middle" fill="'+col+'" font-family="Space Grotesk, sans-serif" font-weight="700">P</text>';
    case 'fan':return '<circle r="'+s(0.25)+'" fill="'+col+'"/>'+[0,90,180,270].map(function(a){return '<ellipse cx="'+s(0.6)+'" cy="0" rx="'+s(0.42)+'" ry="'+s(0.16)+'" fill="none" stroke="'+col+'" stroke-width="'+sw+'" transform="rotate('+a+')"/>';}).join('');
    case 'smoke':return '<circle r="'+s(0.7)+'" fill="#0c0a14" stroke="'+col+'" stroke-width="'+sw+'"/><text x="0" y="'+s(0.3)+'" font-size="'+s(0.75)+'" text-anchor="middle" fill="'+col+'" font-family="Space Grotesk, sans-serif" font-weight="700">SD</text>';
    case 'register':return '<rect x="'+s(-0.9)+'" y="'+s(-0.4)+'" width="'+s(1.8)+'" height="'+s(0.8)+'" fill="#0c0a14" stroke="'+col+'" stroke-width="'+sw+'"/><path d="M'+s(-0.5)+' '+s(-0.4)+'V'+s(0.4)+'M0 '+s(-0.4)+'V'+s(0.4)+'M'+s(0.5)+' '+s(-0.4)+'V'+s(0.4)+'" stroke="'+col+'" stroke-width="'+sw+'"/>';
    case 'ret':return '<rect x="'+s(-0.4)+'" y="'+s(-0.9)+'" width="'+s(0.8)+'" height="'+s(1.8)+'" fill="#0c0a14" stroke="'+col+'" stroke-width="'+sw+'"/><path d="M'+s(-0.4)+' '+s(-0.9)+'L'+s(0.4)+' '+s(0.9)+'" stroke="'+col+'" stroke-width="'+sw+'"/>';}
  return '<circle r="'+s(0.5)+'" fill="'+col+'"/>';}
var FIX_COL={outlet:'#ffd84d',gfci:'#ffd84d',usb:'#ffd84d',switch:'#4dff9a',data:'#7fb2ff',sconce:'#fff1a8',light:'#fff1a8',recessed:'#fff1a8',pendant:'#fff1a8',fan:'#fff1a8',smoke:'#ff8c9e',register:'#2de2e6',ret:'#2de2e6'};
function planFixSVG(k,isSel){if(view.elec===false)return '';var r=Math.max(0.32,7*k);return model.fixtures.map(function(f){var s=isSel('fixture',f.id),col=s?'#ffffff':(FIX_COL[f.kind]||'#fff');
  return '<g data-type="fixture" data-id="'+f.id+'" transform="translate('+f.x+' '+f.y+') rotate('+(f.rot||0)+')" style="cursor:move">'+(s?'<circle r="'+r3(r*1.5)+'" fill="none" stroke="#2de2e6" stroke-width="'+r3(2*k)+'"/>':'')+'<circle r="'+r3(r*1.3)+'" fill="transparent"/>'+fixGlyph(f.kind,r,col)+'</g>';}).join('');}
function buildFixture(f){var D=FIX[f.kind];if(!D)return;var a=(f.rot||0)*Math.PI/180,g=new THREE.Group(),C=fixCeil(f),m;g.position.set(f.x,0,f.y);g.rotation.y=-a;
  // local +x faces out of the wall
  if(D.mount==='wall'){var h=fixH(f);
    if(f.kind==='sconce'){m=bx(0.25,0.5,0.35,'#2b2836');m.position.set(0.15,h,0);g.add(m);var gl=new THREE.Mesh(new THREE.SphereGeometry(0.2,14,10),new THREE.MeshStandardMaterial({color:0xfff1d6,emissive:0xffd9a0,emissiveIntensity:0.6}));gl.position.set(0.35,h+0.2,0);g.add(gl);g.userData.glow=gl;}
    else if(f.kind==='ret'){m=bx(0.04,1,1.5,'#d9d6cf');m.position.set(0.02,h+0.5,0);g.add(m);}
    else{var plate=bx(0.04,f.kind==='switch'?0.38:0.38,0.24,f.kind==='gfci'?'#f7f5ef':'#f2f0ea',{roughness:0.5});plate.position.set(0.02,h,0);plate.castShadow=false;g.add(plate);
      if(OUTLET_KINDS.indexOf(f.kind)>=0)[-0.07,0.07].forEach(function(dy){var s=bx(0.02,0.1,0.12,'#bdb8ae');s.position.set(0.045,h+dy,0);g.add(s);});
      if(f.kind==='switch'){var t=bx(0.05,0.12,0.05,'#ffffff');t.position.set(0.06,h,0);g.add(t);}}}
  else if(D.mount==='floor'){m=bx(1,0.03,0.33,'#9aa0a8',{metalness:0.6,roughness:0.4});m.position.y=0.02;m.castShadow=false;g.add(m);}
  else{var em=new THREE.MeshStandardMaterial({color:0xfff6e6,emissive:0xffe2b0,emissiveIntensity:0.15,roughness:0.4});
    if(f.kind==='recessed'){m=new THREE.Mesh(new THREE.CylinderGeometry(0.25,0.25,0.04,20),em);m.position.y=C-0.03;}
    else if(f.kind==='pendant'){var cord=cyl(0.015,0.015,2,'#1a1a1a');cord.position.y=C-1;g.add(cord);m=new THREE.Mesh(new THREE.ConeGeometry(0.55,0.6,20,1,true),new THREE.MeshStandardMaterial({color:0x2b2836,side:THREE.DoubleSide,metalness:0.5,roughness:0.4}));m.position.y=C-2.2;g.add(m);
      m=new THREE.Mesh(new THREE.SphereGeometry(0.2,14,10),em);m.position.y=C-2.4;}
    else if(f.kind==='fan'){var hub=cyl(0.25,0.3,0.35,'#2b2836');hub.position.y=C-0.9;g.add(hub);var dr=cyl(0.05,0.05,0.75,'#2b2836');dr.position.y=C-0.38;g.add(dr);
      [0,1,2,3,4].forEach(function(i){var bl=bx(2.2,0.04,0.45,'#6b5544');bl.position.set(Math.cos(i*1.2566)*1.25,C-0.85,Math.sin(i*1.2566)*1.25);bl.rotation.y=-i*1.2566;g.add(bl);});
      m=new THREE.Mesh(new THREE.SphereGeometry(0.28,14,10),em);m.position.y=C-1.1;}
    else if(f.kind==='smoke'){m=cyl(0.3,0.3,0.12,'#f4f4f2');m.position.y=C-0.06;}
    else{m=new THREE.Mesh(new THREE.CylinderGeometry(0.6,0.5,0.25,24),em);m.position.y=C-0.13;}
    g.add(m);if(LIGHT_KINDS.indexOf(f.kind)>=0)g.userData.glow=m;}
  vert.add(g);if(D.mount==='ceil')g.userData.ceil=true;tagSel(g,{type:'fixture',id:f.id});fixtureObjs.push({f:f,g:g});}
var fixtureObjs=[];
$('#tElec').onchange=function(e){view.elec=e.target.checked;saveView();renderPlan();applyViewState();};
FIELDS.fixture=[{k:'kind',label:'Type',kind:'select',options:FIX_ORDER.map(function(k){return [k,FIX[k].label];})},LEN('h','Mount height',{opt:true,ph:function(o){return FIX[o.kind]&&FIX[o.kind].mount==='ceil'?'at the ceiling':'default '+fmt(FIX[o.kind]&&FIX[o.kind].h||0);}}),LEN('x','X'),LEN('y','Y'),{k:'rot',label:'Facing °',kind:'num'},{k:'note',label:'Circuit / notes',kind:'area',ph:'e.g. 20A kitchen circuit 3, dimmer, 3-way'}];

/* ---------- furniture catalog ----------
   Real-world sizes in feet. w runs along the item's local X, d along local Z (see buildItem for
   which side is the front/back for each kind: beds have the headboard at +X, sofas the back at -X). */
var CATALOG=[
 ['Bedroom',[['King bed','bed',6.92,6.5,2,'#4a3f36'],['Cal King bed','bed',7.17,6,2,'#4a3f36'],['Queen bed','bed',6.92,5.17,2,'#4a3f36'],['Full bed','bed',6.42,4.67,2,'#4a3f36'],['Twin bed','bed',6.42,3.42,2,'#4a3f36'],
   ['Nightstand','cabinet',2,1.5,2.17,'#5a4636'],['Dresser 60"','cabinet',5,1.67,2.75,'#5a4636'],['Tall dresser','cabinet',3,1.67,4.33,'#5a4636'],['Accent chair','chair',2.5,2.5,2.8,'#7a6a8e']]],
 ['Living',[['Sofa 84"','sofa',3.08,7,2.8,'#5c5f78'],['Sofa 96"','sofa',3.17,8,2.8,'#5c5f78'],['Loveseat','sofa',3,5.33,2.8,'#5c5f78'],['Armchair','chair',2.83,2.83,2.8,'#7a6a8e'],
   ['Coffee table','table',4,2,1.5,'#6b5544'],['Side table','table',1.67,1.67,2,'#6b5544'],['TV console','cabinet',6,1.5,2,'#3a3440'],['TV 65"','tv',4.75,0.75,5,'#111114'],['TV 75"','tv',5.5,0.75,5.3,'#111114'],
   ['Rug 8×10','rug',10,8,0.04,'#6f5a7d'],['Rug 5×8','rug',8,5,0.04,'#6f5a7d'],['Floor plant','plant',1.8,1.8,4.5,'#3f8f5a']]],
 ['Dining',[['Table, seats 6','table',6,3.33,2.5,'#6b5544'],['Table, seats 8','table',8,3.5,2.5,'#6b5544'],['Round table 48"','table',4,4,2.5,'#6b5544'],['Dining chair','chair',1.67,1.83,3.1,'#7a6a8e'],['Buffet','cabinet',6,1.67,3,'#5a4636']]],
 ['Kitchen',[['Base cabinet 36"','counter',3,2.08,3,'#e6e1d8'],['Base cabinet 24"','counter',2,2.08,3,'#e6e1d8'],['Sink base 36"','sink',3,2.08,3,'#9aa3ad'],['Range 30"','range',2.5,2.17,3.05,'#2d2e33'],['Range 36"','range',3,2.25,3.05,'#2d2e33'],
   ['Refrigerator 36"','fridge',3,2.67,5.83,'#b9bec6'],['Refrigerator 30"','fridge',2.5,2.5,5.5,'#b9bec6'],['Dishwasher 24"','dishwasher',2,2.08,2.83,'#b9bec6'],['Island 4×7','island',4,7,3,'#3a4a5a'],['Island 3×6','island',3,6,3,'#3a4a5a'],
   ['Bar stool','chair',1.42,1.42,2.5,'#7a6a8e'],['Pantry cabinet','cabinet',2.5,2,7,'#e6e1d8']]],
 ['Bath',[['Toilet','toilet',2.33,1.67,2.5,'#f4f4f4'],['Vanity 36"','vanity',3,1.75,2.83,'#5a4636',1],['Vanity 48"','vanity',4,1.83,2.83,'#5a4636',1],['Double vanity 60"','vanity',5,1.83,2.83,'#5a4636',2],['Double vanity 72"','vanity',6,1.83,2.83,'#5a4636',2],
   ['Tub 60×30','tub',5,2.5,1.67,'#f4f4f4'],['Shower 36×36','shower',3,3,7,'#e8e8ea'],['Shower 60×32','shower',5,2.67,7,'#e8e8ea'],['Linen cabinet','cabinet',2,1.5,7,'#e6e1d8']]],
 ['Office',[['Desk 60"','table',5,2.5,2.5,'#6b5544'],['Desk chair','chair',2,2,3.3,'#3a3440'],['Bookshelf','shelf',3,1,6,'#c8b89c'],['File cabinet','cabinet',1.25,2.17,2.33,'#7d8590']]],
 ['Laundry',[['Washer','washer',2.25,2.5,3.17,'#eceef0'],['Dryer','washer',2.25,2.5,3.17,'#eceef0'],['Utility sink','sink',2,1.83,2.83,'#e6e1d8'],['Folding counter','counter',5,2,3,'#e6e1d8']]],
 ['Garage',[['Car (sedan)','car',16,6.17,4.75,'#3d5a80'],['SUV / pickup','car',19,6.75,6.25,'#5a5f69'],['Motorcycle','car',7,2.67,3.67,'#8c2f39'],['Workbench','counter',6,2.5,3,'#8a6d4b'],
   ['Tool chest','cabinet',3.5,1.67,3.5,'#b3262e'],['Garage shelving','shelf',4,2,6,'#7d8590'],['Garage fridge','fridge',2.5,2.5,5.5,'#b9bec6'],['Lift / storage rack','shelf',8,4,6,'#7d8590']]],
 ['Storage',[['Wire shelving','shelf',4,1.33,7,'#c8b89c'],['Cabinet','cabinet',3,2,3,'#e6e1d8'],['Wardrobe','cabinet',4,2,7,'#5a4636']]]];
var catCat='All',catQ='';
function catItems(){var out=[];CATALOG.forEach(function(c){c[1].forEach(function(p){out.push({cat:c[0],p:p});});});
  var q=catQ.trim().toLowerCase();return out.filter(function(x){return (catCat==='All'||x.cat===catCat)&&(!q||(x.p[0]+' '+x.cat+' '+x.p[1]).toLowerCase().indexOf(q)>=0);});}
function renderCatalog(){var box=$('#catalog');if(!box)return;var cats=['All'].concat(CATALOG.map(function(c){return c[0];}));
  $('#catChips').innerHTML=cats.map(function(c){return '<button class="chip'+(c===catCat?' on':'')+'" data-cat="'+c+'">'+c+'</button>';}).join('');
  var list=catItems();box.innerHTML=list.length?list.map(function(x,i){var p=x.p;return '<button class="cat-card" draggable="true" data-pi="'+esc(x.cat+'|'+p[0])+'" title="Click to add, or drag it into the plan"><span class="cat-sw" style="background:'+p[5]+'"></span><span class="cat-n">'+esc(p[0])+'</span><span class="cat-d">'+esc(fmt(p[2]).replace(/-0"$/,'')+' × '+fmt(p[3]).replace(/-0"$/,''))+'</span></button>';}).join(''):'<p class="muted">Nothing matches.</p>';
  $$('[data-cat]').forEach(function(b){b.onclick=function(){catCat=b.dataset.cat;renderCatalog();};});
  $$('.cat-card',box).forEach(function(b){b.onclick=function(){addPreset(b.dataset.pi);};
    b.addEventListener('dragstart',function(e){e.dataTransfer.setData('text/x-house-item',b.dataset.pi);e.dataTransfer.setData('text/plain',b.dataset.pi);e.dataTransfer.effectAllowed='copy';});});}
function findPreset(key){var parts=key.split('|'),hit=null;CATALOG.forEach(function(c){if(c[0]!==parts[0])return;c[1].forEach(function(p){if(p[0]===parts[1])hit=p;});});return hit;}
function addPreset(key,at){var p=findPreset(key);if(!p)return;var c=at||viewCenter();pushUndo();
  var o={id:uid('i'),label:p[0],kind:p[1],cx:snapV(c.x),cy:snapV(c.y),w:p[2],d:p[3],h:p[4],rot:0,color:p[5],note:''};if(p[6])o.sinks=p[6];
  model.items.push(o);sel={type:'item',id:o.id};setEditing(true);afterChange();toast(p[0]+' added ('+fmt(p[2])+' × '+fmt(p[3])+'). Drag to place it, R or Rotate 90° to turn it.');}
$('#catSearch').addEventListener('input',function(e){catQ=e.target.value;renderCatalog();});
svg.addEventListener('dragover',function(e){if(e.dataTransfer&&Array.prototype.indexOf.call(e.dataTransfer.types,'text/x-house-item')>=0){e.preventDefault();e.dataTransfer.dropEffect='copy';}});
svg.addEventListener('drop',function(e){var k=e.dataTransfer&&e.dataTransfer.getData('text/x-house-item');if(!k)return;e.preventDefault();addPreset(k,toPlan(e));});
renderCatalog();



/* ---------- side panel & UI wiring ---------- */
function showTab(t){$$('.tabs button').forEach(function(b){b.classList.toggle('on',b.dataset.tab===t);});$$('.pane').forEach(function(p){p.classList.toggle('on',p.dataset.pane===t);});
  var app=$('#app');if(app.classList.contains('collapsed')){app.classList.remove('collapsed');requestAnimationFrame(resize);}}
$$('.tabs button').forEach(function(b){b.onclick=function(){showTab(b.dataset.tab);if(b.dataset.tab==='edit')setEditing(true);};});
function toggleSide(){var app=$('#app');if(matchMedia('(max-width:820px)').matches)app.classList.toggle('side-open');else{app.classList.toggle('collapsed');requestAnimationFrame(function(){resize();});}}
$('#sideToggle').onclick=toggleSide;
if(matchMedia('(max-width:820px)').matches)$('#app').classList.remove('side-open');
$('#mOrbit').onclick=function(){setMode('orbit');};$('#mWalk').onclick=function(){setMode('walk');};
$$('[data-view]').forEach(function(b){b.onclick=function(){goView(b.dataset.view);};});
$('#helpBtn').onclick=function(){$('#help').hidden=false;};$('#helpClose').onclick=function(){$('#help').hidden=true;};
$('#saveBtn').onclick=save;
var ceilSnap=null;
$('#ceilRange').addEventListener('pointerdown',function(){ceilSnap=JSON.stringify(model);});
$('#ceilRange').addEventListener('input',function(e){if(!ceilSnap)ceilSnap=JSON.stringify(model);model.specs.ceiling=parseFloat(e.target.value);$('#ceilVal').textContent=fmt(model.specs.ceiling);scheduleRebuild();});
$('#ceilRange').addEventListener('change',function(){if(ceilSnap&&ceilSnap!==JSON.stringify(model))pushUndo(ceilSnap);ceilSnap=null;afterChange();});
$('#tCeil').onchange=function(e){view.ceilings=e.target.checked;saveView();applyViewState();};
$('#tLabels').onchange=function(e){view.labels=e.target.checked;saveView();};
$('#tShadows').onchange=function(e){view.shadows=e.target.checked;saveView();applyViewState();};
$('#cutRange').oninput=function(e){view.cut=parseFloat(e.target.value);$('#cutVal').textContent=Math.round(view.cut*100)+'%';if(view.mode==='walk')setMode('orbit');applyViewState();saveView();};
var eyeSnap=null;$('#eyeRange').addEventListener('input',function(e){if(!eyeSnap)eyeSnap=JSON.stringify(model);model.specs.eye=parseFloat(e.target.value);$('#eyeVal').textContent=fmt(model.specs.eye);});
$('#eyeRange').addEventListener('change',function(){if(eyeSnap&&eyeSnap!==JSON.stringify(model))pushUndo(eyeSnap);eyeSnap=null;afterChange();});
$('#spdRange').oninput=function(e){view.speed=parseFloat(e.target.value);$('#spdVal').textContent=view.speed+' ft/s';saveView();};
$('#snapSel').onchange=function(e){view.snap=parseFloat(e.target.value);saveView();};
$('#openAll').onclick=function(){model.doors.forEach(function(d){toggleDoor(d.id,1);});};$('#closeAll').onclick=function(){model.doors.forEach(function(d){toggleDoor(d.id,0);});};
$('#undoBtn').onclick=undo;$('#redoBtn').onclick=redo;$('#fitBtn2').onclick=function(){goView('ne');};
$('#touchDoor').addEventListener('click',function(){interact();});
window.addEventListener('beforeunload',function(){updateDirty();});

/* ---------- design check ----------
   Rules that flag clearance problems while you edit. Every issue carries the objects it
   refers to (refs) and a plan-space polygon (zone) that is drawn in the plan and in 3D.
   Numbers are common residential guidelines (IRC / NKBA), in feet. */
var CK={memo:null,list:[],focus:null};
var IN=function(n){return n/12;};
function vlen(x,y){return Math.hypot(x,y);}
function itemAx(it){var a=(it.rot||0)*Math.PI/180;return {x:[Math.cos(a),Math.sin(a)],z:[-Math.sin(a),Math.cos(a)]};}
function itemPoly(it){var A=itemAx(it),hw=it.w/2,hd=it.d/2;return [[-hw,-hd],[hw,-hd],[hw,hd],[-hw,hd]].map(function(p){return [it.cx+p[0]*A.x[0]+p[1]*A.z[0],it.cy+p[0]*A.x[1]+p[1]*A.z[1]];});}
// Rectangle from a center point c: s in [s0,s1] along u, t in [t0,t1] along n.
function zoneRect(c,u,n,s0,s1,t0,t1){return [[s0,t0],[s1,t0],[s1,t1],[s0,t1]].map(function(p){return [c[0]+u[0]*p[0]+n[0]*p[1],c[1]+u[1]*p[0]+n[1]*p[1]];});}
// Wall pieces with door openings removed (a doorway is not an obstacle).
function wallSolids(){var out=[];model.walls.forEach(function(w){var L=segLen(w);if(L<0.05)return;var ux=(w.x2-w.x1)/L,uy=(w.y2-w.y1)/L,n=[-uy,ux],h=w.t/2,cur=-h;
  var cuts=wallOpenings(w).filter(function(o){return o.bot<0.05;});cuts.push({a:L+h,b:L+h});
  cuts.forEach(function(o){if(o.a-cur>0.02)out.push({w:w,poly:zoneRect([w.x1,w.y1],[ux,uy],n,cur,o.a,-h,h)});cur=Math.max(cur,o.b);});});return out;}
function overlapDepth(A,B){var best=Infinity,polys=[A,B];
  for(var k=0;k<2;k++){var P=polys[k];for(var i=0;i<P.length;i++){var p=P[i],q=P[(i+1)%P.length],ax=p[1]-q[1],ay=q[0]-p[0],L=vlen(ax,ay);if(L<1e-9)continue;ax/=L;ay/=L;
    var a0=Infinity,a1=-Infinity,b0=Infinity,b1=-Infinity,j,d;for(j=0;j<A.length;j++){d=A[j][0]*ax+A[j][1]*ay;if(d<a0)a0=d;if(d>a1)a1=d;}
    for(j=0;j<B.length;j++){d=B[j][0]*ax+B[j][1]*ay;if(d<b0)b0=d;if(d>b1)b1=d;}var o=Math.min(a1,b1)-Math.max(a0,b0);if(o<=0)return 0;if(o<best)best=o;}}return best;}
function ptSegDist(p,a,b){var vx=b[0]-a[0],vy=b[1]-a[1],L2=vx*vx+vy*vy||1e-12,t=clamp(((p[0]-a[0])*vx+(p[1]-a[1])*vy)/L2,0,1);return vlen(p[0]-a[0]-vx*t,p[1]-a[1]-vy*t);}
function polyDist(A,B){if(overlapDepth(A,B)>0)return 0;var m=Infinity,i,j;
  for(i=0;i<A.length;i++)for(j=0;j<B.length;j++){m=Math.min(m,ptSegDist(A[i],B[j],B[(j+1)%B.length]),ptSegDist(B[j],A[i],A[(i+1)%A.length]));}return m;}
function doorSector(d){var W=segLen(d),a0=Math.atan2(d.y2-d.y1,d.x2-d.x1),s=d.swing||1,pts=[[d.x1,d.y1]];
  for(var k=0;k<=8;k++){var a=a0+s*Math.PI/2*k/8;pts.push([d.x1+W*Math.cos(a),d.y1+W*Math.sin(a)]);}return pts;}
// Points spread over a door's swing, skipping the hinge corner where walls meet.
function swingPoints(d){var W=segLen(d),a0=Math.atan2(d.y2-d.y1,d.x2-d.x1),s=d.swing||1,pts=[];
  for(var k=1;k<=12;k++){var a=a0+s*Math.PI/2*k/12;for(var r=0.5;r<=W-0.05+1e-9;r+=Math.max(0.2,(W-0.55)/8))pts.push([d.x1+r*Math.cos(a),d.y1+r*Math.sin(a)]);}return pts;}
function ptInConvex(p,P,inset){var sgn=0;for(var i=0;i<P.length;i++){var a=P[i],b=P[(i+1)%P.length],ex=b[0]-a[0],ey=b[1]-a[1],L=vlen(ex,ey)||1;var c=(ex*(p[1]-a[1])-ey*(p[0]-a[0]))/L;
  if(Math.abs(c)<inset)return false;var sg=c>0?1:-1;if(!sgn)sgn=sg;else if(sg!==sgn)return false;}return true;}
function iName(it){return it.label||it.kind||'Item';}
function roomAt(x,y){for(var i=0;i<model.rooms.length;i++){var r=model.rooms[i];if(x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.d)return r;}return null;}
function inchStr(v){return Math.round(v*12)+'"';}

function runChecks(){var key=JSON.stringify(model);if(CK.memo===key)return CK.list;
  var out=[],walls=wallSolids(),items=model.items,polys={};items.forEach(function(it){polys[it.id]=itemPoly(it);});
  function add(sev,rule,refs,title,detail,zone){out.push({sev:sev,rule:rule,refs:refs,title:title,detail:detail,zone:zone,key:rule+':'+refs.map(function(r){return r.id;}).join('+')});}
  function ref(type,o){return {type:type,id:o.id};}
  // What blocks a zone: walls (minus doorways) and items other than the ones listed. Returns the
  // blocking objects and the smallest gap from `from` (a polygon) to any of them.
  function blockers(zone,skip,from,minDepth){var hits=[],gap=Infinity;minDepth=minDepth==null?0.04:minDepth;
    walls.forEach(function(s){if(skip.indexOf(s.w.id)>=0)return;if(overlapDepth(zone,s.poly)>minDepth){hits.push(ref('wall',s.w));if(from)gap=Math.min(gap,polyDist(from,s.poly));}});
    items.forEach(function(it){if(skip.indexOf(it.id)>=0||it.kind==='rug')return;if(overlapDepth(zone,polys[it.id])>minDepth){hits.push(ref('item',it));if(from)gap=Math.min(gap,polyDist(from,polys[it.id]));}});
    return {hits:hits,gap:gap};}
  function hitNames(hs){return hs.map(function(h){var o=getObj(h);return h.type==='wall'?'a wall':iName(o);}).filter(function(v,i,a){return a.indexOf(v)===i;}).join(', ');}
  // Which local side of an item faces away from the closest wall (its "front"). null if none is near a wall.
  function frontOf(it){var A=itemAx(it),c=[it.cx,it.cy],sides=[[A.x,it.w/2,it.d/2],[[-A.x[0],-A.x[1]],it.w/2,it.d/2],[A.z,it.d/2,it.w/2],[[-A.z[0],-A.z[1]],it.d/2,it.w/2]],best=null,bd=1.0;
    sides.forEach(function(s,i){var m=[c[0]+s[0][0]*s[1],c[1]+s[0][1]*s[1]];walls.forEach(function(w){var d=polyDist([m,[m[0]+s[0][0]*0.01,m[1]+s[0][1]*0.01]],w.poly);if(d<bd){bd=d;best=i;}});});
    if(best==null)return null;var b=sides[best],f=sides[best^1];return {dir:f[0],half:f[1],across:f[2],perp:[-f[0][1],f[0][0]]};}
  function frontZone(it,F,depth){return zoneRect([it.cx+F.dir[0]*F.half,it.cy+F.dir[1]*F.half],F.perp,F.dir,-F.across,F.across,0.02,depth);}

  // 1. Door swings: walls, furniture and other doors in the way.
  var sectors={};model.doors.forEach(function(d){if(d.type==='barn'||segLen(d)<0.5)return;sectors[d.id]=doorSector(d);});
  model.doors.forEach(function(d){var S=sectors[d.id];if(!S)return;var hw=hostWall(d),pts=swingPoints(d),b={hits:[]};
    var hitBy=function(P){return pts.some(function(q){return ptInConvex(q,P,0.03);});};
    walls.forEach(function(w){if(w.w!==hw&&hitBy(w.poly))b.hits.push(ref('wall',w.w));});items.forEach(function(it){if(hitBy(polys[it.id]))b.hits.push(ref('item',it));});
    if(b.hits.length)add('err','swing',[ref('door',d)].concat(b.hits),doorName(d)+' can\'t open all the way','It swings into '+hitNames(b.hits)+'. Move the door, flip its swing, or make it a slider.',S);});
  var dl=model.doors.filter(function(d){return sectors[d.id];});
  for(var i=0;i<dl.length;i++)for(var j=i+1;j<dl.length;j++){var A=sectors[dl[i].id],B=sectors[dl[j].id];if(overlapDepth(A,B)>0.15)
    add('warn','doors',[ref('door',dl[i]),ref('door',dl[j])],doorName(dl[i])+' and '+doorName(dl[j])+' collide','Their swings overlap, so they hit each other if both are open.',A);}
  // Barn doors need the wall beside them clear to slide open.
  model.doors.forEach(function(d){if(d.type!=='barn')return;var W=segLen(d);if(W<0.5)return;var u=[(d.x1-d.x2)/W,(d.y1-d.y2)/W],side=d.swing||1,hw=hostWall(d),t=hw?hw.t:model.specs.intT;
    var n=[u[1]*side,-u[0]*side];var Z=zoneRect([d.x1,d.y1],u,n,0.1,W,t/2+0.02,t/2+0.35);var b=blockers(Z,[hw?hw.id:''],null,0.03);
    if(b.hits.length)add('warn','barn',[ref('door',d)].concat(b.hits),doorName(d)+' can\'t slide fully open','Its track runs past '+hitNames(b.hits)+'. A barn door needs a clear wall as wide as the door beside the opening.',Z);});
  // Door widths.
  model.doors.forEach(function(d){var W=segLen(d),ext=/front|exterior|garage|patio/i.test(d.name||'')||(hostWall(d)||{}).ext;
    if(ext&&W<3-0.02)add('tip','dwidth',[ref('door',d)],doorName(d)+' is '+inchStr(W)+' wide','Exterior doors are usually 36" so furniture and appliances fit through.',zoneRect([d.x1,d.y1],[(d.x2-d.x1)/W,(d.y2-d.y1)/W],[-(d.y2-d.y1)/W,(d.x2-d.x1)/W],0,W,-0.6,0.6));
    else if(!ext&&d.type!=='barn'&&W<2.5-0.02)add('tip','dwidth',[ref('door',d)],doorName(d)+' is '+inchStr(W)+' wide','30" is a practical minimum for interior doors; 32"–36" if you want wheelchair or appliance access.',zoneRect([d.x1,d.y1],[(d.x2-d.x1)/W,(d.y2-d.y1)/W],[-(d.y2-d.y1)/W,(d.x2-d.x1)/W],0,W,-0.6,0.6));});

  // 2. Fixture and appliance clearances.
  items.forEach(function(it){var A=itemAx(it),c=[it.cx,it.cy],P=polys[it.id],R=ref('item',it),nm=iName(it),F,Z,b;
    if(it.kind==='toilet'){var fx=A.x,fz=A.z,back=-it.w/2,front=it.w/2;
      Z=zoneRect(c,fx,fz,back+0.05,front,-IN(15),IN(15));b=blockers(Z,[it.id],null,0.02);
      if(b.hits.length)add('err','wc-side',[R].concat(b.hits),nm+' is too tight side to side','Code needs 15" from the toilet\'s centerline to '+hitNames(b.hits)+' (30" wide space in all).',Z);
      Z=zoneRect(c,fx,fz,front+0.02,front+IN(21),-it.d/2,it.d/2);b=blockers(Z,[it.id],null,0.02);
      if(b.hits.length)add('err','wc-front',[R].concat(b.hits),nm+' has less than 21" in front','Code needs 21" clear in front of a toilet; '+hitNames(b.hits)+' is in the way.',Z);
      else{Z=zoneRect(c,fx,fz,front+0.02,front+IN(30),-it.d/2,it.d/2);b=blockers(Z,[it.id],null,0.02);
        if(b.hits.length)add('tip','wc-front',[R].concat(b.hits),nm+' has under 30" in front','It meets code, but 30" feels much less cramped.',Z);}}
    else if(it.kind==='bed'){var hx=A.x,sz=A.z,foot=-it.w/2,head=it.w/2;
      [[1,'left'],[-1,'right']].forEach(function(sd){var n=[sz[0]*sd[0],sz[1]*sd[0]];var edge=zoneRect(c,hx,n,foot,head-1.8,it.d/2,it.d/2+0.3);
        if(blockers(edge,[it.id],null,0.02).hits.some(function(h){return h.type==='wall';}))return; // pushed against a wall on purpose
        Z=zoneRect(c,hx,n,foot,head-1.8,it.d/2+0.02,it.d/2+2);b=blockers(Z,[it.id],P,0.02);
        if(b.hits.length)add('warn','bed',[R].concat(b.hits),nm+': '+inchStr(b.gap)+' to walk along the '+sd[1]+' side','24" is the usual minimum to get in and out of bed and make it; '+hitNames(b.hits)+' is closer than that.',Z);});
      Z=zoneRect(c,hx,sz,foot-2,foot-0.02,-it.d/2,it.d/2);b=blockers(Z,[it.id],P,0.02);
      if(b.hits.length)add('warn','bed',[R].concat(b.hits),nm+': '+inchStr(b.gap)+' at the foot','24"–36" at the foot of a bed keeps a walkway; '+hitNames(b.hits)+' is closer.',Z);}
    else if(['fridge','range','vanity','dishwasher','washer'].indexOf(it.kind)>=0){F=frontOf(it);if(!F)return;
      var need=it.kind==='vanity'?IN(30):IN(36),why=it.kind==='fridge'?'to open the doors and stand while they are open':it.kind==='range'?'to open the oven door and stand at it':it.kind==='dishwasher'?'to drop the door and load it':it.kind==='washer'?'to open the door and load it':'to stand at the sink and open the cabinet doors';
      Z=frontZone(it,F,need);b=blockers(Z,[it.id].concat(it.kind==='range'?[]:[]),P,0.03);
      b.hits=b.hits.filter(function(h){var o=getObj(h);return !(h.type==='item'&&o&&(o.kind==='counter'||o.kind==='cabinet'||o.kind==='sink')&&polyDist(P,polys[o.id])<0.1);}); // ignore the counter run it sits in
      if(b.hits.length)add('warn','front',[R].concat(b.hits),nm+' has '+inchStr(b.gap)+' in front',inchStr(need)+' clear is recommended '+why+'; '+hitNames(b.hits)+' is in the way.',Z);}
    else if(it.kind==='shower'){var fz2=A.z;Z=zoneRect(c,A.x,fz2,-it.w/2,it.w/2,it.d/2+0.02,it.d/2+2);b=blockers(Z,[it.id],P,0.03);
      if(b.hits.length)add('warn','front',[R].concat(b.hits),nm+' has '+inchStr(b.gap)+' in front of the glass','Code needs 24" clear in front of a shower opening.',Z);}});
  // 3. Kitchen work aisles (NKBA: 42" for one cook, 48" for two).
  items.forEach(function(isl){if(isl.kind!=='island')return;items.forEach(function(o){if(o===isl||['counter','range','sink','cabinet'].indexOf(o.kind)<0)return; // fridge has its own front check
    var g=polyDist(polys[isl.id],polys[o.id]);if(g<=0.02||g>=IN(42))return;
    var a=polys[isl.id],cI=[isl.cx,isl.cy],cO=[o.cx,o.cy],Z; // draw the gap as a band between the two
    var dx=cO[0]-cI[0],dy=cO[1]-cI[1],L=vlen(dx,dy)||1,u=[dx/L,dy/L],n=[-u[1],u[0]];var half=Math.min(Math.max(isl.w,isl.d),Math.max(o.w,o.d))/2;
    var ext=function(P){var m=-Infinity;P.forEach(function(p){m=Math.max(m,(p[0]-cI[0])*u[0]+(p[1]-cI[1])*u[1]);});return m;};var s0=ext(a),s1=s0+g;
    Z=zoneRect(cI,n,u,-half,half,s0,s1);
    add(g<IN(36)?'warn':'tip','aisle',[ref('item',isl),ref('item',o)],'Aisle between '+iName(isl)+' and '+iName(o)+' is '+inchStr(g),'42" is recommended for one cook, 48" for two. Under 36" is hard to pass someone or open a dishwasher.',Z);});});
  // 4. Things running into each other or into walls.
  var RUN=['counter','island','cabinet','vanity'],INSET=['sink','range','counter','cabinet','dishwasher'];
  function nests(I,J){return (RUN.indexOf(I.kind)>=0&&INSET.indexOf(J.kind)>=0)||(RUN.indexOf(J.kind)>=0&&INSET.indexOf(I.kind)>=0);}
  for(var a1=0;a1<items.length;a1++)for(var b1=a1+1;b1<items.length;b1++){var I=items[a1],J=items[b1];if(nests(I,J)||I.kind==='rug'||J.kind==='rug')continue;if(overlapDepth(polys[I.id],polys[J.id])>0.08)
    add('warn','overlap',[ref('item',I),ref('item',J)],iName(I)+' overlaps '+iName(J),'They take up the same floor space. Move one or resize it.',polys[I.id]);}
  items.forEach(function(it){var hit=null;walls.forEach(function(s){if(!hit&&overlapDepth(polys[it.id],s.poly)>0.1)hit=s.w;});
    if(hit)add('warn','inwall',[ref('item',it),ref('wall',hit)],iName(it)+' runs into a wall','Part of it sits inside the wall. Pull it out so it sits against the wall face.',polys[it.id]);});
  // 5. Windows blocked by tall furniture.
  model.windows.forEach(function(wi){var W=segLen(wi);if(W<0.3)return;var u=[(wi.x2-wi.x1)/W,(wi.y2-wi.y1)/W],n=[-u[1],u[0]],hw=hostWall(wi),t=hw?hw.t:0.5;
    var Z=zoneRect([wi.x1,wi.y1],u,n,0,W,-(t/2+0.7),t/2+0.7);
    items.forEach(function(it){if((it.h||0)<=wi.sill+0.2)return;if(overlapDepth(Z,polys[it.id])>0.02)add('tip','window',[ref('window',wi),ref('item',it)],iName(it)+' blocks '+(wi.name||'a window'),'It is taller than the '+inchStr(wi.sill)+' sill and sits right in front of the window.',Z);});});
  // 6. Room sizes.
  model.rooms.forEach(function(r){var Z=[[r.x,r.y],[r.x+r.w,r.y],[r.x+r.w,r.y+r.d],[r.x,r.y+r.d]],mn=Math.min(r.w,r.d);
    if(/hall/i.test(r.name)&&mn<IN(36))add('warn','room',[ref('room',r)],r.name+' is only '+inchStr(mn)+' wide','Code needs hallways at least 36" wide; 42" feels comfortable.',Z);
    if(/bed/i.test(r.name)&&(r.w*r.d<70||mn<7))add('warn','room',[ref('room',r)],r.name+' is under the minimum bedroom size','Code needs at least 70 sq ft and 7\' in each direction for a bedroom.',Z);});
  // 7. Electrical & HVAC (NEC-style rules of thumb). Only once something has been placed.
  var fx=model.fixtures||[],outs=fx.filter(function(f){return OUTLET_KINDS.indexOf(f.kind)>=0;});
  var dryRoom=function(r){return /closet|pantry|storage|hall|wc|bath|garage|laundry|mud/i.test(r.name);};
  if(!fx.length)add('tip','elec-none',[],'No outlets, switches or lights placed yet','Add them from Edit → Electrical & HVAC and this tab will check outlet spacing, GFCI locations, switches and lights room by room.',null);
  else{
    var doorAt=function(x,y){return model.doors.some(function(d){var W=segLen(d);return ptSegDist([x,y],[d.x1,d.y1],[d.x2,d.y2])<0.6&&W>0;});};
    model.rooms.forEach(function(r){var Z=[[r.x,r.y],[r.x+r.w,r.y],[r.x+r.w,r.y+r.d],[r.x,r.y+r.d]],R=ref('room',r);
      var inR=function(f){return f.x>=r.x-0.4&&f.x<=r.x+r.w+0.4&&f.y>=r.y-0.4&&f.y<=r.y+r.d+0.4;};
      var mine=fx.filter(inR),myOuts=mine.filter(function(f){return OUTLET_KINDS.indexOf(f.kind)>=0;});
      // Outlets: no point along a usable wall more than 6' from one (NEC 210.52).
      if(!dryRoom(r)&&outs.length){var worst=0,wp=null,step=1;
        for(var e=0;e<4;e++){var a=Z[e],b=Z[(e+1)%4],L=Math.hypot(b[0]-a[0],b[1]-a[1]);for(var t=0.5;t<L;t+=step){var px=a[0]+(b[0]-a[0])*t/L,py=a[1]+(b[1]-a[1])*t/L;
          if(doorAt(px,py)||!walls.some(function(w){return ptInConvex([px,py],w.poly,0);}))continue;
          var dmin=myOuts.reduce(function(m,o){return Math.min(m,Math.hypot(o.x-px,o.y-py));},Infinity);if(dmin>worst){worst=dmin;wp=[px,py];}}}
        if(worst>6.01)add('warn','outlets',[R],r.name+': wall space more than 6\' from an outlet',(myOuts.length?'The farthest spot is about '+fmt(worst)+' from the nearest outlet.':'There are no outlets in this room.')+' Code wants an outlet within 6\' of any point along a wall (roughly one every 12\').',wp?[[wp[0]-0.6,wp[1]-0.6],[wp[0]+0.6,wp[1]-0.6],[wp[0]+0.6,wp[1]+0.6],[wp[0]-0.6,wp[1]+0.6]]:Z);}
      // Switches by the door, lights in every room.
      var lights=mine.filter(function(f){return LIGHT_KINDS.indexOf(f.kind)>=0;}),sws=mine.filter(function(f){return f.kind==='switch';});
      if(fx.some(function(f){return LIGHT_KINDS.indexOf(f.kind)>=0;})&&!lights.length&&!/closet|storage/i.test(r.name))add('tip','lights',[R],r.name+' has no light','Add a ceiling light, recessed lights or sconces.',Z);
      if(fx.some(function(f){return f.kind==='switch';})&&lights.length&&!sws.length)add('warn','switch',[R],r.name+' has lights but no switch','Put a switch on the latch side of the door, about 48" up.',Z);
      if(fx.some(function(f){return f.kind==='register';})&&!mine.some(function(f){return f.kind==='register';})&&!/closet|pantry|storage/i.test(r.name))add('tip','hvac',[R],r.name+' has no supply register','Every conditioned room needs at least one supply; under a window is the usual spot.',Z);
      if(/bed/i.test(r.name)&&fx.some(function(f){return f.kind==='smoke';})&&!mine.some(function(f){return f.kind==='smoke';}))add('warn','smoke',[R],r.name+' needs a smoke alarm','Code requires one inside every bedroom and one outside each sleeping area.',Z);});
    // Kitchen and bath counters: GFCI within 2' of every point along the counter (receptacles every 4').
    items.forEach(function(it){if(['counter','sink','range','island'].indexOf(it.kind)<0||!roomAt(it.cx,it.cy)||!/kitchen/i.test(roomAt(it.cx,it.cy).name))return;if(it.kind==='island'||it.kind==='range')return;
      var P=polys[it.id],far=0;for(var t=0;t<=1.0001;t+=0.1){var q=[P[0][0]+(P[1][0]-P[0][0])*t,P[0][1]+(P[1][1]-P[0][1])*t],q2=[P[3][0]+(P[2][0]-P[3][0])*t,P[3][1]+(P[2][1]-P[3][1])*t];
        var d=outs.reduce(function(m,o){return Math.min(m,Math.hypot(o.x-q[0],o.y-q[1]),Math.hypot(o.x-q2[0],o.y-q2[1]));},Infinity);far=Math.max(far,d);}
      if(far>2.6)add('warn','counter-gfci',[ref('item',it)],iName(it)+' needs countertop outlets','Code wants a GFCI outlet within 2\' of every point along a counter (about every 4\').',P);});
    items.forEach(function(it){if(it.kind!=='vanity')return;var ok=fx.some(function(f){return f.kind==='gfci'&&Math.hypot(f.x-it.cx,f.y-it.cy)<3+it.w/2;});
      if(!ok)add('warn','bath-gfci',[ref('item',it)],iName(it)+' needs a GFCI outlet','Code wants a GFCI outlet within 3\' of each bathroom sink.',polys[it.id]);});
    fx.forEach(function(f){if(OUTLET_KINDS.indexOf(f.kind)<0||f.kind==='gfci')return;var r=roomAt(f.x,f.y)||roomAt(f.x+Math.cos((f.rot||0)*Math.PI/180)*0.5,f.y+Math.sin((f.rot||0)*Math.PI/180)*0.5);
      if(r&&/kitchen|bath|wc|laundry|garage|mud/i.test(r.name)&&f.kind==='outlet')add('warn','gfci',[ref('fixture',f)],'Outlet in '+r.name+' should be GFCI','Kitchens, baths, laundry, garages and wet areas need GFCI protection.',[[f.x-0.5,f.y-0.5],[f.x+0.5,f.y-0.5],[f.x+0.5,f.y+0.5],[f.x-0.5,f.y+0.5]]);});}
  items.forEach(function(it){if(!roomAt(it.cx,it.cy))add('tip','outside',[ref('item',it)],iName(it)+' is outside every room','It may be left over from an edit, or a room is missing around it.',polys[it.id]);});

  var ign={};(model.checkIgnore||[]).forEach(function(k){ign[k]=1;});out.forEach(function(o){o.ignored=!!ign[o.key];});
  var rank={err:0,warn:1,tip:2};out.sort(function(p,q){return (p.ignored-q.ignored)||(rank[p.sev]-rank[q.sev]);});
  CK.memo=key;CK.list=out;return out;}

var SEV={err:{c:'#ff5c7a',label:'Problem'},warn:{c:'#ffb86b',label:'Check'},tip:{c:'#2de2e6',label:'Tip'}};
// Whole-room and tip zones only show for the issue you clicked, so the plan doesn't drown in color.
var WIDE_RULES=['lights','switch','hvac','smoke','room','elec-none'];
function issueZones(){if(!view.issues)return [];return runChecks().filter(function(o){if(o.ignored||!o.zone)return false;if(CK.focus===o.key)return true;return o.sev!=='tip'&&WIDE_RULES.indexOf(o.rule)<0&&!(o.rule==='outlets'&&o.zone.length===4&&Math.abs(o.zone[1][0]-o.zone[0][0])>1.3);});}
function planIssueSVG(k){var h=[];issueZones().forEach(function(o){var f=CK.focus===o.key,c=SEV[o.sev].c;
  h.push('<polygon points="'+o.zone.map(function(p){return r3(p[0])+','+r3(p[1]);}).join(' ')+'" fill="'+c+'" fill-opacity="'+(f?0.42:0.18)+'" stroke="'+c+'" stroke-width="'+(k*(f?2.5:1.2)).toFixed(3)+'" stroke-dasharray="'+(f?'':(k*4).toFixed(3)+' '+(k*3).toFixed(3))+'" pointer-events="none"/>');});return h.join('');}
var issueG=null;
function buildIssues3D(){if(issueG){scene.remove(issueG);issueG.traverse(function(m){if(m.geometry)m.geometry.dispose();if(m.material)m.material.dispose();});}issueG=new THREE.Group();scene.add(issueG);
  issueZones().forEach(function(o,i){var m=new THREE.MeshBasicMaterial({color:new THREE.Color(SEV[o.sev].c).convertSRGBToLinear(),transparent:true,opacity:CK.focus===o.key?0.7:0.5,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
    var sh=new THREE.Shape(o.zone.map(function(p){return new THREE.Vector2(p[0],p[1]);}));var mesh=new THREE.Mesh(new THREE.ShapeGeometry(sh),m);mesh.rotation.x=Math.PI/2;mesh.position.y=0.03+i*0.0005;mesh.renderOrder=2;issueG.add(mesh);
    var lg=new THREE.BufferGeometry().setFromPoints(o.zone.map(function(p){return new THREE.Vector3(p[0],0.06,p[1]);}));var ln=new THREE.LineLoop(lg,new THREE.LineBasicMaterial({color:new THREE.Color(SEV[o.sev].c).convertSRGBToLinear(),toneMapped:false}));ln.renderOrder=3;issueG.add(ln);});}
function renderChecks(){var L=runChecks(),open=L.filter(function(o){return !o.ignored;}),n={err:0,warn:0,tip:0};open.forEach(function(o){n[o.sev]++;});
  var cnt=$('#ckCount');cnt.textContent=n.err+n.warn?String(n.err+n.warn):'';cnt.className='ck-count'+(n.err?' err':n.warn?' warn':'');
  var box=$('#checkList');if(!box)return;
  var sum='<div class="ck-sum">'+['err','warn','tip'].map(function(s){return '<span class="ck-pill" style="--c:'+SEV[s].c+'">'+n[s]+' '+SEV[s].label.toLowerCase()+(n[s]===1||s==='tip'?'':'s')+'</span>';}).join('')+'</div>';
  var row=function(o){return '<li class="ck-item'+(CK.focus===o.key?' on':'')+(o.ignored?' ign':'')+'" data-ck="'+esc(o.key)+'" tabindex="0" style="--c:'+SEV[o.sev].c+'"><div class="ck-t"><span class="ck-dot"></span>'+esc(o.title)+'</div><div class="ck-d">'+esc(o.detail)+'</div>'+
    '<button class="ck-x" data-ign="'+esc(o.key)+'">'+(o.ignored?'Restore':'Ignore')+'</button></li>';};
  var ignored=L.filter(function(o){return o.ignored;});
  box.innerHTML=sum+(open.length?'<ul class="ck-list">'+open.map(row).join('')+'</ul>':'<p class="muted">No problems found. The checks rerun every time you change the plan.</p>')+
    (ignored.length?'<details class="ck-ign"><summary>'+ignored.length+' ignored</summary><ul class="ck-list">'+ignored.map(row).join('')+'</ul></details>':'');
  $$('[data-ck]',box).forEach(function(li){var go=function(){focusIssue(li.dataset.ck);};li.onclick=function(e){if(e.target.closest('[data-ign]'))return;go();};li.onkeydown=function(e){if(e.key==='Enter')go();};});
  $$('[data-ign]',box).forEach(function(b){b.onclick=function(){var k=b.dataset.ign,arr=(model.checkIgnore||[]).slice(),i=arr.indexOf(k);pushUndo();if(i>=0)arr.splice(i,1);else arr.push(k);model.checkIgnore=arr;if(CK.focus===k)CK.focus=null;afterChange();};});}
function focusIssue(key){var o=runChecks().filter(function(x){return x.key===key;})[0];if(!o)return;CK.focus=key;setEditing(true);
  var r=o.refs[0];sel=getObj(r)?r:null;
  if(o.zone){var xs=o.zone.map(function(p){return p[0];}),ys=o.zone.map(function(p){return p[1];}),cx=(Math.min.apply(0,xs)+Math.max.apply(0,xs))/2,cy=(Math.min.apply(0,ys)+Math.max.apply(0,ys))/2;
    var zw=Math.max.apply(0,xs)-Math.min.apply(0,xs),zh=Math.max.apply(0,ys)-Math.min.apply(0,ys);
    setTimeout(function(){var rc=svg.getBoundingClientRect(),asp=(rc.width||400)/(rc.height||400),w=Math.max(14,zw*2.6,zh*2.6*asp),h=w/asp;pvb={x:cx-w/2,y:cy-h/2,w:w,h:h};setVB();renderPlan();},80);}
  renderPlan();renderInspector();renderChecks();buildIssues3D();showTab('check');}
$('#tIssues').onchange=function(e){view.issues=e.target.checked;saveView();renderPlan();buildIssues3D();};

/* ---------- loop ---------- */
function resize(){var w=host.clientWidth||1,h=host.clientHeight||1;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
if(window.ResizeObserver){new ResizeObserver(function(){resize();if(document.body.classList.contains('editing'))renderPlan();}).observe(host);}else window.addEventListener('resize',resize);
var last=performance.now();
function frame(now){var dt=Math.min(0.05,(now-last)/1000);last=now;
  if(rebuildQueued){rebuildQueued=false;rebuild();}
  if(view.mode==='walk')updateWalk(dt);else{stepTween(now);setOrbitCam();}
  updateDoors(dt);updateLabels();renderer.render(scene,camera);requestAnimationFrame(frame);}
syncViewUI();renderSpecs();renderInspector();renderChecks();rebuild();resize();
(function(){var bb=bounds();orbit.tx=bb.cx;orbit.tz=bb.cy;})();goView('ne');tween.dur=1;
updateDirty();
if(JSON.stringify(model)!==savedJSON)setTimeout(function(){toast('Your unsaved edits from last time were restored');},600);
requestAnimationFrame(frame);
})();
