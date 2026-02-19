const ti = require('technicalindicators');
console.log('BullishEngulfing:', ti.BullishEngulfing);
console.log('bullishengulfing:', ti.bullishengulfing);
console.log('Hammer:', ti.Hammer);
console.log('keys:', Object.keys(ti).filter(k => k.toLowerCase().includes('bullish')));
