"""Synthetic fake-microphone fixtures for the voice fidelity harness.

Voiced, harmonic, syllable-modulated signal (not noise: Chrome's WebRTC noise
suppression attenuates stationary noise). Not real speech — it exercises
energy VAD / endpoint timing / barge-in capture, not recognition.
Usage: python3 gen-audio.py <out-dir>
"""
import math, random, struct, wave, sys, os
SR=48000
random.seed(7)
def speech(dur, f0=140.0):
    out=[]
    n=int(dur*SR)
    ph=0.0
    for i in range(n):
        t=i/SR
        f=f0*(1+0.03*math.sin(2*math.pi*5*t))
        ph+=2*math.pi*f/SR
        s=sum(math.sin(k*ph)/k for k in range(1,12))
        env=(0.55+0.45*math.sin(2*math.pi*4.2*t))**2   # syllables
        # soft attack/release at segment edges
        edge=min(1.0, t/0.04, (dur-t)/0.04)
        out.append(0.22*s*env*edge + random.gauss(0,0.0015))
    return out
def silence(dur):
    return [random.gauss(0,0.0015) for _ in range(int(dur*SR))]
def write(name, samples):
    p=os.path.join(sys.argv[1],name)
    with wave.open(p,'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(b''.join(struct.pack('<h', max(-32767,min(32767,int(x*32767)))) for x in samples))
# Scenario A: lead 0.5s, speech 1.8s, pause X, speech 1.5s, tail 3.5s
for X in [300,600,900,1200,1500,1800]:
    write(f"pause_{X}.wav", silence(0.5)+speech(1.8)+silence(X/1000)+speech(1.5, 150)+silence(3.5))
# Scenario B: therapist speaks 1.0s after capture starts, 1.6s, then silence
write("bargein.wav", silence(1.0)+speech(1.6, 130)+silence(3.0))
# Patient audio (what the therapist interrupts): 6s at different pitch
write("patient.wav", speech(6.0, 210))
