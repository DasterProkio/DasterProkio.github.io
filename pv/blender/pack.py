"""Pack rendered plate sequences for the player.

  python3 pack.py [shot ...]

raw Blender output (plates/frames/<shot>, possibly every 2nd frame) is moved to plates/raw/<shot>, then
  plates/frames/<shot>/NNNN.jpg   30 fps, sequential (deterministic export, git-ignored)
  plates/<shot>.webm              30 fps VP9 (web playback, committed)
  plates/manifest.json            {shot: {frames: n}}
Half-rate renders are brought to 30 fps with motion-compensated interpolation.
"""
import glob, json, os, shutil, subprocess, sys

D = os.path.dirname(os.path.abspath(__file__))
P = os.path.join(D, '..', 'plates')
FF = os.environ.get('FFMPEG', 'ffmpeg')


def run(*a):
    subprocess.run([FF, '-loglevel', 'error', '-y', *a], check=True)


def pack(shot):
    raw = os.path.join(P, 'raw', shot)
    out = os.path.join(P, 'frames', shot)
    if not os.path.isdir(raw) or (os.path.isdir(out) and os.listdir(out) and not os.path.exists(os.path.join(out, '.packed'))):
        if os.path.isdir(raw):
            shutil.rmtree(raw)
        os.makedirs(os.path.dirname(raw), exist_ok=True)
        shutil.move(out, raw)
    fs = sorted(glob.glob(os.path.join(raw, '*.jpg')))
    nums = [int(os.path.basename(f)[:4]) for f in fs]
    step = nums[1] - nums[0] if len(nums) > 1 else 1
    if os.path.isdir(out):
        shutil.rmtree(out)
    os.makedirs(out)
    src = ['-framerate', str(30 // step), '-pattern_type', 'glob', '-i', os.path.join(raw, '*.jpg')]
    vf = 'minterpolate=fps=30:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1' if step > 1 else 'null'
    run(*src, '-vf', vf, '-q:v', '3', '-start_number', '0', os.path.join(out, '%04d.jpg'))
    open(os.path.join(out, '.packed'), 'w').close()
    n = len(glob.glob(os.path.join(out, '*.jpg')))
    run('-framerate', '30', '-i', os.path.join(out, '%04d.jpg'), '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '36',
        '-row-mt', '1', '-deadline', 'good', '-cpu-used', '4', '-g', '15', '-pix_fmt', 'yuv420p', '-an',
        os.path.join(P, shot + '.webm'))
    mf = os.path.join(P, 'manifest.json')
    m = json.load(open(mf)) if os.path.exists(mf) else {}
    m[shot] = {'frames': n, 'fps': 30, 'rendered_every': step}
    json.dump(m, open(mf, 'w'), indent=1, sort_keys=True)
    print(shot, 'frames', n, 'step', step, 'webm', os.path.getsize(os.path.join(P, shot + '.webm')) // 1024, 'KB')


for s in sys.argv[1:]:
    pack(s)
