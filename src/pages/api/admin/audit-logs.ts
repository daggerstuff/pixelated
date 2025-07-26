import { getUserAuditLogs, getActionAuditLogs, getAuditLogs } from '../../../lib/audit/log';

export async function GET(context: { url: URL; }) {
  const { url } = context; // url is already a URL object
  const {searchParams} = new URL(url);

  const eventType = searchParams.get('eventType');
  const userId = searchParams.get('userId');
  const limit = parseInt(searchParams.get('limit') || '100', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  let logs = [];
  try {
    if (eventType) {
      logs = await getActionAuditLogs(eventType, limit, offset);
    } else if (userId) {
      logs = await getUserAuditLogs(userId, limit, offset);
    } else {
      logs = await getAuditLogs();
    }

    return new Response(JSON.stringify({ logs }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error in audit logs API:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch audit logs' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}