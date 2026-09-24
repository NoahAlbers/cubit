import dotenv from 'dotenv'
import path from 'path'

// Deliberately never load the production .env or .env.prod files.
if (!['hosted-review', 'hosted-demo'].includes(process.env.CUBIT_MODE || '')) {
  dotenv.config({ path: path.resolve(__dirname, '../../.env.local'), quiet: true })
}

export function readLocalConfig(env: NodeJS.ProcessEnv) {
  if (env.LOCAL_DEVELOPMENT !== 'true') {
    throw new Error('This copy requires LOCAL_DEVELOPMENT=true. See the root README.')
  }
  const host = env.DATABASE_URI || '127.0.0.1'
  const database = env.DATABASE_NAME || 'TonicLocalDev'
  const username = env.DATABASE_USERNAME || 'tonic_local'
  const dataMode = database === 'TonicLocalReview' ? 'imported' : 'demo'
  if (!['127.0.0.1', 'localhost', 'mysql'].includes(host) ||
      !['TonicLocalDev', 'TonicLocalReview'].includes(database) || username !== 'tonic_local' ||
      (dataMode === 'imported' && !['127.0.0.1', 'localhost'].includes(host))) {
    throw new Error('Refusing a database outside the local development configuration.')
  }
  if (!env.DATABASE_PASSWORD || !env.JWT_SECRET) {
    throw new Error('Local DATABASE_PASSWORD and JWT_SECRET must be set.')
  }
  const port = Number(env.PORT || 5001)
  const databasePort = Number(env.DATABASE_PORT || 3306)
  const listenHost = env.HOST || '127.0.0.1'
  if (!['127.0.0.1', '0.0.0.0'].includes(listenHost) ||
      (dataMode === 'imported' && listenHost !== '127.0.0.1') ||
      ![port, databasePort].every(p => Number.isInteger(p) && p > 0 && p < 65536)) {
    throw new Error('Invalid local bind address or port.')
  }
  return {
    // Windows MySQL stores schema identifiers in lowercase. TypeORM otherwise
    // fails to recognize existing tables when synchronizing after a restart.
    host, database: process.platform === 'win32' ? database.toLowerCase() : database,
    username, password: env.DATABASE_PASSWORD,
    databasePort, port, listenHost, jwtSecret: env.JWT_SECRET, dataMode,
    runtimeMode: 'local' as const,
  }
}

export function readHostedReviewConfig(env: NodeJS.ProcessEnv) {
  if (env.CUBIT_MODE !== 'hosted-review' || env.LOCAL_DEVELOPMENT === 'true' ||
      env.DATABASE_URI !== '127.0.0.1' || env.DATABASE_NAME !== 'cubit_review' ||
      env.DATABASE_USERNAME !== 'cubit_app' || env.HOST !== '127.0.0.1' ||
      !env.DATABASE_PASSWORD || !env.JWT_SECRET || env.JWT_SECRET.length < 48 ||
      (env.DOCUSEAL_ENABLED === 'true' && (env.DOCUSEAL_API_URL !== 'http://127.0.0.1:3000/api' || !env.DOCUSEAL_API_KEY || !env.DOCUSEAL_PUBLIC_URL?.startsWith('https://')))) {
    throw new Error('Invalid hosted review configuration.')
  }
  const port = Number(env.PORT || 5001), databasePort = Number(env.DATABASE_PORT || 3306)
  if (![port,databasePort].every(p=>Number.isInteger(p)&&p>0&&p<65536)) throw new Error('Invalid server port.')
  return { host:env.DATABASE_URI, database:env.DATABASE_NAME, username:env.DATABASE_USERNAME,
    password:env.DATABASE_PASSWORD, databasePort, port, listenHost:env.HOST,
    jwtSecret:env.JWT_SECRET, dataMode:'imported', runtimeMode:'hosted-review' as const }
}

export function readHostedDemoConfig(env: NodeJS.ProcessEnv) {
  if (env.CUBIT_MODE !== 'hosted-demo' || env.LOCAL_DEVELOPMENT === 'true' ||
      env.DATABASE_URI !== '127.0.0.1' || env.DATABASE_NAME !== 'cubit_demo' ||
      env.DATABASE_USERNAME !== 'cubit_demo' || env.HOST !== '127.0.0.1' ||
      !env.DATABASE_PASSWORD || !env.JWT_SECRET || env.JWT_SECRET.length < 48 ||
      env.DOCUSEAL_ENABLED === 'true') throw new Error('Invalid hosted demo configuration.')
  const port = Number(env.PORT || 5002), databasePort = Number(env.DATABASE_PORT || 3306)
  if (port !== 5002 || !Number.isInteger(databasePort) || databasePort < 1 || databasePort > 65535)
    throw new Error('Invalid demo port.')
  return { host:env.DATABASE_URI, database:env.DATABASE_NAME, username:env.DATABASE_USERNAME,
    password:env.DATABASE_PASSWORD, databasePort, port, listenHost:env.HOST,
    jwtSecret:env.JWT_SECRET, dataMode:'demo', runtimeMode:'hosted-demo' as const }
}

export const localConfig = process.env.CUBIT_MODE === 'hosted-review'
  ? readHostedReviewConfig(process.env) : process.env.CUBIT_MODE === 'hosted-demo'
  ? readHostedDemoConfig(process.env) : readLocalConfig(process.env)
// The captured Tonic server uses UTC calendar days. Preserve its billing dates.
if (localConfig.dataMode === 'imported' || localConfig.runtimeMode === 'hosted-demo') process.env.TZ = 'UTC'
