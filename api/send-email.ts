import nodemailer from 'nodemailer';

interface SendEmailBody {
  from?: string;
  to?: string;
  subject?: string;
  text?: string;
  smtp?: {
    host?: string;
    port?: number;
    secure?: boolean;
    user?: string;
    pass?: string;
  };
}

interface ReqLike {
  method?: string;
  on: (event: string, cb: (chunk: Uint8Array | string) => void) => void;
}

interface ResLike {
  statusCode: number;
  setHeader: (name: string, value: string) => void;
  end: (body?: string) => void;
}

function readJsonBody(req: ReqLike): Promise<SendEmailBody> {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk: Uint8Array | string) => {
      raw += typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk);
    });
    req.on('end', () => {
      if (!raw.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw) as SendEmailBody);
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function inferSmtpHost(email: string): { host: string; port: number; secure: boolean } {
  const domain = (email.split('@')[1] || '').trim().toLowerCase();
  if (domain === 'comcast.net' || domain === 'xfinity.com') {
    return { host: 'smtp.comcast.net', port: 587, secure: false };
  }
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    return { host: 'smtp.gmail.com', port: 587, secure: false };
  }
  if (domain === 'outlook.com' || domain === 'hotmail.com' || domain === 'live.com') {
    return { host: 'smtp-mail.outlook.com', port: 587, secure: false };
  }
  if (domain === 'yahoo.com' || domain === 'ymail.com') {
    return { host: 'smtp.mail.yahoo.com', port: 587, secure: false };
  }
  const envHost = process.env.SMTP_HOST || '';
  const envPort = Number(process.env.SMTP_PORT || '587') || 587;
  const envSecure = process.env.SMTP_SECURE === 'true';
  return {
    host: envHost || (domain ? `smtp.${domain}` : ''),
    port: envPort,
    secure: envSecure,
  };
}

export default async function handler(req: ReqLike, res: ResLike) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
    return;
  }

  try {
    const body = await readJsonBody(req);
    const from = (body.from || '').trim();
    const to = (body.to || '').trim();
    const subject = (body.subject || '').trim();
    const text = body.text || '';

    if (!from || !from.includes('@')) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'Valid From sender email is required.' }));
      return;
    }
    if (!to || !to.includes('@')) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'Valid To recipient email is required.' }));
      return;
    }
    if (!subject) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'Email subject is required.' }));
      return;
    }

    const inferred = inferSmtpHost(from);
    const host = (body.smtp?.host || inferred.host || '').trim();
    const port = Number(body.smtp?.port || inferred.port || 587);
    const secure = typeof body.smtp?.secure === 'boolean' ? body.smtp.secure : inferred.secure;
    const user = (body.smtp?.user || process.env.SMTP_USER || from).trim();
    const pass = (body.smtp?.pass || process.env.SMTP_PASS || '').trim();

    if (!host) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: `No SMTP host configured for ${from}. Enter SMTP host in account settings.` }));
      return;
    }
    if (!pass) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: `SMTP app/mail password is required to send directly from ${from}.` }));
      return;
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });

    const info = await transporter.sendMail({
      from,
      to,
      subject,
      text,
    });

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      ok: true,
      messageId: info.messageId || '',
      from,
      to,
    }));
  } catch (err: any) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      ok: false,
      error: err?.message || 'SMTP send failed.',
    }));
  }
}
