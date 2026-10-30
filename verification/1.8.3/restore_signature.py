import base64
import hashlib
import json
import mmap
import struct
import sys
import zipfile
from pathlib import Path


def digest_file(path):
    with open(path, 'rb') as source:
        return hashlib.file_digest(source, 'sha256').hexdigest()


def start(data, info):
    name_size, extra_size = struct.unpack_from('<HH', data, info.header_offset + 26)
    return info.header_offset + 30 + name_size + extra_size


def extract(unsigned, signed):
    pieces = []
    def literal(data):
        if data:
            if pieces and 'data' in pieces[-1]:
                data = base64.b64decode(pieces.pop()['data']) + data
            pieces.append({'data': base64.b64encode(data).decode()})
    def copy(offset, length):
        if length:
            if pieces and 'offset' in pieces[-1] and pieces[-1]['offset'] + pieces[-1]['length'] == offset:
                pieces[-1]['length'] += length
            else:
                pieces.append({'offset': offset, 'length': length})
    with open(unsigned, 'rb') as af, open(signed, 'rb') as bf, mmap.mmap(af.fileno(), 0, access=mmap.ACCESS_READ) as a, mmap.mmap(bf.fileno(), 0, access=mmap.ACCESS_READ) as b, zipfile.ZipFile(unsigned) as az, zipfile.ZipFile(signed) as bz:
        old = {info.filename: info for info in az.infolist()}
        if set(old) - set(bz.namelist()) or any(not n.startswith('META-INF/') for n in set(bz.namelist()) - set(old)):
            raise ValueError('Unexpected ZIP payload changes')
        cursor = 0
        for info in sorted(bz.infolist(), key=lambda value: value.header_offset):
            literal(b[cursor:info.header_offset])
            if info.filename not in old:
                bp = start(b, info)
                cursor = bp + info.compress_size
                literal(b[info.header_offset:cursor])
                continue
            original = old[info.filename]
            ap, bp = start(a, original), start(b, info)
            ae, be = ap + original.compress_size, bp + info.compress_size
            if a[ap:ae] != b[bp:be]:
                raise ValueError('Signing changed compressed payload')
            ah, bh = a[original.header_offset:ap], b[info.header_offset:bp]
            if ah == bh:
                copy(original.header_offset, ae - original.header_offset)
            else:
                literal(bh)
                copy(ap, original.compress_size)
            cursor = be
        literal(b[cursor:])
    return {'format': 1, 'input_sha256': digest_file(unsigned), 'output_sha256': digest_file(signed), 'pieces': pieces}


def restore(unsigned, metadata, destination):
    patch = json.loads(Path(metadata).read_text())
    if patch.get('format') != 1 or digest_file(unsigned) != patch['input_sha256']:
        raise ValueError('Unsigned APK does not match verified build')
    size = Path(unsigned).stat().st_size
    digest = hashlib.sha256()
    with open(unsigned, 'rb') as source, open(destination, 'wb') as output:
        for piece in patch['pieces']:
            if 'data' in piece:
                data = base64.b64decode(piece['data'], validate=True)
                output.write(data); digest.update(data)
            else:
                offset, length = piece['offset'], piece['length']
                if not isinstance(offset, int) or not isinstance(length, int) or offset < 0 or length < 0 or offset + length > size:
                    raise ValueError('Invalid APK copy range')
                source.seek(offset)
                while length:
                    data = source.read(min(length, 1024 * 1024))
                    if not data:
                        raise ValueError('Incomplete APK copy')
                    output.write(data); digest.update(data); length -= len(data)
    if digest.hexdigest() != patch['output_sha256']:
        Path(destination).unlink()
        raise ValueError('Signed APK hash mismatch')


if __name__ == '__main__':
    if len(sys.argv) != 5:
        raise SystemExit('Usage: extract|restore INPUT SIGNED_OR_METADATA OUTPUT')
    if sys.argv[1] == 'extract':
        Path(sys.argv[4]).write_text(json.dumps(extract(sys.argv[2], sys.argv[3]), indent=2) + '\n')
    elif sys.argv[1] == 'restore':
        restore(sys.argv[2], sys.argv[3], sys.argv[4])
    else:
        raise SystemExit('Unknown operation')
