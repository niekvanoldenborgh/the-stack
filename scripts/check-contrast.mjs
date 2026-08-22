import { readFileSync } from 'node:fs';
const src = readFileSync('src/ui/theme.ts','utf8');
function block(name){
  const i = src.indexOf(`const ${name}: ColorTokens = {`);
  let d=0,j=src.indexOf('{',i);const s=j;
  for(;j<src.length;j++){ if(src[j]==='{')d++; else if(src[j]==='}'){d--; if(!d)break;} }
  return src.slice(s,j+1);
}
const hexOf = (b,k)=>{ const m=b.match(new RegExp(`\\b${k}:\\s*'(#[0-9A-Fa-f]{6})'`)); return m&&m[1]; };
const L=(h)=>{const c=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=.03928?v/12.92:((v+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2];};
const CR=(a,b)=>{const x=L(a),y=L(b);return ((Math.max(x,y)+.05)/(Math.min(x,y)+.05));};

let fails=0;
for (const mode of ['LIGHT_COLORS','DARK_COLORS']){
  const b=block(mode);
  console.log(`\n=== ${mode} ===`);
  const bg=hexOf(b,'background'), surf=hexOf(b,'surface'), el=hexOf(b,'surfaceElevated'), mut=hexOf(b,'surfaceMuted');
  const surfaces={background:bg,surface:surf,surfaceElevated:el,surfaceMuted:mut};
  for (const fgKey of ['textPrimary','textSecondary','textTertiary','primary']){
    const fg=hexOf(b,fgKey);
    for (const [sn,sv] of Object.entries(surfaces)){
      const r=CR(fg,sv); const min = fgKey==='textTertiary'?3.0:4.5;
      const ok = r>=min;
      if(!ok){fails++;}
      console.log(`${ok?'ok  ':'FAIL'} ${fgKey.padEnd(14)} on ${sn.padEnd(16)} ${r.toFixed(2)}:1 (min ${min})`);
    }
  }
  // onPrimary on primarySolid
  const r=CR(hexOf(b,'onPrimary'),hexOf(b,'primarySolid'));
  console.log(`${r>=4.5?'ok  ':'FAIL'} onPrimary      on primarySolid   ${r.toFixed(2)}:1 (min 4.5)`); if(r<4.5)fails++;
  // severity vs evidence overlap
  const sev=[...b.matchAll(/(critical|high|moderate|info|success):\s*\{\s*fg:\s*'(#[0-9A-Fa-f]{6})'/g)].map(m=>m[2].toUpperCase());
  const ev=[...b.matchAll(/([ABCD]):\s*'(#[0-9A-Fa-f]{6})'/g)].map(m=>m[2].toUpperCase());
  const overlap=ev.filter(e=>sev.includes(e));
  console.log(`${overlap.length?'FAIL':'ok  '} evidence vs severity overlap: [${overlap.join(', ')}]`);
  if(overlap.length)fails++;
}
console.log(`\n${fails===0?'ALL PASS':fails+' FAILURES'}`);
process.exit(fails?1:0);
