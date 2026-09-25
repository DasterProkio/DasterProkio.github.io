// ---------------------------------------------------------------- scene: FIRE (kiln)
// Inside a wood-fired tunnel kiln. Flames pour from the firebox (+z) past the
// bowl toward the camera. Later the fire dies and the door is opened to dawn.
uniform float uFire;      // flame intensity 0..1
uniform float uWallT;     // wall incandescence 0..1
uniform float uDoor;      // cool daylight through the opened door (camera side)
uniform float uEmber;     // ember bed glow after the fire dies
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
  // other wares further in: a jar with a neck, a bowl, a tall vase
  vec3 q = p-vec3(-1.7,0.0,2.8);
  vec2 jq = vec2(length(q.xz), q.y);
  float jar = length((jq-vec2(0.0,0.75))/vec2(0.85,0.75))*0.75-0.75;
  jar = smin(jar, sdSeg(jq, vec2(0.0,1.3), vec2(0.0,1.75))-0.32, 0.12);
  jar = max(jar, -(sdSeg(jq, vec2(0.0,1.2), vec2(0.0,1.9))-0.24));
  jar = max(jar, -q.y);
  q = p-vec3(1.8,0.0,3.6);
  vec2 bq = vec2(length(q.xz), q.y);
  float b2 = abs(length(bq-vec2(0.0,0.95))-0.8)-0.05;
  b2 = max(b2, max(-q.y, q.y-0.9));
  q = p-vec3(0.3,0.0,6.5);
  vec2 vq = vec2(length(q.xz), q.y);
  float b3 = length((vq-vec2(0.0,1.3))/vec2(0.7,1.3))*0.7-0.7;
  b3 = max(smin(b3, sdSeg(vq, vec2(0.0,2.4), vec2(0.0,3.0))-0.25, 0.15), -q.y);
  float wares = min(jar, min(b2, b3));
  if(wares<r.x) r = vec2(wares, 4.0);
  return r;
}

vec3 kilnNormal(vec3 p){
  const vec2 e = vec2(0.0008,-0.0008);
  return normalize(e.xyy*kilnMap(p+e.xyy).x + e.yyx*kilnMap(p+e.yyx).x + e.yxy*kilnMap(p+e.yxy).x + e.xxx*kilnMap(p+e.xxx).x);
}

// fire density: turbulent tongues flowing toward -z and rising
float fireDensity(vec3 p){
  vec3 q = p;
  float t = uTime;
  q.z += t*2.2;
  q.y -= t*0.6;
  vec3 w = vec3(vnoise(q*0.9), vnoise(q*0.9+7.1), vnoise(q*0.9+3.3));
  q += (w-0.5)*1.6;
  vec3 qa = q*vec3(1.4,0.9,0.45);                 // tongues elongated along the flow
  float n = vnoise(qa*1.3)*0.55 + vnoise(qa*2.9)*0.3 + vnoise(qa*6.1)*0.15;
  float ridge = 1.0-abs(2.0*vnoise(qa*2.2+vec3(0,0,t*0.5))-1.0);
  n = n*0.7 + ridge*ridge*0.45;
  // shape: fills the lower tunnel, thicker toward the firebox
  float h = p.y;
  float shape = smoothstep(2.6, 0.2, h - 0.25*p.z) * smoothstep(-4.0, 2.0, p.z) * smoothstep(-0.1, 0.3, h);
  float d = sat(n*2.6 - 1.45 + 0.55*shape) * shape;
  // flames hug the bowl: licking tongues around its surface, none inside
  float sb = sdBowl(p);
  d *= smoothstep(0.0, 0.08, sb);
  d += 0.5*exp(-sb*7.0)*sat(n-0.35)*step(0.0,sb)*smoothstep(0.0,0.5,h);
  return d*uFire;
}

vec3 kilnEnv(vec3 d){
  // what glossy surfaces reflect: glowing brick, fire, and later the door
  vec3 wall = blackbody(mix(800.0, 1250.0, uWallT))*uWallT*uWallT*1.0;
  vec3 fire = blackbody(1400.0)*uFire*1.2*sat(d.z*0.5+0.6);
  vec3 door = vec3(0.55,0.65,0.85)*uDoor*1.2*smoothstep(0.3,0.9,-d.z);
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
      if(h.y==4.0){ brick = mix(vec3(0.12,0.07,0.04), vec3(0.28,0.22,0.1), smoothstep(0.4,0.7,fbm(p*3.0,3)+0.3)); }
      s.alb = mix(brick, brick*0.5, smoothstep(0.05,0.0,mortar)*step(h.y,2.5)*step(1.5,h.y));
      s.rough = 0.85; s.coat = drip*0.8*step(h.y,2.5); s.coatRough = 0.1;
      // incandescent kiln walls (hotter further in)
      float T = mix(800.0, 1250.0, uWallT)*(0.9+0.1*hb)*(1.0+0.05*sat(p.z*0.2));
      emitWall = blackbody(T)*pow(uWallT,2.2)*(0.5+0.5*sat(p.z*0.15))*(h.y==4.0?0.5:1.0);
      vec3 ev = voronoiB(vec3(p.xz*9.0, uTime*0.1));
      emitWall += vec3(1.0,0.25,0.04)*uEmber*1.5*step(h.y,3.5)*step(2.5,h.y)*smoothstep(0.35,0.1,ev.z)*step(0.6,ev.y)*smoothstep(0.3,0.7,vnoise(p*2.0));
    }
    // lighting: fire as a big warm light from behind/below, door daylight from the camera side
    vec3 fireL = normalize(vec3(0.0, 0.35, 1.0));
    vec3 fireC = blackbody(1350.0)*uFire*2.5;
    vec3 doorL = normalize(vec3(0.3, 0.45, -1.0));
    vec3 doorC = vec3(0.7,0.8,1.0)*uDoor*1.8;
    float nv = sat(dot(s.cn,v));
    float Fc = s.coat*F_Schlick1(0.04,nv);
    vec3 amb = kilnEnv(s.n)*0.8;
    vec3 dif = s.alb*(1.0-Fc)*(fireC*sat(dot(s.n,fireL)*0.6+0.4) + doorC*sat(dot(s.n,doorL)) + amb);
    vec3 sp = specGGX(s.n, v, fireL, s.rough, s.f0)*fireC + specGGX(s.n, v, doorL, s.rough, s.f0)*doorC;
    vec3 coat = s.coat*(specGGX(s.cn, v, fireL, s.coatRough, vec3(0.04))*fireC + specGGX(s.cn, v, doorL, s.coatRough, vec3(0.04))*doorC
                        + kilnEnv(reflect(-v,s.cn))*F_Schlick1(0.04,nv)*2.0);
    col = dif + sp + coat + s.emit + emitWall;
  } else t = 30.0;

  // volumetric fire (emission + absorption)
  if(uFire>0.01){
    float tEnd = min(t, 14.0);
    const int N = 26;
    float dt = tEnd/float(N);
    float tt = dt*ign(gl_FragCoord.xy + fract(uTime*7.0)*61.0);
    vec3 acc = vec3(0); float tr = 1.0; float dw = 0.0, dsum = 0.0;
    for(int i=0;i<N;i++){
      vec3 p = ro+rd*tt;
      float d = fireDensity(p);
      if(d>0.001){
        float T = 1000.0 + 900.0*sat(d*1.6);
        vec3 e = blackbody(T)*d*(0.4+d)*7.0;
        acc += tr*e*dt;
        float wl = tr*luma(e)*dt; dw += wl*tt; dsum += wl;
        tr *= exp(-d*0.35*dt);
      }
      tt += dt;
    }
    col = col*tr + acc;
    // depth for DOF: where the flames dominate, focus on them
    if(dsum>1e-4) t = mix(dw/dsum, t, sat(tr*1.5));
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
  col += vec3(0.5,0.6,0.8)*uDoor*0.02*sat(-rd.z);
  fragColor = vec4(col, t);
}
