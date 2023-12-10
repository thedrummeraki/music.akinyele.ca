const { Client, Pool } = require('pg');

const saveMusic = (data) => {
  for (var i = 0; i < data.length; i++) {
    saveTrack(data.items[i]);
  }
};

function saveTrack(trackData) {
  const album = trackData.album;
  const artist = trackData.artist;
}

function albumToDB(album) {
  return {
    album_url: album.external_urls.spotity,
    album_hotlink: album.uri,
    album_name: album.name,
    album_tracks_count: album.total_tracks,
  }
}

function artistToDB(artists) {
  return {
    artist_names: artists.map(artist => artist.name).join(', ')
  }
}
