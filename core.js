/* Min-Basile Bouchon v0.5 — no dependencies. */
(function (root) {
  'use strict';
  const defaults = {width:300,height:450,top:28,bottom:30,left:26,right:26,diameter:3.2,gap:0.75,rowGap:0.75,stroke:0.01,color:'#ff0000',shape:'circle',layoutMode:'column',charactersPerRow:14,columnSpacing:'auto',columnPitch:17.7142857143,rowSpacing:'auto',rowPitch:3.95};
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
    if(!['circle','diamond','triangle','heart','square'].includes(p.shape))throw Error('올바른 타공 모양을 선택하세요.');
    if(p.layoutMode==='continuous')keys.push('gap','rowGap');
    else {
      keys.push('charactersPerRow');
      for(const k of ['columnSpacing','rowSpacing'])if(!['auto','manual'].includes(p[k]))throw Error('간격 계산 방식을 선택하세요.');
      if(p.columnSpacing==='manual')keys.push('columnPitch');
      if(p.rowSpacing==='manual')keys.push('rowPitch');
      if(!Number.isInteger(p.charactersPerRow)||p.charactersPerRow<1||p.charactersPerRow>10000)throw Error('Characters per row는 1~10,000 사이 정수여야 합니다.');
    }
    for(const k of keys)if(typeof p[k]!=='number'||!Number.isFinite(p[k])||p[k]<0)throw Error('치수는 0 이상의 유한한 숫자로 입력하세요.');
    if(p.width<=0||p.height<=0||p.diameter<=0||p.stroke<=0)throw Error('판형, 타공 크기, 선 두께는 0보다 커야 합니다.');
    if(p.width>10000||p.height>10000)throw Error('판형은 각 변 10,000mm 이하로 설정하세요.');
    if(p.stroke>=p.diameter)throw Error('선 두께는 타공 크기보다 작아야 합니다.');
    if(!/^#[0-9a-fA-F]{6}$/.test(p.color))throw Error('선 색상은 RGB 6자리 HEX 값이어야 합니다.');

    const allBits=ascii(text),w=p.width-p.left-p.right,h=p.height-p.top-p.bottom,outer=p.diameter+p.stroke;
    let cols,maxRows,capacityPerPage,columnPitch,rowPitch;

    if(p.layoutMode==='continuous') {
      if(p.gap<p.stroke||p.rowGap<p.stroke)throw Error('타공·행 간격은 선 두께 이상이어야 합니다.');
      const px=p.diameter+p.gap,py=p.diameter+p.rowGap;
      cols=w+1e-9<outer?0:Math.floor((w-outer+1e-9)/px)+1;
      maxRows=h+1e-9<outer?0:Math.floor((h-outer+1e-9)/py)+1;
      capacityPerPage=cols*maxRows;
      if(capacityPerPage<1)throw Error('현재 판형과 여백에는 타공을 배치할 공간이 없습니다.');
    } else {
      cols=p.charactersPerRow;
      const half=outer/2;
      if(p.top+1e-9<half)throw Error('위 여백(첫 중심)은 타공 반지름 + 선 두께 절반 이상이어야 합니다.');
      columnPitch=p.columnSpacing==='auto'?w/cols:p.columnPitch;
      if(columnPitch+1e-9<outer)throw Error('열 중심 간격은 타공 크기 + 선 두께 이상이어야 합니다.');
      if(w<outer||(cols-.5)*columnPitch+half>w+1e-9)throw Error('현재 판형과 여백에는 문자 열을 배치할 공간이 없습니다.');

      const lastSafeCenter=p.height-p.bottom-half;
      const centerSpan=lastSafeCenter-p.top;
      if(centerSpan<6*outer-1e-9)throw Error('현재 판형과 여백에는 7개의 타공 행을 배치할 공간이 없습니다.');

      if(p.rowSpacing==='manual') {
        rowPitch=p.rowPitch;
        if(rowPitch<=0)throw Error('행 중심 간격은 0보다 커야 합니다.');
        if(rowPitch+1e-9<outer)throw Error('행 중심 간격은 타공 크기 + 선 두께 이상이어야 합니다.');
        const maxBitRows=Math.floor((centerSpan+1e-9)/rowPitch)+1;
        maxRows=Math.floor(maxBitRows/7);
      } else {
        const minAutoPitch=outer+0.2;const maxBitRows=Math.floor((centerSpan+1e-9)/minAutoPitch)+1;
        maxRows=Math.floor(maxBitRows/7);
      }
      if(maxRows<1)throw Error('현재 판형과 여백에는 7개의 타공 행을 배치할 공간이 없습니다.');
      capacityPerPage=maxRows*cols*7;
    }

    const pages=[];
    if(p.layoutMode==='column') {
      const charsPerPage=maxRows*cols;
      const half=outer/2,lastSafeCenter=p.height-p.bottom-half,centerSpan=lastSafeCenter-p.top;
      for(let startChar=0,pageIndex=0;startChar<text.length;startChar+=charsPerPage,pageIndex++) {
        const pageText=text.slice(startChar,startChar+charsPerPage);
        const rows=Math.ceil(pageText.length/cols);
        const bitRows=rows*7;
        const pageRowPitch=p.rowSpacing==='auto'?(bitRows>1?centerSpan/(bitRows-1):0):p.rowPitch;
        if(bitRows>1&&pageRowPitch+1e-9<outer)throw Error('자동 행 간격이 타공 크기보다 작습니다. 판형을 키우거나 문자 열 수를 늘리세요.');
        const page={p,text:pageText,bits:ascii(pageText),holes:[],cols,rows,bitRows,maxRows,capacity:capacityPerPage,columnPitch,rowPitch:pageRowPitch,startCharacter:startChar,startBit:startChar*7,pageIndex};
        page.characters=characterTable(pageText);
        for(const character of page.characters)for(let bitIndex=0;bitIndex<7;bitIndex++)if(character.binary[bitIndex]==='1')page.holes.push(columnPosition(page,character.index,bitIndex));
        validateColumns(page);
        pages.push(page);
      }
    } else {
      for(let startBit=0,pageIndex=0;startBit<allBits.length;startBit+=capacityPerPage,pageIndex++) {
        const pageBits=allBits.slice(startBit,startBit+capacityPerPage),rows=Math.ceil(pageBits.length/cols);
        const page={p,text:'',bits:pageBits,holes:[],cols,rows,maxRows,capacity:capacityPerPage,startBit,pageIndex};
        for(let i=0;i<pageBits.length;i++)if(pageBits[i]==='1')page.holes.push(position(page,i));
        pages.push(page);
      }
    }
    if(!pages.length)throw Error('변환할 코드가 없습니다.');
    const pageCount=pages.length;
    for(const page of pages)page.pageCount=pageCount;
    const first=pages[0];
    return {...first,p,text,bits:allBits,pages,pageCount,characters:characterTable(text),
      holes:pages.flatMap(page=>page.holes.map(h=>({...h,page:page.pageIndex}))),
      capacity:capacityPerPage,totalCapacity:capacityPerPage*pageCount};
  }
  // Shared by preview (including zero guides), SVG and PDF.
  function position(r,i) {
    if(r.pages) {
      if(r.p.layoutMode==='column') {
        const charIndex=Math.floor(i/7),charsPerPage=r.pages[0].maxRows*r.p.charactersPerRow,pageIndex=Math.floor(charIndex/charsPerPage);
        const page=r.pages[Math.min(pageIndex,r.pages.length-1)],localChar=charIndex-page.pageIndex*charsPerPage;
        return columnPosition(page,localChar,i%7);
      }
      const pageIndex=Math.floor(i/r.capacity),page=r.pages[Math.min(pageIndex,r.pages.length-1)];
      return position(page,i-page.startBit);
    }
    const p=r.p,half=(p.diameter+p.stroke)/2;
    if(p.layoutMode==='column')return columnPosition(r,Math.floor(i/7),i%7);
    return {x:p.left+half+(i%r.cols)*(p.diameter+p.gap),y:p.top+half+Math.floor(i/r.cols)*(p.diameter+p.rowGap)};
  }
  function characterTable(text) {
    ascii(text);
    return Array.from(text,(character,index)=>({index,character,decimal:character.charCodeAt(0),binary:character.charCodeAt(0).toString(2).padStart(7,'0')}));
  }
  function columnPosition(r,charIndex,bitIndex) {
    if(r.pages) {
      const charsPerPage=r.pages[0].maxRows*r.p.charactersPerRow,pageIndex=Math.floor(charIndex/charsPerPage),page=r.pages[Math.min(pageIndex,r.pages.length-1)];
      return columnPosition(page,charIndex-pageIndex*charsPerPage,bitIndex);
    }
    const p=r.p,column=charIndex%p.charactersPerRow,rowGroup=Math.floor(charIndex/p.charactersPerRow);
    return {x:p.left+r.columnPitch/2+column*r.columnPitch,y:p.top+(rowGroup*7+bitIndex)*r.rowPitch};
  }
  function validateColumns(r) {
    if(r.pages){for(const page of r.pages)validateColumns(page);return true;}
    if(r.p.layoutMode!=='column')return true;
    let holeIndex=0;const p=r.p;
    for(let charIndex=0;charIndex<r.text.length;charIndex++) {
      const decimal=r.text.charCodeAt(charIndex),entry=r.characters[charIndex];
      if(!entry||entry.index!==charIndex||entry.character!==r.text[charIndex]||entry.decimal!==decimal||entry.binary!==decimal.toString(2).padStart(7,'0'))throw Error('문자 디버그 테이블 불일치: 출력을 중단했습니다.');
      for(let bitIndex=0;bitIndex<7;bitIndex++)if((decimal>>(6-bitIndex))&1) {
        const h=r.holes[holeIndex++],expectedX=p.left+(charIndex%p.charactersPerRow+.5)*r.columnPitch,expectedY=p.top+(Math.floor(charIndex/p.charactersPerRow)*7+bitIndex)*r.rowPitch;
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
      const lastRowY=p.top+(group*7+6)*r.rowPitch;
      const nextRowY=group+1<r.rows?p.top+(group+1)*7*r.rowPitch:null;
      const y=(nextRowY===null?lastRowY+halfHole+2:(lastRowY+nextRowY)/2)+settings.offsetY;
      if(y-halfLine<0||y+halfLine>p.height)throw Error(`${group+1}번 구분선이 판형의 위아래 경계를 벗어납니다.`);
      if(y-halfLine<=lastRowY+halfHole+1e-9||(nextRowY!==null&&y+halfLine>=nextRowY-halfHole-1e-9))throw Error(`${group+1}번 구분선이 타공 행과 겹치거나 간격이 부족합니다. 구분선 두께·세로 이동을 조정하거나 구분선을 끄세요.`);
      lines.push({id:`row-separator-${group+1}`,x1,x2,y});
    }
    return {settings,lines};
  }
  function shapeSvg(h,p) {
    const r=p.diameter/2,x=fmt(h.x),y=fmt(h.y),rr=fmt(r);
    if(p.shape==='circle')return `<circle cx="${x}" cy="${y}" r="${rr}"/>`;
    if(p.shape==='square')return `<rect x="${fmt(h.x-r)}" y="${fmt(h.y-r)}" width="${fmt(p.diameter)}" height="${fmt(p.diameter)}"/>`;
    if(p.shape==='diamond')return `<path d="M ${x} ${fmt(h.y-r)} L ${fmt(h.x+r)} ${y} L ${x} ${fmt(h.y+r)} L ${fmt(h.x-r)} ${y} Z"/>`;
    if(p.shape==='triangle')return `<path d="M ${x} ${fmt(h.y-r)} L ${fmt(h.x+r)} ${fmt(h.y+r)} L ${fmt(h.x-r)} ${fmt(h.y+r)} Z"/>`;
    return `<path d="M ${x} ${fmt(h.y+r*.95)} C ${fmt(h.x-r*.95)} ${fmt(h.y+r*.25)} ${fmt(h.x-r*.9)} ${fmt(h.y-r*.65)} ${fmt(h.x-r*.42)} ${fmt(h.y-r*.65)} C ${fmt(h.x-r*.14)} ${fmt(h.y-r*.65)} ${x} ${fmt(h.y-r*.42)} ${x} ${fmt(h.y-r*.2)} C ${x} ${fmt(h.y-r*.42)} ${fmt(h.x+r*.14)} ${fmt(h.y-r*.65)} ${fmt(h.x+r*.42)} ${fmt(h.y-r*.65)} C ${fmt(h.x+r*.9)} ${fmt(h.y-r*.65)} ${fmt(h.x+r*.95)} ${fmt(h.y+r*.25)} ${x} ${fmt(h.y+r*.95)} Z"/>`;
  }
  function svg(r,separatorOptions={}) {
    const pages=r.pages||[r];
    validateColumns(r);
    const p=pages[0].p;
    const groups=pages.map((page,i)=>{
      const boardNumber=Number.isInteger(page.pageIndex)?page.pageIndex+1:i+1;
      const boardId=`Board_${String(boardNumber).padStart(2,'0')}`;
      const {settings,lines}=separators(page,separatorOptions);
      const separatorId=pages.length===1?'row-group-separators':`${boardId}_row-group-separators`;
      const separatorGroup=lines.length?`<g id="${separatorId}" fill="none" stroke="${settings.color}" stroke-width="${fmt(settings.stroke)}" stroke-linecap="butt">\n${lines.map(line=>`<line id="${pages.length===1?line.id:`${boardId}_${line.id}`}" x1="${fmt(line.x1)}" y1="${fmt(line.y)}" x2="${fmt(line.x2)}" y2="${fmt(line.y)}"/>`).join('\n')}\n</g>\n`:'';
      return `<g id="${boardId}" data-name="${boardId}" inkscape:groupmode="layer" inkscape:label="판 ${boardNumber}">\n<g id="${boardId}_holes" fill="none" stroke="${p.color}" stroke-width="${fmt(p.stroke)}" stroke-linejoin="round">\n${page.holes.map(h=>shapeSvg(h,p)).join('\n')}\n</g>\n${separatorGroup}</g>`;
    });
    return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="${fmt(p.width)}mm" height="${fmt(p.height)}mm" viewBox="0 0 ${fmt(p.width)} ${fmt(p.height)}">\n${groups.join('\n')}\n</svg>\n`;
  }
  // PDF user-space uses points; this matrix makes every path coordinate millimetres.
  // Four cubic Bezier arcs are the standard vector representation of a PDF circle.
  function pdfPathCommands(h,p) {
    const x=h.x,y=h.y,r=p.diameter/2,k=0.5522847498307936,d=r*k;
    if(p.shape==='circle')return [`${fmt(x+r)} ${fmt(y)} m`,`${fmt(x+r)} ${fmt(y+d)} ${fmt(x+d)} ${fmt(y+r)} ${fmt(x)} ${fmt(y+r)} c`,`${fmt(x-d)} ${fmt(y+r)} ${fmt(x-r)} ${fmt(y+d)} ${fmt(x-r)} ${fmt(y)} c`,`${fmt(x-r)} ${fmt(y-d)} ${fmt(x-d)} ${fmt(y-r)} ${fmt(x)} ${fmt(y-r)} c`,`${fmt(x+d)} ${fmt(y-r)} ${fmt(x+r)} ${fmt(y-d)} ${fmt(x+r)} ${fmt(y)} c`,'h S'];
    if(p.shape==='square')return [`${fmt(x-r)} ${fmt(y-r)} m`,`${fmt(x+r)} ${fmt(y-r)} l`,`${fmt(x+r)} ${fmt(y+r)} l`,`${fmt(x-r)} ${fmt(y+r)} l`,'h S'];
    if(p.shape==='diamond')return [`${fmt(x)} ${fmt(y-r)} m`,`${fmt(x+r)} ${fmt(y)} l`,`${fmt(x)} ${fmt(y+r)} l`,`${fmt(x-r)} ${fmt(y)} l`,'h S'];
    if(p.shape==='triangle')return [`${fmt(x)} ${fmt(y-r)} m`,`${fmt(x+r)} ${fmt(y+r)} l`,`${fmt(x-r)} ${fmt(y+r)} l`,'h S'];
    return [`${fmt(x)} ${fmt(y+r*.95)} m`,`${fmt(x-r*.95)} ${fmt(y+r*.25)} ${fmt(x-r*.9)} ${fmt(y-r*.65)} ${fmt(x-r*.42)} ${fmt(y-r*.65)} c`,`${fmt(x-r*.14)} ${fmt(y-r*.65)} ${fmt(x)} ${fmt(y-r*.42)} ${fmt(x)} ${fmt(y-r*.2)} c`,`${fmt(x)} ${fmt(y-r*.42)} ${fmt(x+r*.14)} ${fmt(y-r*.65)} ${fmt(x+r*.42)} ${fmt(y-r*.65)} c`,`${fmt(x+r*.9)} ${fmt(y-r*.65)} ${fmt(x+r*.95)} ${fmt(y+r*.25)} ${fmt(x)} ${fmt(y+r*.95)} c`,'h S'];
  }
  function pdf(r) {
    const pages=r.pages||[r];for(const page of pages)validateColumns(page);
    const p=pages[0].p,scale=72/25.4,rgb=[1,3,5].map(i=>parseInt(p.color.slice(i,i+2),16)/255);
    const streams=pages.map(page=>{
      const commands=['q',`${fmt(scale)} 0 0 ${fmt(-scale)} 0 ${fmt(p.height*scale)} cm`,`${fmt(p.stroke)} w`,`${rgb.map(fmt).join(' ')} RG`];
      for(const h of page.holes)commands.push(...pdfPathCommands(h,p));commands.push('Q');return commands.join('\n')+'\n';
    });
    const pageCount=pages.length,firstPageObj=3,firstContentObj=3+pageCount;
    const kids=Array.from({length:pageCount},(_,i)=>`${firstPageObj+i} 0 R`).join(' ');
    const objects=['<< /Type /Catalog /Pages 2 0 R >>',`<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>`];
    for(let i=0;i<pageCount;i++)objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${fmt(p.width*scale)} ${fmt(p.height*scale)}] /Resources << >> /Contents ${firstContentObj+i} 0 R >>`);
    for(const stream of streams)objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`);
    let out='%PDF-1.4\n',offsets=[0];objects.forEach((obj,i)=>{offsets.push(out.length);out+=`${i+1} 0 obj\n${obj}\nendobj\n`;});
    const xref=out.length;out+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
    for(const offset of offsets.slice(1))out+=`${String(offset).padStart(10,'0')} 00000 n \n`;
    out+=`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;return out;
  }
  const api={defaults,minify,ascii,layout,position,columnPosition,characterTable,validateColumns,separators,svg,pdf,lex};
  if(typeof module!=='undefined')module.exports=api;else root.Bouchon=api;
})(typeof globalThis!=='undefined'?globalThis:this);
