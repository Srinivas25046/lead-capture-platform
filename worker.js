const pool = require('./db/pool');

const BACKOFF_MS = [1000, 5000, 15000]; // wait before retry 1, 2, 3

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// The "email" is a console-log stub. Failure can be forced from the environment:
//   EMAIL_FORCE_FAIL=true   -> every attempt throws (proves a failing side effect never blocks a submission)
//   EMAIL_FAIL_RATE=0.3     -> random failures, to exercise the retry path
async function sendConfirmationEmail(payload) {
  console.log(`[EMAIL] Would send confirmation to ${payload.email} for widget ${payload.widgetId}`);

  if (process.env.EMAIL_FORCE_FAIL === 'true') {
    throw new Error('Email failure forced by EMAIL_FORCE_FAIL');
  }
  const failRate = Number(process.env.EMAIL_FAIL_RATE || 0);
  if (Math.random() < failRate) {
    throw new Error('Simulated email provider failure');
  }
}

const HANDLERS = {
  send_confirmation_email: sendConfirmationEmail,
};

async function processNextJob() {
  // SKIP LOCKED lets several workers pull jobs safely without grabbing the same row
  const result = await pool.query(
    `UPDATE jobs SET status = 'processing'
     WHERE id = (
       SELECT id FROM jobs
       WHERE status = 'pending' AND run_at <= now()
       ORDER BY id
       LIMIT 1
       FOR UPDATE SKIP LOCKED
     )
     RETURNING *`
  );

  const job = result.rows[0];
  if (!job) return false; // nothing to do

  try {
    const handler = HANDLERS[job.type];
    if (!handler) throw new Error(`No handler for job type: ${job.type}`);

    await handler(job.payload);
    await pool.query("UPDATE jobs SET status = 'done' WHERE id = $1", [job.id]);
    console.log(`Job ${job.id} (${job.type}) completed.`);
  } catch (err) {
    const attempts = job.attempts + 1;

    if (attempts >= job.max_attempts) {
      await pool.query(
        "UPDATE jobs SET status = 'failed', attempts = $1, last_error = $2 WHERE id = $3",
        [attempts, err.message, job.id]
      );
      console.error(`ALERT: Job ${job.id} (${job.type}) failed permanently after ${attempts} attempts: ${err.message}`);
    } else {
      const delayMs = BACKOFF_MS[attempts - 1] || 15000;
      await pool.query(
        "UPDATE jobs SET status = 'pending', attempts = $1, last_error = $2, run_at = now() + ($3 || ' milliseconds')::interval WHERE id = $4",
        [attempts, err.message, delayMs, job.id]
      );
      console.log(`Job ${job.id} failed (attempt ${attempts}/${job.max_attempts}), retrying in ${delayMs}ms: ${err.message}`);
    }
  }

  return true;
}

async function runWorker() {
  console.log('Worker started, polling for jobs...');
  while (true) {
    let didWork = false;
    try {
      didWork = await processNextJob();
    } catch (err) {
      // e.g. the database or the tables are not ready yet: log, wait, keep going
      console.error('Worker poll failed, will retry:', err.code || err.message);
      await sleep(3000);
      continue;
    }
    await sleep(didWork ? 100 : 1000);
  }
}

runWorker();