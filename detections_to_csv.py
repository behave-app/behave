import json
import sys
import pathlib


path = pathlib.Path(sys.argv[1]).resolve().absolute()
print(f"Reading file {path}", file=sys.stderr)
data = json.loads(
        path.read_text())
for framenr, frameinfo in enumerate(data["framesInfo"]):
    for detection in frameinfo["detections"]:
        print(f"{framenr},{detection['klass']},{detection['confidence']}")
