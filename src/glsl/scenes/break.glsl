// ---------------------------------------------------------------- scene: BREAK
// The shattered bowl. The room falls away into darkness; each shard's glaze
// becomes a window into a different moment of the bowl's life.
uniform float uMemDay, uMemSeason, uMemTwo, uMemGap, uMemCandle, uMemSteam, uMemTea, uMemTea2, uMemOpen, uMemRing;
uniform vec4  uMemA[NSEED];    // day, season, two, candle
uniform vec4  uMemB[NSEED];    // gap, open, tea, ring
uniform vec4  uMemCam[NSEED];  // azimuth, elevation, distance, fov
uniform vec4  uShardN[NSEED];  // mean outward normal (rest), w = portal strength
uniform float uVoid;           // 0 room, 1 darkness
uniform float uPortal;         // global portal amount
uniform float uGoldEdge;       // gold on the fracture faces
uniform float uGoldGlow;       // molten glow of that gold
uniform vec3  uImpact;         // world position of the impact
uniform vec3  uKeyDir;
uniform float uSpecks;         // suspended chips / dust
out vec4 fragColor;

Mem presentMem(){
  Mem m;
  m.day=uMemDay; m.season=uMemSeason; m.two=uMemTwo; m.gap=uMemGap; m.candle=uMemCandle;
  m.steam=uMemSteam; m.tea=uMemTea; m.tea2=uMemTea2; m.open=uMemOpen; m.ring=uMemRing;
  m.bowlOn=0.0; m.bowlOff=vec3(0); m.bowlTilt=0.0;
  return m;
}
Mem shardMem(int i){
  Mem m;
  vec4 a=uMemA[i], b=uMemB[i];
  m.day=a.x; m.season=a.y; m.two=a.z; m.candle=a.w;
  m.gap=b.x; m.open=b.y; m.tea=b.z; m.tea2=b.z*a.z; m.ring=b.w;
  m.steam=step(0.01,b.z); m.bowlOn=1.0; m.bowlOff=vec3(0); m.bowlTilt=0.0;
  return m;
}

vec3 voidEnv(vec3 d){
  float up = d.y*0.5+0.5;
  vec3 c = mix(vec3(0.004,0.004,0.006), vec3(0.012,0.010,0.009), up);
  // a faint warm horizon glow, like light remembered
  c += vec3(0.05,0.03,0.015)*exp(-abs(d.y)*6.0)*0.4;
  return c;
}

vec3 portalView(int i, vec3 q, vec3 dl){
  vec3 n = uShardN[i].xyz;
  float sd = dot(dl, n);
  vec3 f = (sd>=0.0 ? 1.0 : -1.0)*n;
  vec3 right = normalize(cross(vec3(0,1,0), f));
  vec3 up = cross(f, right);
  vec3 c = uShardC[i].xyz;
  vec3 rel = q-c;
  vec3 ld = vec3(dot(dl,right), dot(dl,up), dot(dl,f));
  // recentre on the direction to the shard centroid so the memory stays framed
  vec3 cw = qinv(uShardQ[i], normalize(uShardP[i].xyz-uCamPos));
  vec3 lc = vec3(dot(cw,right), dot(cw,up), dot(cw,f));
  ld.xy = (ld.xy/max(ld.z,0.2) - 0.75*lc.xy/max(lc.z,0.2));
  vec4 mc = uMemCam[i];
  vec3 tg = vec3(-0.45, 0.32, 0.5);
  vec3 eye = tg + mc.z*vec3(sin(mc.x)*cos(mc.y), sin(mc.y), -cos(mc.x)*cos(mc.y));
  vec3 fw = normalize(tg-eye);
  vec3 rr = normalize(cross(vec3(0,1,0), fw));
  vec3 uu = cross(fw, rr);
  // field of view: squeeze the lateral components
  vec3 dm = normalize(rr*ld.x*mc.w + uu*ld.y*mc.w + fw);
  vec3 om = eye + (rr*dot(rel,right) + uu*dot(rel,up))*2.0;
  Mem m = shardMem(i);
  vec4 r = roomTrace(om, dm, m, 90);
  vec3 col = r.rgb;
  vec4 st = steamVolume(om, dm, r.a, vec3(0,teaHeight(m.tea),0), m.steam, m);
  col = col*(1.0-st.a)+st.rgb;
  col += roomBeams(om, dm, r.a, m, 10, 0.03);
  return col;
}

void main(){
  vec3 ro = uCamPos, rd = camRay(gl_FragCoord.xy);
  Mem pm = presentMem();

  // background: the present room, dissolving into the void from the impact outward
  vec3 bg; float tbg;
  if(uVoid<0.999){
    vec4 r = roomTrace(ro, rd, pm, 120);
    bg = r.rgb; tbg = r.a;
    vec3 pw = ro+rd*tbg;
    float dist = length(pw-uImpact);
    float n = fbm(pw*0.6, 3);
    float k = smoothstep(-0.5, 0.5, uVoid*18.0 - dist*1.1 + n*3.0);
    k = max(k, smoothstep(0.85,1.0,uVoid));
    bg = mix(bg, voidEnv(rd), k);
  } else { bg = voidEnv(rd); tbg = 200.0; }

  // suspended chips: sparse glints on a few depth layers
  if(uSpecks>0.0){
    for(int l=0;l<4;l++){
      float z = 1.5+float(l)*1.4;
      vec3 p = ro+rd*z;
      vec3 cell = floor(p*3.0);
      vec3 h = hash33(cell+float(l)*17.0);
      vec3 sp = (cell+h)/3.0;
      vec3 w = sp-ro; float tt=dot(w,rd);
      float d = length(w-rd*tt);
      if(tt<tbg && h.x>0.8) bg += vec3(1.0,0.9,0.75)*uSpecks*0.004/(d*d*900.0+0.02)*(0.5+0.5*sin(uTime*2.0+h.y*20.0));
    }
  }

  vec3 col = bg; float depth = tbg;
  Cands c = shardCull(ro, rd);
  vec2 h = shardTrace(ro, rd, c, tbg);
  if(h.x>0.0){
    int i = int(h.y);
    vec3 p = ro+rd*h.x;
    vec3 q = shardLocal(p, i);
    vec4 Q = uShardQ[i];
    vec3 nl = shardNormalLocal(q, i);
    vec3 n = qrot(Q, nl);
    vec3 v = -rd;
    vec3 vl = qinv(Q, v);
    float cd = cellDist(q, i);
    float bd = sdBowl(q);
    bool fracture = cd > bd-0.002;
    vec3 L = normalize(uKeyDir);
    float sh = 1.0;
    vec3 lit;
    if(!fracture){
      Surf s = bowlSurface(q, nl, vl);
      s.n = qrot(Q, s.n); s.cn = qrot(Q, s.cn);
      // lighting: present room fading to a void key/rim rig
      vec3 roomL = roomLightSurf(s, p, v, pm, 1.0);
      float nl2 = sat(dot(s.n,L));
      float nv = sat(dot(s.cn,v));
      vec3 key = vec3(1.0,0.86,0.7)*1.6;
      vec3 voidL = s.alb*(key*nl2 + voidEnv(s.n)*2.0 + vec3(0.05,0.06,0.08)*sat(-dot(s.n,L)))
                 + s.coat*(specGGX(s.cn, v, L, s.coatRough, vec3(0.04))*key + voidEnv(reflect(-v,s.cn))*F_Schlick1(0.04,nv))
                 + specGGX(s.n, v, L, s.rough, s.f0)*key;
      // rim
      voidL += s.alb*vec3(0.5,0.55,0.7)*pow(1.0-nv, 4.0)*0.6;
      lit = mix(roomL, voidL, uVoid);
      // memory window
      float strength = uPortal*uShardN[i].w;
      if(strength>0.0){
        float inner = smoothstep(-0.003, -0.035, cd);
        float glazed = sat(glazeThickness(q, bowlInfo(q))*3.0);
        vec3 mem = portalView(i, q, qinv(Q, rd));
        float F = F_Schlick1(0.04, nv);
        vec3 tint = mix(vec3(1.0), vec3(0.82,1.0,0.93), 0.35);
        float k = strength*inner*glazed*(1.0-F);
        lit = mix(lit, mem*tint*1.7 + s.coat*specGGX(s.cn, v, L, s.coatRough, vec3(0.04))*key*0.5, k);
        // luminous edge where the memory meets the break
        lit += vec3(1.0,0.72,0.38)*strength*glazed*exp(-abs(cd+0.004)*260.0)*0.9;
      }
    } else {
      // exposed clay body with the thin glaze line at the surface
      float depthIn = -bd;
      Surf s = defaultSurf(n);
      float grain = clayGrain(q);
      s.alb = vec3(0.60,0.53,0.45)*(0.85+0.2*grain);
      s.rough = 0.9;
      float gl = smoothstep(0.012,0.004,depthIn);
      s.alb = mix(s.alb, vec3(0.45,0.62,0.56), gl*0.8);
      // conchoidal ripples
      vec3 nb = n;
      BUMP(nb, q, glazeRipple, 0.004, 0.004);
      s.n = nb;
      // gold on the break (reassembly)
      if(uGoldEdge>0.0){
        float g = uGoldEdge*smoothstep(0.3, 0.7, uGoldEdge + 0.3*gnoise(q*20.0));
        s.alb = mix(s.alb, vec3(0.0), g);
        s.f0 = mix(s.f0, vec3(1.0,0.74,0.32), g);
        s.rough = mix(s.rough, 0.25, g);
        s.emit = vec3(1.0,0.55,0.18)*g*uGoldGlow*3.0;
      }
      vec3 roomL = roomLightSurf(s, p, v, pm, 1.0);
      vec3 key = vec3(1.0,0.86,0.7)*1.6;
      vec3 voidL = s.alb*(key*sat(dot(s.n,L)) + voidEnv(s.n)*2.0) + specGGX(s.n, v, L, s.rough, s.f0)*key
                 + s.f0*voidEnv(reflect(-v,s.n))*0.5 + s.emit;
      lit = mix(roomL, voidL, uVoid);
    }
    col = lit; depth = h.x;
  }
  fragColor = vec4(col, depth);
}
