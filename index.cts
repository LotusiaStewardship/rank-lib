// General types
export type LogEntry = [string, string]
export type PlatformParameters = {
  profileId: {
    len: number
  }
  postId: {
    chunkLength: number
    regex: RegExp
    reader: 'readBigUInt64BE' // additional Buffer reader methods if needed
    type: 'BigInt' | 'Number' | 'String'
  }
}
// RANK script types
export type ScriptChunkLokadUTF8 = 'RANK'
export type ScriptChunkPlatformUTF8 = 'twitter'
export type ScriptChunkSentimentUTF8 = 'positive' | 'negative'
export type ScriptChunkLokadMap = Map<number, ScriptChunkLokadUTF8>
export type ScriptChunkPlatformMap = Map<number, ScriptChunkPlatformUTF8>
export type ScriptChunkSentimentMap = Map<number, ScriptChunkSentimentUTF8>
export type ScriptChunkField =
  | 'lokad'
  | 'sentiment'
  | 'platform'
  | 'profile'
  | 'post'
  | 'comment'
export type ScriptChunk = {
  len: number | null
  map?: ScriptChunkLokadMap | ScriptChunkPlatformMap | ScriptChunkSentimentMap
}
/** OP_RETURN \<RANK\> \<sentiment\> \<profileId\> [\<postId\> \<comment\>] */
export type RankOutput = {
  platform: string // e.g. Twitter/X.com, etc.
  profileId: string // who the ranking is for
  postId?: string // optional post ID if ranking specific content
  sentiment: string // positive or negative sentiment (can support more)
  comment?: string // optional comment
}
/**  */
export type RankTransaction = RankOutput & {
  txid: string
  height?: number // undefined if mempool
  sats: bigint
  timestamp: bigint // unix timestamp
}
/** */
export type Block = {
  hash: string
  height: number
  timestamp: bigint
  ranksLength: number // default is 0 if a block is cringe
  prevhash?: string // for reorg checks only; does not get saved to database
}
export type RankTarget = {
  id: string // profileId, postId, etc
  platform: string
  ranking: bigint
  ranks: Omit<RankTransaction, 'profileId' | 'platform'>[] // omit the database relation fields
  votesPositive: number
  votesNegative: number
}
/**  */
export type Profile = RankTarget & {
  posts?: PostMap
}
/**  */
export type Post = RankTarget & {
  profileId: string
}
/**
 * `RankTransaction` objects are converted to a `ProfileMap` for database ops
 *
 * `string` is `profileId`
 */
export type ProfileMap = Map<string, Profile>
export type PostMap = Map<string, Post>
/**
 * RANK script configuration
 */
export const RANK_OUTPUT_MIN_VALID_SATS = 1_000_000 // minimum RANK burn value in sats
/** First block with a RANK transaction */
export const RANK_BLOCK_GENESIS_V1: Partial<Block> = {
  hash: '00000000019cc1ddc04bc541f531f1424d04d0c37443867f1f6137cc7f7d09e5',
  height: 811624,
}
/**
 * RANK script types and constants
 */
export const SCRIPT_CHUNK_LOKAD: ScriptChunkLokadMap = new Map()
SCRIPT_CHUNK_LOKAD.set(0x52414e4b, 'RANK')
export const SCRIPT_CHUNK_PLATFORM: ScriptChunkPlatformMap = new Map()
//SCRIPT_CHUNK_PLATFORM.set(0x00, 'web_url') // any URL; the PROFILE script chunk is not necessary
SCRIPT_CHUNK_PLATFORM.set(0x01, 'twitter') // twitter.com/x.com
export const SCRIPT_CHUNK_SENTIMENT: ScriptChunkSentimentMap = new Map()
SCRIPT_CHUNK_SENTIMENT.set(0x51, 'positive') // OP_1 | OP_TRUE
SCRIPT_CHUNK_SENTIMENT.set(0x00, 'negative') // OP_0 | OP_FALSE
export const RANK_SCRIPT_CHUNKS: {
  [name in ScriptChunkField]: ScriptChunk
} = {
  lokad: {
    len: 4,
    map: SCRIPT_CHUNK_LOKAD,
  },
  sentiment: {
    len: 1,
    map: SCRIPT_CHUNK_SENTIMENT,
  },
  platform: {
    len: 1,
    map: SCRIPT_CHUNK_PLATFORM,
  },
  profile: {
    len: null,
  },
  post: {
    len: null,
  },
  comment: {
    len: null,
  },
}
/**
 * Platform stuff
 */
export const PLATFORMS: {
  [name in ScriptChunkPlatformUTF8]: PlatformParameters
} = {
  twitter: {
    profileId: {
      len: 16,
    },
    postId: {
      chunkLength: 8, // 64-bit uint: https://developer.x.com/en/docs/x-ids
      regex: /[0-9]+/,
      reader: 'readBigUInt64BE',
      type: 'BigInt',
    },
  },
}
export const toProfileIdBuf = function (
  platform: ScriptChunkPlatformUTF8,
  profileId: string,
): Buffer {
  const platformSpec = PLATFORMS[platform]
  const profileBuf = Buffer.alloc(platformSpec.profileId.len)
  profileBuf.write(profileId, platformSpec.profileId.len - profileId.length, 'utf8')

  return profileBuf
}
/**
 * Convert the `OP_RETURN` profile name back to UTF-8 with null bytes removed
 * @param profileIdBuf
 */
export const toProfileIdUTF8 = function (profileIdBuf: Buffer) {
  return new TextDecoder('utf-8').decode(profileIdBuf.filter(byte => byte != 0x00))
}
export const toPostIdBuf = function (
  platform: ScriptChunkPlatformUTF8,
  postId: string,
): Buffer {
  switch (PLATFORMS[platform].postId.type) {
    case 'BigInt':
      return Buffer.from(BigInt(postId).toString(16), 'hex')
    case 'Number':
      return Buffer.from(Number(postId).toString(16), 'hex')
    case 'String':
      return Buffer.from(Buffer.from(postId).toString('hex'), 'hex')
  }
}
/**
 * Convert the UTF-8 platform name to the defined 1-byte platform hex code
 * @param platform
 * @returns
 */
export const toPlatformBuf = function (
  platform: ScriptChunkPlatformUTF8,
): Buffer | undefined {
  for (const [byte, platformName] of SCRIPT_CHUNK_PLATFORM) {
    if (platformName == platform) {
      return Buffer.from([byte])
    }
  }
}
/**
 * Convert the defined 1-byte platform hex code to the UTF-8 platform name
 * @param platformBuf
 */
export const toPlatformUTF8 = function (
  platformBuf: Buffer,
): ScriptChunkPlatformUTF8 | undefined {
  return SCRIPT_CHUNK_PLATFORM.get(platformBuf.readUint8())
}
/**
 * Convert the UTF-8 sentiment name to the defined 1-byte OP code
 * @param sentiment
 * @returns
 */
export const toSentimentOpCode = function (sentiment: ScriptChunkSentimentUTF8) {
  switch (sentiment) {
    case 'positive':
      return 'OP_1'
    case 'negative':
      return 'OP_0'
  }
}
/**
 * Convert the defined 1-byte sentiment OP code to the UTF-8 sentiment name
 * @param sentimentBuf
 */
export const toSentimentUTF8 = function (
  sentimentBuf: Buffer,
): ScriptChunkSentimentUTF8 | undefined {
  return SCRIPT_CHUNK_SENTIMENT.get(sentimentBuf.readUint8())
}
export const toCommentUTF8 = function (commentBuf: Buffer): string | undefined {
  return new TextDecoder('utf-8').decode(commentBuf)
}
/**
 *
 * @param entries
 */
export const log = function (entries: LogEntry[]) {
  console.log(
    `${new Date().toISOString()} ${entries.map(entry => entry.join('=')).join(' ')}`,
  )
}
