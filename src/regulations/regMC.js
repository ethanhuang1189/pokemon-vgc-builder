import regMB from './regMB.js';
import { extendRegulation } from './extend.js';

// Regulation M-C — everything in M-B plus the additions below.
export default extendRegulation(regMB, {
  id: 'M-C',
  label: 'Regulation M-C (Pokémon Champions)',

  add: {
    pokemon: [
      'Wigglytuff', 'Persian', 'Persian-Alola', 'Farfetch’d', 'Mr. Mime', 'Swalot', 'Salamence',
      'Gogoat', 'Golisopod', 'Rillaboom', 'Cinderace', 'Inteleon', 'Thievul',
      'Toxtricity', 'Toxtricity-Low-Key', 'Grapploct', 'Perrserker', 'Sirfetch’d', 'Pincurchin',
      'Indeedee', 'Indeedee-F', 'Arboliva',
      'Squawkabilly', 'Squawkabilly-Blue', 'Squawkabilly-Yellow', 'Squawkabilly-White',
      'Mabosstiff', 'Baxcalibur',
    ],

    megas: [
      'Absol-Mega-Z', 'Salamence-Mega', 'Garchomp-Mega-Z', 'Lucario-Mega-Z', 'Golisopod-Mega',
      'Baxcalibur-Mega',
    ],

    items: [
      'Leek', 'Rocky Helmet', 'Air Balloon', 'Red Card', 'Binding Band', 'Eject Button', 'Normal Gem',
      'Terrain Extender', 'Electric Seed', 'Psychic Seed', 'Misty Seed', 'Grassy Seed',
      'Salamencite', 'Absolite Z', 'Garchompite Z', 'Lucarionite Z', 'Golisopite', 'Baxcalibrite',
    ],
  },
});
