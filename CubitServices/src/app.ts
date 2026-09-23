import { localConfig } from './dev/config'
import { WindowsNamingStrategy } from './dev/windows-naming'
import express, { Application, Request, Response, NextFunction } from 'express'
import 'reflect-metadata'
import morgan from 'morgan'
import 'reflect-metadata' //needed for typeorm
import { DataSource } from 'typeorm'
import path from 'path'
import { staffOnly } from './api/common/staff-auth'
import { loginLimit } from './api/common/login-limit'
import { demoProxy } from './demo/proxy'
const bodyParser = require('body-parser')
const extension = __filename.endsWith('.js') ? 'js' : 'ts'

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: localConfig.host,
  port: localConfig.databasePort,
  username: localConfig.username,
  password: localConfig.password,
  database: localConfig.database,
  namingStrategy: process.platform === 'win32' || localConfig.runtimeMode !== 'local' ? new WindowsNamingStrategy() : undefined,
  synchronize: false,
  logging: false,
  entities: [path.join(__dirname, `entity/**/*.${extension}`)],
  migrations: [path.join(__dirname, `migration/**/*.${extension}`)],
  subscribers: [path.join(__dirname, `subscriber/**/*.${extension}`)],
})

const app: Application = express()
app.disable('x-powered-by')
if (localConfig.runtimeMode !== 'local') app.set('trust proxy', 'loopback')

app.use(morgan('dev')) //nicer console logging and errors
app.use(bodyParser.json())

//nicer output
app.use(express.urlencoded({ extended: false }))
app.use(express.json())

// Prevent the copied browser bundle from contacting any other API origin.
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', "connect-src 'self'")
  res.setHeader('Cache-Control', 'no-store')
  next()
})

if (localConfig.runtimeMode !== 'local') app.use('/login', loginLimit())
if (localConfig.runtimeMode === 'hosted-review') app.use(demoProxy(process.env.DEMO_ENABLED==='true'))

app.get('/health', (req, res) => {
  res.status(AppDataSource.isInitialized ? 200 : 503).json({
    mode: localConfig.runtimeMode === 'local' ? 'local-development' : localConfig.runtimeMode,
    dataMode: localConfig.dataMode, databaseReady: AppDataSource.isInitialized,
    workspaceLabel: localConfig.runtimeMode === 'hosted-demo' ? 'Synthetic demo · fictional records only' : localConfig.runtimeMode === 'hosted-review' ? 'Hosted review · copied member data' :
      localConfig.dataMode === 'imported' ? 'Local testing · imported membership data' : 'Local demo workspace',
  })
})

// Block every PayPal route, including future additions, before route handlers.
app.use('/paypal', (req, res) => {
  res.status(403).json({ message: 'PayPal synchronization is disabled in this review environment.' })
})
if (localConfig.runtimeMode !== 'local') {
  app.use('/ACON', (req,res)=>res.status(403).json({message:'Door integration is disabled in the hosted review.'}))
}

// Browser navigation serves the Angular shell; JSON calls keep the legacy API URLs.
app.get(['/', '/memberlist', '/overdue', '/member/:memberId', '/accessLog', '/reports', '/automation', '/waivers', '/portal', '/portal/:section', '/app-login'], (req, res, next) => {
  if ((req.headers.accept || '').includes('text/html')) {
    return res.sendFile(path.resolve('public/index.html'))
  }
  next()
})

//get rid of stupid CORS errors
app.use((req, res, next) => {
  if (localConfig.runtimeMode !== 'local') return next()
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', '*')

  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Methods', 'PUT, POST, PATCH, DELETE, GET')
    return res.status(200).json({})
  }
  //go onto the next process
  next()
})

//routes
app.use('/api/portal', require('./api/routes/portal'))
app.use('/api/waivers', require('./api/routes/waivers'))
app.use('/api/cubit', require('./api/routes/cubit'))
app.use('/api/cubit', require('./api/routes/operations'))
app.use(['/member', '/plan', '/transaction', '/key', '/accessLog', '/task', '/ACON'], staffOnly)
//this is where to look for the route file
const memberRoutes = require('./api/routes/member')
//when a client accesses this path, it forwards to the route file
app.use('/member', memberRoutes)

const taskRoutes = require('./api/routes/task')
app.use('/task', taskRoutes)

const loginRoutes = require('./api/routes/login')
app.use('/login', loginRoutes)

const accessLogRoutes = require('./api/routes/accessLog')
app.use('/accessLog', accessLogRoutes)

const transactionRoutes = require('./api/routes/transaction')
app.use('/transaction', transactionRoutes)

const planRoutes = require('./api/routes/plan')
app.use('/plan', planRoutes)

const memberKeyRoutes = require('./api/routes/memberKey')
app.use('/key', memberKeyRoutes)

const paypalRoutes = require('./api/routes/paypal')
app.use('/paypal', paypalRoutes)

const ACONRoutes = require('./api/routes/ACON')
app.use('/ACON', ACONRoutes)

app.use(express.static('public'))

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Request failed:', err.message)
  res.status(err.status || 500).json({ message: err.status ? err.message : 'The request could not be completed.' })
})

//catch bad routes here
app.use('*', (req, res, next) => {
  res.status(404).json({ message: 'Not Found' })
})

export async function startLocalApp() {
  await AppDataSource.initialize()
  if (localConfig.runtimeMode === 'hosted-demo') {
    const rows=await AppDataSource.query("SELECT complete FROM cubit_demo_manifest WHERE id='synthetic-v1'")
    if(rows.length!==1||!rows[0].complete)throw Error('Synthetic demo has not been initialized.')
  } else if (localConfig.dataMode === 'imported') {
    const rows = await AppDataSource.query("SELECT complete FROM cubit_import_manifest WHERE id = 'current'")
    if (rows.length !== 1 || !rows[0].complete) throw Error('The local import has not been validated.')
  } else {
  const { upgradeLocalMoneyColumns } = await import('./dev/upgrade-schema')
  await upgradeLocalMoneyColumns(AppDataSource)
  await AppDataSource.synchronize()
  const { retireUnusedFeatures } = await import('./dev/retire-features')
  await retireUnusedFeatures(AppDataSource)
  const { seedLocalData } = await import('./dev/seed')
  await seedLocalData()
  const { seedScenarios } = await import('./dev/seed-scenarios')
  await seedScenarios()
  const { seedPlanCatalog } = await import('./dev/seed-plan-catalog')
  await seedPlanCatalog()
  const { initializeBilling } = await import('./billing/store')
  await initializeBilling()
  const { seedWaivers } = await import('./dev/seed-waivers')
  await seedWaivers()
  }
  const { upgradeKeyHistory } = await import('./dev/upgrade-key-history')
  await upgradeKeyHistory(AppDataSource)
  const { startAutomationScheduler } = await import('./billing/automation')
  const server = app.listen(localConfig.port, localConfig.listenHost, () => {
    console.log(`Cubit ${localConfig.runtimeMode} ready on port ${localConfig.port}`)
  })
  const stopScheduler = localConfig.runtimeMode === 'local' && localConfig.dataMode === 'demo' ? startAutomationScheduler() : () => {}
  server.on('close', stopScheduler)
  return server
}

if (require.main === module) {
  startLocalApp().catch(err => {
    console.error('Local startup failed:', err.message)
    process.exit(1)
  })
}

export { app }
