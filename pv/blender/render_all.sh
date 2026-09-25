#!/bin/sh
# render plate sequences:  sh render_all.sh shot[:step[:samples]] ...
# frames land in ../plates/frames/<shot>/NNNN.jpg, then get packed into ../plates/<shot>.webm
B=${BLENDER:-/opt/blender/blender-4.2.9-linux-x64/blender}
D=$(cd "$(dirname "$0")" && pwd)
FF=${FFMPEG:-ffmpeg}
for spec in "$@"; do
  shot=${spec%%:*}; rest=${spec#*:}; [ "$rest" = "$spec" ] && rest=""
  step=${rest%%:*}; [ -z "$step" ] && step=1
  spp=${rest#*:}; [ "$spp" = "$rest" ] && spp=12
  out="$D/../plates/frames/$shot"
  echo "== $shot step=$step spp=$spp $(date +%T)"
  "$B" -b -P "$D/plates.py" -- "$shot" "$out" 0 100000 "$spp" 75 "$step" 2>&1 | grep -E "Saved|Error|Traceback" | tail -n 2
  echo "== $shot done $(date +%T)"
done
