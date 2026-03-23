import struct
import zlib

def create_png():
    width, height = 1, 1
    # PNG signature
    png_signature = b'\x89PNG\r\n\x1a\n'

    # IHDR chunk
    ihdr_data = struct.pack('>IIBBCOMP', width, height, 8, 6, 0, 0, 0)
    # The 'COMP' above is a hack to get the length right for struct pack, let's build it manually
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    ihdr_crc = zlib.crc32(b'IHDR' + ihdr_data)
    ihdr_chunk = struct.pack('>I', len(ihdr_data)) + b'IHDR' + ihdr_data + struct.pack('>I', ihdr_crc & 0xffffffff)

    # IDAT chunk (1 pixel RGBA: black transparent)
    # Filter byte (0) + 1 pixel (r, g, b, a) = 5 bytes
    pixel_data = b'\x00\x00\x00\x00\x00'
    idat_data = zlib.compress(pixel_data)
    idat_crc = zlib.crc32(b'IDAT' + idat_data)
    idat_chunk = struct.pack('>I', len(idat_data)) + b'IDAT' + idat_data + struct.pack('>I', idat_crc & 0xffffffff)

    # IEND chunk
    iend_data = b''
    iend_crc = zlib.crc32(b'IEND' + iend_data)
    iend_chunk = struct.pack('>I', len(iend_data)) + b'IEND' + iend_data + struct.pack('>I', iend_crc & 0xffffffff)

    with open('/tmp/dummy.png', 'wb') as f:
        f.write(png_signature + ihdr_chunk + idat_chunk + iend_chunk)

create_png()
