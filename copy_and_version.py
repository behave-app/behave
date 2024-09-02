import hashlib
import sys
import pathlib

if __name__ == "__main__":
    [filepath, sourcepath, destpath] = map(pathlib.Path, sys.argv[1:])
    filebytes = filepath.read_bytes()
    hash = hashlib.md5(filebytes).hexdigest()[:10]
    relfilepath = filepath.relative_to(sourcepath)
    relfilepathwithhash = relfilepath.with_name(
            f"{filepath.stem}.{hash}{filepath.suffix}")
    destfilepath = destpath.joinpath(relfilepathwithhash)
    destfilepath.parent.mkdir(parents=True, exist_ok=True)
    destfilepath.write_bytes(filebytes)
    print(f"s|{relfilepath}|{relfilepathwithhash}|g")
