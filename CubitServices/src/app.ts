import { startAutomationScheduler } from './billing/automation';
import { startWaiverReconciliation } from './waivers/reconcile';
import { localConfig } from './dev/config';
import { AppDataSource, assertSchemaReady } from './database';
export { AppDataSource } from './database';
import express, { Application, Request, Response, NextFunction } from 'express';
import 'reflect-metadata';
import morgan from 'morgan';
import 'reflect-metadata'; //needed for typeorm
import path from 'path';
import { staffOnly } from './api/common/staff-auth';
import { loginLimit } from './api/common/login-limit';
import { demoProxy } from './demo/proxy';
const app: Application = express();
app.disable('x-powered-by');
if (localConfig.runtimeMode !== 'local') app.set('trust proxy', 'loopback');

// Do not persist names, emails or search terms from query strings in access logs.
morgan.token('safe-path', (req) => ((req as Request).originalUrl || req.url || '/').split('?')[0]);
app.use(morgan(':method :safe-path :status :response-time ms'));

//nicer output
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Prevent the copied browser bundle from contacting any other API origin.
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; connect-src 'self'",
  );
  res.setHeader('Cache-Control', 'no-store');
  next();
});

if (localConfig.runtimeMode !== 'local') app.use('/login', loginLimit());
if (localConfig.runtimeMode === 'hosted-review')
  app.use(demoProxy(process.env.DEMO_ENABLED === 'true'));

app.get('/health', (req, res) => {
  res.status(AppDataSource.isInitialized ? 200 : 503).json({
    mode: localConfig.runtimeMode === 'local' ? 'local-development' : localConfig.runtimeMode,
    dataMode: localConfig.dataMode,
    databaseReady: AppDataSource.isInitialized,
    workspaceLabel:
      localConfig.runtimeMode === 'hosted-demo'
        ? 'Synthetic demo · fictional records only'
        : localConfig.runtimeMode === 'hosted-review'
          ? 'Hosted review · copied member data'
          : localConfig.dataMode === 'imported'
            ? 'Local testing · imported membership data'
            : 'Local demo workspace',
  });
});

// Block every PayPal route, including future additions, before route handlers.
app.use('/paypal', (req, res) => {
  res
    .status(403)
    .json({ message: 'PayPal synchronization is disabled in this review environment.' });
});
if (localConfig.runtimeMode !== 'local') {
  app.use('/ACON', (req, res) =>
    res.status(403).json({ message: 'Door integration is disabled in the hosted review.' }),
  );
}

// Browser navigation serves the Angular shell; JSON calls keep the legacy API URLs.
app.get(
  [
    '/',
    '/memberlist',
    '/overdue',
    '/member/:memberId',
    '/accessLog',
    '/reports',
    '/automation',
    '/payments',
    '/plans',
    '/audit',
    '/staff/settings',
    '/organization',
    '/waivers',
    '/portal',
    '/portal/:section',
    '/account/:section',
    '/account/access/:id',
    '/app-login',
  ],
  (req, res, next) => {
    if ((req.headers.accept || '').includes('text/html')) {
      return res.sendFile(path.resolve('public/index.html'));
    }
    next();
  },
);

//get rid of stupid CORS errors
app.use((req, res, next) => {
  if (localConfig.runtimeMode !== 'local') return next();
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Methods', 'PUT, POST, PATCH, DELETE, GET');
    return res.status(200).json({});
  }
  //go onto the next process
  next();
});

//routes
app.use('/api/organization', require('./api/routes/organization'));
app.use('/api/account', require('./api/routes/account-security'));
app.use('/api/backups', require('./api/routes/backups'));
app.use('/api/system-health', require('./api/routes/system-health'));
app.use('/api/portal', require('./api/routes/portal'));
app.use('/api/waivers', require('./api/routes/waivers'));
app.use('/api/cubit', require('./api/routes/cubit'));
app.use('/api/cubit', require('./api/routes/operations'));
app.use('/api/cubit', require('./api/routes/billing-tools'));
app.use('/api/cubit', require('./api/routes/staff-tools'));
app.use(['/member', '/plan', '/transaction', '/key', '/accessLog', '/ACON'], staffOnly);
//this is where to look for the route file
const memberRoutes = require('./api/routes/member');
//when a client accesses this path, it forwards to the route file
app.use('/member', memberRoutes);

const loginRoutes = require('./api/routes/login');
app.use('/login', loginRoutes);
app.use('/logout', require('./api/routes/logout'));

const accessLogRoutes = require('./api/routes/accessLog');
app.use('/accessLog', accessLogRoutes);

const transactionRoutes = require('./api/routes/transaction');
app.use('/transaction', transactionRoutes);

const planRoutes = require('./api/routes/plan');
app.use('/plan', planRoutes);

const memberKeyRoutes = require('./api/routes/memberKey');
app.use('/key', memberKeyRoutes);

const ACONRoutes = require('./api/routes/ACON');
app.use('/ACON', ACONRoutes);

app.use(express.static('public'));

app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  console.error('Request failed:', err.message);
  res.status(err.status || 500).json({
    message: err.status ? err.message : 'The request could not be completed.',
    ...(err.code === 'MFA_REQUIRED' ? { code: err.code } : {}),
  });
});

//catch bad routes here
app.use((req, res) => {
  res.status(404).json({ message: 'Not Found' });
});

export async function startLocalApp() {
  await AppDataSource.initialize();
  await assertSchemaReady(AppDataSource);
  if (localConfig.runtimeMode === 'hosted-demo') {
    const rows = await AppDataSource.query(
      "SELECT complete FROM cubit_demo_manifest WHERE id='synthetic-v1'",
    );
    if (rows.length !== 1 || !rows[0].complete)
      throw Error('Synthetic demo has not been initialized.');
  } else if (localConfig.dataMode === 'imported') {
    const rows = await AppDataSource.query(
      "SELECT complete FROM cubit_import_manifest WHERE id = 'current'",
    );
    if (rows.length !== 1 || !rows[0].complete)
      throw Error('The local import has not been validated.');
  }
  const server = app.listen(localConfig.port, localConfig.listenHost, () => {
    console.log(`Cubit ${localConfig.runtimeMode} ready on port ${localConfig.port}`);
  });
  const stopScheduler =
    localConfig.runtimeMode === 'local' && localConfig.dataMode === 'demo'
      ? startAutomationScheduler()
      : () => {};
  server.on('close', stopScheduler);
  const stopWaivers = startWaiverReconciliation();
  server.on('close', stopWaivers);
  return server;
}

if (require.main === module) {
  startLocalApp().catch((err) => {
    console.error('Local startup failed:', err.message);
    process.exit(1);
  });
}

export { app };
