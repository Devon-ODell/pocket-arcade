(function () {
  'use strict';
  const W=480,H=720,FLOOR=656,CEILING=94,PLAYER_X=128,RADIUS=12;
  const CONFIG={gravity:.235,flap:-4.65,baseSpeed:2.25,gateWidth:62,spacing:235};
  function rand(s){s.rng=(Math.imul(s.rng,1664525)+1013904223)>>>0;return s.rng/4294967296;}
  function init(seed){return {rng:seed>>>0,tick:0,phase:'ready',over:false,y:350,vy:0,gates:[],distance:0,score:0,passed:0,perfects:0,flaps:0,flash:0,particles:[],lastCenter:350,botTarget:350,botNext:0,fx:[],combo:0,bestCombo:0};}
  function addGate(s,x){
    const gap=Math.max(138,210-s.passed*1.6),center=Math.max(235,Math.min(515,s.lastCenter+(rand(s)-.5)*150));
    s.gates.push({x,center,gap,passed:false,gem:false});s.lastCenter=center;
  }
  function fx(s,e){if(e.k==='sound'&&s.fx.length<40)s.fx.push(e);}   // a handheld: sound, no neon
  function crash(s){s.over=true;s.phase='over';s.flash=18;
    fx(s,{k:'shake',m:20});fx(s,{k:'flash',a:0.45,c:'#ff5a6e'});fx(s,{k:'sound',s:'die'});
    for(let i=0;i<16;i++)s.particles.push({x:PLAYER_X,y:s.y,vx:(rand(s)-.5)*5,vy:(rand(s)-.5)*5,life:35});
  }
  function hitsGate(y,g){
    const x=Math.max(g.x,Math.min(PLAYER_X,g.x+CONFIG.gateWidth));
    const top=g.center-g.gap/2,bottom=g.center+g.gap/2;
    const nearTop=Math.min(y,top),nearBottom=Math.max(y,bottom);
    return (PLAYER_X-x)**2+(y-nearTop)**2<RADIUS**2 || (PLAYER_X-x)**2+(y-nearBottom)**2<RADIUS**2;
  }
  function step(s,i){
    if(s.over)return s;i=i||{};s.tick++;s.fx.length=0;   // the shell drains this each tick
    if(s.phase==='ready'){
      if(i.actionPressed||i.up){s.phase='play';s.vy=CONFIG.flap;s.flaps++;addGate(s,520);addGate(s,755);}
      return s;
    }
    s.flash=Math.max(0,s.flash-1);
    if(i.actionPressed||i.up){s.vy=CONFIG.flap;s.flaps++;}
    s.vy=Math.min(7,s.vy+CONFIG.gravity);s.y+=s.vy;
    const speed=Math.min(4.5,CONFIG.baseSpeed+s.passed*.04);s.distance+=speed;
    for(const p of s.particles){p.x+=p.vx;p.y+=p.vy;p.life--;}
    s.particles=s.particles.filter(p=>p.life>0);
    for(const g of s.gates){
      g.x-=speed;
      if(hitsGate(s.y,g)){crash(s);return s;}
      if(!g.gem&&Math.abs(g.x+CONFIG.gateWidth/2-PLAYER_X)<18&&Math.abs(s.y-g.center)<22){
        g.gem=true;s.perfects++;s.score+=3;s.flash=10;
        s.combo++;s.bestCombo=Math.max(s.bestCombo,s.combo);
        fx(s,{k:'burst',x:PLAYER_X,y:s.y,n:12,c:'#ffdf91',spd:3.2});
        fx(s,{k:'ring',x:PLAYER_X,y:s.y,max:34,c:'#ffdf91'});
        fx(s,{k:'pop',x:PLAYER_X,y:s.y-30,t:'GLIMMER +3',c:'#ffdf91',size:16});
        fx(s,{k:'combo',n:s.combo});fx(s,{k:'sound',s:'pick',n:Math.min(12,s.combo)});
        for(let n=0;n<7;n++)s.particles.push({x:PLAYER_X,y:s.y,vx:(rand(s)-.5)*3,vy:(rand(s)-.5)*3,life:25});
      }
      if(!g.passed&&g.x+CONFIG.gateWidth<PLAYER_X-RADIUS){g.passed=true;s.passed++;s.score+=10;
        fx(s,{k:'pop',x:PLAYER_X+40,y:s.y,t:'+10',c:'#adf5c9',size:18});
        fx(s,{k:'sound',s:'pick',n:Math.min(12,s.passed)});
        if(s.passed%5===0){fx(s,{k:'flash',a:0.16,c:'#ffffff'});fx(s,{k:'pop',x:W/2,y:H*0.3,t:`${s.passed} GATES`,c:'#ffe1a0',size:26});fx(s,{k:'sound',s:'level'});}}
    }
    if(s.y-RADIUS<=CEILING||s.y+RADIUS>=FLOOR){crash(s);return s;}
    s.gates=s.gates.filter(g=>g.x+CONFIG.gateWidth>-20);
    if(s.gates[s.gates.length-1].x<W+30)addGate(s,s.gates[s.gates.length-1].x+CONFIG.spacing);
    return s;
  }
  function bot(s){
    if(s.phase==='ready')return {actionPressed:true};
    if(s.tick<s.botNext)return {};
    s.botNext=s.tick+5+Math.floor(rand(s)*5);
    const g=s.gates.find(g=>g.x+CONFIG.gateWidth>PLAYER_X-RADIUS);
    s.botTarget=(g?g.center:350)+16+(rand(s)-.5)*28;
    return {actionPressed:s.y+s.vy*5>s.botTarget&&s.vy>-2&&rand(s)>.035};
  }
  // --- drawing: POCKET DREAM / 02 ---------------------------------------------
  // Pixel sprites over layered night scenery. Dark distant terrain recedes behind
  // the brighter crystal edges; the moth and pickups carry warm accent colours.
  // The screen is taller than Cinder Hop's because CEILING and FLOOR are collision data:
  // the whole flight path has to sit inside the glass.
  const INK='#172d41', DARK='#406379', MID='#749baf', LIGHT='#dce5dd';
  const SX=22, SY=86, SW=436, SH=576;                        // the screen, inside the bezel
  function box(c,x,y,w,h,color){c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
  function label(c,t,x,y,size=16,col=INK,align='center'){c.fillStyle=col;c.font=`bold ${size}px monospace`;c.textAlign=align;c.fillText(t,x,y);}
  function sprite(c,rows,x,y,scale,palette){
    x=Math.round(x);y=Math.round(y);
    rows.forEach((row,j)=>[...row].forEach((v,i)=>{if(v!=='.')box(c,x+i*scale,y+j*scale,scale,scale,palette[Number(v)-1]);}));
  }
  // 13 × 11 at 2x is 26 × 22: the moth's collision circle is 24 across. Solid wings with a
  // hard ink edge, so it reads against the pale sky the way Cinder Hop's ember does.
  const MOTH=[
    ["1111.....1111", "12221...12221", "1242213122421", "1222223222221", ".12222322221.", "..122232221..", "..122333221..", ".12221312221.", ".1221.1.1221.", "..11.....11..", "............."],
    [".............", ".............", ".....111.....", "....13331....", "1111133311111", "1222213122221", "1242213124221", "1222213122221", ".12221.12221.", "..111...111..", "............."]];
  const GEM=['...1...','..121..','.12321.','1233321','.12321.','..121..','...1...'];
  // Two slow terrain layers provide parallax without competing with the obstacles.
  function hills(c,dist,speed,base,rise,dither){
    c.fillStyle=dither?'#31526a':'#3a6479';c.beginPath();c.moveTo(SX,SY+SH);
    for(let x=SX;x<=SX+SW+8;x+=8){const k=(x+dist*speed)/8;const h=rise*(.55+.3*Math.sin(k*.19)+.15*Math.sin(k*.057+1.3));c.lineTo(x,base-h);}
    c.lineTo(SX+SW,SY+SH);c.closePath();c.fill();
  }
  // A pillar of crystal with a stepped point toward the gap, so the opening reads at a glance.
  function pillar(c,x,top,bottom,pointDown){
    const w=CONFIG.gateWidth, len=bottom-top;
    if(len<=0)return;
    box(c,x,top,w,len,INK);
    box(c,x+2,top,w-4,len,'#426f80');
    box(c,x+10,top,6,len,'#94bebf');                                  // the facet catching the moon
    for(let k=0;k<3;k++){                                        // the point, three steps deep
      const inset=6+k*8, y=pointDown?bottom+k*6:top-(k+1)*6;
      box(c,x+inset,y,w-inset*2,6,INK);
      box(c,x+inset+2,y,w-inset*2-4,6,k===2?MID:DARK);
    }
  }
  function render(s,c,ui){
    c.imageSmoothingEnabled=false;
    // The device.
    box(c,0,0,W,H,'#b8b9ad');box(c,8,8,464,704,'#eee9db');
    label(c,'GLIMMER GLIDE',28,40,24,INK,'left');label(c,'MOONGLASS / 02',28,62,12,DARK,'left');
    box(c,440,20,6,6,'#887c4e');label(c,'ON',458,27,9,DARK);
    label(c,String(s.score).padStart(5,'0'),452,50,20,INK,'right');
    label(c,`GATES ${String(s.passed).padStart(2,'0')}  ◆ ${s.perfects}`,452,66,11,DARK,'right');
    box(c,10,76,460,596,'#7b8b81');box(c,17,81,446,586,INK);

    c.save();c.beginPath();c.rect(SX,SY,SW,SH);c.clip();
    const d=s.distance;
    box(c,SX,SY,SW,SH,'#172f49');
    c.fillStyle='#edddae';c.beginPath();c.arc(377,155,26,0,Math.PI*2);c.fill();
    c.fillStyle='#172f49';c.beginPath();c.arc(388,148,23,0,Math.PI*2);c.fill();
    for(let i=0;i<42;i++){const x=((i*83+29-Math.floor(d*.05))%SW+SW)%SW+SX;box(c,x,110+(i*53)%310,i%7===0?3:1,i%7===0?3:1,'#a1bec3');}
    for(let i=0;i<8;i++){const x=((i*99-Math.floor(d*.12))%792+792)%792-60;c.fillStyle='#294b63';c.beginPath();c.moveTo(x-55,560);c.lineTo(x+45,299+(i%3)*43);c.lineTo(x+145,560);c.fill();}
    hills(c,d,.18,560,130,true);
    hills(c,d,.45,626,70,false);

    for(const g of s.gates){
      const top=g.center-g.gap/2, bottom=g.center+g.gap/2;
      pillar(c,g.x,CEILING,top-18,true);
      pillar(c,g.x,bottom+18,FLOOR,false);
      if(!g.gem)sprite(c,GEM,g.x+CONFIG.gateWidth/2-7,g.center-7+(Math.floor(s.tick/16)%2)*2,2,['#855d42','#f8db8c','#c39860']);
    }
    // The cave's lip and floor: collision lines drawn as solid ink so nobody argues with them.
    box(c,SX,SY,SW,CEILING-SY,INK);
    for(let x=SX;x<SX+SW;x+=12)box(c,x+2,CEILING,6,2+((x/12)%3)*2,DARK);
    box(c,SX,FLOOR,SW,SY+SH-FLOOR,INK);
    for(let x=SX-Math.floor(d)%12;x<SX+SW;x+=12)box(c,x+4,FLOOR-4,4,4,DARK);

    for(const p of s.particles)if(p.life>0)box(c,Math.round(p.x/2)*2,Math.round(p.y/2)*2,2,2,MID);
    // Wings beat on a clock, and faster just after a flap.
    const y=s.phase==='ready'?350+Math.round(Math.sin(s.tick*.06)*8):s.y;
    const frame=s.phase==='play'&&s.vy<0?Math.floor(s.tick/3)%2:Math.floor(s.tick/9)%2;
    const blink=s.flash>0&&s.tick%4<2;
    sprite(c,MOTH[frame],PLAYER_X-13,y-11,2,blink?[LIGHT,INK,LIGHT,INK]:['#1b3446','#f5dfb0','#d6a76f','#fff7d9']);

    if(s.phase==='ready'){
      box(c,62,392,356,138,INK);box(c,66,396,348,130,LIGHT);
      label(c,'A LITTLE LIGHT.',240,436,20);label(c,'A LITTLE LIFT.',240,464,20,DARK);
      label(c,'SLIP THE CRYSTALS · TAKE THE GLIMMERS',240,494,11,DARK);
      if(Math.floor(s.tick/30)%2)label(c,'PRESS A TO FLY',240,516,12);
    }
    if(s.over){
      box(c,40,250,400,236,INK);
      label(c,s.passed>=20?'GOLDEN WINGS':s.passed>=8?'SILVER WINGS':'REST YOUR WINGS',240,298,22,LIGHT);
      label(c,String(s.score).padStart(5,'0'),240,350,34,MID);
      label(c,`${s.passed} GATES · ${s.perfects} GLIMMERS`,240,384,13,LIGHT);
      if(ui&&ui.best)label(c,s.score>=ui.best?'A NEW BEST NIGHT':'BEST '+ui.best,240,412,13,s.score>=ui.best?LIGHT:MID);
      label(c,'SPACE / TAP TO FLY AGAIN',240,452,14,LIGHT);
    }
    c.restore();

    label(c,'MOONGLASS · SPACE TO FLAP',28,697,11,DARK,'left');
    const r=ui&&ui.rank;
    if(r){
      const fresh=r.fresh&&s.tick%20<10;
      label(c,fresh?'LV UP':'LV '+r.level,28,684,11,fresh?INK:DARK,'left');
      for(let k=0;k<5;k++)box(c,78+k*8,677,6,6,k<Math.round(r.part*5)?INK:'#b4ae9f');
    }
    box(c,300,676,156,32,'#755966');label(c,'A · FLAP',378,698,16,'#f4e7d2');
  }

  globalThis.Game={id: "glimmer-glide",
    guide: {
  "version": 1,
  "summary": "Endless crystal gates: gate +10, central glimmer +3; gaps narrow and speed rises.",
  "goal": "Currently endless: improve gates/high score, no final victory.",
  "lose": "Touch a gate, ceiling or floor.",
  "rules": [
    "Each gate earns 10 and a central glimmer earns 3.",
    "Gravity lowers the moth; each press supplies one flap.",
    "Gaps narrow and speed rises; contact with a gate, ceiling or floor ends the run."
  ],
  "controls": [
    {
      "action": "Flap",
      "keyboard": "Space or Up, once per press",
      "touch": "Tap to flap"
    }
  ],
  "firstSteps": [
    "Tap once to rise; let gravity lower your moth.",
    "Aim for the open crystal gap before chasing the glimmer."
  ],
  "tips": [
    "Do not chase a glimmer through solid crystal; survival comes before bonus points."
  ],
  "modes": []
},
    title:'Glimmer Glide',autoJuice:false,width:W,height:H,init,step,bot,render,
    metrics:s=>({score:s.score,gates:s.passed,glimmers:s.perfects,flaps:s.flaps}),rules:{hitsGate,config:CONFIG}};
})();
