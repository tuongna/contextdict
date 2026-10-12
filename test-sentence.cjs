const { JSDOM } = require('jsdom');
const fs = require('fs');

const html = `
<!DOCTYPE html>
<html>
<body>
  <div id="content">
    <p>This is the first sentence. The quick brown fox jumps over the lazy dog. This is the third sentence.</p>
  </div>
</body>
</html>
`;

const dom = new JSDOM(html);
global.window = dom.window;
global.document = dom.window.document;
global.Node = dom.window.Node;
global.navigator = { language: 'en-US' };

// Load the original source file, not the minified dist to test easily
const src = fs.readFileSync('content/context-collector.js', 'utf8');
// The source uses an IIFE that attaches to window.ContextDictCollector
eval(src);

const p = document.querySelector('p');
const textNode = p.childNodes[0];

// Hover on "fox" (index 44 in the text node)
const offset = 44; 
const sentence = window.ContextDictCollector.getSentenceContext(textNode, offset);
console.log("DETECTED SENTENCE:", sentence);

// Test another scenario: abbreviations
p.innerHTML = "Dr. Smith went to Washington. He met with Mr. President there.";
const textNode2 = p.childNodes[0];
const offset2 = 12; // inside "went"
const sentence2 = window.ContextDictCollector.getSentenceContext(textNode2, offset2);
console.log("DETECTED SENTENCE WITH ABBREVIATION:", sentence2);

