// Writes a 1024x1024 solid-color PNG to src-tauri/app-icon.png using only
// Node built-ins, so the Tauri CLI can generate the full icon set offline.
const zlib = require('zlib')
const fs = require('fs')
const path = require('path')

const W = 1024, H = 1024
const RGB = [37, 99, 235] // blue

const crcTable = (() => {
  const t = []
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crc])
}

const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4)
ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0 // 8-bit RGB

const rowLen = 1 + W * 3
const raw = Buffer.alloc(rowLen * H)
for (let y = 0; y < H; y++) {
  const off = y * rowLen
  raw[off] = 0 // filter: none
  for (let x = 0; x < W; x++) {
    const p = off + 1 + x * 3
    raw[p] = RGB[0]; raw[p + 1] = RGB[1]; raw[p + 2] = RGB[2]
  }
}
const idat = zlib.deflateSync(raw)
const png = Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])

const out = path.join(__dirname, '..', 'src-tauri', 'app-icon.png')
fs.writeFileSync(out, png)
console.log('wrote', out)
