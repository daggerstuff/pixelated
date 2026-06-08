import Redis from 'ioredis'

const redis = new Redis()
const subscriber = redis.duplicate()
console.log(subscriber)
