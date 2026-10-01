(function(){
'use strict';
  const W=480,H=720;
  function rand(s){s.rng=(Math.imul(s.rng,1664525)+1013904223)>>>0;return s.rng/4294967296;}
  // The bot draws from its own stream so its choices never shift the game's rng.
  function botRand(b){b.rng=(Math.imul(b.rng,1664525)+1013904223)>>>0;return b.rng/4294967296;}
  function box(c,x,y,w,h,color){c.fillStyle=color;c.fillRect(x,y,w,h);}
  function text(c,str,x,y,size=18,color='#edf4ff',align='center'){c.fillStyle=color;c.font=`bold ${size}px system-ui`;c.textAlign=align;c.fillText(str,x,y);}
  function dot(c,x,y,r,color){c.fillStyle=color;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();}
  function background(c,color='#11182f'){box(c,0,0,W,H,color);for(let i=0;i<35;i++)dot(c,(i*97+17)%W,(i*131)%H,1,'#ffffff22');}
  function endScreen(s,c,title){if(!s.over)return;box(c,25,245,430,200,'#0b1224ef');text(c,title,240,302,32);text(c,`Score ${s.score}`,240,349,25,'#a7ecff');text(c,'Tap or press Space to play again',240,399,16);}
  // World coordinates in pixels. Extend LEVELS with pits, ledges, checkpoints and foes.
  const CONFIG={speed:240,acceleration:1800,jump:550,riseGravity:1500,fallGravity:2300,coyote:6,buffer:6};
  const GROUND=580,PW=26,PH=34;
  const LEVELS=[
    {name:'Ashwood Approach',width:1800,pits:[[420,495],[970,1050]],ledges:[[230,485,100],[730,460,120],[1330,480,100]],enemies:[820,1420],sky:'#162643',accent:'#74dba6'},
    {name:'Rain Caves',width:2100,pits:[[400,480],[900,985],[1440,1530]],ledges:[[250,478,100],[710,454,100],[1230,470,100],[1720,448,140]],enemies:[700,1260,1780],sky:'#142438',accent:'#7bbfff'},
    {name:'The Ember Gate',width:2500,pits:[[460,540],[1090,1180]],ledges:[[270,475,100],[870,470,100],[1420,465,130]],enemies:[820,1440],sky:'#302038',accent:'#f3b47a',boss:true}
  ];
  function prepare(s){const l=LEVELS[s.level];s.x=55;s.y=GROUND-PH;s.vx=0;s.vy=0;s.grounded=true;s.coyote=6;s.buffer=0;s.checkpoint=55;s.camera=0;s.foes=l.enemies.map(x=>({x,origin:x,alive:true}));s.sparks=Array.from({length:Math.floor(l.width/150)-1},(_,i)=>({x:160+i*150,y:GROUND-65,taken:false}));s.boss={x:2220,hp:l.boss?3:0,phase:0};s.transition=0;}
  function botSeed(seed){const r={rng:((seed>>>0)^0x9e3779b9)>>>0};r.look=46+Math.floor(botRand(r)*16);r.miss=0.04+botRand(r)*0.07;r.hesitate=0;return r;}
  function init(seed,progress){const s={rng:seed>>>0,bot:botSeed(seed),tick:0,over:false,won:false,score:0,level:0,lives:5,levelsCleared:0,deaths:0,coins:0,invul:0,prevAction:false,fx:[],combo:0,wasGrounded:true,unlocked:progress&&progress.unlocked||1};prepare(s);return s;}
  function fx(s,e){if(e.k==='sound'&&s.fx.length<40)s.fx.push(e);}
  function hurt(s){if(s.invul)return;s.lives--;s.deaths++;s.invul=85;s.combo=0;
    fx(s,{k:'shake',m:15});fx(s,{k:'flash',a:0.36,c:'#ff5470'});fx(s,{k:'sound',s:'hit'});
    fx(s,{k:'burst',x:s.x-s.camera+13,y:s.y+18,n:16,c:'#ff8a5b',spd:3.6});if(s.lives<=0){s.over=true;return;}s.x=s.checkpoint;s.y=GROUND-PH;s.vx=0;s.vy=0;}
  function step(s,input){if(s.over)return s;s.tick++;s.fx.length=0;   // the shell drains it each tick
    if(s.invul)s.invul--;if(s.transition){if(--s.transition===0){s.level++;prepare(s);}return s;}const i=input||{},l=LEVELS[s.level];let left=i.left,right=i.right,jump=(i.action&&!i.pointer)||i.up;
    if(i.pointer&&i.pointer.down&&i.pointer.y>630){if(i.pointer.x<250){left=i.pointer.x<110;right=i.pointer.x>=110;}if(i.pointer.x>=300)jump=true;}
    if(i.actionPressed&&!i.pointer&&!i.stick||jump&&!s.prevAction)s.buffer=CONFIG.buffer;s.prevAction=!!jump;
    const direction=(right?1:0)-(left?1:0),target=direction*CONFIG.speed;s.vx+=Math.max(-CONFIG.acceleration/60,Math.min(CONFIG.acceleration/60,target-s.vx));
    if(s.grounded)s.coyote=CONFIG.coyote;else s.coyote=Math.max(0,s.coyote-1);
    if(s.buffer>0&&s.coyote>0){s.vy=-CONFIG.jump;s.grounded=false;s.coyote=0;s.buffer=0;
      fx(s,{k:'burst',x:s.x-s.camera+13,y:s.y+PH,n:7,c:'#ffb668',spd:2.2});fx(s,{k:'sound',s:'pick',n:1});}
    s.buffer=Math.max(0,s.buffer-1);if(!jump&&s.vy<-200)s.vy*=.65;
    const oldBottom=s.y+PH;s.vy+= (s.vy<0?CONFIG.riseGravity:CONFIG.fallGravity)/60;s.x=Math.max(0,Math.min(l.width-PW,s.x+s.vx/60));s.y+=s.vy/60;s.grounded=false;
    const cx=s.x+PW/2,inPit=l.pits.some(([a,b])=>cx>a&&cx<b);
    const surfaces=[...l.ledges];if(!inPit)surfaces.push([0,GROUND,l.width]);
    for(const[x,y,w]of surfaces)if(s.vy>=0&&oldBottom<=y+1&&s.y+PH>=y&&s.x+PW>x&&s.x<x+w){s.y=y-PH;s.vy=0;s.grounded=true;}
    if(!s.wasGrounded&&s.grounded&&s.vy===0){fx(s,{k:'burst',x:s.x-s.camera+13,y:s.y+PH,n:5,c:'#c9a27a',spd:1.6});fx(s,{k:'sound',s:'thud'});}
    s.wasGrounded=s.grounded;
    if(s.y>H+70)hurt(s);
    if(s.x>l.width*.52&&s.checkpoint===55)s.checkpoint=Math.floor(l.width*.52);if(l.boss&&s.x>1840)s.checkpoint=1840;
    for(const f of s.foes)if(f.alive){f.x=f.origin+Math.sin(s.tick/55+f.origin)*35;if(Math.abs(s.x+PW/2-f.x)<28&&s.y+PH>GROUND-25&&s.y<GROUND){if(s.vy>0&&oldBottom<GROUND-10){f.alive=false;s.vy=-350;s.score+=75;s.combo++;
      fx(s,{k:'burst',x:f.x-s.camera,y:GROUND-13,n:14,c:'#a88fd6',spd:3.2});
      fx(s,{k:'ring',x:f.x-s.camera,y:GROUND-13,max:34,c:'#c8b4ff'});
      fx(s,{k:'pop',x:f.x-s.camera,y:GROUND-46,t:'+75',c:'#c8b4ff',size:17+Math.min(10,s.combo)});
      fx(s,{k:'combo',n:s.combo});fx(s,{k:'shake',m:5});fx(s,{k:'sound',s:'pick',n:Math.min(12,s.combo)});}else hurt(s);}}
    for(const item of s.sparks)if(!item.taken&&Math.abs(cx-item.x)<28&&Math.abs(s.y+PH/2-item.y)<40){item.taken=true;s.coins++;s.score+=20;s.combo++;
      fx(s,{k:'burst',x:item.x-s.camera,y:item.y,n:10,c:'#ffd78e',spd:2.6});
      fx(s,{k:'pop',x:item.x-s.camera,y:item.y-24,t:'+20',c:'#ffd78e',size:15+Math.min(10,s.combo)});
      fx(s,{k:'combo',n:s.combo});fx(s,{k:'sound',s:'pick',n:Math.min(12,s.combo)});}
    if(l.boss&&s.boss.hp>0){const b=s.boss;b.phase=s.tick%180;if(b.phase>60&&b.phase<130)b.x=2220-(b.phase-60)*3;else if(b.phase>=130)b.x=Math.min(2220,b.x+4);
      if(Math.abs(s.x+PW/2-b.x)<42&&s.y+PH>GROUND-54&&s.y<GROUND){if(s.vy>0&&oldBottom<GROUND-30){b.hp--;s.vy=-480;s.score+=200;s.invul=35;
        fx(s,{k:'burst',x:b.x-s.camera,y:GROUND-40,n:22,c:'#ffb46b',spd:4.2});
        fx(s,{k:'ring',x:b.x-s.camera,y:GROUND-40,max:56,c:'#ffd6a0'});
        fx(s,{k:'pop',x:b.x-s.camera,y:GROUND-82,t:'+200',c:'#ffb46b',size:24});
        fx(s,{k:'shake',m:14});fx(s,{k:'flash',a:0.2,c:'#ffd6a0'});
        fx(s,{k:'sound',s:b.hp<=0?'win':'clear',n:3});}else hurt(s);}}
    if(s.x>l.width-75&&s.boss.hp===0){s.levelsCleared++;s.score+=300;s.unlocked=Math.max(s.unlocked,Math.min(3,s.level+2));fx(s,{k:'confetti'});fx(s,{k:'flash',a:0.2,c:'#ffffff'});
      fx(s,{k:'pop',x:240,y:H*0.32,t:'BEACON RELIT',c:'#b5f1bb',size:26});
      fx(s,{k:'sound',s:s.level===2?'win':'level'});
      if(s.level===2){s.over=true;s.won=true;}else s.transition=75;}
    s.camera=Math.max(0,Math.min(l.width-W,s.x-W*.32));return s;
  }
  function bot(s){const b=s.bot;const l=LEVELS[s.level];const pit=l.pits.some(([a,b2])=>s.x+PW>a-b.look&&s.x<b2);const foe=s.foes.some(f=>f.alive&&f.x>s.x-20&&f.x-s.x<b.look+43);const boss=s.boss.hp>0&&Math.abs(s.boss.x-s.x)<140;const chase=s.boss.hp>0&&s.x>1850;const want=pit||foe||boss;if(want&&s.grounded&&b.hesitate<=0&&botRand(b)<b.miss)b.hesitate=1+Math.floor(botRand(b)*3);if(b.hesitate>0)b.hesitate--;const jump=want&&b.hesitate<=0;return {right:!chase||s.x<s.boss.x-8,left:chase&&s.x>s.boss.x+8,action:jump||s.vy<0,actionPressed:s.grounded&&jump};}
  // Pixel silhouettes carry their facial details in the same sprite coordinates.
  const SPRITES={
    hero:['......33.....','.....333.....','..3..323.....','..33322333...','.3322222333..','.3222222223..','332211211233.','322211211223.','322222222223.','322222222223.','.3222112223..','.3322222333..','..33333333...','...332233....','...33..33....','..333..333...','..11....11...'],
    mite:['..111111..','.12222221.','1221221221','1221221221','1222222221','.12222221.','..111111..','.11....11.'],
    spark:['..1..','.121.','12321','.121.','..1..']};
  function sprite(c,rows,x,y,scale,palette,flip=false){
    x=Math.round(x);y=Math.round(y);
    rows.forEach((row,j)=>[...row].forEach((v,i)=>{if(v!=='.')box(c,x+(flip?row.length-1-i:i)*scale,y+j*scale,scale,scale,palette[Number(v)-1]);}));
  }
  function render(s,c,ui){
    const l=LEVELS[s.level],cam=Math.round(s.camera/2)*2;
    const ink='#253c3b',dark='#46604c',mid='#8eac6d',light='#d3deb1',paper='#b8b9ad';
    const label=(t,x,y,size=16,col=ink,align='center')=>{c.fillStyle=col;c.font=`bold ${size}px monospace`;c.textAlign=align;c.fillText(t,x,y);};
    c.imageSmoothingEnabled=false;
    box(c,0,0,W,H,paper);box(c,8,8,464,704,'#eee9db');
    label('CINDER HOP',28,43,26,ink,'left');label('EMBERWOOD / 01',28,66,12,dark,'left');
    box(c,427,32,8,8,'#887c4e');label('ON',447,40,10,dark);
    box(c,10,84,460,541,'#7b8b81');box(c,17,92,446,522,ink);
    c.save();c.beginPath();c.rect(22,98,436,510);c.clip();
    box(c,22,98,436,510,light);
    // A layered woodland skyline behind the old aqueduct.
    box(c,22,98,436,225,'#e0dfbd');box(c,22,323,436,285,'#c7d0aa');
    c.fillStyle='#edc781';c.beginPath();c.arc(373-cam*.02,183,31,0,Math.PI*2);c.fill();
    for(let i=0;i<7;i++){
      const x=((i*103-cam*.07)%721+721)%721-90;
      c.fillStyle='#b2c1a0';c.beginPath();c.moveTo(x-70,355);c.quadraticCurveTo(x+20,190,x+110,355);c.fill();
    }
    for(let i=0;i<8;i++){
      const x=((i*93-cam*.24)%744+744)%744-70;
      box(c,x+22,282,8,310,'#668878');
      for(let j=0;j<3;j++){c.fillStyle=j%2?'#89a58b':'#93ae90';c.beginPath();c.moveTo(x-22+j*6,333-j*34);c.lineTo(x+26,216-j*19);c.lineTo(x+74-j*6,333-j*34);c.fill();}
    }

    for(let i=0;i<28;i++)box(c,(i*83+27-cam*.08)%480,170+(i*47)%150,2,2,mid);
    for(let i=0;i<14;i++){
      const x=Math.floor(((i*84-cam*.15)%1176+1176)%1176)-84,y=310+(i%3)*24;
      box(c,x+4,y+4,48,270,'#678777');box(c,x,y,48,270,'#a2b198');box(c,x-4,y,56,8,'#667f6b');box(c,x+16,y+24,16,38,'#688777');box(c,x,y+8,48,2,'#c8ccab');
      for(let j=0;j<4;j++)box(c,x+4+(j%2)*8,y+85+j*36,24,2,dark);
    }
    for(let x=Math.floor(cam/16)*16;x<cam+W;x+=16){
      if(l.pits.some(([a,b])=>x+8>a&&x+8<b))continue;
      const xx=x-cam;box(c,xx,GROUND,16,32,dark);box(c,xx,GROUND,16,4,'#bed08d');box(c,xx+2,GROUND-3,3,3,'#718c56');
      box(c,xx+2,GROUND+8,10,2,mid);box(c,xx+8,GROUND+18,2,4,ink);
    }
    for(const[a,b]of l.pits){box(c,a-cam,GROUND,b-a,40,ink);for(let x=a+4;x<b;x+=8)box(c,x-cam,GROUND+12,2,2,dark);}
    for(const[x,y,w]of l.ledges){box(c,x-cam,y,w,12,ink);box(c,x-cam+2,y+2,w-4,4,mid);for(let t=4;t<w;t+=16)box(c,x-cam+t,y+8,8,2,dark);}
    for(const item of s.sparks)if(!item.taken)sprite(c,SPRITES.spark,item.x-cam-5,item.y-5+(Math.floor(s.tick/20)%2)*2,2,['#755737','#edba66','#fff1c0']);
    for(const f of s.foes)if(f.alive)sprite(c,SPRITES.mite,f.x-cam-15,GROUND-24,3,['#3f4240','#b6836b','#f5dfaa']);
    if(s.boss.hp>0){sprite(c,SPRITES.mite,s.boss.x-cam-30,GROUND-48,6,['#39443d','#907766','#f5dfaa']);label('WARDEN '+s.boss.hp,s.boss.x-cam,GROUND-60,12);}
    const gate=l.width-55-cam;box(c,gate,GROUND-86,8,86,ink);box(c,gate-10,GROUND-90,28,10,ink);box(c,gate+2,GROUND-80,4,14,mid);
    if(!s.invul||s.tick%8<4){
      // 13 × 17 pixels at 2x exactly match the 26 × 34 collision body.
      sprite(c,SPRITES.hero,s.x-cam,s.y,2,['#3e3935','#f3cb81','#c57350'],s.vx<0);
      if(s.grounded&&Math.abs(s.vx)>10&&Math.floor(s.tick/7)%2)box(c,Math.round(s.x-cam)+2,Math.round(s.y)+32,6,2,mid);
    }
    box(c,22,98,436,47,light);label(l.name.toUpperCase(),34,116,13,ink,'left');
    label('SPARKS '+String(s.coins).padStart(2,'0'),34,136,12,dark,'left');label('LIFE '+s.lives+'   '+String(s.score).padStart(5,'0'),446,136,12,ink,'right');
    if(s.transition){box(c,65,296,350,90,light);label('A LIGHT REMEMBERS YOU',240,332,19);label('BEACON RELIT',240,363,14,dark);}
    if(s.over){box(c,40,265,400,200,ink);label(s.won?'THE DREAM CONTINUES':'WAKE, LITTLE EMBER',240,310,23,light);label('SCORE '+s.score,240,353,25,mid);label('SPACE / TAP TO RETURN',240,412,16,light);}
    c.restore();
    label('EMBERWOOD · ARROWS TO MOVE / SPACE TO HOP',240,643,11,dark);
    // The rank, in the machine's own ink: the shell draws no neon over a handheld game.
    const r=ui&&ui.rank;
    if(r){const fresh=r.fresh&&s.tick%20<10;label(fresh?'LV UP':'LV '+r.level,396,66,11,fresh?ink:dark,'left');
      for(let k=0;k<5;k++)box(c,438+k*6,59,4,6,k<Math.round(r.part*5)?ink:'#b4ae9f');}
    box(c,24,654,94,48,ink);box(c,124,654,94,48,ink);box(c,306,654,150,48,'#755966');
    label('◀',71,686,26,light);label('▶',171,686,26,light);label('A · HOP',381,684,20,'#f4e7d2');
    label('← →',260,671,11,dark);label('SPACE',260,690,11,dark);
  }

  globalThis.Game={id: "cinder-hop",
    guide: {
  "version": 1,
  "summary": "Three worlds with pits, enemies, sparks and checkpoints.",
  "goal": "Beat the Ember Beetle and reach the exit of the third world.",
  "lose": "Lose all five lives to hazards/enemies.",
  "rules": [
    "Three worlds with pits, enemies, sparks and checkpoints. Five shared lives. The Ember Beetle takes three stomps; the final exit ends the run. Existing variable-height jump and pixel sprites are strengths."
  ],
  "controls": [
    {
      "action": "Move",
      "keyboard": "A/D or Left/Right",
      "touch": "Touch movement controls"
    },
    {
      "action": "Jump",
      "keyboard": "Space or Up; hold for height",
      "touch": "Hold jump for height"
    }
  ],
  "firstSteps": [
    "Hold jump to clear a wider gap; release for a shorter landing.",
    "Approach an enemy from above to stomp it."
  ],
  "tips": [
    "Release jump for a shorter landing; approaching an enemy from the side is dangerous."
  ],
  "modes": []
},
    title:'Cinder Hop',autoJuice:false,width:W,height:H,touchStick:(s,p)=>!s.over&&(!p||p.x<260&&p.y<630),init,step,bot,render,progress:s=>({unlocked:s.unlocked}),metrics:s=>({score:s.score,levels_cleared:s.levelsCleared,deaths:s.deaths,sparks:s.coins,won:s.won?1:0}),rules:{LEVELS,CONFIG}};

})();
