#!/bin/bash
# v9 shipping one-shots (onset-fixed). Guitar SF2 singles via singles.mjs (seq.skipToFirstNoteOn = false),
# bass via sfzrender.py. Output: ../v9/<tone>/ship/n<key>.wav (mono float, 44.1k).
set -e
cd "$(dirname "$0")"; W=${WORK:-./work}; S=$W/sf; B=$S/bass; V=$W/v9; PY=${PY:-python3}
SP=$S/SpanishClassicalGuitar-SF2-20190618/SpanishClassicalGuitar-20190618.sf2
EC="$S/EGuitarFSBS-clean bridge small SF2-20260807/EGuitarFSBS-clean bridge small 20260807.sf2"
KG=40,43,46,49,52,55,58,61,64,67,70,73,76,79,82,85,88; KE=40,43,46,49,52,55,58,61,64,67,70,73,76,79,82,85,86
KB=28,31,34,37,40,43,46,49,52,55
node singles.mjs $S/FluidR3_GM.sf2 0 24 $V/nylon/ship $KG 1.3 1.6 2>&1 | grep -v -i warn
node singles.mjs $SP 0 0 $V/spanish/ship $KG 1.3 1.6 2>&1 | grep -v -i warn
node singles.mjs "$EC" 0 0 $V/clean/ship $KE 1.3 1.6 2>&1 | grep -v -i warn
KEYS=$KB HOLD=${UPHOLD:-1.7} LEN=${UPLEN:-2.0} $PY sfzrender.py $B/dsmolken.double-bass/d_smolken_rubner_bass_pizz.sfz $B/dsmolken.double-bass --singles $V/upright/ship 79 2>/dev/null
KEYS=$KB HOLD=1.3 LEN=1.6 $PY sfzrender.py $B/karoryfer.swagbass/swagbass_clean.sfz $B/karoryfer.swagbass --singles $V/ebass/ship 72 2>/dev/null
ls $V/*/ship | head -80
