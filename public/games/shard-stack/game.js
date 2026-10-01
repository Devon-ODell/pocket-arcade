(function () {
  'use strict';
  const W=480,H=720,COLS=8,ROWS=15,CELL=36,X=24,Y=100;
  const CONFIG={columns:COLS,rows:ROWS,gravity:1,lockTicks:30,lockResets:8};
  const NAMES=['I','O','T','S','Z','J','L'];
  const SHAPES=[
    [[0,0],[1,0],[2,0],[3,0]], // I
    [[0,0],[1,0],[0,1],[1,1]], // O
    [[1,0],[0,1],[1,1],[2,1]], // T
    [[1,0],[2,0],[0,1],[1,1]], // S
    [[0,0],[1,0],[1,1],[2,1]], // Z
    [[0,0],[0,1],[1,1],[2,1]], // J
    [[2,0],[0,1],[1,1],[2,1]]  // L
  ];
  const COLORS=['#95bfc7','#eadab1','#cbb7df','#b5e0c4','#d8aabd','#9faee0','#eac29f'];
  function rand(s){s.rng=(Math.imul(s.rng,1664525)+1013904223)>>>0;return s.rng/4294967296;}
  function shape(type,rotation){
    let cells=SHAPES[type].map(p=>p.slice());
    for(let r=0;r<rotation%4;r++)cells=cells.map(([x,y])=>[-y,x]);
    const mx=Math.min(...cells.map(p=>p[0])),my=Math.min(...cells.map(p=>p[1]));
    return cells.map(([x,y])=>[x-mx,y-my]);
  }
  function fits(board,p){
    return shape(p.type,p.rotation).every(([x,y])=>{
      x+=p.x;y+=p.y;
      return x>=0&&x<COLS&&y>=0&&y<ROWS&&board[y*COLS+x]===0;
    });
  }
  function nextType(s){
    if(!s.bag.length){
      s.bag=NAMES.map((_,i)=>i);
      for(let i=s.bag.length-1;i>0;i--){const j=Math.floor(rand(s)*(i+1));[s.bag[i],s.bag[j]]=[s.bag[j],s.bag[i]];}
    }
    return s.bag.pop();
  }
  function resetPiece(s,type){
    const width=Math.max(...shape(type,0).map(p=>p[0]))+1;
    s.piece={type,rotation:0,x:Math.floor((COLS-width)/2),y:0};
    s.fall=0;s.lock=0;s.lockResets=0;s.plan=null;s.planAge=0;
    if(!fits(s.board,s.piece))s.over=true;
  }
  function spawn(s){
    const type=s.next.shift();s.next.push(nextType(s));
    resetPiece(s,type);s.held=false;
  }
  function init(seed){
    const s={rng:seed>>>0,tick:0,over:false,score:0,rows:0,depth:1,
      board:Array(COLS*ROWS).fill(0),bag:[],next:[],stash:-1,held:false,
      pieces:0,fall:0,lock:0,lockResets:0,repeat:0,direction:0,prevUp:false,
      flash:0,fx:[],prevStash:false,streak:0,stashUses:0,maxHeight:0,plan:null,planAge:0};
    s.next=[nextType(s),nextType(s)];spawn(s);return s;
  }
  function clearRows(board){
    let count=0;
    for(let y=ROWS-1;y>=0;y--){
      if(board.slice(y*COLS,(y+1)*COLS).every(Boolean)){
        board.splice(y*COLS,COLS);board.unshift(...Array(COLS).fill(0));count++;y++;
      }
    }
    return count;
  }
  function rowScore(rows){return [0,100,300,600,1000][Math.min(rows,4)];}
  function lock(s){
    if(!fits(s.board,s.piece)){s.over=true;return;}
    for(const[x,y]of shape(s.piece.type,s.piece.rotation)){
      const yy=y+s.piece.y;s.board[yy*COLS+x+s.piece.x]=s.piece.type+1;
      s.maxHeight=Math.max(s.maxHeight,ROWS-yy);
    }
    s.pieces++;
    const cleared=clearRows(s.board);
    s.rows+=cleared;s.streak=cleared?s.streak+1:0;
    s.score+=rowScore(cleared)*s.depth+Math.max(0,s.streak-1)*50*s.depth;
    if(cleared){s.flash=12;s.fx.push({k:"sound",s:"clear",n:cleared});}
    spawn(s);
  }
  function grounded(s){return !fits(s.board,{...s.piece,y:s.piece.y+1});}
  function move(s,p){
    if(!fits(s.board,p))return false;
    const touched=grounded(s);s.piece=p;
    if(touched&&s.lockResets<CONFIG.lockResets){s.lock=0;s.lockResets++;}
    return true;
  }
  function rotate(s){
    const r=(s.piece.rotation+1)%4;
    // Normalized rotations can grow the I piece by three cells at a wall/floor.
    for(const[dx,dy]of [[0,0],[-1,0],[1,0],[-2,0],[2,0],[-3,0],[3,0],[0,-1],[0,-2],[0,-3]]){
      if(move(s,{...s.piece,rotation:r,x:s.piece.x+dx,y:s.piece.y+dy}))return true;
    }
    return false;
  }
  function stash(s){
    if(s.held||s.over)return false;
    const old=s.piece.type;
    if(s.stash<0)spawn(s);else resetPiece(s,s.stash);
    s.stash=old;s.held=true;s.stashUses++;return true;
  }
  function step(s,input){
    if(s.over)return s;
    const i=input||{};s.tick++;s.fx=[];s.flash=Math.max(0,s.flash-1);
    let left=!!i.left,right=!!i.right,up=!!i.up,down=!!i.down;
    let drop=!!i.actionPressed&&!i.pointer,hold=!!i.stash;
    const p=i.pointer;
    if(p&&(p.down||i.actionPressed)){
      // Held movement/drop buttons must remain active after the first pointer tick.
      // A tap outside a button never hard-drops the current piece.
      if(p.x>=0&&p.x<W&&p.y>=654&&p.y<705){
        const b=Math.floor(p.x/80);
        left=left||b===0;right=right||b===1;down=down||b===3;
        up=up||(b===2&&!!i.actionPressed);
        drop=b===4&&!!i.actionPressed;hold=hold||(b===5&&!!i.actionPressed);
      }else if(p.x>=330&&p.x<W&&p.y>=414&&p.y<522&&i.actionPressed)hold=true;
    }
    const stashPressed=hold&&!s.prevStash;s.prevStash=hold;
    if(stashPressed&&stash(s))return s;
    const dir=left===right?0:right?1:-1;
    if(dir&&(dir!==s.direction||s.repeat<=0)){
      move(s,{...s.piece,x:s.piece.x+dir});s.repeat=dir!==s.direction?12:3;
    }
    s.direction=dir;s.repeat=Math.max(0,s.repeat-1);
    if(up&&!s.prevUp)rotate(s);s.prevUp=up;
    if(drop){while(fits(s.board,{...s.piece,y:s.piece.y+1}))s.piece.y++;lock(s);return s;}
    s.fall+=CONFIG.gravity*(down?4:1);
    if(s.fall>=60){
      s.fall-=60;
      if(fits(s.board,{...s.piece,y:s.piece.y+1}))s.piece.y++;
    }
    if(grounded(s)){s.lock++;if(s.lock>=CONFIG.lockTicks)lock(s);}
    return s;
  }
  // A deterministic placement baseline. M1b adds stash search and fixed casual noise.
  function plan(s){
    let best=null,value=-1e9;
    for(let r=0;r<4;r++)for(let x=0;x<COLS;x++){
      const p={type:s.piece.type,rotation:r,x,y:s.piece.y};
      if(!fits(s.board,p))continue;
      while(fits(s.board,{...p,y:p.y+1}))p.y++;
      const b=s.board.slice();
      for(const[xx,yy]of shape(p.type,r))b[(yy+p.y)*COLS+xx+x]=1;
      const lines=clearRows(b);let holes=0,height=0,bump=0,last=0;
      for(let col=0;col<COLS;col++){
        let top=ROWS;
        for(let y=0;y<ROWS;y++)if(b[y*COLS+col]){top=y;break;}
        const h=ROWS-top;height+=h;if(col)bump+=Math.abs(h-last);last=h;
        for(let y=top;y<ROWS;y++)if(!b[y*COLS+col])holes++;
      }
      const v=lines*12-height*.45-holes*5-bump*.3;
      if(v>value){value=v;best={x,r};}
    }
    return best;
  }
  function bot(s){
    if(s.tick%3)return {};
    if(!s.plan)s.plan=plan(s);
    // A blocked route must not spin until the simulation cap; gravity still applies.
    if(!s.plan||s.planAge++>20)return {actionPressed:true};
    if(s.piece.rotation!==s.plan.r)return {up:!s.prevUp};
    if(s.piece.x!==s.plan.x)return {left:s.piece.x>s.plan.x,right:s.piece.x<s.plan.x};
    return {actionPressed:true};
  }
  function box(c,x,y,w,h,color){c.fillStyle=color;c.fillRect(x,y,w,h);}
  function text(c,str,x,y,size=18,color='#f0ebdf',align='center'){
    c.fillStyle=color;c.font=`bold ${size}px system-ui`;c.textAlign=align;c.fillText(str,x,y);
  }
  // Faceted mineral tiles. The inset outline keeps adjacent pieces readable.
  function tile(c,x,y,color,size=CELL){
    box(c,x+1,y+2,size-2,size-2,'#071b23');
    box(c,x+2,y+1,size-4,size-5,color);
    c.fillStyle='#ffffff60';c.beginPath();c.moveTo(x+2,y+1);c.lineTo(x+size-2,y+1);
    c.lineTo(x+size-8,y+7);c.lineTo(x+8,y+7);c.lineTo(x+8,y+size-9);c.lineTo(x+2,y+size-5);c.fill();
    c.fillStyle='#10293250';c.beginPath();c.moveTo(x+size-2,y+1);c.lineTo(x+size-2,y+size-5);
    c.lineTo(x+2,y+size-5);c.lineTo(x+8,y+size-11);c.lineTo(x+size-8,y+size-11);c.lineTo(x+size-8,y+7);c.fill();
    box(c,x+size*.38,y+size*.32,Math.max(2,size*.14),2,'#ffffff80');
  }
  function render(s,c,ui){
    box(c,0,0,W,H,'#10272e');
    // Quiet strata behind the well; no animated wallpaper competing with the pieces.
    for(let i=0;i<9;i++){
      c.fillStyle=i%2?'#153139':'#19353c';c.beginPath();c.moveTo(320,65+i*68);
      c.lineTo(480,32+i*68);c.lineTo(480,82+i*68);c.lineTo(320,110+i*68);c.fill();
    }
    box(c,24,25,4,34,'#edbd76');text(c,'SHARD STACK',39,45,26,'#f2e9d5','left');
    text(c,'01 / THE MINERAL VAULT',40,65,10,'#9cb9b8','left');
    text(c,'← → MOVE   ↑ ROTATE   SPACE DROP   C HOLD',24,85,10,'#9cb9b8','left');
    box(c,X-5,Y-5,COLS*CELL+10,ROWS*CELL+10,'#3f6065');
    box(c,X-2,Y-2,COLS*CELL+4,ROWS*CELL+4,'#091b24');
    for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){
      const xx=X+x*CELL,yy=Y+y*CELL,v=s.board[y*COLS+x];
      box(c,xx,yy,CELL,CELL,(x+y)%2?'#10232b':'#12262e');
      box(c,xx,yy,1,1,'#365058');
      if(v)tile(c,xx,yy,COLORS[v-1]);
    }
    if(!s.over){
      const landing={...s.piece};while(fits(s.board,{...landing,y:landing.y+1}))landing.y++;
      for(const[x,y]of shape(landing.type,landing.rotation)){
        c.strokeStyle='#8aa8a4';c.lineWidth=1;
        c.strokeRect(X+(landing.x+x)*CELL+4,Y+(landing.y+y)*CELL+4,CELL-8,CELL-8);
        box(c,X+(landing.x+x)*CELL+8,Y+(landing.y+y+1)*CELL-5,CELL-16,2,'#edbd76');
      }
      const visualFall=grounded(s)?0:Math.min(1,s.fall/60);
      for(const[x,y]of shape(s.piece.type,s.piece.rotation))tile(c,X+(s.piece.x+x)*CELL,Y+(s.piece.y+y+visualFall)*CELL,COLORS[s.piece.type]);
    }
    box(c,330,100,126,94,'#0d222a');text(c,'SCORE',343,122,10,'#9cb9b8','left');
    text(c,String(s.score).padStart(5,'0'),343,155,27,'#f2e9d5','left');
    text(c,`${s.rows} ROWS CLEARED`,343,179,10,'#d2ac74','left');
    text(c,'NEXT SHARDS',343,221,10,'#9cb9b8','left');
    s.next.forEach((t,j)=>{box(c,330,234+j*84,126,76,'#0d222a');shape(t,0).forEach(([x,y])=>tile(c,348+x*24,240+j*84+y*24,COLORS[t],24));});
    box(c,330,414,126,108,'#0d222a');text(c,'HOLD / C',343,433,10,'#9cb9b8','left');
    if(s.stash>=0)shape(s.stash,0).forEach(([x,y])=>tile(c,348+x*24,442+y*24,COLORS[s.stash],24));
    else text(c,'EMPTY',393,482,12,'#647f83');
    text(c,s.held?'LOCKED UNTIL DROP':'TAP TO EXCHANGE',393,539,9,'#9cb9b8');
    text(c,'CHAIN',343,578,10,'#9cb9b8','left');text(c,'×'+s.streak,343,609,27,'#edbd76','left');
    if(s.flash)box(c,X,Y,COLS*CELL,ROWS*CELL,`rgba(240,225,193,${s.flash/150})`);
    ['←','→','↻','↓','DROP','HOLD'].forEach((v,i)=>{
      box(c,i*80+4,658,72,47,'#071b23');box(c,i*80+4,654,72,47,i===4?'#edbd76':'#2e4a51');
      text(c,v,i*80+40,684,v.length>1?11:23,i===4?'#12272c':'#eee7d5');
    });
    if(s.over){box(c,30,269,420,147,'#091c27f5');box(c,30,269,420,3,'#edbd76');text(c,'The vault is full',240,307,28);
      const bestText=ui&&ui.best?`BEST ${ui.best} · `:'';
      text(c,`${bestText}${s.rows} rows · ${s.score} points`,240,348,19);text(c,'Tap or Space to try again',240,387,14,'#a9c4c0');}
  }
  globalThis.Game={id: "shard-stack",
    guide: {
  "version": 1,
  "summary": "Endless 8x15 well; seven tetrominoes I/O/T/S/Z/J/L, one of each per bag, two previews, one hold per locked piece.",
  "goal": "Endless has no final win: clear rows and improve your score.",
  "lose": "A new piece cannot spawn.",
  "rules": [
    "Endless 8x15 well; seven tetrominoes I/O/T/S/Z/J/L, one of each per bag, two previews, one hold per locked piece. Rows score 100/300/600/1000 with consecutive-clear bonuses. Depth currently stays at one."
  ],
  "controls": [
    {
      "action": "Move",
      "keyboard": "Left / Right",
      "touch": "Hold arrow buttons"
    },
    {
      "action": "Rotate / soft drop",
      "keyboard": "Up / Down",
      "touch": "Rotate / down buttons"
    },
    {
      "action": "Hard drop",
      "keyboard": "Space",
      "touch": "DROP"
    },
    {
      "action": "Hold",
      "keyboard": "C / Shift",
      "touch": "HOLD"
    }
  ],
  "firstSteps": [
    "Move a piece toward the landing outline.",
    "Complete a row while leaving room for the four-cell line."
  ],
  "tips": [
    "Do not cover empty holes; hold a piece before hard-dropping when the landing is poor."
  ],
  "modes": []
},
    title:'Shard Stack',width:W,height:H,init,step,bot,render,autoJuice:false,
    progress:()=>({unlocked:1}),metrics:s=>({score:s.score,rows:s.rows,pieces:s.pieces,depth:s.depth,
      stash_uses:s.stashUses,max_height:s.maxHeight}),
    rules:{fits,clearRows,shape,nextType,spawn,rotate,stash,lock,rowScore,config:CONFIG,names:NAMES}};
})();
