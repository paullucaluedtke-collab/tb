const ti = require('technicalindicators');
console.log('bullish object:', ti.bullish);
if (ti.bullish) {
    console.log('bullish keys:', Object.keys(ti.bullish));
}
console.log('bearish object:', ti.bearish);
if (ti.bearish) {
    console.log('bearish keys:', Object.keys(ti.bearish));
}
