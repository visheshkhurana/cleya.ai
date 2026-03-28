import { Resend } from 'resend';

interface ResendCredentials {
  apiKey: string;
  fromEmail?: string;
}

async function getConnectorCredentials(): Promise<ResendCredentials | null> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? 'depl ' + process.env.WEB_REPL_RENEWAL
    : null;

  if (!hostname || !xReplitToken) return null;

  try {
    const resp = await fetch(
      'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
      {
        headers: {
          'Accept': 'application/json',
          'X-Replit-Token': xReplitToken,
        },
      }
    );

    if (!resp.ok) {
      console.warn(`[Resend] Connector request failed with status ${resp.status}`);
      return null;
    }

    const data = await resp.json();
    const conn = data.items?.[0];
    if (conn?.settings?.api_key) {
      return {
        apiKey: conn.settings.api_key,
        fromEmail: conn.settings.from_email || undefined,
      };
    }
  } catch (err: any) {
    console.warn(`[Resend] Connector fetch error: ${err.message}`);
  }
  return null;
}

export async function getUncachableResendClient() {
  const directKey = process.env.RESEND_API_KEY;

  if (directKey) {
    return { client: new Resend(directKey), fromEmail: undefined };
  }

  const connector = await getConnectorCredentials();
  if (connector) {
    return {
      client: new Resend(connector.apiKey),
      fromEmail: connector.fromEmail,
    };
  }

  throw new Error('Resend not configured: set RESEND_API_KEY or connect via Replit integration');
}
