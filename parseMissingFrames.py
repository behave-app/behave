import sys

data = sys.stdin.read(-1)
lines = data.split("\n")


def frameType(n):
    return "IDR" if (n % 300) == 2 else "I" if n % 12 == 2 \
            else "P" if n % 3 == 2 else "B"


def expectMissing(n):
    return n % 300 > 232 and frameType(n) == "B"


lastline = -1
for line in lines:
    n = int(line)
    for i in range(lastline + 1, n):
        if not expectMissing(i):
            print("missing: %d; %s-frame (after %s)" % (
                i, frameType(i), frameType(i - 1)))
    if expectMissing(n):
        print("Expected frame %d to be missing" % n)
    lastline = n

print("Done at %d" % lastline)
