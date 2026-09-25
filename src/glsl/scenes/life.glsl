// ---------------------------------------------------------------- scene: LIFE
uniform float uMemDay, uMemSeason, uMemTwo, uMemGap, uMemCandle, uMemSteam, uMemTea, uMemTea2, uMemOpen, uMemRing;
uniform float uBowlOn, uBowlTilt;
uniform vec3  uBowlOff;
uniform float uBeams;
out vec4 fragColor;

Mem currentMem(){
  Mem m;
  m.day=uMemDay; m.season=uMemSeason; m.two=uMemTwo; m.gap=uMemGap; m.candle=uMemCandle;
  m.steam=uMemSteam; m.tea=uMemTea; m.tea2=uMemTea2; m.open=uMemOpen; m.ring=uMemRing;
  m.bowlOn=uBowlOn; m.bowlOff=uBowlOff; m.bowlTilt=uBowlTilt;
  return m;
}

void main(){
  Mem m = currentMem();
  vec3 ro = uCamPos, rd = camRay(gl_FragCoord.xy);
  vec4 r = roomTrace(ro, rd, m, 140);
  vec3 col = r.rgb;
  // steam above the bowls
  vec4 st = steamVolume(ro, rd, r.a, m.bowlOff+vec3(0,teaHeight(m.tea),0), m.steam*step(0.01,m.tea), m);
  vec4 st2 = steamVolume(ro, rd, r.a, vec3(-m.gap*0.95, 0.45, m.gap*0.3), m.steam*m.two*step(0.01,m.tea2), m);
  col = col*(1.0-st.a)+st.rgb;
  col = col*(1.0-st2.a)+st2.rgb;
  col += roomBeams(ro, rd, r.a, m, 24, 0.05*uBeams);
  fragColor = vec4(col, r.a);
}
