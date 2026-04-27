import { test, expect } from '@playwright/test';

test('browse, search, favorite and view a product', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'تازگی را به خانه ببرید' })).toBeVisible();
  await expect(page.locator('.product-card')).toHaveCount(4);
  await page.getByRole('searchbox', { name: 'جستجوی محصولات' }).fill('carrots');
  await expect(page.locator('.product-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'علاقه‌مندی: Fresh carrots' }).click();
  await page.getByRole('link', { name: /علاقه‌مندی‌ها/ }).click();
  await expect(page.locator('.product-card')).toHaveCount(1);
  await page.getByRole('heading', { name: 'Fresh carrots' }).getByRole('link').click();
  await expect(page.getByRole('heading', { level: 1, name: 'Fresh carrots' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'حذف از علاقه‌مندی' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('register, update cart and submit a real order', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/register');
  await page.getByLabel('نام شما').fill('خریدار آزمایشی');
  await page.getByLabel('ایمیل', { exact: true }).fill(`buyer-${Date.now()}@example.test`);
  await page.getByLabel('رمز عبور', { exact: true }).fill('Test-buyer-password-123!');
  await page.getByRole('button', { name: 'ساخت حساب', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'تازگی را به خانه ببرید' })).toBeVisible();
  await page.getByRole('button', { name: 'افزودن Fresh carrots به سبد' }).click();
  await expect(page.getByRole('status')).toContainText('به سبد خرید اضافه شد');
  await page
    .getByRole('link', { name: /سبد خرید/ })
    .first()
    .click();
  await page.getByRole('button', { name: 'افزایش تعداد Fresh carrots' }).click();
  await expect(page.getByRole('status', { name: 'تعداد Fresh carrots' })).toHaveText('2');
  await page.getByRole('link', { name: 'ادامه و ثبت سفارش' }).click();
  await page.getByLabel('نشانی کامل').fill('کابل، سرک آزمایشی، خانه ۱۰');
  await page.getByLabel('شماره تلفن').fill('+93700000000');
  await page.getByRole('button', { name: 'تأیید و ثبت سفارش' }).click();
  await expect(page.getByRole('heading', { name: 'سفارش‌های من' })).toBeVisible();
  await expect(page.locator('.order-card')).toHaveCount(1);
  await expect(page.locator('.order-card')).toContainText('ثبت شده');
  await page
    .getByRole('link', { name: /سبد خرید/ })
    .first()
    .click();
  await expect(page.getByRole('heading', { name: 'سبد شما هنوز خالی است' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('manager can create a product and update order processing', async ({ page, request }) => {
  const registration = await request.post('/api/auth/register', {
    data: {
      name: 'Order fixture',
      email: `order-${Date.now()}@example.test`,
      password: 'Test-order-password-123!',
    },
  });
  expect(registration.status()).toBe(201);
  const { token } = await registration.json();
  const headers = { Authorization: `Bearer ${token}` };
  const catalog = await (await request.get('/api/products')).json();
  expect(
    (await request.put(`/api/cart/${catalog[0].id}`, { headers, data: { quantity: 1 } })).ok(),
  ).toBeTruthy();
  expect(
    (
      await request.post('/api/orders', {
        headers,
        data: {
          address: 'Kabul, Test Street',
          phone: '+93700000000',
          requestKey: crypto.randomUUID(),
        },
      })
    ).status(),
  ).toBe(201);
  await page.goto('/login');
  await page.getByLabel('ایمیل', { exact: true }).fill('manager@example.test');
  await page.getByLabel('رمز عبور', { exact: true }).fill('Test-only-password-123!');
  await page.getByRole('button', { name: 'ورود', exact: true }).click();
  await page.getByRole('link', { name: 'مدیریت', exact: true }).click();
  await page.getByRole('button', { name: 'محصول جدید' }).click();
  await page.getByLabel('نام محصول').fill('Test harvest');
  await page.getByLabel('توضیحات').fill('A product created through the manager interface.');
  await page.getByLabel('قیمت به سنت امریکا').fill('899');
  await page.getByLabel('موجودی', { exact: true }).fill('12');
  await page.getByRole('button', { name: 'ذخیرهٔ محصول' }).click();
  await expect(page.getByRole('cell', { name: /Test harvest/ })).toBeVisible();
  await page.getByRole('button', { name: 'مدیریت سفارش‌ها' }).click();
  const order = page.locator('.order-card').first();
  await expect(order).toBeVisible();
  await order.getByRole('button', { name: 'در حال آماده‌سازی' }).click();
  await expect(order.locator('.badge')).toHaveText('در حال آماده‌سازی');
});

test('customer can edit profile, change password and revoke all sessions', async ({
  page,
  request,
}) => {
  const email = `account-${Date.now()}@example.test`;
  const oldPassword = 'Initial-account-password-123!';
  const newPassword = 'Replacement-account-password-123!';
  const registered = await request.post('/api/auth/register', {
    data: { name: 'Account customer', email, password: oldPassword },
  });
  expect(registered.status()).toBe(201);
  const { token: oldToken } = await registered.json();
  await page.goto('/login');
  await page.getByLabel('ایمیل', { exact: true }).fill(email);
  await page.getByLabel('رمز عبور', { exact: true }).fill(oldPassword);
  await page.getByRole('button', { name: 'ورود', exact: true }).click();
  await page.getByRole('link', { name: 'حساب من', exact: true }).click();
  await page.getByLabel('نام شما').fill('نام تازه');
  await page.getByRole('button', { name: 'ذخیرهٔ نام', exact: true }).click();
  await expect(page.getByRole('button', { name: 'خروج · نام تازه', exact: true })).toBeVisible();
  await page.getByLabel('رمز فعلی', { exact: true }).fill(oldPassword);
  await page.getByLabel('رمز جدید', { exact: true }).fill(newPassword);
  await page.getByLabel('تکرار رمز جدید', { exact: true }).fill(newPassword);
  await page.getByRole('button', { name: 'تغییر رمز و خروج از همهٔ نشست‌ها', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'ورود به حساب', exact: true })).toBeVisible();
  expect(
    (
      await request.get('/api/auth/me', { headers: { Authorization: `Bearer ${oldToken}` } })
    ).status(),
  ).toBe(401);
  await page.getByLabel('ایمیل', { exact: true }).fill(email);
  await page.getByLabel('رمز عبور', { exact: true }).fill(newPassword);
  await page.getByRole('button', { name: 'ورود', exact: true }).click();
  await page.getByRole('link', { name: 'حساب من', exact: true }).click();
  await expect(page.getByLabel('نام شما')).toHaveValue('نام تازه');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('button', { name: 'خروج از همهٔ نشست‌ها', exact: true }).click();
  await page.getByRole('button', { name: 'تأیید خروج از همهٔ نشست‌ها', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'ورود به حساب', exact: true })).toBeVisible();
});

test('customer confirms pending order cancellation and stock is restored', async ({
  page,
  request,
}) => {
  const email = `cancel-${Date.now()}@example.test`;
  const password = 'Cancellation-password-123!';
  const registered = await request.post('/api/auth/register', {
    data: { name: 'Cancellation customer', email, password },
  });
  const { token } = await registered.json();
  const headers = { Authorization: `Bearer ${token}` };
  const [product] = await (await request.get('/api/products')).json();
  expect(
    (await request.put(`/api/cart/${product.id}`, { headers, data: { quantity: 1 } })).status(),
  ).toBe(200);
  const created = await request.post('/api/orders', {
    headers,
    data: {
      address: 'Kabul, Test Street 12',
      phone: '+93700000000',
      requestKey: crypto.randomUUID(),
    },
  });
  expect(created.status()).toBe(201);
  const order = await created.json();
  await page.goto('/login');
  await page.getByLabel('ایمیل', { exact: true }).fill(email);
  await page.getByLabel('رمز عبور', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'ورود', exact: true }).click();
  await page.getByRole('link', { name: 'سفارش‌ها', exact: true }).click();
  await page.getByRole('button', { name: `لغو سفارش #${order.id}`, exact: true }).click();
  await page.getByRole('button', { name: 'انصراف', exact: true }).click();
  await expect(page.locator('.order-card .badge')).toHaveText('ثبت شده');
  await page.getByRole('button', { name: `لغو سفارش #${order.id}`, exact: true }).click();
  await page.getByRole('button', { name: `تأیید لغو سفارش #${order.id}`, exact: true }).click();
  await expect(page.locator('.order-card .badge')).toHaveText('لغو شده');
  await expect(
    page.getByRole('button', { name: `لغو سفارش #${order.id}`, exact: true }),
  ).toHaveCount(0);
  expect((await (await request.get(`/api/products/${product.id}`)).json()).stock).toBe(
    product.stock,
  );
});

test('mobile layout stays inside the viewport and handles missing pages', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('.product-card').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'test-results/storefront-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: 'test-results/storefront-desktop.png', fullPage: true });
  await page.goto('/missing-page');
  await expect(page.getByRole('heading', { name: 'صفحه پیدا نشد' })).toBeVisible();
});

test('catalog pagination and search survive shared URLs and reloads', async ({ page, request }) => {
  const login = await request.post('/api/auth/login', {
    data: { email: 'manager@example.test', password: 'Test-only-password-123!' },
  });
  const { token } = await login.json();
  const headers = { Authorization: `Bearer ${token}` };
  const ids = [];
  try {
    for (let index = 0; index < 14; index++) {
      const created = await request.post('/api/admin/products', {
        headers,
        data: {
          name: `Page fruit ${index}`,
          description: 'Catalog pagination fixture',
          category: 'Pagination fixture',
          image: '/images/img-pro-01.jpg',
          priceCents: 100 + index,
          stock: 10,
          active: true,
        },
      });
      expect(created.status()).toBe(201);
      ids.push((await created.json()).id);
    }
    await page.goto('/?category=Pagination+fixture&sort=low');
    await expect(page.locator('.product-card')).toHaveCount(12);
    await page.getByRole('button', { name: 'صفحهٔ بعدی', exact: true }).click();
    await expect(page.locator('.product-card')).toHaveCount(2);
    await expect(page).toHaveURL(/page=1/);
    await page.reload();
    await expect(page.locator('.product-card')).toHaveCount(2);
    await expect(page.getByRole('heading', { name: 'Page fruit 13', exact: true })).toBeVisible();
    await page.getByRole('searchbox', { name: 'جستجوی محصولات' }).fill('Page fruit 13');
    await expect(page.locator('.product-card')).toHaveCount(1);
    await expect(page).not.toHaveURL(/page=1/);
    await page.reload();
    await expect(page.locator('.product-card')).toHaveCount(1);
    await expect(page.getByRole('searchbox', { name: 'جستجوی محصولات' })).toHaveValue(
      'Page fruit 13',
    );
  } finally {
    for (const id of ids) await request.delete(`/api/admin/products/${id}`, { headers });
  }
});

async function loginCustomer(page, email, password) {
  await page.goto('/login');
  await page.getByLabel('ایمیل', { exact: true }).fill(email);
  await page.getByLabel('رمز عبور', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'ورود', exact: true }).click();
  await expect(page.getByRole('link', { name: 'حساب من', exact: true })).toBeVisible();
}

test('account wishlist synchronizes across devices and stays isolated after sign-out', async ({
  page,
  browser,
  request,
  baseURL,
}) => {
  const email = `saved-${Date.now()}@example.test`,
    password = 'Saved-products-password-123!';
  expect(
    (
      await request.post('/api/auth/register', {
        data: { name: 'Saved customer', email, password },
      })
    ).status(),
  ).toBe(201);
  await loginCustomer(page, email, password);
  await page.getByRole('button', { name: 'علاقه‌مندی: Fresh carrots', exact: true }).click();
  await page.getByRole('link', { name: /علاقه‌مندی‌ها/ }).click();
  await expect(page.locator('.product-card')).toHaveCount(1);
  const otherDevice = await browser.newContext({ baseURL });
  try {
    const otherPage = await otherDevice.newPage();
    await loginCustomer(otherPage, email, password);
    await otherPage.getByRole('link', { name: /علاقه‌مندی‌ها/ }).click();
    await expect(otherPage.locator('.product-card')).toHaveCount(1);
    await expect(
      otherPage.getByRole('heading', { name: 'Fresh carrots', exact: true }),
    ).toBeVisible();
  } finally {
    await otherDevice.close();
  }
  await page.getByRole('button', { name: 'خروج · Saved customer', exact: true }).click();
  await page.getByRole('link', { name: /علاقه‌مندی‌ها/ }).click();
  await expect(page.locator('.product-card')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'هنوز محصولی ذخیره نکرده‌اید' })).toBeVisible();
});

test('guest wishlist is imported only after explicit account confirmation', async ({
  page,
  request,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'علاقه‌مندی: Fresh carrots', exact: true }).click();
  await page.getByRole('link', { name: 'ورود / ثبت‌نام', exact: true }).click();
  await page.getByRole('link', { name: 'ثبت‌نام کنید', exact: true }).click();
  const email = `import-${Date.now()}@example.test`,
    password = 'Import-wishlist-password-123!';
  await page.getByLabel('نام شما').fill('Import customer');
  await page.getByLabel('ایمیل', { exact: true }).fill(email);
  await page.getByLabel('رمز عبور', { exact: true }).fill(password);
  const registered = page.waitForResponse((response) =>
    response.url().endsWith('/api/auth/register'),
  );
  await page.getByRole('button', { name: 'ساخت حساب', exact: true }).click();
  const { token } = await (await registered).json();
  const headers = { Authorization: `Bearer ${token}` };
  await page.getByRole('link', { name: /علاقه‌مندی‌ها/ }).click();
  await expect(page.locator('.product-card')).toHaveCount(0);
  expect(await (await request.get('/api/wishlist', { headers })).json()).toEqual([]);
  await page
    .getByRole('button', { name: 'انتقال علاقه‌مندی‌های مهمان به حساب', exact: true })
    .click();
  await expect(page.locator('.product-card')).toHaveCount(1);
  await expect(page.locator('.wishlist-banner')).toHaveCount(0);
  expect((await (await request.get('/api/wishlist', { headers })).json()).length).toBe(1);
  await page.getByRole('button', { name: 'خروج · Import customer', exact: true }).click();
  await page.getByRole('link', { name: /علاقه‌مندی‌ها/ }).click();
  await expect(page.locator('.product-card')).toHaveCount(0);
});

test('saved delivery addresses support defaults, checkout selection and immutable receipts', async ({
  page,
  request,
}) => {
  const email = `addresses-${Date.now()}@example.test`,
    password = 'Delivery-address-password-123!';
  expect(
    (
      await request.post('/api/auth/register', {
        data: { name: 'Address customer', email, password },
      })
    ).status(),
  ).toBe(201);
  await loginCustomer(page, email, password);
  await page.getByRole('link', { name: 'حساب من', exact: true }).click();
  await page.getByRole('link', { name: 'مدیریت نشانی‌ها', exact: true }).click();
  await page.getByRole('button', { name: 'نشانی جدید', exact: false }).click();
  await page.getByLabel('عنوان نشانی').fill('خانه');
  await page.getByLabel('نام گیرنده', { exact: true }).fill('گیرنده خانه');
  await page.getByLabel('شماره تماس تحویل').fill('+93700000011');
  await page.getByLabel('نشانی کامل تحویل').fill('کابل، نشانی خانه ۱۱');
  await page.getByRole('button', { name: 'ذخیرهٔ نشانی', exact: true }).click();
  await expect(page.locator('.address-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'نشانی جدید', exact: false }).click();
