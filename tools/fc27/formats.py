"""Bounded readers for the tested FC27 Lite profile. Not a general Frostbite SDK."""
import struct
import uuid

class FormatError(ValueError):
    pass

def require(condition, message):
    if not condition:
        raise FormatError(message)

def span(data, offset, size):
    require(0 <= offset <= len(data) and 0 <= size <= len(data) - offset,
            f'Out-of-bounds span {offset}+{size}, file size {len(data)}')
    return data[offset:offset + size]

def unpack(data, offset, fmt):
    return struct.unpack(fmt, span(data, offset, struct.calcsize(fmt)))

def cstring(data, offset):
    require(0 <= offset < len(data), 'String offset outside file')
    end = data.find(b'\0', offset)
    require(end >= offset, 'Unterminated string')
    return data[offset:end].decode('utf-8')

class Reader:
    def __init__(self, data, offset=0):
        self.data, self.offset = data, offset

    def read(self, fmt):
        values = unpack(self.data, self.offset, fmt)
        self.offset += struct.calcsize(fmt)
        return values[0] if len(values) == 1 else values

    def varint(self):
        value = 0
        for shift in range(0, 70, 7):
            byte = self.read('B')
            value |= (byte & 127) << shift
            if byte < 128:
                return value
        raise FormatError('Overlong varint')

    def string(self):
        value = cstring(self.data, self.offset)
        self.offset += len(value.encode('utf-8')) + 1
        return value

    def db_object(self, depth=0):
        require(depth < 64, 'DB object nesting limit')
        tag = self.read('B')
        kind = tag & 31
        if not kind:
            return '', None
        name = '' if tag & 128 else self.string()
        if kind in (1, 2):
            size = self.varint()
            end = self.offset + size
            span(self.data, self.offset, size)
            value = [] if kind == 1 else {}
            while self.offset < end:
                key, child = self.db_object(depth + 1)
                if child is None:
                    break
                if kind == 1:
                    value.append(child)
                else:
                    value[key] = child
            require(self.offset <= end, 'DB child exceeds parent')
            self.offset = end
        elif kind in (7, 19):
            size = self.varint()
            raw = span(self.data, self.offset, size)
            self.offset += size
            value = raw.rstrip(b'\0').decode('utf-8') if kind == 7 else raw.hex()
        elif kind == 6:
            value = bool(self.read('B'))
        elif kind in (8, 9, 11, 12):
            value = self.read({8: '<i', 9: '<q', 11: '<f', 12: '<d'}[kind])
        elif kind in (15, 16):
            size = 16 if kind == 15 else 20
            raw = span(self.data, self.offset, size)
            self.offset += size
            value = str(uuid.UUID(bytes_le=raw)) if kind == 15 else raw.hex()
        else:
            raise FormatError(f'Unsupported DB type {kind} at {self.offset}')
        return name, value

def efix(data):
    require(data[:4] == b'RIFF', 'Not a RIFF EBX')
    sections, offset = {}, 12
    while offset + 8 <= len(data):
        name = span(data, offset, 4).decode('ascii')
        size, = unpack(data, offset + 4, '<I')
        span(data, offset + 8, size)
        sections[name] = (offset + 8, size)
        offset += 8 + size + size % 2
    require('EFIX' in sections, 'EBX has no EFIX section')
    r = Reader(data, sections['EFIX'][0])
    def guid():
        value = str(uuid.UUID(bytes_le=span(data, r.offset, 16)))
        r.offset += 16
        return value
    def array(read):
        count = r.read('<I')
        require(count <= 1000000, 'EFIX array limit')
        return [read() for _ in range(count)]
    result = {'fileGuid': guid(), 'classes': array(guid),
              'signatures': array(lambda: r.read('<I')), 'exported': r.read('<I')}
    for name in ('objects', 'list1', 'list2'):
        result[name] = array(lambda: r.read('<I'))
    result['imports'] = array(lambda: {'fileGuid': guid(), 'classGuid': guid()})
    for name in ('importOffsets', 'resOffsets'):
        result[name] = array(lambda: r.read('<I'))
    for name in ('arrayOffset', 'unknown', 'stringsOffset'):
        result[name] = r.read('<I')
    result['sections'] = sections
    return result

def relative_array(data, base, field, element_format, limit=100000):
    pointer = base + field
    delta, = unpack(data, pointer, '<q')
    target = pointer + delta
    count, = unpack(data, target - 4, '<I')
    require(count <= limit, f'Array count {count} exceeds {limit}')
    stride = struct.calcsize('<' + element_format)
    return [unpack(data, target + stride * i, '<' + element_format) for i in range(count)]

def scalar_array(data, base, field, fmt, limit=100000):
    return [row[0] for row in relative_array(data, base, field, fmt, limit)]

def vbr_base(data):
    fix = efix(data)
    hits = [32 + offset for offset in fix['objects']
            if span(data, 32 + offset + 40, 4) == b' RBV']
    require(len(hits) == 1, f'Expected one VBR object, found {len(hits)}')
    return hits[0], fix
