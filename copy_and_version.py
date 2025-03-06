import hashlib
import sys
import pathlib
import re
import base64

DATA_URL_TAG = re.compile(r"insert-data-url\(([^)]*)\)")

MIME_MAP = {
        ".png": "image/png",
        ".jpg": "image/jpg",
        ".jpeg": "image/jpg",
        ".webp": "image/webp",
}

if __name__ == "__main__":
    [sourcepath, destpath] = map(pathlib.Path, sys.argv[1:])
    filepaths = [f for f in sourcepath.rglob("*") if f.is_file()]
    for filepath in filepaths:
        filebytes = filepath.read_bytes()
        if filepath.suffix == ".svg":
            def replace_with_data_url(match: re.Match) -> str:
                include_filename = match.group(1)
                include_filepath = filepath.with_name(include_filename)
                include_data = include_filepath.read_bytes()
                url = (f"data:{MIME_MAP[include_filepath.suffix]};"
                       f"base64,"
                       f"{base64.b64encode(include_data).decode('utf8')}")
                return url
            filetext = filebytes.decode("utf-8")
            newfiletext = DATA_URL_TAG.sub(replace_with_data_url, filetext)
            filebytes = newfiletext.encode("utf-8")
        hash = hashlib.md5(filebytes).hexdigest()[:10]
        relfilepath = filepath.relative_to(sourcepath)
        relfilepathwithhash = relfilepath.with_name(
                f"{filepath.stem}.{hash}{filepath.suffix}")
        destfilepath = destpath.joinpath(relfilepathwithhash)
        destfilepath.parent.mkdir(parents=True, exist_ok=True)
        destfilepath.write_bytes(filebytes)
        print(f"s|{relfilepath}|{relfilepathwithhash}|g")
        print(f"done {filepath} --> {relfilepathwithhash}", file=sys.stderr)
