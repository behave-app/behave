import re
import subprocess

lines = subprocess.check_output([
    "git",
    "log",
    "--date=iso8601-strict",
    "--pretty=format:%H %ad %d",
    "--decorate=full"
    ], encoding="UTF-8").split("\n")

lines = [line for line in lines if len(line.strip())]
tag = "initial"
since_last_tag = 0
for line in lines[::-1]:
    sha, dt, rest = line.split(" ", 2)
    match = re.search(r"\brefs/tags/(v\d[^),]+)", rest)
    if match:
        tag = match.group(1)
        since_last_tag = 0
    else:
        since_last_tag += 1
print(tag if since_last_tag == 0 else f"{tag}-dev{since_last_tag} ({sha[:7]})")
