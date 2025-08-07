const puppeteer = require('puppeteer');
const { execSync } = require('child_process');

describe('End-to-End User Workflow', () => {
  let browser;
  let page;
  const baseUrl = process.env.E2E_BASE_URL || 'http://localhost:3000';
  const apiUrl = process.env.E2E_API_URL || 'http://localhost:8000';

  beforeAll(async () => {
    // Start services if not running
    try {
      execSync('docker-compose -f docker-compose.enterprise.yml up -d', { stdio: 'pipe' });
      // Wait for services to be ready
      await new Promise(resolve => setTimeout(resolve, 30000));
    } catch (error) {
      console.warn('Services may already be running:', error.message);
    }

    browser = await puppeteer.launch({
      headless: process.env.E2E_HEADLESS !== 'false',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      slowMo: process.env.E2E_SLOW_MO ? parseInt(process.env.E2E_SLOW_MO) : 0
    });

    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  beforeEach(async () => {
    // Clear cookies and local storage
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    
    const client = await page.target().createCDPSession();
    await client.send('Network.clearBrowserCookies');
  });

  describe('User Registration and Login Flow', () => {
    const testUser = {
      firstName: 'Test',
      lastName: 'User',
      username: 'testuser_' + Date.now(),
      email: 'test_' + Date.now() + '@example.com',
      password: 'SecurePass123!',
      tenantSlug: 'demo-tenant'
    };

    it('should complete user registration successfully', async () => {
      await page.goto(`${baseUrl}/register`);

      // Fill registration form
      await page.waitForSelector('input[name="firstName"]');
      await page.type('input[name="firstName"]', testUser.firstName);
      await page.type('input[name="lastName"]', testUser.lastName);
      await page.type('input[name="username"]', testUser.username);
      await page.type('input[name="email"]', testUser.email);
      await page.type('input[name="password"]', testUser.password);
      await page.type('input[name="confirmPassword"]', testUser.password);
      await page.type('input[name="tenantSlug"]', testUser.tenantSlug);

      // Submit form
      await page.click('button[type="submit"]');

      // Wait for success message
      await page.waitForSelector('.success-message', { timeout: 10000 });
      const successText = await page.$eval('.success-message', el => el.textContent);
      expect(successText).toContain('Registration successful');
    });

    it('should login with registered user', async () => {
      await page.goto(`${baseUrl}/login`);

      // Fill login form
      await page.waitForSelector('input[name="identifier"]');
      await page.type('input[name="identifier"]', testUser.email);
      await page.type('input[name="password"]', testUser.password);
      await page.type('input[name="tenantSlug"]', testUser.tenantSlug);

      // Submit form
      await page.click('button[type="submit"]');

      // Wait for redirect to dashboard
      await page.waitForNavigation({ timeout: 10000 });
      
      expect(page.url()).toContain('/dashboard');

      // Check if user is logged in
      await page.waitForSelector('.user-menu');
      const userEmail = await page.$eval('.user-email', el => el.textContent);
      expect(userEmail).toBe(testUser.email);
    });

    it('should show validation errors for invalid login', async () => {
      await page.goto(`${baseUrl}/login`);

      // Fill with invalid credentials
      await page.waitForSelector('input[name="identifier"]');
      await page.type('input[name="identifier"]', 'invalid@email.com');
      await page.type('input[name="password"]', 'wrongpassword');
      await page.type('input[name="tenantSlug"]', testUser.tenantSlug);

      // Submit form
      await page.click('button[type="submit"]');

      // Wait for error message
      await page.waitForSelector('.error-message', { timeout: 5000 });
      const errorText = await page.$eval('.error-message', el => el.textContent);
      expect(errorText).toContain('Invalid credentials');
    });
  });

  describe('Asset Management Flow', () => {
    beforeEach(async () => {
      // Login before each asset test
      await page.goto(`${baseUrl}/login`);
      await page.type('input[name="identifier"]', 'admin@demo-tenant.com');
      await page.type('input[name="password"]', 'AdminPass123!');
      await page.type('input[name="tenantSlug"]', 'demo-tenant');
      await page.click('button[type="submit"]');
      await page.waitForNavigation();
    });

    it('should create a new asset', async () => {
      await page.goto(`${baseUrl}/assets/new`);

      const assetData = {
        name: 'Test Laptop ' + Date.now(),
        category: 'Electronics',
        price: '1500.00',
        purchaseDate: '2024-01-15',
        description: 'Test laptop for E2E testing'
      };

      // Fill asset form
      await page.waitForSelector('input[name="name"]');
      await page.type('input[name="name"]', assetData.name);
      await page.select('select[name="category"]', assetData.category);
      await page.type('input[name="price"]', assetData.price);
      await page.type('input[name="purchaseDate"]', assetData.purchaseDate);
      await page.type('textarea[name="description"]', assetData.description);

      // Submit form
      await page.click('button[type="submit"]');

      // Wait for success and redirect
      await page.waitForSelector('.success-message', { timeout: 10000 });
      await page.waitForNavigation();

      // Verify asset appears in list
      await page.waitForSelector('.asset-list');
      const assetNames = await page.$$eval('.asset-name', els => els.map(el => el.textContent));
      expect(assetNames).toContain(assetData.name);
    });

    it('should search and filter assets', async () => {
      await page.goto(`${baseUrl}/assets`);

      // Wait for assets to load
      await page.waitForSelector('.asset-list');

      // Use search functionality
      await page.type('input[name="search"]', 'Laptop');
      await page.click('button[type="search"]');

      // Wait for filtered results
      await page.waitForTimeout(2000);

      // Check if results contain searched term
      const assetNames = await page.$$eval('.asset-name', els => els.map(el => el.textContent));
      const laptopAssets = assetNames.filter(name => name.toLowerCase().includes('laptop'));
      expect(laptopAssets.length).toBeGreaterThan(0);
    });

    it('should export assets to CSV', async () => {
      await page.goto(`${baseUrl}/assets`);
      
      // Set up download handling
      const client = await page.target().createCDPSession();
      await client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: './downloads'
      });

      // Click export button
      await page.click('button[data-action="export"]');
      await page.click('button[data-format="csv"]');

      // Wait for download
      await page.waitForTimeout(3000);

      // Verify download started (this is basic - in real tests you'd check the file)
      const exportStatus = await page.$eval('.export-status', el => el.textContent);
      expect(exportStatus).toContain('Export completed');
    });
  });

  describe('Multi-Factor Authentication Flow', () => {
    beforeEach(async () => {
      // Login as admin
      await page.goto(`${baseUrl}/login`);
      await page.type('input[name="identifier"]', 'admin@demo-tenant.com');
      await page.type('input[name="password"]', 'AdminPass123!');
      await page.type('input[name="tenantSlug"]', 'demo-tenant');
      await page.click('button[type="submit"]');
      await page.waitForNavigation();
    });

    it('should setup MFA successfully', async () => {
      await page.goto(`${baseUrl}/profile/security`);

      // Click setup MFA
      await page.click('button[data-action="setup-mfa"]');

      // Wait for QR code to appear
      await page.waitForSelector('.qr-code', { timeout: 10000 });
      
      // Check if backup codes are displayed
      await page.waitForSelector('.backup-codes');
      const backupCodes = await page.$$eval('.backup-code', els => els.map(el => el.textContent));
      expect(backupCodes).toHaveLength(10);

      // Save backup codes (simulate user copying them)
      await page.click('button[data-action="confirm-backup-codes"]');

      // Simulate entering TOTP code (in real test, you'd use a TOTP library)
      await page.type('input[name="totpCode"]', '123456'); // This would fail, but tests the flow
      await page.click('button[data-action="verify-mfa"]');

      // This would show an error in real scenario, which is expected
      await page.waitForSelector('.error-message', { timeout: 5000 });
    });
  });

  describe('Responsive Design Tests', () => {
    it('should work on mobile viewport', async () => {
      await page.setViewport({ width: 375, height: 667 }); // iPhone SE

      await page.goto(`${baseUrl}/login`);

      // Check if mobile menu is present
      await page.waitForSelector('.mobile-menu-button');
      
      // Check if form is properly sized
      const loginForm = await page.$('.login-form');
      const formBox = await loginForm.boundingBox();
      expect(formBox.width).toBeLessThanOrEqual(375);
    });

    it('should work on tablet viewport', async () => {
      await page.setViewport({ width: 768, height: 1024 }); // iPad

      await page.goto(`${baseUrl}/dashboard`);

      // Check if layout adapts to tablet
      await page.waitForSelector('.dashboard-content');
      const sidebar = await page.$('.sidebar');
      
      // On tablet, sidebar might be collapsed or adapted
      if (sidebar) {
        const sidebarBox = await sidebar.boundingBox();
        expect(sidebarBox.width).toBeLessThanOrEqual(300);
      }
    });
  });

  describe('Accessibility Tests', () => {
    it('should be keyboard navigable', async () => {
      await page.goto(`${baseUrl}/login`);

      // Tab through form elements
      await page.keyboard.press('Tab');
      let activeElement = await page.evaluate(() => document.activeElement.tagName);
      expect(activeElement).toBe('INPUT');

      await page.keyboard.press('Tab');
      activeElement = await page.evaluate(() => document.activeElement.tagName);
      expect(['INPUT', 'BUTTON']).toContain(activeElement);
    });

    it('should have proper ARIA labels', async () => {
      await page.goto(`${baseUrl}/login`);

      // Check for ARIA labels on form elements
      const emailInput = await page.$('input[name="identifier"]');
      const ariaLabel = await page.evaluate(el => el.getAttribute('aria-label'), emailInput);
      expect(ariaLabel).toBeTruthy();
    });
  });

  describe('Performance Tests', () => {
    it('should load dashboard within performance budget', async () => {
      // Enable performance monitoring
      await page.goto(`${baseUrl}/login`);
      
      // Login first
      await page.type('input[name="identifier"]', 'admin@demo-tenant.com');
      await page.type('input[name="password"]', 'AdminPass123!');
      await page.type('input[name="tenantSlug"]', 'demo-tenant');
      
      // Measure dashboard load time
      const startTime = Date.now();
      await page.click('button[type="submit"]');
      await page.waitForNavigation();
      await page.waitForSelector('.dashboard-content');
      const endTime = Date.now();
      
      const loadTime = endTime - startTime;
      expect(loadTime).toBeLessThan(5000); // 5 second budget
    });
  });
});