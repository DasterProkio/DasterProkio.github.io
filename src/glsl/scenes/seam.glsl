// ---------------------------------------------------------------- scene: THE SEAM
// A continuous zoom from millimetres to the whole bowl. The cracks are real
// geometry (thin canyons carved through the wall); molten gold flows along them
// from the point of impact and cools into the kintsugi seams.
uniform float uGap;        // half-width of the crack canyon (0 = closed)
uniform float uFlow;       // gold front distance from the source
uniform vec3  uSource;     // where the gold starts (bowl local)
uniform float uCool;       // how far behind the front the gold cools
uniform vec3  uKeyDir;
uniform float uRoomLight;  // 0 void rig, 1 morning room light (end of scene)
uniform float uAlt;        // camera altitude (for detail LOD)
out vec4 fragColor;

// seam field restricted to near the bowl
float crackD(vec3 p, out float bd){
  vec3 sf = seamField(p);
  bd = sf.x;
  return sf.x;
}

// ids: 1 glaze/body, 2 gold
vec2 seamMap(vec3 p){
  float b = sdBowl(p);
  if(b > 0.03) return vec2(b, 1.0);
  float bd = seamField(p).x;
  // rough fracture walls
  float rough = 0.0;
  if(bd < uGap*4.0+0.004) rough = 0.00045*gnoise(p*900.0) + 0.0012*gnoise(p*260.0);
  float wall = (uGap + rough) - bd;          // >0 inside the canyon
  float d = max(b, wall*0.9);
  vec2 r = vec2(d, 1.0);
  // gold: fills the canyon and domes slightly above the glaze
  float front = length(p-uSource) - uFlow;
  float gw = uGap + 0.0028 + 0.0012*gnoise(p*120.0);
  float g = max(max(bd - gw, b - 0.0007), front);
  if(g < r.x) r = vec2(g, 2.0);
  return r;
}

float macroRipple(vec3 p){ return gnoise(p*180.0)*0.6 + gnoise(p*520.0)*0.25; }

vec3 seamNormal(vec3 p, float eps){
  const vec2 k = vec2(1,-1);
  return normalize(k.xyy*seamMap(p+k.xyy*eps).x + k.yyx*seamMap(p+k.yyx*eps).x +
                   k.yxy*seamMap(p+k.yxy*eps).x + k.xxx*seamMap(p+k.xxx*eps).x);
}

float seamShadow(vec3 ro, vec3 rd, float k, float scale){
  float res = 1.0, t = scale*0.02;
  for(int i=0;i<40;i++){
    float h = seamMap(ro+rd*t).x;
    res = min(res, k*h/t);
    t += clamp(h, scale*0.01, scale*0.5);
    if(res<0.003 || t>scale*40.0) break;
  }
  return sat(res);
}

vec3 envSeam(vec3 d){
  vec3 dark = mix(vec3(0.004,0.004,0.006), vec3(0.012,0.010,0.009), d.y*0.5+0.5);
  // a warm horizon, like the light of the gold itself, and one large soft key
  dark += vec3(1.0,0.55,0.25)*0.35*exp(-abs(d.y-0.02)*7.0)*(0.55+0.45*d.z);
  vec3 kd = normalize(uKeyDir);
  float k = dot(d, kd);
  dark += vec3(1.0,0.85,0.66)*(9.0*smoothstep(0.994,0.9985,k) + 0.5*pow(sat(k),24.0));
  dark += vec3(0.6,0.62,0.7)*0.06*sat(d.y);
  // morning room: warm window glow from +z, soft sky
  vec3 room = mix(vec3(0.06,0.05,0.045), vec3(0.5,0.48,0.45), smoothstep(-0.2,0.6,d.z)*smoothstep(-0.3,0.4,d.y));
  room += vec3(2.5,2.2,1.8)*smoothstep(0.75,0.95,d.z)*smoothstep(-0.1,0.2,d.y)*smoothstep(0.7,0.3,d.y);
  return mix(dark, room, uRoomLight);
}

void main(){
  vec3 ro = uCamPos, rd = camRay(gl_FragCoord.xy);
  float scale = max(uAlt, 0.0015);
  float t = 0.0; vec2 h = vec2(0); bool hit = false;
  // bounding sphere of the bowl
  vec3 oc = ro-vec3(0,0.36,0);
  float bb = dot(oc,rd), cc = dot(oc,oc)-0.72*0.72, disc = bb*bb-cc;
  if(disc>0.0){
    t = max(-bb-sqrt(disc), 0.0);
    float tend = -bb+sqrt(disc);
    for(int i=0;i<180;i++){
      h = seamMap(ro+rd*t);
      if(h.x < 0.00025*t + scale*0.0015){ hit = true; break; }
      t += h.x*0.8;
      if(t>tend) break;
    }
  }
  vec3 col = envSeam(rd);
  float depth = 1e3;
  if(hit){
    vec3 p = ro+rd*t;
    float eps = max(0.00012, t*0.0008);
    vec3 n = seamNormal(p, eps);
    vec3 v = -rd;
    vec3 L = normalize(uKeyDir);
    vec3 key = mix(vec3(1.0,0.85,0.66)*2.2, vec3(1.0,0.9,0.75)*3.0, uRoomLight);
    float bd = seamField(p).x;
    // light from the molten gold nearby (canyon glow)
    float front = length(p-uSource) - uFlow;
    float behind = -front;
    float molten = sat(1.0 - behind/max(uCool,1e-3));
    vec3 goldGlow = vec3(1.0,0.5,0.14)*5.0*molten*step(front,0.0);
    float nearGold = exp(-max(bd-uGap,0.0)/(scale*0.6+0.0015));
    float sh = seamShadow(p+n*eps*2.0, L, 10.0, max(scale,0.02));
    if(h.y==2.0){
      // gold: molten (emissive, rippling) cooling to burnished metal
      Surf s = defaultSurf(n);
      vec3 rip = vec3(gnoise(p*400.0+uTime*0.8), 0.0, gnoise(p*400.0+7.0-uTime*0.6))*0.25*molten;
      s.n = normalize(n + rip);
      s.alb = vec3(0.0); s.f0 = vec3(1.0,0.74,0.32); s.rough = mix(0.18, 0.35, molten);
      float nv = sat(dot(s.n,v));
      vec3 spec = specGGX(s.n, v, L, s.rough, s.f0)*key*sh;
      vec2 eb = envBRDF(nv, s.rough);
      spec += envSeam(reflect(-v,s.n))*(s.f0*eb.x+eb.y)*1.5;
      col = spec + goldGlow*0.25*(0.5+0.5*gnoise(p*300.0-uTime))*molten + vec3(1.0,0.42,0.08)*molten*molten*0.7;
    } else {
      float b = sdBowl(p);
      bool wallFace = (bd < uGap + 0.003) && b < -0.0004;
      Surf s;
      if(!wallFace){
        s = bowlSurface(p, n, v);
        // macro detail on the glaze: fine ripples and pinholes
        if(scale < 0.08){
          float det = 1.0-smoothstep(0.02,0.08,scale);
          vec3 cn = s.cn;
          BUMP(cn, p, macroRipple, 0.0003, 0.0009*det);
          float pin = smoothstep(0.08,0.0,voronoiB(p*350.0).z)*step(0.85,hash13(floor(p*350.0)));
          s.cn = normalize(cn + (hash33(floor(p*350.0))-0.5)*pin*0.6*det);
        }
      } else {
        // fracture wall: fired clay body, the glaze a glassy band at the lip
        s = defaultSurf(n);
        float grain = gnoise(p*700.0)*0.5+gnoise(p*2100.0)*0.25;
        s.alb = vec3(0.62,0.55,0.46)*(0.85+0.25*grain);
        s.alb = mix(s.alb, vec3(0.22,0.12,0.07), smoothstep(0.75,0.95,vnoise(p*500.0))*0.6);
        float depthIn = -b;
        s.alb = mix(s.alb, vec3(0.42,0.6,0.54), smoothstep(0.012,0.006,depthIn)*0.85);
        s.rough = 0.85;
      }
      float nl = sat(dot(s.n,L));
      float nv = sat(dot(s.cn,v));
      float Fc = s.coat*F_Schlick1(0.04,nv);
      vec3 amb = envSeam(s.n)*0.9 + vec3(0.02,0.022,0.03)*(1.0-uRoomLight);
      col = s.alb*(1.0-Fc)*(key*nl*sh + amb + goldGlow*nearGold*0.35)
          + s.coat*(specGGX(s.cn, v, L, s.coatRough, vec3(0.04))*key*sh + envSeam(reflect(-v,s.cn))*F_Schlick1(0.04,nv))
          + specGGX(s.n, v, L, s.rough, s.f0)*key*sh;
      // subsurface: glaze glows with gold light nearby
      col += vec3(0.8,0.6,0.25)*s.coat*nearGold*molten*0.25*step(front, 0.02);
    }
    depth = t;
  }
  fragColor = vec4(col, depth);
}
