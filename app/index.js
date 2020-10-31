const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios').default;
const qs = require('qs');
const auth = require('./auth');

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

app.get('/authorize', (_, res) => {
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

app.get('/top/artists', (_, res) => {
  auth.request('/top/artists')
    .then(response => {
      res.send(
        response.items.map(item => ({
          id: item.id,
          name: item.name,
          img: item.images.length > 0 && item.images[0].url,
          genres: item.genres,
        }))
      )
    })
    .catch(error => {
      console.error('error', error);
      res.send({ success: false, error: error });
    })
});

app.get('/top/tracks', (_, res, next) => {
  auth.request('/top/tracks')
    .then(response => {
      res.send(
        response.items.map(item => ({
          id: item.id,
          name: item.name,
          album: {
            id: item.album.id,
            name: item.album.name,
            img: item.album.images[0].url,
          },
          artists: item.artists.map(artist => artist.name),
        }))
      );
    })
    .catch(error => {
      console.error(error);
      res.send({ success: false, error: error });
    });
});

app.get('/top/genres', (_, res) => {
  auth.request('/top/artists')
    .then(response => {
      const genres = response.items.map(item => item.genres).flat().reduce((result, value) => {
        result[value] = (result[value] || 0) + 1;
        return result;
      }, {});

      const topGenres = Object.fromEntries(
        Object.entries(genres).sort(([, a], [, b]) => b - a)
      );

      res.send(Object.keys(topGenres));
    })
    .catch(error => {
      console.error('error', error);
      res.send({ success: false, error: error });
    })
});

app.get('/playing/now', (_, res) => {
  auth.request('/player/currently-playing')
    .then(response => {
      const track = response.item;

      res.send({
        id: track.id,
        at: track.timestamp,
        progress: (response.progress_ms / track.duration_ms) * 100,
        name: track.name,
        preview_url: track.preview_url,
        artists: track.artists.map(artist => artist.name),
        album: {
          name: track.album.name,
          image: track.album.images[0],
        },
      })
    })
    .catch(error => {
      console.error('error', error);
      res.send({ success: false, error: error });
    })
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
      auth.saveTokens(response.data);

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
