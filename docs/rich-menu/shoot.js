const puppeteer = require('puppeteer-core');
const path = require('path');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL = 'file://' + path.resolve(__dirname, 'rich-menu.html');

const sizes = [
  ['large-2500x1686', 2500, 1686],
  ['large-1200x810', 1200, 810],
  ['large-800x540', 800, 540],
  ['small-2500x843', 2500, 843],
  ['small-1200x405', 1200, 405],
  ['small-800x270', 800, 270],
];

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--hide-scrollbars'],
  });
  for (const [name, w, h] of sizes) {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    await page.goto(`${URL}?w=${w}&h=${h}`, { waitUntil: 'networkidle0' });
    await page.evaluateHandle('document.fonts.ready');
    await page.screenshot({
      path: path.join(__dirname, name + '.png'),
      clip: { x: 0, y: 0, width: w, height: h },
    });
    await page.close();
    console.log('wrote', name, w + 'x' + h);
  }
  await browser.close();
})();
