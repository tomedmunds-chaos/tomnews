import { createServer } from 'http'
import { parse } from 'url'
import { execSync } from 'child_process'
import next from 'next'
import cron from 'node-cron'
import { runFetchJob } from './lib/jobs/fetchJob'
import { runDigestJob } from './lib/jobs/digestJob'
import { digestConfig } from './config/topics'

const dev = process.env.NODE_ENV !== 'production'
const hostname = '0.0.0.0'
const port = parseInt(process.env.PORT ?? '3000', 10)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  createServer(async (req, res) => {
    const parsedUrl = parse(req.url ?? '/', true)
    await handle(req, res, parsedUrl)
  }).listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`)

    // Push DB schema after server is listening (non-blocking)
    setTimeout(() => {
      try {
        console.log('[db] Running prisma db push...')
        execSync('npx prisma db push --skip-generate --accept-data-loss', { stdio: 'inherit' })
        console.log('[db] Schema up to date')
      } catch (err) {
        console.error('[db] prisma db push failed:', err)
      }
    }, 0)

    // Register cron jobs
    cron.schedule(digestConfig.fetchCron, () => {
      console.log('[cron] Running fetch job...')
      runFetchJob()
    })

    cron.schedule(digestConfig.digestCron, () => {
      console.log('[cron] Running digest job...')
      runDigestJob()
    })

    console.log(`[cron] fetchJob scheduled: ${digestConfig.fetchCron}`)
    console.log(`[cron] digestJob scheduled: ${digestConfig.digestCron}`)
    console.log('[server] Ready v2')
  })
})
