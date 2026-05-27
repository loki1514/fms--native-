const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  
  await page.goto('http://localhost:8081/login');
  await page.waitForTimeout(2000);
  
  // Fill email
  await page.fill('input[type="email"], input[placeholder*="email"], input[name="email"]', 'srustikarta2022@gmail.com');
  await page.waitForTimeout(500);
  
  // Fill password
  await page.fill('input[type="password"], input[placeholder*="password"], input[name="password"]', 'Naveen@95');
  await page.waitForTimeout(500);
  
  // Click sign in
  await page.click('button:has-text("Sign In"), button[type="submit"]');
  
  // Wait for navigation
  await page.waitForTimeout(5000);
  
  console.log('Current URL:', page.url());
  await page.screenshot({ path: './screenshots/04-after-login.png', fullPage: true });
  
  await browser.close();
})();
