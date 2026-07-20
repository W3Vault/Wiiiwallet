import base64
import hashlib
import json
import socket
import ssl

HOST = 'etx1.wiiicoin.io'
PORT = 50002
NAMESPACE_ID = 'NTEf4Zbft422WDxDMtNyM7PQypemYtB5Ra'
EXPECTED_KEY = 'test1.json'
EXPECTED_VALUE = '{"value":"test"}'
ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'


def b58check_decode(value: str) -> bytes:
    number = 0
    for character in value:
        number = number * 58 + ALPHABET.index(character)
    raw = number.to_bytes((number.bit_length() + 7) // 8, 'big') if number else b''
    raw = b'\x00' * (len(value) - len(value.lstrip('1'))) + raw
    payload, checksum = raw[:-4], raw[-4:]
    expected_checksum = hashlib.sha256(hashlib.sha256(payload).digest()).digest()[:4]
    assert checksum == expected_checksum, 'Invalid namespace Base58Check checksum'
    return payload


def request(stream, request_id: int, method: str, params: list):
    message = json.dumps({'id': request_id, 'method': method, 'params': params}, separators=(',', ':')) + '\n'
    stream.write(message.encode())
    stream.flush()
    while True:
        line = stream.readline()
        if not line:
            raise RuntimeError(f'ElectrumX closed the connection while waiting for {method}')
        response = json.loads(line)
        if response.get('id') == request_id:
            if response.get('error'):
                raise RuntimeError(f'{method} failed: {response["error"]!r}')
            return response.get('result')


namespace_payload = b58check_decode(NAMESPACE_ID)
assert len(namespace_payload) == 21 and namespace_payload[0] == 0x35
synthetic_script = bytes([0xD1, len(namespace_payload)]) + namespace_payload + bytes([0x00, 0x6D, 0x75, 0x6A])
script_hash = hashlib.sha256(synthetic_script).digest()[::-1].hex()

context = ssl.create_default_context()
with socket.create_connection((HOST, PORT), timeout=20) as raw_socket:
    with context.wrap_socket(raw_socket, server_hostname=HOST) as tls_socket:
        tls_socket.settimeout(20)
        with tls_socket.makefile('rwb') as stream:
            negotiated = request(stream, 1, 'server.version', ['Wiiiwallet live namespace check', '1.4'])
            result = request(stream, 2, 'blockchain.wiii.get_keyvalues', [script_hash, -1])

values = result if isinstance(result, list) else result.get('keyvalues', [])
decoded = [
    {
        **item,
        'decoded_key': base64.b64decode(item.get('key', '')).decode('utf-8'),
        'decoded_value': base64.b64decode(item.get('value', '')).decode('utf-8'),
    }
    for item in values
]
matching = [item for item in decoded if item['decoded_key'] == EXPECTED_KEY]
assert matching, f'{EXPECTED_KEY} was not returned for {NAMESPACE_ID}: {decoded!r}'
latest = max(matching, key=lambda item: item.get('height', 0))
assert latest['decoded_value'] == EXPECTED_VALUE, f'Unexpected live value: {latest!r}'

print(f'Electrum protocol negotiated: {negotiated!r}')
print(f'Namespace script hash: {script_hash}')
print(f'Verified namespace: {NAMESPACE_ID}')
print(f'Verified key: {EXPECTED_KEY}')
print(f'Verified value: {latest["decoded_value"]}')
print(f'Confirmed at block height: {latest.get("height")}')
