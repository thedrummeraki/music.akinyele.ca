// Manage authentication
const axios = require('axios').default;
const qs = require('qs');
const redis = require('redis');

const OAUTH_HOST = 'https://accounts.spotify.com';
const API_BASE_URL = 'https://api.spotify.com/';

const clientID = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;
const clientIDSecret = `${clientID}:${clientSecret}`;

const client = redis.createClient(process.env.REDIS_URL);
client.on("error", function (error) {
  console.error('Redis error', error);
});

const request = async (endpoint, method, retry) => {
  const requestMethod = method || "GET";

  console.log(
    `${new Date()}`,
    requestMethod.toUpperCase(),
    '\x1b[32m',
    API_BASE_URL,
    '\x1b[0m',
    endpoint,
  )
  const headers = {
    'Authorization': `Bearer ${(await accessToken(retry))}`,
  };

  try {
    const response = await axios.request({
      baseURL: API_BASE_URL,
      url: `/v1/me${endpoint}`,
      method: requestMethod,
      headers: headers,
    });

    return response.data;
  } catch (error) {
    console.error(error);
    if (error.response && error.response.status === 401) {
      // if retry, then refreshing the access did not work.
      if (retry) {
        return error;
      } else {
        return await request(endpoint, method, true);
      }
    } else {
      return error;
    }
  }
};

const accessToken = async (refresh) => {
  if (refresh) {
    console.log('Re-requesting an access token...');
    const tokens = await newAccessToken();
    await saveTokens(tokens);

    return tokens.access_token;
  } else {
    return await getTokens('access');
  }
};

const newAccessToken = async () => {
  const authorizationBody = {
    grant_type: 'refresh_token',
    refresh_token: await getTokens('refresh'),
  };

  const authorizationHeaders = {
    'Authorization': `Basic ${Buffer.from(clientIDSecret).toString('base64')}`,
  };

  console.log('New access token body:', authorizationBody);
  console.log('New access token headers:', authorizationHeaders);

  const response = await axios.request({
    baseURL: OAUTH_HOST,
    method: 'POST',
    url: '/api/token',
    data: qs.stringify(authorizationBody),
    headers: authorizationHeaders,
  });

  return await saveTokens(response.data);
};

const saveTokens = (data) => {
  if (data.access_token) {
    console.log('Saving access token', data.access_token);
    client.set('access', data.access_token);
  }

  if (data.refresh_token) {
    console.log('Saving refresh token', data.refresh_token);
    client.set('refresh', data.refresh_token);
  }

  return data;
};

const getTokens = async (type) => {
  return new Promise((resolve, _) => {
    client.get(type, (_, res) => resolve(res));
  });
};

module.exports = {
  request: request,
  accessToken: accessToken,
  saveTokens: saveTokens,
  newAccessToken: newAccessToken,
};
