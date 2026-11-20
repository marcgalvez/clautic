// Dades inicials de SOLC. Les portades es generen per codi (no són les originals).
window.SOLC_SEED = {
  me: { name: "Tu", city: "Barcelona" },

  myCrate: [
    { id: "m1", artist: "The Clash", title: "London Calling", year: 1979, genre: "Punk", condition: "VG+", forTrade: false },
    { id: "m2", artist: "Ramones", title: "Ramones", year: 1976, genre: "Punk", condition: "VG", forTrade: true },
    { id: "m3", artist: "Joy Division", title: "Unknown Pleasures", year: 1979, genre: "Post-punk", condition: "Near Mint", forTrade: false },
    { id: "m4", artist: "Dead Kennedys", title: "Fresh Fruit for Rotting Vegetables", year: 1980, genre: "Hardcore", condition: "VG+", forTrade: true },
    { id: "m5", artist: "La Polla Records", title: "Salve", year: 1984, genre: "Punk", condition: "VG", forTrade: false },
    { id: "m6", artist: "The Stooges", title: "Fun House", year: 1970, genre: "Garage", condition: "VG+", forTrade: true },
    { id: "m7", artist: "Nirvana", title: "Bleach", year: 1989, genre: "Grunge", condition: "Mint", forTrade: false },
    { id: "m8", artist: "Siouxsie and the Banshees", title: "Juju", year: 1981, genre: "Post-punk", condition: "VG+", forTrade: true }
  ],

  wishlist: [
    { id: "w1", artist: "Black Flag", title: "Damaged" },
    { id: "w2", artist: "Wire", title: "Pink Flag" },
    { id: "w3", artist: "Eskorbuto", title: "Anti Todo" },
    { id: "w4", artist: "Bad Brains", title: "Bad Brains" }
  ],

  collectors: [
    { id: "c1", name: "Rata Ramona", city: "Gràcia", avatar: "🐀", rep: 4.9,
      wants: ["Fun House", "Juju"],
      offers: [
        { id: "o1", artist: "Black Flag", title: "Damaged", year: 1981, genre: "Hardcore", condition: "VG+" },
        { id: "o2", artist: "Sex Pistols", title: "Never Mind the Bollocks", year: 1977, genre: "Punk", condition: "VG" }
      ] },
    { id: "c2", name: "Kike Imperdible", city: "Bilbo", avatar: "📌", rep: 4.7,
      wants: ["Fresh Fruit for Rotting Vegetables"],
      offers: [
        { id: "o3", artist: "Eskorbuto", title: "Anti Todo", year: 1986, genre: "Punk", condition: "Near Mint" },
        { id: "o4", artist: "Kortatu", title: "Kortatu", year: 1985, genre: "Punk", condition: "VG+" }
      ] },
    { id: "c3", name: "Nora Feedback", city: "València", avatar: "🎸", rep: 4.8,
      wants: ["Bleach", "Ramones"],
      offers: [
        { id: "o5", artist: "Wire", title: "Pink Flag", year: 1977, genre: "Post-punk", condition: "VG+" },
        { id: "o6", artist: "Sonic Youth", title: "Daydream Nation", year: 1988, genre: "Rock", condition: "Mint" },
        { id: "o7", artist: "The Cramps", title: "Songs the Lord Taught Us", year: 1980, genre: "Garage", condition: "VG" }
      ] },
    { id: "c4", name: "Pau Skinhead Antifa", city: "Sabadell", avatar: "🥾", rep: 4.6,
      wants: ["London Calling"],
      offers: [
        { id: "o8", artist: "Cock Sparrer", title: "Shock Troops", year: 1983, genre: "Oi!", condition: "VG+" },
        { id: "o9", artist: "Bad Brains", title: "Bad Brains", year: 1982, genre: "Hardcore", condition: "VG" }
      ] },
    { id: "c5", name: "Lola Distorsió", city: "Girona", avatar: "🔊", rep: 5.0,
      wants: ["Unknown Pleasures"],
      offers: [
        { id: "o10", artist: "Mudhoney", title: "Superfuzz Bigmuff", year: 1988, genre: "Grunge", condition: "Near Mint" },
        { id: "o11", artist: "The Damned", title: "Damned Damned Damned", year: 1977, genre: "Punk", condition: "VG+" }
      ] }
  ]
};
