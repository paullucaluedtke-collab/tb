const ti = require('technicalindicators');
const keys = Object.keys(ti);
console.log('Star patterns:', keys.filter(k => k.toLowerCase().includes('star')));
console.log('Doji patterns:', keys.filter(k => k.toLowerCase().includes('doji')));
console.log('Hammer patterns:', keys.filter(k => k.toLowerCase().includes('hammer')));
console.log('Engulfing patterns:', keys.filter(k => k.toLowerCase().includes('engulfing')));
