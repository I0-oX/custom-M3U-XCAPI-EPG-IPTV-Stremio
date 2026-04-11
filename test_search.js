// Test script to verify catalog search logic
const M3UEPGAddon = require("./addon"); // Mock or require addon structure
const assert = require("assert");

// Mock data
const mockSeries = [
  { id: "s1", name: "Breaking Bad", type: "series" },
  { id: "s2", name: "Better Call Saul", type: "series" },
  { id: "s3", name: "The.Wire.S01", type: "series" }, // Dot separated
];

// Mock addon instance
const addonInstance = {
  config: { includeSeries: true, debug: false },
  channels: [],
  movies: [],
  series: mockSeries,
  generateMetaPreview: (i) => ({ id: i.id, name: i.name }),
};

// Simulate catalog handler logic
function searchLogic(args) {
  let items = [];
  if (args.type === "tv" && args.id === "iptv_channels") {
    items = addonInstance.channels;
  } else if (args.type === "movie" && args.id === "iptv_movies") {
    items = addonInstance.movies;
  } else if (args.type === "series" && args.id === "iptv_series") {
    if (addonInstance.config.includeSeries !== false)
      items = addonInstance.series;
  }

  // Original simplified logic
  let filtered = items;
  const extra = args.extra || {};

  // Improved logic
  if (extra.search) {
    const q = extra.search.toLowerCase();
    const cleanQ = q.replace(/[^a-z0-9]/g, "");
    filtered = filtered.filter((i) => {
      if (!i.name) return false;
      const itemLower = i.name.toLowerCase();
      return (
        itemLower.includes(q) ||
        itemLower.replace(/[^a-z0-9]/g, "").includes(cleanQ)
      );
    });
  }

  return filtered.map((i) => i.name);
}

// Test 1: Simple match
const res1 = searchLogic({
  type: "series",
  id: "iptv_series",
  extra: { search: "Breaking" },
});
console.log("Test 1 (Simple):", res1);

// Test 2: Dot separated match with spaces query
const res2 = searchLogic({
  type: "series",
  id: "iptv_series",
  extra: { search: "The Wire" },
});
console.log("Test 2 (Dots):", res2);

// Test 3: Incorrect type (should define empty)
const res3 = searchLogic({
  type: "movie",
  id: "iptv_series",
  extra: { search: "Breaking" },
});
console.log("Test 3 (Wrong Type):", res3);
