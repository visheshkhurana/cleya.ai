import { test, expect, type Page } from '@playwright/test';

/**
 * Mobile layout regression suite.
 *
 * Locks in the rules from the Phase 5 mobile audit:
 *   - body font-size >= 14px
 *   - no rendered text node below 12px
 *   - interactive controls (buttons, role=button, submittable inputs,
 *     checkboxes/radios, text inputs, selects, textareas, and non-inline
 *     anchor links) measure at least 44x44 CSS pixels
 *
 * Tests the four target viewport widths (360, 375, 393, 768) against the
 * homepage, signup modal, dashboard, matches, messages and the global footer.
 *
 * Authenticated routes (`/dashboard`, `/matches`, `/messages`) require a
 * Playwright storage state captured for a logged-in user. Set
 * `PLAYWRIGHT_STORAGE_STATE` to point at a JSON storage state file (the
 * Playwright config picks it up automatically). Without it those tests are
 * skipped with a clear message so we never silently validate a redirect to
 * the login page in place of the real authenticated layout.
 */

const VIEWPORTS = [
  { name: '360 (small Android)', width: 360, height: 780 },
  { name: '375 (iPhone SE/13 mini)', width: 375, height: 812 },
  { name: '393 (Pixel 7 / iPhone 14 Pro)', width: 393, height: 852 },
  { name: '768 (iPad portrait)', width: 768, height: 1024 },
] as const;

type PageTarget = {
  name: string;
  path: string;
  /** When true, the test scrolls to the bottom and verifies the footer. */
  scrollToFooter?: boolean;
  /**
   * When true, the test requires PLAYWRIGHT_STORAGE_STATE and asserts that
   * the URL stays on the requested route (i.e. the user really is logged in)
   * AND that an expected page-level marker is present.
   */
  requiresAuth?: boolean;
  /** Locator that must be visible to prove the page rendered (auth pages). */
  authMarker?: string;
};

const PAGES: PageTarget[] = [
  { name: 'homepage', path: '/' },
  { name: 'signup modal', path: '/?action=signup' },
  {
    name: 'dashboard',
    path: '/dashboard',
    requiresAuth: true,
    authMarker: '[data-testid="dashboard-page"], main',
  },
  {
    name: 'matches',
    path: '/matches',
    requiresAuth: true,
    authMarker: '[data-testid="matches-page"], main',
  },
  {
    name: 'messages',
    path: '/messages',
    requiresAuth: true,
    authMarker: '[data-testid="messages-page"], main',
  },
  // Footer renders on every page; pricing is a public page that scrolls all
  // the way to it without auth so the footer rules get exercised end-to-end.
  { name: 'footer (via /pricing)', path: '/pricing', scrollToFooter: true },
];

const MIN_BODY_FONT_PX = 14;
const MIN_TEXT_FONT_PX = 12;
const MIN_TAP_TARGET_PX = 44;

const STORAGE_STATE_PATH = process.env.PLAYWRIGHT_STORAGE_STATE;
const HAS_AUTH = !!STORAGE_STATE_PATH;

async function gotoAndSettle(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  // Give client-side hydration / redirects a moment to land.
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(250);
}

async function assertBodyFontSize(page: Page) {
  const fontPx = await page.evaluate(() => {
    const fs = window.getComputedStyle(document.body).fontSize;
    return parseFloat(fs);
  });
  expect(fontPx, 'body font-size').toBeGreaterThanOrEqual(MIN_BODY_FONT_PX);
}

async function assertNoTinyText(page: Page) {
  const offenders = await page.evaluate((minPx) => {
    const found: Array<{ tag: string; text: string; fontSize: number }> = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const text = (node.nodeValue ?? '').trim();
      if (!text) continue;
      const parent = node.parentElement;
      if (!parent) continue;
      const tag = parent.tagName.toLowerCase();
      if (['script', 'style', 'noscript', 'template'].includes(tag)) continue;
      const rect = parent.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      const styles = window.getComputedStyle(parent);
      if (styles.visibility === 'hidden' || styles.display === 'none') continue;
      const fontSize = parseFloat(styles.fontSize);
      if (Number.isFinite(fontSize) && fontSize < minPx) {
        found.push({ tag, text: text.slice(0, 40), fontSize });
      }
    }
    return found;
  }, MIN_TEXT_FONT_PX);

  expect(
    offenders,
    `text nodes rendered below ${MIN_TEXT_FONT_PX}px:\n` +
      offenders.map((o) => `  <${o.tag}> ${o.fontSize}px "${o.text}"`).join('\n'),
  ).toEqual([]);
}

async function assertTouchTargets(page: Page) {
  const offenders = await page.evaluate((minPx) => {
    const selector = [
      'button',
      '[role="button"]',
      'input[type="submit"]',
      'input[type="button"]',
      'input[type="reset"]',
      'input[type="checkbox"]',
      'input[type="radio"]',
      'select',
      'textarea',
      'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="range"]):not([type="color"]):not([type="file"])',
      'a[href]',
      '[role="link"]',
      '[role="menuitem"]',
      '[role="tab"]',
      '[role="switch"]',
      '[role="checkbox"]',
      '[role="radio"]',
    ].join(',');

    const found: Array<{
      tag: string;
      label: string;
      width: number;
      height: number;
    }> = [];

    const els = Array.from(document.querySelectorAll<HTMLElement>(selector));
    for (const el of els) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const styles = window.getComputedStyle(el);
      if (styles.visibility === 'hidden' || styles.display === 'none') continue;
      if (el.hasAttribute('disabled')) continue;
      if (el.getAttribute('aria-hidden') === 'true') continue;
      // Inline anchors inside paragraph text are exempt: they are read as
      // word-level links, not standalone tap targets, and meeting WCAG 2.5.8
      // for them is satisfied via line-height + spacing rather than 44x44.
      if (
        (el.tagName === 'A' || el.getAttribute('role') === 'link') &&
        styles.display === 'inline'
      ) {
        continue;
      }
      // Explicit opt-out for unusual decorative controls.
      if (el.dataset.allowSmallTouch === 'true') continue;

      if (rect.width < minPx || rect.height < minPx) {
        found.push({
          tag: el.tagName.toLowerCase(),
          label:
            el.getAttribute('aria-label') ||
            el.getAttribute('name') ||
            (el.textContent ?? '').trim().slice(0, 40),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        });
      }
    }
    return found;
  }, MIN_TAP_TARGET_PX);

  expect(
    offenders,
    `interactive controls smaller than ${MIN_TAP_TARGET_PX}x${MIN_TAP_TARGET_PX}px:\n` +
      offenders
        .map((o) => `  <${o.tag}> "${o.label}" ${o.width}x${o.height}`)
        .join('\n'),
  ).toEqual([]);
}

for (const viewport of VIEWPORTS) {
  test.describe(`viewport ${viewport.width}px - ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    for (const target of PAGES) {
      test(`${target.name} respects mobile typography & touch-target rules`, async ({
        page,
      }) => {
        if (target.requiresAuth && !HAS_AUTH) {
          if (process.env.CI) {
            throw new Error(
              `Authenticated mobile-layout coverage for "${target.name}" requires PLAYWRIGHT_STORAGE_STATE in CI. ` +
                'The CI workflow should boot the backend, seed the test user, and run global-setup to capture a logged-in state.',
            );
          }
          test.skip(
            true,
            `Set PLAYWRIGHT_STORAGE_STATE to a logged-in storage state file to run "${target.name}" coverage locally.`,
          );
          return;
        }

        await gotoAndSettle(page, target.path);

        if (target.requiresAuth) {
          // Verify the authenticated route actually rendered (no redirect to
          // /login or /sign-in slipping past us).
          const url = new URL(page.url());
          expect(
            url.pathname,
            `expected to land on ${target.path} but ended up at ${url.pathname}`,
          ).toBe(new URL(target.path, url.origin).pathname);

          if (target.authMarker) {
            await expect(page.locator(target.authMarker).first()).toBeVisible();
          }
        }

        if (target.scrollToFooter) {
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          await page.waitForTimeout(150);
          await expect(page.locator('footer').first()).toBeVisible();
        }

        await assertBodyFontSize(page);
        await assertNoTinyText(page);
        await assertTouchTargets(page);
      });
    }
  });
}
