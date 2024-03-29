const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios").default;
const qs = require("qs");
const auth = require("./auth");

const app = express();
const port = process.env.PORT || 5000;
const allowConnectFrom =
  process.env.ALLOW_CONNECT_FROM || "http://localhost:3000";
const clientID = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;
const clientIDSecret = `${clientID}:${clientSecret}`;
const redirectPath = "/auth/spotify/callback";
const redirectURL = `${
  process.env.REDIRECT_HOST || `http://localhost:${port}`
}${redirectPath}`;
const scopes = [
  "user-read-private",
  "user-read-email",
  "user-top-read",
  "user-read-currently-playing",
].join(" ");

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const getOriginURL = (req) => {
  const refererHost = req.headers["referer"];
  const originatingHost = req.headers["origin"];
  const goingToHost = req.headers["host"];
  const currentHostname = req.hostname;

  if (refererHost) {
    console.debug("Referer is", `${refererHost}`);
  }

  if (originatingHost) {
    console.debug("Request originating from", `"${originatingHost}"`);
  }

  if (goingToHost) {
    console.debug("Request going to host", `"${goingToHost}"`);
  }

  const host = refererHost || originatingHost || goingToHost || currentHostname;

  let matingAllowConnectFrom = allowConnectFrom
    .split(",")
    .map((url) => url.trim());
  const matchingOriginURL = matingAllowConnectFrom.filter((authorized_urls) =>
    Boolean(host.match(RegExp(authorized_urls)))
  )[0];

  if (!matchingOriginURL) {
    console.warn("No matching origin URL was found...");
    return redirectURL;
  }

  return matchingOriginURL;
};

const allowCrossDomain = function (req, res, next) {
  const allowedHeaders =
    req.header("access-control-request-headers") ||
    "Content-Type,X-Tanoshimu-Auth,X-Proxied-Auth-ID";

  const originatingHost = req.headers["origin"];
  const goingToHost = req.headers["host"];
  const currentHostname = req.hostname;

  if (originatingHost) {
    console.log("Request originating from", `"${originatingHost}"`);
  }

  if (goingToHost) {
    console.log("Request going to host", `"${goingToHost}"`);
  }

  const host = originatingHost || goingToHost || currentHostname;
  console.log("Coming from", host);

  // Set CORS headers: allow all origins, methods, and headers: you may want to lock this down in a production environment
  const originURL = getOriginURL(req);
  if (originURL) {
    res.header("Access-Control-Allow-Origin", originURL);
  } else {
    console.warn(
      "Warning: Access-Control-Allow-Origin not authorized for host",
      `"${host}"`
    );
  }

  res.header("Access-Control-Allow-Credentials", true);
  res.header("Access-Control-Allow-Methods", "GET, PUT, PATCH, POST, DELETE");
  res.header("Access-Control-Allow-Headers", allowedHeaders);
  res.header("X-Request-Id", req.headers["x-request-id"]);

  next();
};

app.use(allowCrossDomain);
app.use(function (req, _, next) {
  console.log(
    `\n\n[${new Date()}]`,
    "\x1b[36m",
    req.method.toUpperCase(),
    "\x1b[0m",
    req.originalUrl
  );

  next();
});

app.get("/authorize", (_, res) => {
  const authorizeURLParams = [
    `client_id=${clientID}`,
    "response_type=code",
    `redirect_uri=${redirectURL}`,
    `scope=${scopes}`,
  ].join("&");

  if (!clientID || !clientSecret) {
    res.send({
      success: false,
      message: "missing client id and client secret",
    });
  } else {
    res.redirect(
      `https://accounts.spotify.com/authorize?${authorizeURLParams}`
    );
  }
});

app.get("/top/artists", (_, res) => {
  auth
    .request("/top/artists?time_range=long_term")
    .then((response) => {
      res.send(
        response.items.map((item) => ({
          id: item.id,
          name: item.name,
          img: item.images.length > 0 && item.images[0].url,
          genres: item.genres,
        }))
      );
    })
    .catch((error) => {
      console.error("error", error);
      res.send({ success: false, error: error });
    });
});

app.get("/top/tracks", (req, res, next) => {
  const topTracks = parseInt(req.query.top_tracks) || 20;
  const limit = topTracks <= 0 ? 50 : topTracks;
  const time_range = `${req.query.time_range || "medium"}_term`;

  //myTopTracks(140).then(items => console.log('GOT', items.length, ' item(s)!')).catch(e => console.log('error', e));

  auth
    .request(`/top/tracks?limit=${limit}&time_range=${time_range}`)
    .then((response) => {
      res.send(
        response.items.map((item) => ({
          id: item.id,
          name: item.name,
          album: {
            id: item.album.id,
            name: item.album.name,
            img: item.album.images[0].url,
          },
          artists: item.artists.map((artist) => artist.name),
        }))
      );
    })
    .catch((error) => {
      console.error(error);
      res.send({ success: false, error: error });
    });
});

async function myTopTracks(limit) {
  const tracks = [];
  const pages = Math.floor(limit / 50);
  const remainder = limit % 50;
  let offset = 0;

  const getSpotifyTracks = async (limit, offset) => {
    const result = await auth.request(
      `/top/tracks?limit=${limit}&offset=${offset}`
    );
    return result.items;
  };

  for (let i = 0; i < pages; i++) {
    await getSpotifyTracks(50, offset).forEach((x) => tracks.push(x));
    offset += 50;
  }

  await getSpotifyTracks(remainder, offset).forEach((x) => tracks.push(x));

  return tracks;
}

app.get("/top/genres", (_, res) => {
  auth
    .request("/top/artists")
    .then((response) => {
      const genres = response.items
        .map((item) => item.genres)
        .flat()
        .reduce((result, value) => {
          result[value] = (result[value] || 0) + 1;
          return result;
        }, {});

      const topGenres = Object.fromEntries(
        Object.entries(genres).sort(([, a], [, b]) => b - a)
      );

      res.send(Object.keys(topGenres));
    })
    .catch((error) => {
      console.error("error", error);
      res.send({ success: false, error: error });
    });
});

app.get("/playing/now", (_, res) => {
  auth
    .request("/player/currently-playing")
    .then((response) => {
      const track = response.item;
      var result;

      if (track) {
        result = {
          id: track.id,
          at: track.timestamp,
          progress: (response.progress_ms / track.duration_ms) * 100,
          progress_ms: response.duration_ms,
          duration_ms: track.duration_ms,
          playing: response.is_playing,
          name: track.name,
          preview_url: track.preview_url,
          artists: track.artists.map((artist) => ({
            name: artist.name,
            id: artist.id,
          })),
          album: {
            name: track.album.name,
            image: track.album.images[0],
          },
        };
      } else {
        result = {
          playing: false,
        };
      }

      result.success = true;
      res.send(result);
    })
    .catch((error) => {
      console.error("error", error);
      res.send({ success: false, error: error });
    });
});

app.get(redirectPath, (req, res) => {
  const code = req.query.code;
  const error = req.query.error;

  if (error) {
    res.send({ success: false, error: error });
  } else {
    const authorizationBody = {
      grant_type: "authorization_code",
      code: code,
      redirect_uri: redirectURL,
    };

    const authorizationHeaders = {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(clientIDSecret).toString("base64")}`,
    };

    axios
      .request({
        baseURL: "https://accounts.spotify.com",
        method: "POST",
        url: "/api/token",
        data: qs.stringify(authorizationBody),
        headers: authorizationHeaders,
      })
      .then((response) => {
        auth.saveTokens(response.data);

        res.send({
          success: true,
          response: response.data,
        });
      })
      .catch((error) => {
        console.error(error.response);
        res.send({
          success: false,
          message: "that did not work",
          error: error,
        });
      });
  }
});

app.listen(port, () => console.log(`Running on port ${port}...`));
