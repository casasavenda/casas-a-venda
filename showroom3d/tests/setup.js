import { TextDecoder, TextEncoder } from 'node:util';

if (!globalThis.TextDecoder) globalThis.TextDecoder = TextDecoder;
if (!globalThis.TextEncoder) globalThis.TextEncoder = TextEncoder;
