(function(){
'use strict';
  const W=480,H=720;
  function rand(s){s.rng=(Math.imul(s.rng,1664525)+1013904223)>>>0;return s.rng/4294967296;}
  function box(c,x,y,w,h,color){c.fillStyle=color;c.fillRect(x,y,w,h);}
  function text(c,str,x,y,size=18,color='#edf4ff',align='center'){c.fillStyle=color;c.font=`bold ${size}px system-ui`;c.textAlign=align;c.fillText(str,x,y);}
  function dot(c,x,y,r,color){c.fillStyle=color;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();}
  function background(c,color='#11182f'){box(c,0,0,W,H,color);for(let i=0;i<35;i++)dot(c,(i*97+17)%W,(i*131)%H,1,'#ffffff22');}
  function endScreen(s,c,title){if(!s.over)return;box(c,25,245,430,200,'#0b1224ef');text(c,title,240,302,32);text(c,`Score ${s.score}`,240,349,25,'#a7ecff');text(c,'Tap or press Space to play again',240,399,16);}
  // Level data is intentionally small and editable. Add blockers/objectives here later.
  const LEVELS=[{name:'Seedbed',goal:450,moves:18,colors:5},{name:'Moonlit Grove',goal:700,moves:21,colors:5},{name:'Crystal Garden',goal:950,moves:24,colors:6}];
  const COLORS=['#ffa0bc','#7edfa4','#83c8ff','#fbd772','#cfa0ff','#ffac75'];
  const N=8,SIZE=51,X=36,Y=184;
  function matches(board){const found=new Set();for(let y=0;y<8;y++)for(let x=0;x<8;x++){const v=board[y*8+x];if(v<0)continue;if(x<6&&board[y*8+x+1]===v&&board[y*8+x+2]===v){let k=x;while(k<8&&board[y*8+k]===v)found.add(y*8+k++);}if(y<6&&board[(y+1)*8+x]===v&&board[(y+2)*8+x]===v){let k=y;while(k<8&&board[k*8+x]===v)found.add(k++*8+x);}}return [...found];}
  function swaps(board){const out=[];for(let y=0;y<8;y++)for(let x=0;x<8;x++)for(const [dx,dy]of [[1,0],[0,1]]){if(x+dx>=8||y+dy>=8)continue;const a=y*8+x,b=(y+dy)*8+x+dx,copy=board.slice();[copy[a],copy[b]]=[copy[b],copy[a]];const score=matches(copy).length;if(score)out.push({a,b,score});}return out;}
  function makeBoard(s){for(let tries=0;tries<50;tries++){const b=[];for(let y=0;y<8;y++)for(let x=0;x<8;x++){let value=Math.floor(rand(s)*LEVELS[s.level].colors);while((x>=2&&b[y*8+x-1]===value&&b[y*8+x-2]===value)||(y>=2&&b[(y-1)*8+x]===value&&b[(y-2)*8+x]===value))value=(value+1)%LEVELS[s.level].colors;b.push(value);}if(swaps(b).length)return b;}throw Error('Could not make playable board');}
  function startLevel(s){s.board=makeBoard(s);s.movesLeft=LEVELS[s.level].moves;s.levelScore=0;s.phase='idle';s.selected=-1;s.chain=0;s.marked=[];s.wait=0;}
  function init(seed,progress){const s={rng:seed>>>0,tick:0,over:false,won:false,level:0,score:0,totalMoves:0,cleared:0,bestChain:0,levelsWon:0,reshuffles:0,cursor:0,repeat:0,unlocked:progress&&progress.unlocked||1};startLevel(s);return s;}
  function swap(s,a,b){if(a<0||b<0||a>=64||b>=64||Math.abs(a%8-b%8)+Math.abs(Math.floor(a/8)-Math.floor(b/8))!==1)return false;[s.board[a],s.board[b]]=[s.board[b],s.board[a]];const marked=matches(s.board);if(!marked.length){[s.board[a],s.board[b]]=[s.board[b],s.board[a]];return false;}s.marked=marked;s.phase='clear';s.wait=12;s.movesLeft--;s.totalMoves++;s.chain=1;s.selected=-1;return true;}
  function select(s,index){if(s.selected<0)s.selected=index;else if(s.selected===index)s.selected=-1;else if(!swap(s,s.selected,index))s.selected=index;}
  function settle(s){if(s.levelScore>=LEVELS[s.level].goal){s.levelsWon++;s.unlocked=Math.max(s.unlocked,Math.min(3,s.level+2));s.phase='complete';s.wait=75;return;}if(!s.movesLeft){s.over=true;return;}if(!swaps(s.board).length){s.board=makeBoard(s);s.reshuffles++;}s.phase='idle';s.chain=0;}
  function step(s,input){if(s.over)return s;s.tick++;if(s.wait>0){s.wait--;return s;}if(s.phase==='complete'){if(s.level===LEVELS.length-1){s.over=true;s.won=true;}else{s.level++;startLevel(s);}return s;}
    if(s.phase==='clear'){const count=s.marked.length;s.cleared+=count;s.bestChain=Math.max(s.bestChain,s.chain);s.score+=count*10*s.chain;s.levelScore+=count*10*s.chain;for(const index of s.marked)s.board[index]=-1;s.phase='fall';s.wait=8;return s;}
    if(s.phase==='fall'){for(let x=0;x<8;x++){const col=[];for(let y=7;y>=0;y--)if(s.board[y*8+x]>=0)col.push(s.board[y*8+x]);while(col.length<8)col.push(Math.floor(rand(s)*LEVELS[s.level].colors));for(let y=7;y>=0;y--)s.board[y*8+x]=col[7-y];}s.marked=matches(s.board);if(s.marked.length){s.chain++;s.phase='clear';s.wait=10;}else settle(s);return s;}
    const i=input||{};if(s.repeat<=0){let move=i.left?-1:i.right?1:i.up?-8:i.down?8:0;if(move){s.cursor=(s.cursor+64+move)%64;s.repeat=8;}}s.repeat--;
    if(i.actionPressed){let index=s.cursor;if(i.pointer){const x=Math.floor((i.pointer.x-X)/SIZE),y=Math.floor((i.pointer.y-Y)/SIZE);if(x<0||x>=8||y<0||y>=8)return s;index=y*8+x;}select(s,index);}return s;
  }
  function bot(s){if(s.phase!=='idle'||s.wait)return {};let move=swaps(s.board).sort((a,b)=>b.score-a.score)[0];if(!move)return {};const index=s.selected===move.a?move.b:move.a;return {actionPressed:true,pointer:{x:X+(index%8+.5)*SIZE,y:Y+(Math.floor(index/8)+.5)*SIZE,down:true}};}
  // Each botanical rune has its own silhouette, so matches do not rely on colour.
  function rune(c,v,x,y,scale=1){
    c.save();c.translate(x,y);c.scale(scale,scale);
    c.fillStyle='#061d2845';c.beginPath();c.ellipse(0,15,17,5,0,0,Math.PI*2);c.fill();
    const colors=['#e9988c','#9acb92','#88c4d0','#ebc46f','#b5a1cc','#dc9e6e'];
    c.fillStyle=colors[v];c.strokeStyle='#183f3d';c.lineWidth=2;
    c.beginPath();
    if(v===0){for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,r=i%2?10:20;const px=Math.cos(a)*r,py=Math.sin(a)*r;i?c.lineTo(px,py):c.moveTo(px,py);}c.closePath();}
    if(v===1){c.moveTo(-15,12);c.bezierCurveTo(-20,-10,-2,-21,17,-17);c.bezierCurveTo(22,2,11,19,-15,12);}
    if(v===2){c.moveTo(0,-21);c.bezierCurveTo(5,-12,17,0,16,7);c.bezierCurveTo(14,25,-16,25,-16,7);c.bezierCurveTo(-17,0,-5,-12,0,-21);}
    if(v===3){for(let i=0;i<6;i++){const a=i*Math.PI/3;const px=Math.cos(a)*19,py=Math.sin(a)*19;i?c.lineTo(px,py):c.moveTo(px,py);}c.closePath();}
    if(v===4){c.moveTo(0,-21);c.lineTo(16,-5);c.lineTo(10,16);c.lineTo(-10,16);c.lineTo(-16,-5);c.closePath();}
    if(v===5){c.arc(0,3,16,0,Math.PI*2);}
    c.fill();c.stroke();
    c.strokeStyle='#ffffff75';c.lineWidth=2;c.beginPath();
    if(v===1){c.moveTo(-10,9);c.lineTo(10,-10);c.moveTo(0,0);c.lineTo(-7,-4);}
    else if(v===4){c.moveTo(0,-16);c.lineTo(-5,-3);c.lineTo(0,11);c.lineTo(6,-3);c.closePath();}
    else {c.moveTo(-9,-4);c.quadraticCurveTo(-7,-11,0,-11);}
    c.stroke();
    if(v===0||v===3)dot(c,0,0,4,v===0?'#f8dfaa':'#fff0bd');
    if(v===5){box(c,-2,-21,4,8,'#6d8956');c.strokeStyle='#81573f';c.beginPath();c.moveTo(-13,0);c.quadraticCurveTo(0,-8,13,0);c.stroke();}
    c.restore();
  }
  function render(s,c){
    background(c,'#163b37');
    // Leaf borders, etched into a garden journal.
    for(let i=0;i<14;i++)for(const side of [0,1]){
      const x=side?475:5,y=100+i*43;
      c.strokeStyle='#356052';c.lineWidth=1;c.beginPath();c.moveTo(x,y+28);c.quadraticCurveTo(x+(side?-26:26),y+10,x,y);c.stroke();
    }
    text(c,'RUNE GARDEN',29,45,27,'#f3e7c9','left');text(c,`BOTANICAL STUDIES / 0${s.level+1}`,30,69,10,'#a7bf9b','left');
    box(c,29,91,422,69,'#244a3f');text(c,LEVELS[s.level].name,43,118,21,'#efe1bd','left');
    text(c,`${s.levelScore} / ${LEVELS[s.level].goal} points`,43,141,12,'#c0d0b0','left');
    text(c,String(s.movesLeft),431,124,29,'#edc880','right');text(c,'MOVES',431,144,9,'#c0d0b0','right');
    box(c,29,166,422,4,'#0f2d2b');box(c,29,166,422*Math.min(1,s.levelScore/LEVELS[s.level].goal),4,'#c9aa6c');
    box(c,X-7,Y-7,422,422,'#aa9468');box(c,X-4,Y-4,416,416,'#102e2b');
    for(let y=0;y<8;y++)for(let x=0;x<8;x++){
      const index=y*8+x,xx=X+x*SIZE,yy=Y+y*SIZE,v=s.board[index];
      box(c,xx+1,yy+1,SIZE-2,SIZE-2,(x+y)%2?'#24473e':'#294d42');
      if(index===s.selected)box(c,xx+1,yy+1,SIZE-2,SIZE-2,'#667753');
      if(v>=0){const scale=s.phase==='clear'&&s.marked.includes(index)?Math.max(.2,s.wait/12):1;rune(c,v,xx+25.5,yy+25.5,scale);}
      if(index===s.selected||index===s.cursor){c.strokeStyle=index===s.selected?'#f6d993':'#8cae86';c.lineWidth=index===s.selected?2:1;c.strokeRect(xx+3,yy+3,SIZE-6,SIZE-6);}
    }
    text(c,s.chain>1?`CASCADE ×${s.chain}`:'SWAP · MATCH · GROW',240,632,s.chain>1?23:13,'#ead2a1');
    text(c,`Total ${s.score}    /    Best chain ×${s.bestChain}`,240,663,13,'#b9c9a7');
    text(c,'Choose two neighboring runes · Arrows + Space also work',240,694,10,'#94b399');
    if(s.phase==='complete'){box(c,55,312,370,118,'#122e29f5');text(c,'Garden restored',240,362,29,'#e6d09a');text(c,'On to the next grove…',240,397,16);}
    endScreen(s,c,s.won?'Gardens restored!':'Out of moves');
  }
  globalThis.Game={id: "rune-garden",
    guide: {
  "version": 1,
  "summary": "8x8 match-three; adjacent swaps must make a match to cost a move.",
  "goal": "Meet the score goal in all three gardens.",
  "lose": "Use all moves without meeting the current goal.",
  "rules": [
    "8x8 match-three; adjacent swaps must make a match to cost a move. Cascades, refill and dead-board reshuffle. Three score goals 450/700/950 with 18/21/24 moves; final garden adds a sixth color."
  ],
  "controls": [
    {
      "action": "Swap",
      "keyboard": "Arrows select; Space confirms each rune",
      "touch": "Tap two adjacent runes"
    }
  ],
  "firstSteps": [
    "Find two adjacent runes whose swap creates three in a line.",
    "Make the swap and watch the move and objective counters."
  ],
  "tips": [
    "Diagonal runes cannot swap; choose adjacent runes that actually create a match."
  ],
  "modes": []
},
    title:'Rune Garden',width:W,height:H,init,step,bot,render,progress:s=>({unlocked:s.unlocked}),metrics:s=>({score:s.score,moves:s.totalMoves,cleared:s.cleared,best_chain:s.bestChain,levels_won:s.levelsWon,won:s.won?1:0}),rules:{matches,swaps,swap}};

})();
