export const onRequest: PagesFunction = async ({ next, request }) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,x-admin-secret',
        'Access-Control-Max-Age': '86400'
      }
    });
  }

  const response = await next();
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type,x-admin-secret');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
};
