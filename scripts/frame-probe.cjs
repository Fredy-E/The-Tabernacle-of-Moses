/* Offline framing probe: rasterises one camera pose to a PNG so the walkthrough
   framing can be inspected without a GPU. Diagnostic only; not part of the page. */
const fs=require('fs'),vm=require('vm'),zlib=require('zlib');
const html=fs.readFileSync(process.env.PAGE||require('path').join(__dirname,'../index.html'),'utf8');
let script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
/* mark the vertex ranges of the three things inside the ark */
const MARKS=[
 ['  push(T(POS.ark[0],.125,POS.ark[2])); push(RY(Math.PI/2));','jar'],
 ['    // Two modest stone slabs','tab'],
 ['    mat("#7d5f3c",.72,0,3,.16);','rod'],
 ['  // Interior floor remains when the exterior desert mesh is culled.','end']
];
for(const [anchor,name] of MARKS){
  const at=script.indexOf(anchor);
  if(at<0) throw Error('anchor not found: '+anchor);
  if(script.indexOf(anchor,at+1)>=0) throw Error('anchor not unique: '+anchor);
  script=script.slice(0,at)+'  RANGE.'+name+'=V.length/15;\n'+script.slice(at);
}
const ctx={window:{matchMedia:()=>({matches:false})},document:{getElementById:()=>({})},console,RANGE:{}};
vm.createContext(ctx);
vm.runInContext(script.slice(0,script.indexOf('/* ---------- G. PAGE')),ctx);

const W=Number(process.argv[2]||1440), H=Number(process.argv[3]||900);
const T=Number(process.argv[4]||9);
const OUT=process.argv[5]||'frame-probe.png';

const scene=ctx.buildScene();
const V=scene.v, I=scene.i, M=scene.motion;

/* --- camera, exactly as frame() builds it (no drift, no pointer parallax) --- */
const i0=Math.max(0,Math.min(ctx.POSES.length-2,Math.floor(T))), f=Math.max(0,Math.min(1,T-i0));
const A=ctx.POSES[i0],B=ctx.POSES[i0+1];
const eye=ctx.vlerp(A.eye,B.eye,f), at=ctx.vlerp(A.at,B.at,f);
const fov=ctx.lerp(A.fov,B.fov,f);
const sx=process.env.SX!==undefined?Number(process.env.SX):ctx.lerp(A.sx,B.sx,f);
const d=ctx.vlen(ctx.vsub(at,eye));
const k=Math.max(0,Math.min(1,(W-880)/760))*0.40;
const shift=sx*k*d*Math.tan(fov*Math.PI/360);

const open=[ctx.smoother((ctx.CX1+4.0-eye[0])/3.3),
            ctx.smoother((ctx.TX1+.16+3.0-eye[0])/2.5),
            ctx.smoother((ctx.VX+2.8-eye[0])/2.3),
            ctx.smoother((T-8.08)/.72)];
const hinge=[ctx.POS.ark[0]-ctx.cu(.75),ctx.cu(1.5),ctx.POS.ark[2]];

function deform(p,n,m){
  const id=Math.round(m[0]);
  if(id>0&&id<4){
    const amount=open[id-1],side=m[1],half=m[2],scale=1-amount*0.90;
    p[2]=side*half+(p[2]-side*half)*scale;
  }else if(id===4){
    const a=open[3]*1.92,c=Math.cos(a),s=Math.sin(a);
    const q=[p[0]-hinge[0],p[1]-hinge[1],p[2]-hinge[2]];
    p[0]=hinge[0]+c*q[0]-s*q[1]; p[1]=hinge[1]+s*q[0]+c*q[1]; p[2]=hinge[2]+q[2];
    const nx=c*n[0]-s*n[1], ny=s*n[0]+c*n[1]; n[0]=nx; n[1]=ny;
  }
}

const view=ctx.mShiftX(ctx.mLook(eye,at,[0,1,0]),shift);
const proj=ctx.mPersp(fov*Math.PI/180,W/H,0.06,420);
const vp=ctx.mMul(proj,view);

/* --- the three things inside the ark, by their vertex ranges --- */
const R=ctx.RANGE;
const TINT={jar:[255,215,0],tab:[80,200,255],rod:[255,60,60]};
const MARK=process.env.MARK!=='0';
function relicOf(vi){
  if(vi<R.jar||vi>=R.end) return null;
  if(vi<R.tab) return 'jar';
  if(vi<R.rod) return 'tab';
  return 'rod';
}

const px=new Float32Array(W*H*3), zb=new Float32Array(W*H).fill(Infinity);
const sun=ctx.vnorm([0.55,0.72,0.42]);
let counted={jar:0,tab:0,rod:0};
const bounds={jar:[1e9,1e9,-1e9,-1e9],tab:[1e9,1e9,-1e9,-1e9],rod:[1e9,1e9,-1e9,-1e9]};

const P=[[0,0,0,0],[0,0,0,0],[0,0,0,0]], NR=[[0,0,0],[0,0,0],[0,0,0]], CO=[[0,0,0],[0,0,0],[0,0,0]];
const S=[[0,0,0],[0,0,0],[0,0,0]];
for(let t=0;t<I.length;t+=3){
  let tag=null, ok=true;
  for(let v=0;v<3;v++){
    const vi=I[t+v], b=vi*15, mb=vi*4;
    const p=[V[b],V[b+1],V[b+2]], n=[V[b+3],V[b+4],V[b+5]];
    const c=[V[b+8],V[b+9],V[b+10]];
    deform(p,n,[M[mb],M[mb+1],M[mb+2],M[mb+3]]);
    const r=relicOf(vi); if(r) tag=r;
    NR[v]=n; CO[v]=c;
    const X=vp[0]*p[0]+vp[4]*p[1]+vp[8]*p[2]+vp[12];
    const Y=vp[1]*p[0]+vp[5]*p[1]+vp[9]*p[2]+vp[13];
    const Z=vp[2]*p[0]+vp[6]*p[1]+vp[10]*p[2]+vp[14];
    const Wc=vp[3]*p[0]+vp[7]*p[1]+vp[11]*p[2]+vp[15];
    if(Wc<=1e-6){ok=false;break;}
    P[v]=[X,Y,Z,Wc];
    S[v]=[(X/Wc*0.5+0.5)*W, (0.5-Y/Wc*0.5)*H, Z/Wc];
  }
  if(!ok) continue;
  const minx=Math.max(0,Math.floor(Math.min(S[0][0],S[1][0],S[2][0])));
  const maxx=Math.min(W-1,Math.ceil(Math.max(S[0][0],S[1][0],S[2][0])));
  const miny=Math.max(0,Math.floor(Math.min(S[0][1],S[1][1],S[2][1])));
  const maxy=Math.min(H-1,Math.ceil(Math.max(S[0][1],S[1][1],S[2][1])));
  if(maxx<minx||maxy<miny) continue;
  const area=(S[1][0]-S[0][0])*(S[2][1]-S[0][1])-(S[2][0]-S[0][0])*(S[1][1]-S[0][1]);
  if(Math.abs(area)<1e-9) continue;
  for(let y=miny;y<=maxy;y++) for(let x=minx;x<=maxx;x++){
    const cx=x+0.5, cy=y+0.5;
    let w0=((S[1][0]-S[0][0])*(cy-S[0][1])-(cx-S[0][0])*(S[1][1]-S[0][1]))/area;
    let w1=((cx-S[0][0])*(S[2][1]-S[0][1])-(S[2][0]-S[0][0])*(cy-S[0][1]))/area;
    const w2=1-w0-w1;
    if(w0<0||w1<0||w2<0) continue;
    const z=S[0][2]*w2+S[1][2]*w1+S[2][2]*w0;
    const o=y*W+x;
    if(z>=zb[o]) continue;
    zb[o]=z;
    const nz=[NR[0][0]*w2+NR[1][0]*w1+NR[2][0]*w0,
              NR[0][1]*w2+NR[1][1]*w1+NR[2][1]*w0,
              NR[0][2]*w2+NR[1][2]*w1+NR[2][2]*w0];
    const nl=Math.hypot(nz[0],nz[1],nz[2])||1;
    const lam=Math.abs((nz[0]*sun[0]+nz[1]*sun[1]+nz[2]*sun[2])/nl);
    const sh=0.34+0.66*lam;
    let r,g,b2;
    if(tag&&MARK){ const tt=TINT[tag]; r=tt[0]*sh; g=tt[1]*sh; b2=tt[2]*sh; }
    else { r=255*(CO[0][0]*w2+CO[1][0]*w1+CO[2][0]*w0)*sh;
           g=255*(CO[0][1]*w2+CO[1][1]*w1+CO[2][1]*w0)*sh;
           b2=255*(CO[0][2]*w2+CO[1][2]*w1+CO[2][2]*w0)*sh; }
    px[o*3]=r; px[o*3+1]=g; px[o*3+2]=b2;
    if(tag){ counted[tag]++;
      const bb=bounds[tag];
      if(x<bb[0])bb[0]=x; if(y<bb[1])bb[1]=y; if(x>bb[2])bb[2]=x; if(y>bb[3])bb[3]=y; }
  }
}

/* --- overlay the text card's footprint as measured in the browser --- */
const card=process.argv[6]?process.argv[6].split(',').map(Number):null;
if(card){
  const [cx,cy,cw,ch]=card;
  for(let y=Math.max(0,cy);y<Math.min(H,cy+ch);y++) for(let x=Math.max(0,cx);x<Math.min(W,cx+cw);x++){
    const o=(y*W+x)*3; px[o]=px[o]*0.30; px[o+1]=px[o+1]*0.30+40; px[o+2]=px[o+2]*0.30+70;
  }
}

const raw=Buffer.alloc(H*(W*3+1));
for(let y=0;y<H;y++){ raw[y*(W*3+1)]=0;
  for(let x=0;x<W*3;x++) raw[y*(W*3+1)+1+x]=Math.max(0,Math.min(255,Math.round(px[y*W*3+x]))); }
function chunk(type,data){
  const len=Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body=Buffer.concat([Buffer.from(type,'ascii'),data]);
  const crc=Buffer.alloc(4); crc.writeUInt32BE(crc32(body)>>>0);
  return Buffer.concat([len,body,crc]);
}
let TBL=null;
function crc32(buf){ if(!TBL){TBL=[];for(let n=0;n<256;n++){let c=n;for(let j=0;j<8;j++)c=c&1?0xEDB88320^(c>>>1):c>>>1;TBL[n]=c>>>0;}}
  let c=0xFFFFFFFF; for(const b of buf) c=TBL[(c^b)&0xFF]^(c>>>8); return (c^0xFFFFFFFF)>>>0; }
const ihdr=Buffer.alloc(13); ihdr.writeUInt32BE(W,0); ihdr.writeUInt32BE(H,4);
ihdr[8]=8; ihdr[9]=2; ihdr[10]=0; ihdr[11]=0; ihdr[12]=0;
fs.writeFileSync(OUT,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),
  chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));

console.log(JSON.stringify({t:T,W,H,eye,at,fov,sx,shift,
  ndcShift:sx*k/(W/H), pixelShift:(sx*k/(W/H))*W/2,
  visiblePixels:counted, bounds, out:OUT},null,1));
