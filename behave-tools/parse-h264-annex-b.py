import clargs


def nalprint(b: bytes):
    assert len(b) > 0
    assert b[0] & 0x80 == 0
    ref = (b[0] & 0x60) >> 5
    type = b[0] & 0x1f
    if type != 5 and type != 1:
        return
    pos = 8
    first_mb_in_slice, pos = get_exp_golomb(b, pos)
    slice_type, pos = get_exp_golomb(b, pos)
    print(f"{type:02x}({ref}, {first_mb_in_slice}, {slice_type}): "
          f"{hexstring(b[:30])}")


def shift_left(nr: int, shift: int) -> int:
    return nr << shift if shift > 0 else nr >> -shift


def get_exp_golomb(data: bytes, startbit) -> (int, int):
    """Extract an Exp-Golomb coded number from the bitstream."""
    nrzeros = 0
    while True:
        bytenr = (nrzeros + startbit) // 8
        bit_in_byte = (nrzeros + startbit) % 8
        val = data[bytenr] & (0x80 >> bit_in_byte)
        if val != 0:
            break
        nrzeros += 1
    nrbits_needed = nrzeros + 1
    result = 0
    resultstartbit = startbit + nrzeros
    resultendbit = startbit + nrzeros + nrbits_needed
    startbyte = resultstartbit // 8
    endbyte = resultendbit // 8
    for bytenr in range(startbyte, endbyte + 1):
        mask = 0xff >> (resultstartbit % 8 if bytenr == startbyte else 0)
        result += shift_left(data[bytenr] & mask,
                             (endbyte - bytenr - 1) * 8 + resultendbit % 8)
    return (result - 1, resultendbit)


def hexstring(b: bytes) -> str:
    return " ".join('{:02x}'.format(x) for x in b)


def parse(
        file: clargs.ExistingFilePath,
):
    assert file.suffix == ".h264", "please give a raw h264 stream as file"
    content = file.read_bytes()
    nals = content.split(b"\x00\x00\x00\x01")
    for nal in nals[1:]:
        nalprint(nal)


if __name__ == "__main__":
    clargs.create_parser_and_run(parse)
