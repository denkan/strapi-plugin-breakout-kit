import type { Schema, Struct } from '@strapi/strapi';

export interface SharedLink extends Struct.ComponentSchema {
  collectionName: 'components_shared_links';
  info: {
    description: 'A labelled URL';
    displayName: 'Link';
    icon: 'link';
  };
  attributes: {
    label: Schema.Attribute.String & Schema.Attribute.Required;
    newTab: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    url: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface SharedMediaBlock extends Struct.ComponentSchema {
  collectionName: 'components_shared_media_blocks';
  info: {
    description: 'A media file with caption';
    displayName: 'Media block';
    icon: 'picture';
  };
  attributes: {
    caption: Schema.Attribute.String;
    file: Schema.Attribute.Media<'images' | 'videos' | 'files'>;
  };
}

export interface SharedQuote extends Struct.ComponentSchema {
  collectionName: 'components_shared_quotes';
  info: {
    description: 'A quote with attribution';
    displayName: 'Quote';
    icon: 'quote';
  };
  attributes: {
    attribution: Schema.Attribute.String;
    text: Schema.Attribute.Text & Schema.Attribute.Required;
  };
}

export interface SharedSeo extends Struct.ComponentSchema {
  collectionName: 'components_shared_seos';
  info: {
    description: 'Meta information for search and social sharing';
    displayName: 'SEO';
    icon: 'search';
  };
  attributes: {
    metaDescription: Schema.Attribute.Text;
    metaTitle: Schema.Attribute.String;
    shareImage: Schema.Attribute.Media<'images'>;
  };
}

export interface SharedWrapper extends Struct.ComponentSchema {
  collectionName: 'components_shared_wrappers';
  info: {
    description: 'A wrapper with nested dynamic zone';
    displayName: 'Wrapper';
    icon: 'blocks';
  };
  attributes: {
    backgroundColor: Schema.Attribute.String;
    content: Schema.Attribute.DynamicZone<
      ['shared.link', 'shared.media-block', 'shared.quote', 'shared.wrapper']
    >;
    textColor: Schema.Attribute.String;
  };
}

declare module '@strapi/strapi' {
  export namespace Public {
    export interface ComponentSchemas {
      'shared.link': SharedLink;
      'shared.media-block': SharedMediaBlock;
      'shared.quote': SharedQuote;
      'shared.seo': SharedSeo;
      'shared.wrapper': SharedWrapper;
    }
  }
}
