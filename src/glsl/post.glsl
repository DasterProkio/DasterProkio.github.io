//@@ POST_COMPOSITE
// Transition compositor: blends scene A and B in world space.
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uA, uB;
uniform float uMix;       // 0 = A only, 1 = B only
uniform int   uMode;      // 0 crossfade, 1 ember burn, 2 ink bleed, 3 light bloom, 4 dark void
uniform vec3  uCamPos; uniform mat3 uCamRot; uniform float uFov; uniform vec2 uRes;
uniform vec3  uCenter;    // world-space origin of the transition front
uniform float uTime;

float h12(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float vn(vec3 p){
  vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  float n=dot(i,vec3(1.0,57.0,113.0));
  #define H(x) fract(sin(x)*43758.5453)
  return mix(mix(mix(H(n),H(n+1.0),f.x),mix(H(n+57.0),H(n+58.0),f.x),f.y),
             mix(mix(H(n+113.0),H(n+114.0),f.x),mix(H(n+170.0),H(n+171.0),f.x),f.y),f.z);
  #undef H
}
float fbm3(vec3 p){ return 0.5*vn(p)+0.25*vn(p*2.1)+0.125*vn(p*4.3)+0.0625*vn(p*8.7); }

void main(){
  vec4 a = texture(uA, vUv), b = texture(uB, vUv);
  if(uMode==0 || uMix<=0.0 || uMix>=1.0){ o = mix(a,b,uMix); return; }
  vec2 uv = (2.0*gl_FragCoord.xy-uRes)/uRes.y;
  vec3 rd = normalize(uCamRot*vec3(uv*uFov,1.0));
  // use the nearer surface to place the front in the world
  float dA = a.a, dB = b.a;
  vec3 pw = uCamPos + rd*min(dA, dB);
  float r = length(pw-uCenter);
  if(uMode==1){
    // ember burn: a noisy front grows outward from the centre, glowing edge
    float n = fbm3(pw*1.3+vec3(0.0,-uTime*0.3,0.0));
    float front = uMix*14.0 - r + (n-0.5)*3.5;
    float k = smoothstep(0.0, 0.35, front);
    float edge = exp(-abs(front)*5.0)*step(0.0, 1.0-k)*(1.0-uMix*0.5);
    vec3 c = mix(a.rgb, b.rgb, k);
    c += vec3(3.0,0.9,0.18)*edge*(0.5+n);
    o = vec4(c, mix(a.a,b.a,k));
  } else if(uMode==2){
    // ink bleed: screen-space-ish radial with fibre noise
    float n = fbm3(vec3(uv*6.0, 1.0));
    float front = uMix*2.6 - length(uv)*1.2 + (n-0.5)*0.8;
    float k = smoothstep(-0.05, 0.1, front);
    o = mix(a, b, k);
  } else if(uMode==3){
    // light bloom: the world brightens into white light then settles into B
    float w = sin(uMix*3.14159);
    vec4 m = mix(a,b,smoothstep(0.3,0.7,uMix));
    o = vec4(m.rgb + w*w*2.5*vec3(1.0,0.85,0.6)*(0.4+0.6*fbm3(pw*0.5)), m.a);
  } else {
    // dark void: world dissolves into darkness from the edges of the frame
    float n = fbm3(pw*0.8);
    float k = smoothstep(0.0, 0.3, uMix*1.6 - length(uv)*0.5 - n*0.5);
    o = mix(a, b, k);
  }
}

//@@ POST_COC
// Circle of confusion (pixels, signed: <0 near) into alpha; colour premultiplied weight
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uSrc;
uniform float uFocus, uAperture, uMaxCoc;
void main(){
  vec4 c = texture(uSrc, vUv);
  float d = c.a;
  float coc = uAperture*(d-uFocus)/max(d,1e-3);
  coc = clamp(coc*uMaxCoc, -uMaxCoc, uMaxCoc);
  o = vec4(c.rgb, coc);
}

//@@ POST_DOF
// Half-res gather bokeh (golden-angle spiral). Input: rgb + signed CoC in pixels (full res units).
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uSrc; uniform vec2 uTexel; uniform float uMaxCoc;
void main(){
  vec4 c0 = texture(uSrc, vUv);
  float r0 = abs(c0.a);
  vec3 acc = vec3(0); float wsum = 0.0;
  const int N = 40;
  float ga = 2.39996323;
  float radius = uMaxCoc;
  for(int i=0;i<N;i++){
    float fi = float(i)+0.5;
    float r = sqrt(fi/float(N))*radius;
    vec2 off = vec2(cos(fi*ga), sin(fi*ga))*r;
    vec4 s = textureLod(uSrc, vUv+off*uTexel, 0.0);
    float cs = abs(s.a);
    // sample contributes if its CoC covers this distance; background samples
    // cannot bleed over sharper foreground
    float w = smoothstep(r-1.0, r+0.5, cs);
    if(s.a > c0.a+2.0) w *= smoothstep(r-1.0, r+0.5, r0);  // farther sample, only if we are blurry too
    // bokeh highlights: slight boost of bright samples
    w *= 1.0 + 0.8*smoothstep(1.5, 6.0, dot(s.rgb, vec3(0.3,0.5,0.2)));
    acc += s.rgb*w; wsum += w;
  }
  vec3 col = wsum>0.0 ? acc/wsum : c0.rgb;
  o = vec4(col, r0);
}

//@@ POST_DOFMIX
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uSharp, uBlur;
void main(){
  vec4 s = texture(uSharp, vUv);
  vec4 b = texture(uBlur, vUv);
  float k = smoothstep(0.6, 2.2, abs(s.a));
  // near-field blur spills over: use blurred coc too
  k = max(k, smoothstep(0.8, 2.5, b.a));
  o = vec4(mix(s.rgb, b.rgb, k), s.a);
}

//@@ POST_DOWN
// 13-tap downsample (CoD / Jimenez) with a soft threshold on the first level
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uSrc; uniform vec2 uTexel; uniform float uThresh; uniform int uFirst;
vec3 s(vec2 d){ return texture(uSrc, vUv+d*uTexel).rgb; }
void main(){
  vec3 a=s(vec2(-2,2)), b=s(vec2(0,2)), c=s(vec2(2,2));
  vec3 d=s(vec2(-2,0)), e=s(vec2(0,0)), f=s(vec2(2,0));
  vec3 g=s(vec2(-2,-2)), h=s(vec2(0,-2)), i=s(vec2(2,-2));
  vec3 j=s(vec2(-1,1)), k=s(vec2(1,1)), l=s(vec2(-1,-1)), m=s(vec2(1,-1));
  vec3 col = e*0.125 + (a+c+g+i)*0.03125 + (b+d+f+h)*0.0625 + (j+k+l+m)*0.125;
  if(uFirst==1){
    float br = max(col.r, max(col.g, col.b));
    float soft = clamp(br-uThresh+0.5, 0.0, 1.0);
    soft = soft*soft*0.5;
    float contrib = max(soft, br-uThresh)/max(br, 1e-4);
    col *= contrib;
    col = min(col, vec3(60.0));
  }
  o = vec4(col, 1.0);
}

//@@ POST_UP
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uSrc, uPrev; uniform vec2 uTexel; uniform float uRadius;
void main(){
  vec2 d = uTexel*uRadius;
  vec3 c = texture(uSrc, vUv+vec2(-d.x,d.y)).rgb + 2.0*texture(uSrc, vUv+vec2(0,d.y)).rgb + texture(uSrc, vUv+d).rgb
         + 2.0*texture(uSrc, vUv+vec2(-d.x,0)).rgb + 4.0*texture(uSrc, vUv).rgb + 2.0*texture(uSrc, vUv+vec2(d.x,0)).rgb
         + texture(uSrc, vUv-d).rgb + 2.0*texture(uSrc, vUv+vec2(0,-d.y)).rgb + texture(uSrc, vUv+vec2(d.x,-d.y)).rgb;
  o = vec4(c/16.0 + texture(uPrev, vUv).rgb, 1.0);
}

//@@ POST_FINAL
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uSrc, uBloom, uOverlay;
uniform vec2 uRes;           // output resolution
uniform float uExposure, uBloomAmt, uGrain, uVignette, uCA, uTime, uLetterbox, uFade, uOverlayAmt, uShimmer;
uniform vec3 uLift, uGamma, uGain; uniform float uSat; uniform vec3 uTintShadow, uTintHigh;
uniform float uContrast;

float hash(vec2 p){ vec3 p3=fract(vec3(p.xyx)*0.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }

vec3 agx(vec3 c){
  const mat3 M = mat3(0.842479,0.0423282,0.0423756, 0.0784336,0.878468,0.0784336, 0.0792237,0.0791661,0.879142);
  const mat3 Mi = mat3(1.19687,-0.0528968,-0.0529716, -0.0980208,1.15190,-0.0980434, -0.0990297,-0.0989612,1.15107);
  c = M*max(c,1e-6);
  c = clamp((log2(c)+12.47393)/16.5, 0.0, 1.0);
  vec3 x2=c*c, x4=x2*x2;
  c = 15.5*x4*x2 - 40.14*x4*c + 31.96*x4 - 6.868*x2*c + 0.4298*x2 + 0.1191*c - 0.00232;
  c = Mi*c;
  return pow(max(c,0.0), vec3(2.2));
}

void main(){
  vec2 uv = vUv;
  vec2 cc = uv-0.5;
  // heat shimmer
  if(uShimmer>0.0){
    float s = sin(uv.y*60.0+uTime*9.0)*sin(uv.x*23.0-uTime*5.0);
    uv += vec2(s, cos(uv.x*40.0+uTime*7.0))*0.0012*uShimmer;
  }
  // chromatic aberration grows toward the edges
  float ca = uCA*dot(cc,cc);
  vec3 col;
  col.r = texture(uSrc, uv - cc*ca).r;
  col.g = texture(uSrc, uv).g;
  col.b = texture(uSrc, uv + cc*ca).b;
  vec3 bl = texture(uBloom, uv).rgb;
  col += bl*uBloomAmt;
  col *= uExposure;
  col = agx(col);
  // grade (display-referred)
  col = pow(max(col,0.0), vec3(1.0/2.2));
  float l = dot(col, vec3(0.2126,0.7152,0.0722));
  col = mix(vec3(l), col, uSat);
  col = (col-0.5)*uContrast+0.5;
  col = col*uGain + uLift*(1.0-col);
  col = pow(max(col,0.0), 1.0/uGamma);
  l = dot(col, vec3(0.2126,0.7152,0.0722));
  col *= mix(uTintShadow, uTintHigh, smoothstep(0.0,1.0,l));
  // vignette
  vec2 vv = cc*vec2(uRes.x/uRes.y,1.0);
  col *= mix(1.0, smoothstep(1.25, 0.25, length(vv)), uVignette);
  // overlay (paper, titles) in display space
  vec4 ov = texture(uOverlay, vUv);
  col = mix(col, ov.rgb, ov.a*uOverlayAmt);
  // film grain (luma-weighted) + dither
  float g = hash(gl_FragCoord.xy + fract(uTime*7.13)*1000.0) - 0.5;
  col += g*uGrain*(0.4+0.6*sqrt(max(l,0.0)));
  col += (hash(gl_FragCoord.xy*1.3+17.0)-0.5)/255.0;
  col *= uFade;
  // letterbox
  float bar = (1.0 - uRes.x/uRes.y/uLetterbox)*0.5;
  if(uLetterbox>0.0 && (vUv.y < bar || vUv.y > 1.0-bar)) col = vec3(0);
  o = vec4(col, 1.0);
}
