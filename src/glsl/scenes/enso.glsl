// ---------------------------------------------------------------- scene: ENSŌ
// Rice paper, top-down. One breath: a brush circle. Also the gold ensō at the end.
uniform float uStroke;    // stroke progress 0..1
uniform float uWet;       // wet sheen 0..1
uniform float uGoldInk;   // 0 sumi, 1 gold
uniform float uZoom;      // view half-height in paper units
uniform vec2  uCenter;    // view centre
uniform float uPaperL;    // paper illumination
uniform float uFadeInk;   // ink fading out (for the final transition), 0..1
out vec4 fragColor;

#define R0 1.0
#define TH0 (-2.25)
#define SPAN 5.55

float fiberField(vec2 p){
  float f = 0.0;
  for(int i=0;i<4;i++){
    float a = float(i)*1.7+0.4;
    vec2 q = rot(a)*p;
    q += 0.3*vec2(gnoise(p*2.0+float(i)), 0.0);
    float n = gnoise(q*vec2(2.0, 60.0)+float(i)*13.0);
    float line = smoothstep(0.08, 0.0, abs(n))*smoothstep(0.2,0.6,vnoise(q*vec2(0.8,3.0)+float(i)));
    f += line;
  }
  return f;
}
float paperHeight(vec2 p){
  return fbm(p*6.0,4)*0.5 + fiberField(p)*0.35 + gnoise(p*90.0)*0.08;
}

// brush pressure along the stroke (0..1 arc parameter)
float pressure(float u){
  float touch = mix(0.75, 1.0, smoothstep(0.0,0.03,u));   // the brush lands already loaded: no neck after the pool
  float body = mix(1.25, 0.8, smoothstep(0.02,0.35,u)) * mix(1.0, 0.55, smoothstep(0.55,1.0,u));
  return touch*body;
}
float inkLoad(float u){ return 1.0 - smoothstep(0.55, 1.02, u); }

// returns ink coverage, and wetness weight in y
vec2 ensoInk(vec2 p){
  float r = length(p);
  float th = atan(p.y, p.x);
  // unwrap relative to the start, travelling counter-clockwise
  float a = th - TH0;
  a = mod(a, TAU);
  float u = a/SPAN;
  // centreline wobble and a slight spiral inward at the end
  float Rc = R0*(1.0 + 0.018*sin(th*3.0+0.7) + 0.01*sin(th*7.0) - 0.035*smoothstep(0.7,1.0,u));
  float w = 0.13*pressure(u);
  float d = r - Rc;
  // the gap after the stroke end, and the unpainted part
  float painted = step(u, uStroke) * step(u, 1.0);
  // brush head: rounded tip at the current position
  float headU = min(uStroke, 1.0);
  vec2 hp = vec2(cos(TH0+headU*SPAN), sin(TH0+headU*SPAN))*R0;
  float tip = smoothstep(w*0.9, w*0.6, length(p-hp))*step(uStroke,0.999)*step(0.005,uStroke);
  // bristle streaks along the stroke: v across, streak noise along u
  float v = d/max(w,1e-3);
  float bristle = vnoise(vec2(v*14.0, u*3.0)) * 0.6 + vnoise(vec2(v*37.0, u*9.0))*0.4;
  float load = inkLoad(u);
  // dry brush: gaps appear where bristles run out of ink
  float dry = smoothstep(load-0.25, load+0.05, bristle*(0.65+0.35*abs(v)));
  float feather = 0.05*(fiberField(p*1.3)-0.5) + 0.03*gnoise(p*40.0);
  float edge = smoothstep(1.0+feather*6.0, 0.86+feather*6.0, abs(v));
  float cov = edge*(1.0-dry)*painted*smoothstep(0.0, 0.006, u);
  // start: ink pools where the brush touched down
  vec2 sp = vec2(cos(TH0), sin(TH0))*R0;
  float capR = 0.13*1.05;
  float pool = smoothstep(capR, capR*0.8, length(p-sp) + 0.012*gnoise(p*30.0) + 0.01*(fiberField(p*1.3)-0.5))*step(0.001,uStroke);
  cov = max(cov, pool);
  // the tip carries the same ink load and dry-brush breakup as the stroke behind it
  float loadH = inkLoad(headU);
  float dryH = smoothstep(loadH-0.25, loadH+0.05, bristle*(0.65+0.35*abs(v)));
  cov = max(cov, tip*(1.0-dryH)*smoothstep(0.05, 0.4, loadH));
  float poolD = pool;
  // ink density varies: darker where the bristles pressed, lighter in the dry tail
  float dens = mix(0.8, 1.0, bristle)*mix(1.0, 0.75, smoothstep(0.55,1.0,u)*step(0.02,u));
  dens = max(dens, poolD);
  // how recently painted (for the wet sheen)
  float age = max(uStroke - u, 0.0);
  float wet = exp(-age*3.5)*painted;
  return vec2(sat(cov), wet + 10.0*floor(dens*100.0)/100.0);
}

void main(){
  vec2 uv = (2.0*(gl_FragCoord.xy+uJitter)-uRes)/uRes.y;
  vec2 p = uCenter + uv*uZoom;
  // paper
  float h = paperHeight(p);
  vec2 e = vec2(0.002, 0.0);
  vec2 g = vec2(paperHeight(p+e.xy)-h, paperHeight(p+e.yx)-h)/e.x;
  vec3 n = normalize(vec3(-g*0.004, 1.0));
  vec3 L = normalize(vec3(-0.6, 0.5, 0.65));
  float diff = 0.75 + 0.35*dot(n, L);
  vec3 paper = vec3(0.95,0.905,0.82)*(0.96+0.06*fbm(p*3.0,3))*diff;
  paper += vec3(0.02,0.015,0.0)*fiberField(p);
  vec2 ink = ensoInk(p);
  float dens = floor(ink.y/10.0*100.0+0.5)/100.0; ink.y = ink.y - dens*10.0;
  ink.x *= 1.0-uFadeInk;
  // sumi: nearly black where loaded, a warm grey where the brush ran dry
  vec3 sumi = mix(vec3(0.05,0.047,0.045), vec3(0.003,0.003,0.0045), smoothstep(0.72,0.95,dens));
  vec3 gold = vec3(0.0);
  vec3 col = mix(paper, sumi, ink.x*0.96);
  if(uGoldInk>0.0){
    // gold leaf laid with the brush: brushed metal, streaks running along the stroke,
    // a slow light sweeping across it so the leaf breathes
    float th = atan(p.y, p.x), r = length(p);
    vec2 radial = p/max(r,1e-4);
    float streak = vnoise(vec2(r*95.0, th*5.0))*0.6 + vnoise(vec2(r*280.0, th*13.0))*0.4;
    vec3 gn = normalize(vec3(radial*(streak-0.5)*1.1 + vec2(gnoise(p*55.0), gnoise(p*55.0+5.0))*0.3, 1.0));
    float ang = uTime*0.3;
    vec3 Lg = normalize(vec3(cos(ang)*0.75, 0.35+sin(ang)*0.55, 0.55));
    vec3 H = normalize(Lg + vec3(0,0,1));
    float nh = sat(dot(gn,H));
    vec3 gAlb = vec3(0.80,0.55,0.19)*(0.8+0.35*fbm(p*14.0,3));
    gold = gAlb*(0.3 + 0.6*pow(nh,5.0)) + vec3(1.0,0.82,0.48)*pow(nh,40.0)*1.3;
    col = mix(paper, gold, smoothstep(0.2, 0.75, ink.x)*uGoldInk);
  }
  // wet sheen: soft specular on fresh ink
  vec3 V = vec3(0,0,1);
  float spec = pow(sat(dot(reflect(-L, normalize(n*0.2+vec3(0,0,1))), V)), 40.0);
  col += vec3(0.25)*spec*ink.y*ink.x*uWet;
  col *= uPaperL;
  fragColor = vec4(col, 3.0);
}
