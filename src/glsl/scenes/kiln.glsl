// ---------------------------------------------------------------- scene: FIRE (kiln)
// Inside a wood-fired tunnel kiln. Flames pour from the firebox (+z) past the
// bowl toward the camera. Later the fire dies and the door is opened to dawn.
uniform float uFire;      // flame intensity 0..1
uniform float uWallT;     // wall incandescence 0..1
uniform float uDoor;      // cool daylight through the opened door (camera side)
uniform float uEmber;     // ember bed glow after the fire dies
uniform float uWhite;     // white-hot peak 0..1
out vec4 fragColor;

#define KR 3.6

float brickPattern(vec3 p, out vec2 cell){
  // running bond on the vault surface: u = arc length, v = z
  float a = atan(p.x, p.y-0.3);
  vec2 uv = vec2(a*KR, p.z)/vec2(0.55,1.1);
  uv.x += 0.5*mod(floor(uv.y),2.0);
  cell = floor(uv);
  vec2 f = abs(fract(uv)-0.5);
  return min(0.5-f.x, (0.5-f.y)*2.0*0.55/1.1);
}

// approximate ellipse distance (good enough away from the tips)
float sdEllipse2(vec2 p, vec2 r){
  float k0 = length(p/r), k1 = length(p/(r*r));
  return k0*(k0-1.0)/max(k1,1e-5);
}

// ids: 1 bowl, 2 vault, 3 floor, 4 other wares
vec2 kilnMap(vec3 p){
  float bb = length(p-vec3(0,0.4,0))-0.95;
  vec2 r = vec2(bb > 0.3 ? bb : sdBowl(p), 1.0);
  // vault (interior of a half-cylinder along z)
  vec2 cell;
  float mortar = brickPattern(p, cell);
  float vault = KR - length(p.xy-vec2(0.0,0.3)) - 0.03*smoothstep(0.05,0.0,mortar) + 0.03*hash12(cell);
  if(vault<r.x) r = vec2(vault, 2.0);
  // floor with ash and sand
  float fl = p.y + 0.02*fbm(p.xz*3.0,2);
  if(fl<r.x) r = vec2(fl, 3.0);
  // other wares further in: a shouldered jar, a stacked pair of bowls, a tall bottle
  vec3 q = p-vec3(-1.85,0.0,3.6);
  vec2 jq = vec2(length(q.xz), q.y);
  float jar = sdEllipse2(jq-vec2(0.0,0.78), vec2(0.62,0.5));
  jar = smin(jar, sdSeg(jq, vec2(0.0,0.05), vec2(0.0,0.5))-0.34, 0.25);
  jar = smin(jar, sdSeg(jq, vec2(0.0,1.2), vec2(0.0,1.5))-0.2, 0.1);
  jar = min(jar, length(jq-vec2(0.22,1.5))-0.045);
  jar = max(jar, -(sdSeg(jq, vec2(0.0,1.05), vec2(0.0,1.8))-0.15));
  jar = max(jar, -q.y);
  q = p-vec3(1.75,0.0,4.2);
  vec2 bq = vec2(length(q.xz), q.y);
  float b2 = abs(length(bq-vec2(0.0,0.66))-0.55)-0.035;
  b2 = max(b2, max(-q.y+0.02, q.y-0.5));
  b2 = min(b2, max(abs(length(bq-vec2(0.0,1.08))-0.52)-0.035, max(0.47-q.y, q.y-0.92)));
  b2 = min(b2, sdSeg(bq, vec2(0.0,0.0), vec2(0.16,0.0))-0.05);
  q = p-vec3(0.55,0.0,7.4);
  vec2 vq = vec2(length(q.xz), q.y);
  float b3 = sdEllipse2(vq-vec2(0.0,0.75), vec2(0.5,0.72));
  b3 = smin(b3, sdSeg(vq, vec2(0.0,1.3), vec2(0.0,2.35))-0.11, 0.3);
  b3 = min(b3, length(vq-vec2(0.13,2.35))-0.05);
  b3 = max(b3, -q.y);
  float wares = min(jar, min(b2, b3));
  if(wares<r.x) r = vec2(wares, 4.0);
  return r;
}

vec3 kilnNormal(vec3 p){
  const vec2 e = vec2(0.0008,-0.0008);
  return normalize(e.xyy*kilnMap(p+e.xyy).x + e.yyx*kilnMap(p+e.yyx).x + e.yxy*kilnMap(p+e.yxy).x + e.xxx*kilnMap(p+e.xxx).x);
}

// fire density: discrete tongues with sharp edges (not fog). The threshold falls
// as the fire grows, so a few licks at the start become a roaring sheet at the peak.
float fireField(vec3 p, out float core){
  float t = uTime;
  vec3 q = p;
  float spd = mix(1.3, 2.3, uFire);
  q.y -= t*spd;
  q.z += t*spd*0.4;
  vec3 w = vec3(vnoise(q*vec3(1.1,0.5,1.1)), vnoise(q*vec3(1.1,0.5,1.1)+7.1), vnoise(q*vec3(1.1,0.5,1.1)+3.3));
  q.xz += (w.xz-0.5)*1.1;
  q.y += (w.y-0.5)*0.6;
  vec3 qa = q*vec3(2.4,0.75,2.4);                  // tall, narrow tongues rising from the bed
  float n = vnoise(qa)*0.58 + vnoise(qa*2.13+5.0)*0.28 + vnoise(qa*4.7+9.0)*0.14;
  float reach = mix(0.5, 2.8, uFire);
  float hh = sat(p.y/reach);
  // fire lives behind and around the bowl, strongest toward the firebox. It stays sparse:
  // the build is carried by reach, speed and heat, never by filling the air.
  float src = smoothstep(-1.0, 3.0, p.z);
  float f = n - hh*0.6 + 0.3*src - 0.2 - 0.4*(1.0-smoothstep(-0.9, 0.7, p.z));   // keep the air in front of the bowl clear
  float thr = mix(0.3, 0.2, uFire);
  core = sat((f-thr)*4.0);
  return smoothstep(thr, thr+0.03, f)*smoothstep(-0.05, 0.1, p.y);
}
float fireDensity(vec3 p, out float core){
  float d = fireField(p, core);
  // flames wrap the bowl: none inside, tongues licking along the outside
  float sb = sdBowl(p);
  d *= smoothstep(0.0, 0.05, sb);
  return d;
}

vec3 kilnEnv(vec3 d){
  // what glossy surfaces reflect: glowing brick, fire, and later the door
  vec3 wall = blackbody(mix(800.0, 1250.0, uWallT)+180.0*uWhite)*uWallT*uWallT*1.0;
  vec3 fire = blackbody(1400.0+300.0*uWhite)*uFire*1.2*sat(d.z*0.5+0.6);
  vec3 door = vec3(0.55,0.65,0.85)*uDoor*1.2*smoothstep(0.3,0.9,dot(d, normalize(vec3(-0.85,0.4,-0.55))));
  vec3 ember = vec3(1.0,0.3,0.05)*uEmber*0.3*sat(-d.y*0.5+0.3);
  return wall + fire + door + ember + 0.005;
}

void main(){
  vec3 ro = uCamPos, rd = camRay(gl_FragCoord.xy);
  float t = 0.0; vec2 h = vec2(0); bool hit = false;
  for(int i=0;i<140;i++){
    h = kilnMap(ro+rd*t);
    if(h.x < 0.0004*t+0.0004){ hit=true; break; }
    t += h.x*0.9;
    if(t>30.0) break;
  }
  vec3 col = vec3(0);
  if(hit){
    vec3 p = ro+rd*t;
    vec3 n = kilnNormal(p);
    vec3 v = -rd;
    Surf s;
    vec3 emitWall = vec3(0);
    if(h.y==1.0){
      s = bowlSurface(p, n, v);
    } else {
      s = defaultSurf(n);
      vec2 cell; float mortar = brickPattern(p, cell);
      float hb = hash12(cell);
      vec3 brick = mix(vec3(0.35,0.2,0.12), vec3(0.5,0.35,0.22), hb);
      // ash glaze runs on the bricks: greenish glassy drips
      float drip = smoothstep(0.55,0.85, fbm(vec2(p.z*1.5, p.y*0.3+atan(p.x,p.y)*3.0),3)+0.4*hb);
      brick = mix(brick, vec3(0.2,0.25,0.12), drip*0.7);
      if(h.y==3.0) brick = vec3(0.3,0.27,0.24)*(0.8+0.3*fbm(p.xz*4.0,3));
      if(h.y==4.0){
        // iron body, natural ash glaze gathered on the shoulders, glassy where it ran
        float ashTop = smoothstep(0.15, 0.75, n.y + 0.35*fbm(p*vec3(4.0,1.5,4.0),3));
        brick = mix(vec3(0.07,0.045,0.03), vec3(0.24,0.23,0.12), ashTop);
      }
      s.alb = mix(brick, brick*0.5, smoothstep(0.05,0.0,mortar)*step(h.y,2.5)*step(1.5,h.y));
      s.rough = 0.85; s.coat = drip*0.8*step(h.y,2.5); s.coatRough = 0.1;
      if(h.y==4.0){ s.coat = 0.9; s.coatRough = 0.12; s.rough = 0.5; }
      // incandescent kiln walls (hotter further in; white-hot at the peak)
      float T = (mix(800.0, 1250.0, uWallT) + 180.0*uWhite)*(0.9+0.1*hb)*(1.0+0.05*sat(p.z*0.2));
      emitWall = blackbody(T)*pow(uWallT,2.2)*(0.35+0.4*sat(p.z*0.15))*(h.y==4.0?0.5:1.0);
      // after the fire: a smouldering bed of ash, embers breathing under grey skin, deeper in
      if(h.y==3.0){
        float e1 = fbm(vec3(p.xz*2.6, uTime*0.08), 4);
        float cr = 1.0-smoothstep(0.0, 0.06, abs(gnoise(p.xz*4.5)));
        float bed = smoothstep(-0.02, 0.25, e1)*(0.4+0.6*cr) * smoothstep(-0.5, 2.5, p.z);
        float breathe = 0.75+0.25*sin(uTime*1.3+e1*9.0);
        emitWall += blackbody(mix(850.0, 1100.0, bed))*uEmber*bed*bed*breathe*2.2;
      }
    }
    // lighting: fire as a big warm light from behind/below, door daylight from the camera side
    vec3 fireL = normalize(vec3(0.0, 0.35, 1.0));
    vec3 fireC = blackbody(1350.0+300.0*uWhite)*uFire*2.2;
    vec3 doorL = normalize(vec3(-0.85, 0.5, -0.55));
    vec3 doorC = vec3(0.7,0.8,1.0)*uDoor*1.8;
    float nv = sat(dot(s.cn,v));
    float Fc = s.coat*F_Schlick1(0.04,nv);
    vec3 amb = kilnEnv(s.n)*0.8;
    vec3 dif = s.alb*(1.0-Fc)*(fireC*sat(dot(s.n,fireL)*0.6+0.4) + doorC*sat(dot(s.n,doorL)) + amb);
    vec3 sp = specGGX(s.n, v, fireL, s.rough, s.f0)*fireC + specGGX(s.n, v, doorL, s.rough, s.f0)*doorC;
    vec3 coat = s.coat*(specGGX(s.cn, v, fireL, s.coatRough, vec3(0.04))*fireC + specGGX(s.cn, v, doorL, s.coatRough, vec3(0.04))*doorC
                        + kilnEnv(reflect(-v,s.cn))*F_Schlick1(0.04,nv)*2.0);
    // flames mirrored in the molten glaze
    if(h.y==1.0 && uFire>0.01){
      vec3 rr = reflect(-v, s.cn);
      float c1, c2;
      float f1 = fireField(p+rr*0.9, c1), f2 = fireField(p+rr*2.2, c2);
      vec3 fr = blackbody(1250.0+400.0*max(c1,c2)+300.0*uWhite)*(f1*(0.2+c1)+f2*(0.2+c2)*0.7)*uFire*1.4;
      coat += fr*s.coat*F_Schlick1(0.04,nv)*(1.0+3.0*uMelt);
    }
    col = dif + sp + coat + s.emit + emitWall;
  } else t = 30.0;

  // volumetric fire (emission + absorption), clipped to the firebox region
  if(uFire>0.01){
    vec3 bmin = vec3(-3.2, 0.0, -1.6), bmax = vec3(3.2, 3.4, 5.5);
    vec3 ird = 1.0/rd;
    vec3 t0 = (bmin-ro)*ird, t1 = (bmax-ro)*ird;
    vec3 tmn = min(t0,t1), tmx = max(t0,t1);
    float ta = max(max(max(tmn.x,tmn.y),tmn.z), 0.0), tb = min(min(min(tmx.x,tmx.y),tmx.z), t);
    if(tb>ta){
      const int N = 36;
      float dt = (tb-ta)/float(N);
      float tt = ta + dt*ign(gl_FragCoord.xy + fract(uTime*7.0)*61.0);
      vec3 acc = vec3(0); float tr = 1.0; float dw = 0.0, dsum = 0.0;
      for(int i=0;i<N;i++){
        vec3 p = ro+rd*tt;
        float core;
        float d = fireDensity(p, core)*smoothstep(0.6, 1.6, tt);
        if(d>0.001){
          // cooler, redder skirts; hot cores; the whole fire whitens toward the peak
          float T = mix(1050.0, 1650.0, core) + 350.0*uWhite*core;
          vec3 e = blackbody(T)*d*(0.15+1.4*core)*mix(2.0, 3.0, uWhite);
          acc += tr*e*dt;
          float wl = tr*luma(e)*dt; dw += wl*tt; dsum += wl;
          tr *= exp(-d*0.9*dt);
        }
        tt += dt;
        if(tr<0.02) break;
      }
      col = col*tr + acc;
      // depth for DOF: where the flames dominate, focus on them
      if(dsum>1e-4) t = mix(dw/dsum, t, sat(tr*1.5));
    }
  }
  // ash / sparks: drifting toward the camera
  float sparks = uFire*0.9 + uEmber*0.2;
  if(sparks>0.01){
    for(int l=0;l<5;l++){
      float z = 1.0+float(l)*1.3;
      if(z>t) break;
      vec3 p = ro+rd*z;
      p.z += uTime*1.7; p.y -= uTime*0.35;
      vec3 cell = floor(p*4.0);
      vec3 hh = hash33(cell+float(l)*13.0);
      vec3 spp = (cell+0.5+0.35*sin(hh*6.28+uTime*2.0))/4.0;
      spp.z -= uTime*1.7; spp.y += uTime*0.35;
      vec3 w = spp-ro; float tp = dot(w,rd);
      float d = length(w-rd*tp);
      if(hh.x>0.9) col += blackbody(1500.0+hh.y*600.0)*sparks*0.0015/(d*d*2500.0+0.002);
    }
  }
  // door light haze
  col += vec3(0.5,0.6,0.8)*uDoor*0.03*pow(sat(dot(rd, normalize(vec3(-0.85,0.4,-0.55)))*0.5+0.5), 3.0);
  fragColor = vec4(col, t);
}
