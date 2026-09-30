/* Min-Basile Bouchon v0.4 — no dependencies. */
(function (root) {
  'use strict';
  const defaults = {width:300,height:450,top:28,bottom:30,left:26,right:26,diameter:3.2,gap:0.75,rowGap:0.75,stroke:0.01,color:'#ff0000',layoutMode:'column',charactersPerRow:14,bitPitch:3.95,columnSpacing:'auto',rowGroupSpacing:'auto',columnPitch:17.7142857143,rowGroupPitch:35};
  const ops = ['%:%:','>>=','<<=','->*','...','##','::','.*','->','++','--','<<','>>','<=','>=','==','!=','&&','||','*=','/=','%=','+=','-=','&=','^=','|=','<:',':>','<%','%>','%:'];
  function lex(s) {
    const out=[]; let i=0;
    while(i<s.length) {
      const rest=s.slice(i); let m;
      if((m=/^\s+/.exec(rest))) {out.push({type:'space',s:m[0]});i+=m[0].length;continue;}
      if(rest.startsWith('//')) {const end=s.indexOf('\n',i);const j=end<0?s.length:end;out.push({type:'comment',s:s.slice(i,j)});i=j;continue;}
      if(rest.startsWith('/*')) {const end=s.indexOf('*/',i+2);if(end<0)throw Error('닫히지 않은 블록 주석이 있습니다.');out.push({type:'comment',s:s.slice(i,end+2)});i=end+2;continue;}
      if((m=/^(?:u8|u|U|L)?R"([^ ()\\\t\r\n]{0,16})\(/.exec(rest))) {
        const end=s.indexOf(')'+m[1]+'"',i+m[0].length);
        if(end<0)throw Error('닫히지 않은 raw 문자열이 있습니다.');
        let j=end+m[1].length+2;const suffix=/^[A-Za-z_][A-Za-z_0-9]*/.exec(s.slice(j));if(suffix)j+=suffix[0].length;out.push({type:'literal',s:s.slice(i,j)});i=j;continue;
      }
      if((m=/^(?:u8|u|U|L)?["']/.exec(rest))) {
        const quote=m[0].slice(-1);let j=i+m[0].length,closed=false;
        for(;j<s.length;j++){if(s[j]==='\\'){j++;continue;}if(s[j]===quote){j++;closed=true;break;}if(s[j]==='\n'||s[j]==='\r')break;}
        if(!closed)throw Error('닫히지 않은 문자열 또는 문자 리터럴이 있습니다.');
        // A user-defined literal suffix belongs to the same preprocessing token.
        const suffix=/^[A-Za-z_][A-Za-z_0-9]*/.exec(s.slice(j));if(suffix)j+=suffix[0].length;
        out.push({type:'literal',s:s.slice(i,j)});i=j;continue;
      }
      if((m=/^(?:[0-9]|\.[0-9])(?:[A-Za-z_0-9.]|[eEpP][+-]|'[A-Za-z_0-9])*/.exec(rest))) {
        // Exponent signs must be consumed before the generic identifier characters.
        m=/^(?:[0-9]|\.[0-9])(?:[eEpP][+-]|[A-Za-z_0-9.]|'[A-Za-z_0-9])*/.exec(rest);
        out.push({type:'token',s:m[0]});i+=m[0].length;continue;
      }
      if((m=/^[A-Za-z_\u0080-\uffff][A-Za-z_0-9\u0080-\uffff]*/.exec(rest))){out.push({type:'token',s:m[0]});i+=m[0].length;continue;}
      const op=ops.find(x=>rest.startsWith(x))||s[i];out.push({type:'token',s:op});i+=op.length;
    }
    return out;
  }
  function minify(source) {
    if(!source.trim())throw Error('Arduino 코드를 입력하세요.');
    if(source.length>200000)throw Error('입력은 200,000자 이하로 나누어 주세요.');
    if(/\\\r?\n/.test(source))throw Error('1단계에서는 역슬래시로 이어진 여러 줄 코드를 축약하지 않습니다. 연결된 줄을 한 줄로 정리해 주세요. 원본은 유지됩니다.');
    if(/\?\?[=/'()!<>-]/.test(source))throw Error('트라이그래프가 포함된 코드는 이번 버전에서 축약하지 않습니다.');
    const ts=lex(source.replace(/\r\n?/g,'\n'));
    // __LINE__ and stringification can observe whitespace. Keep whitespace
    // conservatively whenever user macros/directives may depend on it.
    const stripped=ts.map(t=>t.type==='comment'?' '+(t.s.match(/\n/g)||[]).join(''):t.s).join('');
    if(/\b__LINE__\b/.test(stripped)||/^\s*(?:#|%:)\s*(?!include\b)\S/m.test(stripped))return stripped;
    // Preserve existing whitespace inside all parenthesized groups: a function
    // macro from a header can stringify its arguments. Other whitespace may shrink.
    let out='',prev=null,lineStart=true,directive=false,depth=0,pending='';
    for(const t of lex(stripped)) {
      if(t.type==='space') {
        if(directive){out+=t.s;if(t.s.includes('\n')){directive=false;prev=null;lineStart=true;}}
        else {pending+=t.s;if(t.s.includes('\n'))lineStart=true;}
        continue;
      }
      if(lineStart&&(t.s==='#'||t.s==='%:')){if(out&&!out.endsWith('\n'))out+='\n';out+=t.s;directive=true;pending='';prev=null;lineStart=false;continue;}
      if(directive){out+=t.s;lineStart=false;continue;}
      if(prev&&pending){
        let joinSafe=false;
        try{const pair=lex(prev.s+t.s);joinSafe=pair.length===2&&pair[0].s===prev.s&&pair[1].s===t.s;}catch(_){}
        // Preserve dots separately (three dots would otherwise form ellipsis).
        out+=(depth>0?pending:(!joinSafe||prev.s==='.'&&t.s==='.'?' ':''));
      }
      out+=t.s;if(t.s==='(')depth++;if(t.s===')')depth=Math.max(0,depth-1);
      pending='';prev=t;lineStart=false;
    }
    return out.trim()+(directive?'\n':'');
  }
  function ascii(text) {
    if(!text.length)throw Error('변환할 코드가 없습니다.');
    if(text.length>200000)throw Error('입력은 200,000자 이하로 나누어 주세요.');
    for(let i=0;i<text.length;i++)if(text.charCodeAt(i)>127){const prefix=text.slice(0,i);throw Error(`7-bit ASCII에 없는 문자 ${JSON.stringify(String.fromCodePoint(text.codePointAt(i)))}가 있습니다 (${prefix.split('\n').length}행). 주석은 교정으로 제거할 수 있지만 문자열·식별자는 직접 확인하세요.`);}
    return Array.from(text,c=>c.charCodeAt(0).toString(2).padStart(7,'0')).join('');
  }
  function layout(text,options={}) {
    const p={...defaults,...options};
    const keys=['width','height','top','bottom','left','right','diameter','stroke'];
    if(!['continuous','column'].includes(p.layoutMode))throw Error('올바른 Layout Mode를 선택하세요.');
    if(p.layoutMode==='continuous')keys.push('gap','rowGap');
    else {
      keys.push('bitPitch','charactersPerRow');
      for(const k of ['columnSpacing','rowGroupSpacing'])if(!['auto','manual'].includes(p[k]))throw Error('간격 계산 방식을 선택하세요.');
      if(p.columnSpacing==='manual')keys.push('columnPitch');
      if(p.rowGroupSpacing==='manual')keys.push('rowGroupPitch');
      if(!Number.isInteger(p.charactersPerRow)||p.charactersPerRow<1||p.charactersPerRow>10000)throw Error('Characters per row는 1~10,000 사이 정수여야 합니다.');
    }
    for(const k of keys)if(typeof p[k]!=='number'||!Number.isFinite(p[k])||p[k]<0)throw Error('치수는 0 이상의 유한한 숫자로 입력하세요.');
    if(p.width<=0||p.height<=0||p.diameter<=0||p.stroke<=0)throw Error('판형, 원 지름, 선 두께는 0보다 커야 합니다.');
    if(p.width>10000||p.height>10000)throw Error('판형은 각 변 10,000mm 이하로 설정하세요.');
    if(p.stroke>=p.diameter)throw Error('선 두께는 원 지름보다 작아야 합니다.');
    if(!/^#[0-9a-fA-F]{6}$/.test(p.color))throw Error('선 색상은 RGB 6자리 HEX 값이어야 합니다.');
    const bits=ascii(text),w=p.width-p.left-p.right,h=p.height-p.top-p.bottom;
    const outer=p.diameter+p.stroke;
    let cols,rows,maxRows,capacity,columnPitch,rowGroupPitch,groupHeight;
    const overflow=()=>{throw Error('입력한 코드가 현재 판형에 모두 들어가지 않습니다. 원 크기, 간격, 문자 열 수, 여백, 판형 크기를 조정하세요.');};
    if(p.layoutMode==='continuous') {
      if(p.gap<p.stroke||p.rowGap<p.stroke)throw Error('원·행 간격은 선 두께 이상이어야 합니다.');
      const px=p.diameter+p.gap,py=p.diameter+p.rowGap;
      cols=w+1e-9<outer?0:Math.floor((w-outer+1e-9)/px)+1;
      maxRows=h+1e-9<outer?0:Math.floor((h-outer+1e-9)/py)+1;
      capacity=cols*maxRows;rows=cols?Math.ceil(bits.length/cols):0;
      if(bits.length>capacity)overflow();
    } else {
      cols=p.charactersPerRow;rows=Math.ceil(text.length/cols);
      groupHeight=6*p.bitPitch+outer;
      const occupiedHeight=6*p.bitPitch+outer/2;
      if(p.top+1e-9<outer/2)throw Error('위 여백(첫 중심)은 원 반지름 + 선 두께 절반 이상이어야 합니다.');
      columnPitch=p.columnSpacing==='auto'?w/cols:p.columnPitch;
      // Automatic groups spread from the top safe center to the bottom safe center.
      // A single group stays at the top. Never shrink the seven-bit pitch.
      rowGroupPitch=p.rowGroupSpacing==='auto'?(rows>1?(h-occupiedHeight)/(rows-1):7*p.bitPitch):p.rowGroupPitch;
      if(p.bitPitch+1e-9<outer||columnPitch+1e-9<outer)throw Error('비트·열 중심 간격은 원 지름 + 선 두께 이상이어야 합니다.');
      if(w<outer||h+1e-9<occupiedHeight||(cols-.5)*columnPitch+outer/2>w+1e-9)overflow();
      if(rows>1&&rowGroupPitch+1e-9<occupiedHeight)overflow();
      if(rowGroupPitch<=0)throw Error('행 그룹 중심 간격은 0보다 커야 합니다.');
      if(p.rowGroupSpacing==='manual'&&rowGroupPitch+1e-9<occupiedHeight)throw Error('행 그룹 중심 간격이 7비트 그룹 높이보다 작습니다.');
      if((rows-1)*rowGroupPitch+occupiedHeight>h+1e-9)overflow();
      const minPitch=p.rowGroupSpacing==='auto'?groupHeight:rowGroupPitch;
      maxRows=Math.floor((h-occupiedHeight+1e-9)/minPitch)+1;
      capacity=maxRows*cols*7;
    }
    const r={p,text,bits,holes:[],cols,rows,maxRows,capacity,columnPitch,rowGroupPitch,groupHeight};
    r.characters=characterTable(text);
    if(p.layoutMode==='column') {
      for(const character of r.characters)for(let bitIndex=0;bitIndex<7;bitIndex++) {
        if(character.binary[bitIndex]==='1')r.holes.push(columnPosition(r,character.index,bitIndex));
      }
      validateColumns(r);
    } else for(let i=0;i<bits.length;i++)if(bits[i]==='1')r.holes.push(position(r,i));
    return r;
  }
  // Shared by preview (including zero guides), SVG and PDF.
  function position(r,i) {
    const p=r.p,half=(p.diameter+p.stroke)/2;
    if(p.layoutMode==='column') {
      return columnPosition(r,Math.floor(i/7),i%7);
    }
    return {x:p.left+half+(i%r.cols)*(p.diameter+p.gap),y:p.top+half+Math.floor(i/r.cols)*(p.diameter+p.rowGap)};
  }
  function characterTable(text) {
    ascii(text);
    return Array.from(text,(character,index)=>({index,character,decimal:character.charCodeAt(0),binary:character.charCodeAt(0).toString(2).padStart(7,'0')}));
  }
  function columnPosition(r,charIndex,bitIndex) {
    const p=r.p,column=charIndex%p.charactersPerRow,rowGroup=Math.floor(charIndex/p.charactersPerRow);
    return {x:p.left+r.columnPitch/2+column*r.columnPitch,
      y:p.top+rowGroup*r.rowGroupPitch+bitIndex*p.bitPitch};
  }
  function validateColumns(r) {
    if(r.p.layoutMode!=='column')return true;
    let holeIndex=0;
    const p=r.p;
    for(let charIndex=0;charIndex<r.text.length;charIndex++) {
      const decimal=r.text.charCodeAt(charIndex),entry=r.characters[charIndex];
      if(!entry||entry.index!==charIndex||entry.character!==r.text[charIndex]||entry.decimal!==decimal||entry.binary!==decimal.toString(2).padStart(7,'0'))throw Error('문자 디버그 테이블 불일치: 출력을 중단했습니다.');
      for(let bitIndex=0;bitIndex<7;bitIndex++)if((decimal>>(6-bitIndex))&1) {
        const h=r.holes[holeIndex++];
        const expectedX=p.left+(charIndex%p.charactersPerRow+.5)*r.columnPitch;
        const expectedY=p.top+Math.floor(charIndex/p.charactersPerRow)*r.rowGroupPitch+bitIndex*p.bitPitch;
        if(!h||Math.abs(h.x-expectedX)>1e-8||Math.abs(h.y-expectedY)>1e-8)throw Error(`문자 ${charIndex}의 세로열 좌표 불일치: 출력을 중단했습니다.`);
      }
    }
    if(holeIndex!==r.holes.length)throw Error('타공 개수 불일치: 출력을 중단했습니다.');
    return true;
  }
  const fmt=n=>String(Number(n.toFixed(8)));
  // Export-only geometry. Never mutate the layout or share this with PDF/preview.
  function separators(r,options={}) {
    const p=r.p;
    const settings={enabled:true,color:'#999999',stroke:0.1,length:p.width-p.left-p.right,offsetX:0,offsetY:0,...options};
    if(p.layoutMode!=='column'||!settings.enabled)return {settings,lines:[]};
    for(const k of ['stroke','length','offsetX','offsetY'])if(typeof settings[k]!=='number'||!Number.isFinite(settings[k]))throw Error('구분선 설정은 유한한 숫자로 입력하세요.');
    if(settings.stroke<=0||settings.length<=0)throw Error('구분선 두께와 길이는 0보다 커야 합니다.');
    if(!/^#[0-9a-fA-F]{6}$/.test(settings.color))throw Error('구분선 색상이 올바르지 않습니다.');
    const halfLine=settings.stroke/2,halfHole=(p.diameter+p.stroke)/2;
    const x1=p.left+settings.offsetX,x2=x1+settings.length;
    if(x1<0||x2>p.width)throw Error('구분선이 판형의 좌우 경계를 벗어납니다. 길이 또는 가로 이동을 조정하세요.');
    const lines=[];
    for(let group=0;group<r.rows;group++) {
      const bottom=p.top+group*r.rowGroupPitch+6*p.bitPitch+halfHole;
      const nextTop=group+1<r.rows?p.top+(group+1)*r.rowGroupPitch-halfHole:null;
      const y=(nextTop===null?bottom+2:(bottom+nextTop)/2)+settings.offsetY;
      if(y-halfLine<0||y+halfLine>p.height)throw Error(`${group+1}번 구분선이 판형의 위아래 경계를 벗어납니다.`);
      if(y-halfLine<=bottom+1e-9||(nextTop!==null&&y+halfLine>=nextTop-1e-9))throw Error(`${group+1}번 구분선이 7비트 그룹 영역과 겹치거나 간격이 부족합니다. 구분선 두께·세로 이동을 조정하거나 구분선을 끄세요.`);
      lines.push({id:`row-separator-${group+1}`,x1,x2,y});
    }
    return {settings,lines};
  }
  function svg(r,separatorOptions={}) {
    validateColumns(r);
    const p=r.p,{settings,lines}=separators(r,separatorOptions);
    const separatorGroup=lines.length?`<g id="row-group-separators" fill="none" stroke="${settings.color}" stroke-width="${fmt(settings.stroke)}" stroke-linecap="butt">\n${lines.map(l=>`<line id="${l.id}" x1="${fmt(l.x1)}" y1="${fmt(l.y)}" x2="${fmt(l.x2)}" y2="${fmt(l.y)}"/>`).join('\n')}\n</g>\n`:'';
    return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(p.width)}mm" height="${fmt(p.height)}mm" viewBox="0 0 ${fmt(p.width)} ${fmt(p.height)}">\n<g fill="none" stroke="${p.color}" stroke-width="${fmt(p.stroke)}">\n${r.holes.map(h=>`<circle cx="${fmt(h.x)}" cy="${fmt(h.y)}" r="${fmt(p.diameter/2)}"/>`).join('\n')}\n</g>\n${separatorGroup}</svg>\n`;
  }
  // PDF user-space uses points; this matrix makes every path coordinate millimetres.
  // Four cubic Bezier arcs are the standard vector representation of a PDF circle.
  function pdf(r) {
    validateColumns(r);
    const p=r.p,scale=72/25.4,k=0.5522847498307936,rad=p.diameter/2,d=rad*k;
    const rgb=[1,3,5].map(i=>parseInt(p.color.slice(i,i+2),16)/255);
    const commands=['q',`${fmt(scale)} 0 0 ${fmt(-scale)} 0 ${fmt(p.height*scale)} cm`,`${fmt(p.stroke)} w`,`${rgb.map(fmt).join(' ')} RG`];
    for(const {x,y} of r.holes)commands.push(
      `${fmt(x+rad)} ${fmt(y)} m`,
      `${fmt(x+rad)} ${fmt(y+d)} ${fmt(x+d)} ${fmt(y+rad)} ${fmt(x)} ${fmt(y+rad)} c`,
      `${fmt(x-d)} ${fmt(y+rad)} ${fmt(x-rad)} ${fmt(y+d)} ${fmt(x-rad)} ${fmt(y)} c`,
      `${fmt(x-rad)} ${fmt(y-d)} ${fmt(x-d)} ${fmt(y-rad)} ${fmt(x)} ${fmt(y-rad)} c`,
      `${fmt(x+d)} ${fmt(y-rad)} ${fmt(x+rad)} ${fmt(y-d)} ${fmt(x+rad)} ${fmt(y)} c`, 'h S');
    commands.push('Q');
    const stream=commands.join('\n')+'\n';
    const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${fmt(p.width*scale)} ${fmt(p.height*scale)}] /Resources << >> /Contents 4 0 R >>`,
      `<< /Length ${stream.length} >>\nstream\n${stream}endstream`];
    let out='%PDF-1.4\n',offsets=[0];
    objects.forEach((obj,i)=>{offsets.push(out.length);out+=`${i+1} 0 obj\n${obj}\nendobj\n`;});
    const xref=out.length;
    out+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
    for(const offset of offsets.slice(1))out+=`${String(offset).padStart(10,'0')} 00000 n \n`;
    out+=`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return out;
  }
  const api={defaults,minify,ascii,layout,position,columnPosition,characterTable,validateColumns,separators,svg,pdf,lex};
  if(typeof module!=='undefined')module.exports=api;else root.Bouchon=api;
})(typeof globalThis!=='undefined'?globalThis:this);
