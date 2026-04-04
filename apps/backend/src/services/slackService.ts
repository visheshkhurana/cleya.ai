import { WebClient } from '@slack/web-api';
import { prisma } from '@cleya/db';

let connectionSettings: any;
async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? 'depl ' + process.env.WEB_REPL_RENEWAL
    : null;

  if (!xReplitToken) {
    throw new Error('X-Replit-Token not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=slack',
    {
      headers: {
        'Accept': 'application/json',
        'X-Replit-Token': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Slack not connected');
  }
  return accessToken;
}

async function getUncachableSlackClient() {
  const token = await getAccessToken();
  return new WebClient(token);
}

let cachedChannelId: string | null = null;

async function getNotificationChannelId(): Promise<string> {
  if (cachedChannelId) return cachedChannelId;

  const slack = await getUncachableSlackClient();
  const result = await slack.conversations.list({ types: 'public_channel', limit: 200 });

  const channel = result.channels?.find(ch => ch.name === 'cleya-notifications')
    || result.channels?.find(ch => ch.name === 'general');

  if (channel?.id) {
    cachedChannelId = channel.id;
    return channel.id;
  }

  throw new Error('No suitable Slack channel found. Create a #cleya-notifications channel.');
}

class SlackService {
  private enabled = true;

  private async post(text: string, blocks?: any[]) {
    if (!this.enabled) return;
    try {
      const slack = await getUncachableSlackClient();
      const channelId = await getNotificationChannelId();
      await slack.chat.postMessage({ channel: channelId, text, blocks });
    } catch (err: any) {
      console.log(`[SlackService] Failed to send message: ${err.message}`);
    }
  }

  async notifyUserRegistered(user: { id: string; email: string; name?: string }) {
    const totalUsers = await prisma.user.count();
    const blocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:wave: *New User Registered*\n>*Email:* ${user.email}\n>*Name:* ${user.name || 'Not provided'}\n>*Total Users:* ${totalUsers}`
        }
      }
    ];
    await this.post(`New user registered: ${user.email} (Total: ${totalUsers})`, blocks);
  }

  async sendDailyReport() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      newUsersToday,
      totalProfiles,
      completeProfiles,
      totalMatches,
      matchesToday,
      acceptedMatches,
      pendingMatches,
      totalConversations,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: today } } }),
      prisma.profile.count(),
      prisma.profile.count({ where: { isComplete: true } }),
      prisma.match.count(),
      prisma.match.count({ where: { createdAt: { gte: today } } }),
      prisma.match.count({ where: { status: 'ACCEPTED' } }),
      prisma.match.count({ where: { status: { in: ['PROPOSED', 'PENDING_A', 'PENDING_B'] } } }),
      prisma.conversation.count(),
    ]);

    const personaBreakdown = await prisma.profile.groupBy({
      by: ['persona'],
      _count: true,
      where: { isComplete: true },
    });

    const personaLines = personaBreakdown
      .filter(p => p.persona)
      .map(p => `>  ${p.persona}: ${p._count}`)
      .join('\n');

    const dateStr = today.toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Kolkata',
    });

    const blocks = [
      {
        type: 'header',
        text: { type: 'plain_text', text: `Cleya.ai Daily Report — ${dateStr}` }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:busts_in_silhouette: *Users*\n>Total: *${totalUsers}*\n>New today: *${newUsersToday}*\n>Complete profiles: *${completeProfiles}* / ${totalProfiles}`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:handshake: *Matches*\n>Total: *${totalMatches}*\n>New today: *${matchesToday}*\n>Accepted: *${acceptedMatches}*\n>Pending: *${pendingMatches}*`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:speech_balloon: *Conversations:* ${totalConversations}`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:chart_with_upwards_trend: *Persona Breakdown*\n${personaLines || '> No complete profiles yet'}`
        }
      },
      { type: 'divider' }
    ];

    await this.post(`Cleya.ai Daily Report — ${dateStr}`, blocks);
    console.log('[SlackService] Daily report sent');
  }
}

export const slackService = new SlackService();
