import { CONFIG } from './constants.js';

export const PLATFORMS_DATA = [
  {
    id: 0,
    name: "Colaba Rooftop Terminal",
    x: 0,
    width: 12.0,
    zStart: -15.0,
    zEnd: 45.0,
    topY: 0.0,
    edgeColor: 'cyan',
    props: [
      { type: 'waterTank', x: -4.5, z: 10, radius: 1.2, height: 2.5 },
      { type: 'waterTank', x: 4.5, z: 25, radius: 1.4, height: 3.0 },
      { type: 'ventUnit', x: -3.8, z: 32, width: 1.8, depth: 2.2, height: 1.2 },
      { type: 'antenna', x: 4.8, z: 5, height: 6.0 },
      { type: 'neonSign', text: 'विद्युत', x: -5.5, z: 20, color: 0x00f0ff }
    ]
  },
  {
    id: 1,
    name: "Marine Lines Solar Deck",
    x: 0,
    width: 11.0,
    zStart: 51.5,
    zEnd: 105.0,
    topY: 0.0,
    edgeColor: 'amber',
    props: [
      { type: 'solarArray', x: -3.5, z: 65, width: 2.5, depth: 6.0 },
      { type: 'solarArray', x: 3.5, z: 88, width: 2.5, depth: 6.0 },
      { type: 'waterTank', x: 4.2, z: 60, radius: 1.1, height: 2.2 },
      { type: 'ventUnit', x: -3.8, z: 98, width: 2.0, depth: 2.0, height: 1.0 }
    ]
  },
  {
    id: 2,
    name: "Churchgate Telecom Nexus",
    x: 0,
    width: 10.5,
    zStart: 112.5,
    zEnd: 165.0,
    topY: 0.0,
    edgeColor: 'cyan',
    props: [
      { type: 'antenna', x: -4.2, z: 125, height: 7.5 },
      { type: 'satelliteDish', x: 4.0, z: 135, radius: 1.6 },
      { type: 'waterTank', x: -4.0, z: 150, radius: 1.5, height: 2.8 },
      { type: 'neonSign', text: 'स्पीड', x: 4.8, z: 145, color: 0xffaa00 }
    ]
  },
  {
    id: 3,
    name: "Kalbadevi Market Flats",
    x: 0,
    width: 11.5,
    zStart: 174.5,
    zEnd: 230.0,
    topY: -1.0,
    edgeColor: 'amber',
    props: [
      { type: 'ventUnit', x: -4.2, z: 190, width: 2.0, depth: 3.0, height: 1.4 },
      { type: 'waterTank', x: 4.2, z: 205, radius: 1.3, height: 2.6 },
      { type: 'waterTank', x: -4.5, z: 220, radius: 1.1, height: 2.2 },
      { type: 'neonSign', text: 'जल सेवा', x: -5.2, z: 200, color: 0x00f0ff }
    ]
  },
  {
    id: 4,
    name: "Monsoon Harvesting Hub",
    x: 0,
    width: 11.0,
    zStart: 238.5,
    zEnd: 295.0,
    topY: 0.0,
    edgeColor: 'cyan',
    props: [
      { type: 'waterTank', x: -4.0, z: 250, radius: 1.6, height: 3.2 },
      { type: 'waterTank', x: -4.0, z: 256, radius: 1.6, height: 3.2 },
      { type: 'ventUnit', x: 4.0, z: 275, width: 2.2, depth: 2.2, height: 1.3 },
      { type: 'solarArray', x: -3.6, z: 280, width: 2.2, depth: 5.0 }
    ]
  },
  {
    id: 5,
    name: "Girgaon Transit Overpass",
    x: 0,
    width: 10.0,
    zStart: 303.5,
    zEnd: 355.0,
    topY: 0.0,
    edgeColor: 'amber',
    props: [
      { type: 'antenna', x: 3.8, z: 315, height: 6.5 },
      { type: 'satelliteDish', x: -3.8, z: 330, radius: 1.5 },
      { type: 'ventUnit', x: 3.5, z: 345, width: 1.8, depth: 2.0, height: 1.1 }
    ]
  },
  {
    id: 6,
    name: "Tardeo High Voltage Station",
    x: 0,
    width: 10.5,
    zStart: 364.5,
    zEnd: 415.0,
    topY: 1.0,
    edgeColor: 'cyan',
    props: [
      { type: 'ventUnit', x: -4.0, z: 380, width: 2.2, depth: 3.5, height: 1.5 },
      { type: 'waterTank', x: 4.0, z: 395, radius: 1.4, height: 2.8 },
      { type: 'neonSign', text: 'पावर ग्रिड', x: 4.8, z: 385, color: 0xff3366 }
    ]
  },
  {
    id: 7,
    name: "Worli Coastal Overlook",
    x: 0,
    width: 11.0,
    zStart: 423.5,
    zEnd: 475.0,
    topY: 1.0,
    edgeColor: 'amber',
    props: [
      { type: 'solarArray', x: -3.8, z: 435, width: 2.4, depth: 6.0 },
      { type: 'waterTank', x: 4.0, z: 460, radius: 1.5, height: 3.0 },
      { type: 'ventUnit', x: -3.6, z: 468, width: 1.8, depth: 2.4, height: 1.2 }
    ]
  },
  {
    id: 8,
    name: "Parel Mill Complex",
    x: 0,
    width: 11.5,
    zStart: 487.0,
    zEnd: 545.0,
    topY: -1.5,
    edgeColor: 'cyan',
    props: [
      { type: 'waterTank', x: -4.2, z: 500, radius: 1.8, height: 3.5 },
      { type: 'waterTank', x: 4.2, z: 518, radius: 1.5, height: 2.8 },
      { type: 'ventUnit', x: -4.0, z: 532, width: 2.0, depth: 2.8, height: 1.4 },
      { type: 'neonSign', text: 'मुंबई 2088', x: -5.0, z: 510, color: 0x00f0ff }
    ]
  },
  {
    id: 9,
    name: "Dadar Central Skyway",
    x: 0,
    width: 10.5,
    zStart: 553.5,
    zEnd: 605.0,
    topY: -0.5,
    edgeColor: 'amber',
    props: [
      { type: 'antenna', x: -4.0, z: 570, height: 7.0 },
      { type: 'satelliteDish', x: 4.0, z: 585, radius: 1.8 },
      { type: 'ventUnit', x: -3.8, z: 595, width: 1.8, depth: 2.2, height: 1.2 }
    ]
  },
  {
    id: 10,
    name: "Matunga Logistics Terrace",
    x: 0,
    width: 10.5,
    zStart: 614.5,
    zEnd: 665.0,
    topY: -0.5,
    edgeColor: 'cyan',
    props: [
      { type: 'waterTank', x: 4.0, z: 628, radius: 1.4, height: 2.6 },
      { type: 'solarArray', x: -3.6, z: 642, width: 2.2, depth: 5.5 },
      { type: 'ventUnit', x: 3.8, z: 655, width: 1.8, depth: 2.0, height: 1.1 }
    ]
  },
  {
    id: 11,
    name: "Sion Express Viaduct",
    x: 0,
    width: 11.0,
    zStart: 674.0,
    zEnd: 725.0,
    topY: 0.5,
    edgeColor: 'amber',
    props: [
      { type: 'ventUnit', x: -4.0, z: 690, width: 2.2, depth: 3.0, height: 1.3 },
      { type: 'waterTank', x: 4.2, z: 705, radius: 1.5, height: 2.8 },
      { type: 'antenna', x: -4.5, z: 718, height: 6.8 }
    ]
  },
  {
    id: 12,
    name: "Kurla Sky-Chawl Roofs",
    x: 0,
    width: 11.0,
    zStart: 734.5,
    zEnd: 785.0,
    topY: 0.5,
    edgeColor: 'cyan',
    props: [
      { type: 'waterTank', x: -4.2, z: 748, radius: 1.6, height: 3.0 },
      { type: 'waterTank', x: 4.2, z: 762, radius: 1.3, height: 2.5 },
      { type: 'neonSign', text: 'मार्ग', x: 4.8, z: 755, color: 0xffaa00 },
      { type: 'solarArray', x: -3.5, z: 772, width: 2.4, depth: 5.0 }
    ]
  },
  {
    id: 13,
    name: "Bandra Cyber Yard",
    x: 0,
    width: 11.5,
    zStart: 796.5,
    zEnd: 850.0,
    topY: -1.0,
    edgeColor: 'amber',
    props: [
      { type: 'satelliteDish', x: -4.2, z: 812, radius: 1.8 },
      { type: 'ventUnit', x: 4.0, z: 825, width: 2.0, depth: 2.8, height: 1.4 },
      { type: 'waterTank', x: -4.0, z: 840, radius: 1.5, height: 2.8 }
    ]
  },
  {
    id: 14,
    name: "BKC Skybridge Approach",
    x: 0,
    width: 10.5,
    zStart: 858.5,
    zEnd: 910.0,
    topY: 0.0,
    edgeColor: 'cyan',
    props: [
      { type: 'antenna', x: 4.2, z: 872, height: 7.2 },
      { type: 'solarArray', x: -3.8, z: 885, width: 2.2, depth: 6.0 },
      { type: 'ventUnit', x: 3.8, z: 900, width: 2.0, depth: 2.2, height: 1.2 }
    ]
  },
  {
    id: 15,
    name: "Neo-Bandra Sky Tower Helipad",
    x: 0,
    width: 14.0,
    zStart: 919.5,
    zEnd: 1015.0,
    topY: 0.5,
    edgeColor: 'cyan',
    props: [
      { type: 'helipad', x: 0, z: 975, radius: 5.0 },
      { type: 'antenna', x: -5.5, z: 940, height: 8.0 },
      { type: 'antenna', x: 5.5, z: 940, height: 8.0 },
      { type: 'waterTank', x: -5.2, z: 960, radius: 1.8, height: 3.5 },
      { type: 'waterTank', x: 5.2, z: 960, radius: 1.8, height: 3.5 },
      { type: 'neonSign', text: 'लक्ष्य - HELIPAD 01', x: 0, z: 995, color: 0x00f0ff, isBanner: true }
    ]
  }
];

// Five collectible energy cells along the route
export const CELLS_DATA = [
  {
    id: 1,
    name: "Cell Alpha - Solar Deck",
    x: 0.0,
    y: 1.8, // Easily grabbed while running or hop
    z: 80.0
  },
  {
    id: 2,
    name: "Cell Beta - Alley Leap",
    x: 0.0,
    y: 1.2, // Mid-air jump collectible between Platform 3 and 4
    z: 234.25
  },
  {
    id: 3,
    name: "Cell Gamma - Worli High",
    x: 0.0,
    y: 2.8, // Requiring a jump over the elevated terrace
    z: 450.0
  },
  {
    id: 4,
    name: "Cell Delta - Viaduct Crossing",
    x: 0.0,
    y: 1.7, // Mid-air jump collectible between Platform 10 and 11
    z: 669.5
  },
  {
    id: 5,
    name: "Cell Epsilon - Skybridge Apex",
    x: 0.0,
    y: 1.8, // Ahead of the grand helipad
    z: 885.0
  }
];
