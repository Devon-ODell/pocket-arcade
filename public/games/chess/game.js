// Original local chess rules and opponent; no services, engine downloads or DOM.
(function () {
  'use strict';
  const W=480,H=720,X=32,Y=155,C=52;
  const VALUE=[0,100,320,335,500,900,20000],GLYPH=['','♟','♞','♝','♜','♛','♚'];
  const DIRS=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
  const KNIGHT=[[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]];
  const inside=(x,y)=>x>=0&&x<8&&y>=0&&y<8;
  const name=i=>'abcdefgh'[i%8]+(8-Math.floor(i/8));
  function rand(s){s.rng=(Math.imul(s.rng,1664525)+1013904223)>>>0;return s.rng/4294967296;}
  function attacked(p,square,by){
    const b=p.board,x=square%8,y=Math.floor(square/8);
    for(const dx of [-1,1]){const xx=x+dx,yy=y+by;if(inside(xx,yy)&&b[yy*8+xx]===by)return true;}
    for(const [dx,dy]of KNIGHT){if(inside(x+dx,y+dy)&&b[(y+dy)*8+x+dx]===by*2)return true;}
    for(let n=0;n<8;n++){
      const[dx,dy]=DIRS[n];let xx=x+dx,yy=y+dy,d=1;
      while(inside(xx,yy)){
        const v=b[yy*8+xx];
        if(v){if(Math.sign(v)===by&&(Math.abs(v)===5||Math.abs(v)===(n<4?4:3)||(d===1&&Math.abs(v)===6)))return true;break;}
        xx+=dx;yy+=dy;d++;
      }
    }return false;
  }
  function inCheck(p,side=p.turn){const k=p.board.indexOf(side*6);return k<0||attacked(p,k,-side);}
  function pseudo(p){
    const moves=[],b=p.board,side=p.turn;
    function add(from,to,extra={}){
      if(Math.abs(b[to])===6)return;
      if(Math.abs(b[from])===1&&(to<8||to>=56))for(const promotion of [5,4,3,2])moves.push({from,to,promotion,...extra});
      else moves.push({from,to,...extra});
    }
    for(let from=0;from<64;from++){
      const v=b[from];if(Math.sign(v)!==side)continue;
      const kind=Math.abs(v),x=from%8,y=Math.floor(from/8);
      if(kind===1){
        const ny=y-side,to=ny*8+x;
        if(inside(x,ny)&&!b[to]){add(from,to);if(y===(side===1?6:1)&&!b[(y-2*side)*8+x])add(from,(y-2*side)*8+x);}
        for(const dx of [-1,1])if(inside(x+dx,ny)){
          const q=ny*8+x+dx;
          if(b[q]&&Math.sign(b[q])===-side)add(from,q);
          else if(q===p.ep&&!b[q]&&b[q+side*8]===-side)add(from,q,{ep:true});
        }
      }else if(kind===2||kind===6){
        for(const[dx,dy]of kind===2?KNIGHT:DIRS){const xx=x+dx,yy=y+dy;if(inside(xx,yy)&&Math.sign(b[yy*8+xx])!==side)add(from,yy*8+xx);}
        if(kind===6){
          const home=side===1?60:4,bits=side===1?1:4;
          if(from===home&&!inCheck(p)){
            if((p.castle&bits)&&b[home+3]===side*4&&!b[home+1]&&!b[home+2]&&!attacked(p,home+1,-side)&&!attacked(p,home+2,-side))add(from,home+2,{castle:true});
            if((p.castle&(bits*2))&&b[home-4]===side*4&&!b[home-1]&&!b[home-2]&&!b[home-3]&&!attacked(p,home-1,-side)&&!attacked(p,home-2,-side))add(from,home-2,{castle:true});
          }
        }
      }else{
        for(let n=0;n<8;n++){
          if(kind===3&&n<4||kind===4&&n>=4)continue;
          const[dx,dy]=DIRS[n];let xx=x+dx,yy=y+dy;
          while(inside(xx,yy)){const to=yy*8+xx;if(Math.sign(b[to])===side)break;add(from,to);if(b[to])break;xx+=dx;yy+=dy;}
        }
      }
    }return moves;
  }
  function apply(p,m){
    const b=p.board.slice(),piece=b[m.from],capture=b[m.to]||m.ep;
    b[m.to]=m.promotion?Math.sign(piece)*m.promotion:piece;b[m.from]=0;
    if(m.ep)b[m.to+p.turn*8]=0;
    if(m.castle){const rook=m.to>m.from?m.from+3:m.from-4;b[(m.from+m.to)/2]=b[rook];b[rook]=0;}
    let rights=p.castle;
    if(piece===6)rights&=~3;if(piece===-6)rights&=~12;
    for(const[sq,bit]of [[63,1],[56,2],[7,4],[0,8]])if(m.from===sq||m.to===sq)rights&=~bit;
    return{board:b,turn:-p.turn,castle:rights,ep:Math.abs(piece)===1&&Math.abs(m.to-m.from)===16?(m.to+m.from)/2:-1,halfmove:Math.abs(piece)===1||capture?0:p.halfmove+1};
  }
  function legal(p){const side=p.turn;return pseudo(p).filter(m=>!inCheck(apply(p,m),side));}
  function key(p,moves){return p.board.join(',')+'/'+p.turn+'/'+p.castle+'/'+((moves||legal(p)).some(m=>m.ep)?p.ep:-1);}
  function insufficient(p){
    const men=p.board.map((v,i)=>({v:Math.abs(v),i})).filter(o=>o.v&&o.v!==6);
    return !men.length||(men.length===1&&men[0].v<=3)||men.every(o=>o.v===3)&&new Set(men.map(o=>(o.i%8+Math.floor(o.i/8))%2)).size===1;
  }
  function init(seed,progress){
    const b=Array(64).fill(0),back=[4,2,3,5,6,3,2,4];
    for(let x=0;x<8;x++){b[x]=-back[x];b[x+8]=-1;b[x+48]=1;b[x+56]=back[x];}
    const p={board:b,turn:1,castle:15,ep:-1,halfmove:0};
    const s={...p,rng:seed>>>0||1,tick:0,over:false,score:0,winner:0,reason:'',selected:-1,cursor:52,wait:0,moves:0,captures:0,last:null,log:[],promotion:null,history:{},claimable:false,checked:false,fx:[],difficulty:progress===undefined?seed%3:Math.max(0,Math.min(2,Number.isInteger(progress.difficulty)?progress.difficulty:1)),humanMove:0};
    s.history[key(s)]=1;return s;
  }
  function evaluate(p){
    let score=0;
    for(let i=0;i<64;i++){const v=p.board[i];if(!v)continue;const side=Math.sign(v),type=Math.abs(v),x=i%8,y=Math.floor(i/8),advance=side===1?6-y:y-1;
      const centre=7-Math.abs(3.5-x)-Math.abs(3.5-y);
      score+=side*(VALUE[type]+(type===1?advance*9:0)+(type===2||type===3?centre*9:type===6?-centre*3:centre*2));
    }return score;
  }
  function search(p,depth,alpha,beta){
    if(!depth)return evaluate(p)*p.turn;
    const moves=legal(p);if(!moves.length)return inCheck(p)?-100000-depth:0;
    if(insufficient(p)||p.halfmove>=150)return 0;
    moves.sort((a,b)=>(VALUE[Math.abs(p.board[b.to])]+(b.promotion?800:0))-(VALUE[Math.abs(p.board[a.to])]+(a.promotion?800:0)));
    let best=-1e9;
    for(const m of moves){const value=-search(apply(p,m),depth-1,-beta,-alpha);best=Math.max(best,value);alpha=Math.max(alpha,value);if(alpha>=beta)break;}
    return best;
  }
  function choose(s,level){
    const moves=legal(s);if(!moves.length)return null;
    if(level===0&&rand(s)<.55)return moves[Math.floor(rand(s)*moves.length)];
    let best=null,value=-1e9;
    for(const m of moves){const p=apply(s,m);let v=-search(p,level===2?1:0,-1e9,1e9);
      // Avoid free captures even at medium strength, without hiding enemy information.
      if(attacked(p,m.to,p.turn))v-=VALUE[Math.abs(p.board[m.to])]*.55;
      v+=rand(s)*8;
      if(v>value){value=v;best=m;}
    }return best;
  }
  function finish(s,winner,reason){s.over=true;s.winner=winner;s.reason=reason;s.score=winner===1?500:winner===0?150:50;s.fx.push({k:'sound',s:winner===1?'win':'level'});}
  function play(s,move){
    const m=legal(s).find(m=>m.from===move.from&&m.to===move.to&&(m.promotion||0)===(move.promotion||0));if(!m||s.over)return false;
    const capture=!!s.board[m.to]||!!m.ep;
    const label=m.castle?(m.to>m.from?'O-O':'O-O-O'):name(m.from)+(capture?'×':'–')+name(m.to)+(m.promotion?'='+['','','N','B','R','Q'][m.promotion]:'');
    Object.assign(s,apply(s,m));s.moves++;if(capture)s.captures++;s.last={from:m.from,to:m.to};s.selected=-1;s.promotion=null;s.wait=25;s.log.push(label);s.log=s.log.slice(-6);
    const moves=legal(s),k=key(s,moves);s.history[k]=(s.history[k]||0)+1;s.checked=inCheck(s);s.claimable=s.halfmove>=100||s.history[k]>=3;
    s.fx.push({k:'sound',s:capture?'thud':'pick'});
    if(!moves.length)finish(s,s.checked?-s.turn:0,s.checked?'Checkmate':'Stalemate');
    else if(insufficient(s))finish(s,0,'Insufficient material');
    else if(s.history[k]>=5)finish(s,0,'Fivefold repetition');
    else if(s.halfmove>=150)finish(s,0,'75-move draw');
    return true;
  }
  function select(s,square){
    if(square<0||square>=64)return;
    if(s.selected>=0){const choices=legal(s).filter(m=>m.from===s.selected&&m.to===square);
      if(choices.some(m=>m.promotion)){s.promotion={from:s.selected,to:square};return;}
      if(choices.length){play(s,choices[0]);return;}
    }
    s.selected=s.board[square]>0?square:-1;s.cursor=square;
  }
  function step(s,input){
    if(s.over)return s;s.tick++;s.fx=[];const i=input||{};
    if(s.wait){s.wait--;return s;}
    if(s.turn===-1){if(s.claimable)finish(s,0,'Draw claimed');else{const m=choose(s,s.difficulty);if(m)play(s,m);}return s;}
    if(i.claim&&s.claimable){finish(s,0,'Draw claimed');return s;}
    if(i.move){play(s,i.move);return s;}
    if(s.promotion){if(i.actionPressed){let n=0;if(i.pointer)n=Math.floor((i.pointer.x-32)/104);if(!i.pointer||i.pointer.y>=603&&i.pointer.y<665){const promotion=[5,4,3,2][n];if(promotion)play(s,{...s.promotion,promotion});}}return s;}
    if(s.tick%7===0){if(i.left)s.cursor=(s.cursor+63)%64;if(i.right)s.cursor=(s.cursor+1)%64;if(i.up)s.cursor=(s.cursor+56)%64;if(i.down)s.cursor=(s.cursor+8)%64;}
    if(i.actionPressed){
      if(i.pointer){const p=i.pointer;if(p.y>=640&&p.y<687&&s.claimable){finish(s,0,'Draw claimed');return s;}
        const x=Math.floor((p.x-X)/C),y=Math.floor((p.y-Y)/C);if(inside(x,y))select(s,y*8+x);
      }else select(s,s.cursor);
    }return s;
  }
  function bot(s){if(s.wait||s.turn!==1)return{};if(s.claimable)return{claim:true};return{move:choose(s,1)};}
  function text(c,t,x,y,size=16,color='#f1e9d1',align='left'){c.fillStyle=color;c.font=`600 ${size}px system-ui`;c.textAlign=align;c.fillText(t,x,y);}
  // Drawn silhouettes avoid platform-dependent chess fonts and keep both armies legible.
  function piece(c,type,x,y,white){
    c.save();c.translate(x,y);c.fillStyle='#142b2b40';c.beginPath();c.ellipse(0,18,18,4,0,0,Math.PI*2);c.fill();
    const fill=white?'#faf0d4':'#233c42',edge=white?'#7e775f':'#0d252c';
    c.fillStyle=fill;c.strokeStyle=edge;c.lineWidth=1.5;c.lineJoin='round';
    const polygon=points=>{c.beginPath();points.forEach(([xx,yy],i)=>i?c.lineTo(xx,yy):c.moveTo(xx,yy));c.closePath();c.fill();c.stroke();};
    const ball=(xx,yy,r)=>{c.beginPath();c.arc(xx,yy,r,0,Math.PI*2);c.fill();c.stroke();};
    if(type===1){polygon([[-10,14],[-5,2],[-5,-3],[5,-3],[5,2],[10,14]]);ball(0,-10,7);}
    if(type===2){polygon([[-13,14],[-10,2],[-3,-7],[-12,-4],[-15,-9],[-6,-17],[-6,-23],[2,-20],[8,-17],[13,-4],[10,14]]);c.fillStyle=white?'#374b47':'#ecdbad';c.fillRect(-2,-14,3,3);c.fillStyle=fill;}
    if(type===3){polygon([[-11,14],[-5,1],[-5,-4],[5,-4],[5,1],[11,14]]);polygon([[0,-23],[-8,-12],[-6,-5],[6,-5],[8,-12]]);c.beginPath();c.moveTo(3,-19);c.lineTo(-2,-10);c.stroke();}
    if(type===4){polygon([[-10,14],[-7,-7],[-12,-10],[-12,-22],[-6,-22],[-6,-16],[-3,-16],[-3,-22],[3,-22],[3,-16],[6,-16],[6,-22],[12,-22],[12,-10],[7,-7],[10,14]]);}
    if(type===5){polygon([[-11,14],[-6,-3],[-12,-18],[-5,-12],[0,-23],[5,-12],[12,-18],[6,-3],[11,14]]);for(const[xx,yy]of[[-12,-19],[0,-24],[12,-19]])ball(xx,yy,2.5);}
    if(type===6){polygon([[-11,14],[-6,-3],[-9,-13],[9,-13],[6,-3],[11,14]]);polygon([[-3,-13],[-3,-19],[-8,-19],[-8,-23],[-3,-23],[-3,-28],[3,-28],[3,-23],[8,-23],[8,-19],[3,-19],[3,-13]]);}
    c.fillStyle=fill;polygon([[-15,14],[15,14],[17,19],[-17,19]]);
    c.strokeStyle=white?'#ffffffb0':'#6b8381';c.lineWidth=1;c.beginPath();c.moveTo(-12,15);c.lineTo(12,15);c.stroke();c.restore();
  }
  function render(s,c){
    c.fillStyle='#132d2d';c.fillRect(0,0,W,H);text(c,'CHESS',30,43,32);text(c,'A QUIET TABLE. A SHARP OPPONENT.',32,66,10,'#a7b9a8');
    text(c,s.over?s.reason:s.promotion?'Choose your promotion':s.checked?'CHECK · protect your king':s.turn===1?'Your move · White':'Black is thinking…',32,110,20,s.checked?'#f1a681':'#e6d19e');
    text(c,s.over?(s.winner===1?'You win':s.winner===-1?'Black wins':'Draw'):'Tap a piece, then a highlighted square.',32,136,12,'#a8c6b7');
    const targets=s.selected>=0?legal(s).filter(m=>m.from===s.selected).map(m=>m.to):[];
    c.fillStyle='#081f25';c.fillRect(X-8,Y-5,C*8+16,C*8+18);c.fillStyle='#ad9063';c.fillRect(X-6,Y-8,C*8+12,C*8+16);c.fillStyle='#304b45';c.fillRect(X-2,Y-2,C*8+4,C*8+4);
    for(let y=0;y<8;y++)for(let x=0;x<8;x++){
      const n=y*8+x,xx=X+x*C,yy=Y+y*C;c.fillStyle=(x+y)%2?'#729087':'#e2d7b9';c.fillRect(xx,yy,C,C);
      if(s.last&&(n===s.last.from||n===s.last.to)){c.fillStyle='#d6bb5070';c.fillRect(xx,yy,C,C);}
      if(n===s.selected){c.fillStyle='#f6d477aa';c.fillRect(xx,yy,C,C);}
      if(targets.includes(n)){c.fillStyle='#123c3380';c.beginPath();c.arc(xx+C/2,yy+C/2,s.board[n]?22:6,0,Math.PI*2);s.board[n]?(c.lineWidth=3,c.strokeStyle='#b97b3a',c.stroke()):c.fill();}
      const v=s.board[n];if(v)piece(c,Math.abs(v),xx+C/2,yy+29,v>0);
      if(n===s.cursor&&!s.over){c.strokeStyle='#efbd53';c.lineWidth=2;c.strokeRect(xx+3,yy+3,C-6,C-6);}
    }
    for(let i=0;i<8;i++){text(c,'abcdefgh'[i],X+i*C+26,590,11,'#b3c5b4','center');text(c,String(8-i),18,Y+i*C+31,11,'#b3c5b4','center');}
    text(c,`${Math.ceil(s.moves/2)} moves · ${s.captures} captures`,32,618,12,'#a8c6b7');text(c,s.log.slice(-3).join('   '),32,640,12,'#e6d19e');
    if(s.promotion){c.fillStyle='#102423';c.fillRect(22,596,436,88);[5,4,3,2].forEach((p,n)=>{c.fillStyle='#3e6356';c.fillRect(32+n*104,603,96,62);text(c,['','','Knight','Bishop','Rook','Queen'][p],80+n*104,639,14,'#fff1cb','center');});}
    else if(s.claimable&&!s.over){c.fillStyle='#405e50';c.fillRect(32,650,416,37);text(c,'CLAIM DRAW',240,675,13,'#f3ddb0','center');}
    text(c,s.over?'Tap / Space for a rematch':'Arrows + Space also work · AI slider above',240,706,11,'#a8c6b7','center');
  }
  globalThis.Game={id: "chess",
    guide: {
  "version": 1,
  "summary": "Standard legal chess, human White, three AI settings; castling, en passant, four promotions and supported draw rules.",
  "goal": "Checkmate the opponent. Stalemate and supported draw conditions produce a draw.",
  "lose": "Being checkmated loses; stalemate and supported draw conditions draw.",
  "rules": [
    "Standard legal chess, human White, three AI settings; castling, en passant, four promotions and supported draw rules. Threefold/50-move claims, automatic fivefold/75-move draws. Keyboard promotion currently defaults to queen; no clock/campaign."
  ],
  "controls": [
    {
      "action": "Move a piece",
      "keyboard": "Arrows + Space for origin/destination",
      "touch": "Tap origin then destination"
    },
    {
      "action": "Promotion / draw claim",
      "keyboard": "Current promotion defaults to queen; use visible choice/claim buttons",
      "touch": "Tap promotion choice or Claim draw"
    }
  ],
  "firstSteps": [
    "Select a white piece and a legal highlighted destination.",
    "Keep your king safe; if checked, choose a move that removes the check."
  ],
  "tips": [
    "You cannot leave your own king in check; not every apparent capture is legal."
  ],
  "modes": []
},
    title:'Chess',width:W,height:H,init,step,bot,render,autoJuice:false,settings:{difficulty:true},progress:s=>({difficulty:s.difficulty}),metrics:s=>({score:s.score,moves:s.moves,captures:s.captures,won:s.winner===1?1:0,draw:s.over&&s.winner===0?1:0}),rules:{legal,apply,attacked,inCheck,insufficient,play,key,choose}};
})();
