'use strict';

/**
 * Seeds the playground with an admin user and sample documents for every
 * content type. Idempotent: safe to run repeatedly.
 *
 * Run with: npm run seed (from apps/playground or via the root workspace).
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { createStrapi, compileStrapi } = require('@strapi/strapi');

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@playground.local';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'Playground123!';

// 1x1 red PNG, used as a placeholder upload for media fields.
const PLACEHOLDER_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function ensureAdminUser(strapi) {
  const userService = strapi.service('admin::user');
  const existing = await userService.findOneByEmail(ADMIN_EMAIL);
  if (existing) {
    console.log(`Admin user ${ADMIN_EMAIL} already exists`);
    return existing;
  }
  const superAdminRole = await strapi.service('admin::role').getSuperAdmin();
  if (!superAdminRole) {
    throw new Error('Super admin role not found; has the app bootstrapped?');
  }
  const user = await userService.create({
    email: ADMIN_EMAIL,
    firstname: 'Playground',
    lastname: 'Admin',
    password: ADMIN_PASSWORD,
    isActive: true,
    roles: [superAdminRole.id],
  });
  console.log(`Created admin user ${ADMIN_EMAIL}`);
  return user;
}

async function ensureLocale(strapi, code, name) {
  const localesService = strapi.plugin('i18n').service('locales');
  const existing = await localesService.findByCode(code);
  if (existing) {
    return existing;
  }
  const created = await localesService.create({ code, name });
  console.log(`Created locale ${code}`);
  return created;
}

async function uploadPlaceholderImage(strapi, name) {
  const existing = await strapi.db
    .query('plugin::upload.file')
    .findOne({ where: { name } });
  if (existing) {
    return existing;
  }
  const tmpPath = path.join(os.tmpdir(), name);
  fs.writeFileSync(tmpPath, Buffer.from(PLACEHOLDER_PNG_BASE64, 'base64'));
  const stats = fs.statSync(tmpPath);
  const [file] = await strapi.plugin('upload').service('upload').upload({
    data: { fileInfo: { name, caption: 'Seed placeholder', alternativeText: 'Placeholder' } },
    files: {
      filepath: tmpPath,
      // `path` kept for compatibility with older formidable-style handling
      path: tmpPath,
      originalFilename: name,
      originalFileName: name,
      name,
      mimetype: 'image/png',
      type: 'image/png',
      size: stats.size,
    },
  });
  console.log(`Uploaded placeholder image ${name}`);
  return file;
}

async function seedContent(strapi) {
  const articles = strapi.documents('api::article.article');
  const existingArticles = await articles.findMany({ limit: 1 });
  if (existingArticles.length > 0) {
    console.log('Sample content already exists, skipping content seed');
    return;
  }

  let placeholder = null;
  try {
    placeholder = await uploadPlaceholderImage(strapi, 'seed-placeholder.png');
  } catch (err) {
    console.warn(`Could not upload placeholder image, media fields stay empty: ${err.message}`);
  }

  const authors = strapi.documents('api::author.author');
  const alice = await authors.create({
    data: {
      name: 'Alice Writer',
      email: 'alice@playground.local',
      bio: 'Writes most of the sample articles.',
      ...(placeholder ? { avatar: placeholder.id } : {}),
    },
  });
  const bob = await authors.create({
    data: {
      name: 'Bob Reporter',
      email: 'bob@playground.local',
      bio: 'Occasional contributor.',
    },
  });

  const categories = strapi.documents('api::category.category');
  const tech = await categories.create({ data: { name: 'Tech', slug: 'tech' } });
  const culture = await categories.create({ data: { name: 'Culture', slug: 'culture' } });
  const science = await categories.create({ data: { name: 'Science', slug: 'science' } });

  const blocks = (text) => [
    { type: 'paragraph', children: [{ type: 'text', text }] },
  ];

  const fullArticle = await articles.create({
    data: {
      title: 'The Complete Article',
      slug: 'the-complete-article',
      body: blocks('This article fills in every field type so the edit view can be tested end to end.'),
      legacyBody: 'Markdown **rich text** body.',
      wordCount: 1200,
      price: 19.99,
      rating: 4.5,
      viewCount: '9007199254740993',
      featured: true,
      publishDate: '2026-01-15',
      publishTime: '09:30:00.000',
      exactMoment: '2026-01-15T09:30:00.000Z',
      tone: 'technical',
      contactEmail: 'newsroom@playground.local',
      metadata: { source: 'seed', tags: ['fixture', 'complete'] },
      ...(placeholder ? { cover: placeholder.id, gallery: [placeholder.id] } : {}),
      author: { connect: [alice.documentId] },
      categories: { connect: [tech.documentId, science.documentId] },
      heroCategory: { connect: [tech.documentId] },
      contributors: { connect: [bob.documentId] },
      spotlightAuthor: { connect: [alice.documentId] },
      seo: {
        metaTitle: 'The Complete Article',
        metaDescription: 'A seeded article that exercises every field type.',
        ...(placeholder ? { shareImage: placeholder.id } : {}),
      },
      quotes: [
        { text: 'First seeded quote.', attribution: 'Alice Writer' },
        { text: 'Second seeded quote.', attribution: 'Bob Reporter' },
      ],
      sections: [
        { __component: 'shared.quote', text: 'A quote inside the dynamic zone.', attribution: 'Anonymous' },
        { __component: 'shared.link', label: 'Strapi docs', url: 'https://docs.strapi.io', newTab: true },
        ...(placeholder
          ? [{ __component: 'shared.media-block', file: placeholder.id, caption: 'Placeholder media' }]
          : []),
      ],
      locale: 'en',
    },
    status: 'published',
  });

  // Swedish localization of the same document (i18n coverage).
  await articles.update({
    documentId: fullArticle.documentId,
    locale: 'sv',
    data: {
      title: 'Den kompletta artikeln',
      body: blocks('Svensk version av exempelartikeln.'),
      legacyBody: 'Markdown **rik text** på svenska.',
    },
    status: 'published',
  });

  // A draft-only article (draft & publish coverage).
  await articles.create({
    data: {
      title: 'Draft in Progress',
      slug: 'draft-in-progress',
      body: blocks('This article exists only as a draft.'),
      wordCount: 150,
      featured: false,
      tone: 'casual',
      author: { connect: [bob.documentId] },
      categories: { connect: [culture.documentId] },
      locale: 'en',
    },
  });

  await strapi.documents('api::global-setting.global-setting').create({
    data: {
      siteName: 'Headless CM Playground',
      defaultSeo: {
        metaTitle: 'Playground',
        metaDescription: 'Playground app for the headless content manager plugin.',
      },
      footerLinks: [
        { label: 'GitHub', url: 'https://github.com', newTab: true },
        { label: 'Docs', url: 'https://docs.strapi.io', newTab: false },
      ],
    },
  });

  console.log('Sample content created');
}

async function main() {
  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();
  app.log.level = 'error';

  try {
    // Checkpoint assertion: the plugin must be registered and enabled.
    if (!app.plugin('breakout-kit')) {
      throw new Error('Plugin breakout-kit is not registered');
    }
    console.log('Plugin breakout-kit is registered');

    await ensureAdminUser(app);
    await ensureLocale(app, 'sv', 'Swedish (sv)');
    await seedContent(app);
    console.log('Seed complete');
    console.log(`Admin login: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  } finally {
    await app.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
