declare module 'buffer' {
  export var Buffer: {
    new (str: string, encoding?: string): Buffer
    new (size: number): Buffer
    new (array: Uint8Array): Buffer
    new (arrayBuffer: ArrayBuffer): Buffer
    new (array: number[]): Buffer
    new (buffer: Buffer): Buffer
    from(str: string, encoding?: string): Buffer
    from(arrayBuffer: ArrayBuffer, byteOffset?: number, length?: number): Buffer
    from(array: number[]): Buffer
    from(buffer: Buffer): Buffer
    from(obj: { [key: string]: number | string }): Buffer
    alloc(
      size: number,
      fill?: string | Buffer | number,
      encoding?: string,
    ): Buffer
    allocUnsafe(size: number): Buffer
    allocUnsafeSlow(size: number): Buffer
    isBuffer(obj: unknown): boolean
    compare(buf1: Buffer, buf2: Buffer): number
    concat(list: Buffer[], totalLength?: number): Buffer
    byteLength(
      string: string | Buffer | ArrayBuffer | SharedArrayBuffer | Uint8Array,
      encoding?: string,
    ): number
  }

  export interface Buffer extends Uint8Array {
    write(
      string: string,
      offset?: number,
      length?: number,
      encoding?: string,
    ): number
    toString(encoding?: string, start?: number, end?: number): string
    toJSON(): { type: 'Buffer'; data: number[] }
    equals(otherBuffer: Buffer): boolean
    compare(
      otherBuffer: Buffer,
      targetStart?: number,
      targetEnd?: number,
      sourceStart?: number,
      sourceEnd?: number,
    ): number
    copy(
      targetBuffer: Buffer,
      targetStart?: number,
      sourceStart?: number,
      sourceEnd?: number,
    ): number
    slice(start?: number, end?: number): Buffer
    writeUIntLE(
      value: number,
      offset: number,
      byteLength: number,
      noAssert?: boolean,
    ): number
    writeUIntBE(
      value: number,
      offset: number,
      byteLength: number,
      noAssert?: boolean,
    ): number
    writeIntLE(
      value: number,
      offset: number,
      byteLength: number,
      noAssert?: boolean,
    ): number
    writeIntBE(
      value: number,
      offset: number,
      byteLength: number,
      noAssert?: boolean,
    ): number
    readUIntLE(offset: number, byteLength: number, noAssert?: boolean): number
    readUIntBE(offset: number, byteLength: number, noAssert?: boolean): number
    readIntLE(offset: number, byteLength: number, noAssert?: boolean): number
    readIntBE(offset: number, byteLength: number, noAssert?: boolean): number
    readUInt8(offset: number, noAssert?: boolean): number
    readUInt16LE(offset: number, noAssert?: boolean): number
    readUInt16BE(offset: number, noAssert?: boolean): number
    readUInt32LE(offset: number, noAssert?: boolean): number
    readUInt32BE(offset: number, noAssert?: boolean): number
    readInt8(offset: number, noAssert?: boolean): number
    readInt16LE(offset: number, noAssert?: boolean): number
    readInt16BE(offset: number, noAssert?: boolean): number
    readInt32LE(offset: number, noAssert?: boolean): number
    readInt32BE(offset: number, noAssert?: boolean): number
    readFloatLE(offset: number, noAssert?: boolean): number
    readFloatBE(offset: number, noAssert?: boolean): number
    readDoubleLE(offset: number, noAssert?: boolean): number
    readDoubleBE(offset: number, noAssert?: boolean): number
    swap16(): Buffer
    swap32(): Buffer
    swap64(): Buffer
    writeUInt8(value: number, offset: number, noAssert?: boolean): number
    writeUInt16LE(value: number, offset: number, noAssert?: boolean): number
    writeUInt16BE(value: number, offset: number, noAssert?: boolean): number
    writeUInt32LE(value: number, offset: number, noAssert?: boolean): number
    writeUInt32BE(value: number, offset: number, noAssert?: boolean): number
    writeInt8(value: number, offset: number, noAssert?: boolean): number
    writeInt16LE(value: number, offset: number, noAssert?: boolean): number
    writeInt16BE(value: number, offset: number, noAssert?: boolean): number
    writeInt32LE(value: number, offset: number, noAssert?: boolean): number
    writeInt32BE(value: number, offset: number, noAssert?: boolean): number
    writeFloatLE(value: number, offset: number, noAssert?: boolean): number
    writeFloatBE(value: number, offset: number, noAssert?: boolean): number
    writeDoubleLE(value: number, offset: number, noAssert?: boolean): number
    writeDoubleBE(value: number, offset: number, noAssert?: boolean): number
    fill(value: string | number | Buffer, offset?: number, end?: number): this
    indexOf(
      value: string | number | Buffer,
      byteOffset?: number,
      encoding?: string,
    ): number
    lastIndexOf(
      value: string | number | Buffer,
      byteOffset?: number,
      encoding?: string,
    ): number
    includes(
      value: string | number | Buffer,
      byteOffset?: number,
      encoding?: string,
    ): boolean
  }
}
