const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios').default;
const requestHTTP = require('request');
const qs = require('qs');

const app = express();
const port = process.env.PORT || 5000;
const allowConnectFrom = process.env.ALLOW_CONNECT_FROM || 'http://localhost:3000';
const clientID = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;
const clientIDSecret = `${clientID}:${clientSecret}`;
const redirectPath = '/auth/spotify/callback';
const redirectURL = `${(process.env.REDIRECT_HOST || `http://localhost:${port}`)}${redirectPath}`;
const scopes = [
  'user-read-private',
  'user-read-email',
  'user-top-read',
  'user-read-currently-playing',
].join(' ');

console.log(clientIDSecret);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use((_, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', allowConnectFrom);
  next();
});

app.get('/api/latest', (req, res) => {
  res.send({message: 'this works!'});
});

app.get('/authorize', (req, res) => {
  const authorizeURLParams = [
    `client_id=${clientID}`,
    'response_type=code',
    `redirect_uri=${redirectURL}`,
    `scope=${scopes}`,
  ].join('&');

  if (!clientID || !clientSecret) {
    res.send({success: false, message: 'missing client id and client secret'});
  } else {
    res.redirect(`https://accounts.spotify.com/authorize?${authorizeURLParams}`);
  }
});

app.get(redirectPath, (req, res) => {
  const code = req.query.code;
  const error = req.query.error;

  if (error) {
    res.send({success: false, error: error});
  } else {
    const authorizationBody = {
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectURL,
    };

    const authorizationHeaders = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(clientIDSecret).toString('base64')}`,
    };

    axios.request({
      baseURL: 'https://accounts.spotify.com',
      method: 'POST',
      url: '/api/token',
      data: qs.stringify(authorizationBody),
      headers: authorizationHeaders,
    }).then(response => {
      console.log('Response', response.data);

      res.send({
        success: true,
        response: response.data,
      });
    }).catch(error => {
      console.error(error.response);
      res.send({
        success: false,
        message: 'that did not work',
        error: error,
      });
    });
  }
});

app.listen(port,
  () => console.log(`Running on port ${port}...`));
