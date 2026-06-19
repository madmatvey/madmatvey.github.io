# frozen_string_literal: true

module Jekyll
  class SeoArchiveMeta < Generator
    safe true
    priority :lowest

    ARCHIVE_LAYOUTS = %w[tag category].freeze
    LISTING_LAYOUTS = %w[tags categories archives].freeze

    def generate(site)
      site.pages.each { |page| apply_page_meta(page) }

      site.collections.each_value do |collection|
        collection.docs.each { |doc| apply_page_meta(doc) }
      end
    end

    def apply_page_meta(page)
      apply_archive_meta(page)
      apply_pagination_meta(page)
      apply_listing_meta(page)
    end

    private

    def apply_archive_meta(page)
      layout = page.data['layout']
      return unless ARCHIVE_LAYOUTS.include?(layout)

      name = page.title.to_s.strip
      return if name.empty?

      page.data['description'] = if layout == 'tag'
                                   %(Articles tagged "#{name}" — engineering, leadership, and product notes by Eugene Leontev.)
                                 else
                                   %(Articles in category "#{name}" — engineering, leadership, and product notes by Eugene Leontev.)
                                 end
      page.data['sitemap'] = false
      page.data['noindex'] = true
    end

    def apply_pagination_meta(page)
      return unless page.url&.match?(%r{/page\d+/})

      page.data['sitemap'] = false
      page.data['noindex'] = true
    end

    def apply_listing_meta(page)
      layout = page.data['layout']
      return unless LISTING_LAYOUTS.include?(layout)

      page.data['sitemap'] = false
      page.data['noindex'] = true
    end
  end
end
