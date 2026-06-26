// Curated Phase 1 seed list: a spread across the trigger spectrum so the genre
// filter is demonstrable. Annotated offline by scripts/build-seed.js -> seed-data.json
// (no DTDD calls at browse time). Real dynamic catalogs + Supabase cache come in Phase 4.
'use strict';

module.exports = [
  // Movies — animal death
  { ttId: 'tt0050798', type: 'movie' }, // Old Yeller
  { ttId: 'tt0822832', type: 'movie' }, // Marley & Me
  { ttId: 'tt2911666', type: 'movie' }, // John Wick
  { ttId: 'tt1028532', type: 'movie' }, // Hachi: A Dog's Tale
  { ttId: 'tt0110357', type: 'movie' }, // The Lion King (1994)
  // Movies — flashing lights / action
  { ttId: 'tt3606756', type: 'movie' }, // Incredibles 2
  { ttId: 'tt4633694', type: 'movie' }, // Spider-Man: Into the Spider-Verse
  // Movies — heavier themes
  { ttId: 'tt0038650', type: 'movie' }, // It's a Wonderful Life (suicide theme)
  // Movies — family / clean-ish
  { ttId: 'tt1109624', type: 'movie' }, // Paddington
  { ttId: 'tt4468740', type: 'movie' }, // Paddington 2
  { ttId: 'tt0114709', type: 'movie' }, // Toy Story
  { ttId: 'tt0266543', type: 'movie' }, // Finding Nemo
  { ttId: 'tt1049413', type: 'movie' }, // Up
  { ttId: 'tt2096673', type: 'movie' }, // Inside Out
  { ttId: 'tt2380307', type: 'movie' }, // Coco
  { ttId: 'tt0245429', type: 'movie' }, // Spirited Away

  // Series
  { ttId: 'tt4574334', type: 'series' }, // Stranger Things
  { ttId: 'tt0903747', type: 'series' }, // Breaking Bad
  { ttId: 'tt0944947', type: 'series' }, // Game of Thrones
  { ttId: 'tt0417299', type: 'series' }, // Avatar: The Last Airbender
  { ttId: 'tt7842848', type: 'series' }, // Bluey
  { ttId: 'tt0386676', type: 'series' }, // The Office (US)
];
