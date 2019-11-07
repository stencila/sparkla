/**
 * Type declarations necessary to build this project.
 *
 * Note that although some of these modules may not be direct
 * dependencies of Sparkla, it is still necessary to have these
 * declarations available here.
 */

declare module 'length-prefixed-stream' {
  import stream from 'stream'

  export type Encoder = stream.Transform
  export type Decoder = stream.Transform

  export function encode(): Encoder
  export function decode(): Decoder
}
