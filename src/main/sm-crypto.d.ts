declare module 'sm-crypto' {
  export function sm3(data: string | Buffer, options?: { output: 'hex' | 'binary' }): string
  export function sm4(data: string | Buffer, key: string | Buffer, options?: { mode: 'ecb' | 'cbc', iv?: string }): string
  export function sm2(data: string, key: string, options?: { mode: 'c1c2c3' | 'c1c3c2' }): string
}
